"""Per-camera analytics workers: detect → track → rules → events → annotated MJPEG."""

from __future__ import annotations

import sys
import threading
import time
from collections import deque
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

from app.config import Config
from app.database.db import db
from app.models.app_setting import AppSetting
from app.models.camera import Camera
from app.models.zone import Zone
from app.services.alert_engine import record_event
from app.services import event_bus

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from ai_engine_loader import load_ai  # noqa: E402


class CameraWorker:
    def __init__(self, app, camera_id: int):
        self.app = app
        self.camera_id = camera_id
        self.alive = False
        self._stop = threading.Event()
        self._thread = None
        self.latest_jpeg = None
        self.latest_lock = threading.Lock()
        self.frame_index = 0
        self.detection_source = "UNKNOWN"
        self._cooldowns: dict[str, float] = {}

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name=f"cam-{self.camera_id}")
        self._thread.start()

    def stop(self):
        self._stop.set()
        self.alive = False

    def _cooldown_ok(self, key: str, seconds: float) -> bool:
        now = time.time()
        if now - self._cooldowns.get(key, 0) < seconds:
            return False
        self._cooldowns[key] = now
        return True

    def _run(self):
        detect, resolve_mode, CentroidTracker, evaluate_track, FrameSource, recognize_plate = load_ai()
        with self.app.app_context():
            cam = db.session.get(Camera, self.camera_id)
            if not cam:
                return
            source = FrameSource(
                {
                    "id": cam.id,
                    "code": cam.code,
                    "camera_type": cam.camera_type,
                    "stream_url": cam.stream_url,
                },
                Config.DEMO_VIDEO_DIR,
                Config.FFMPEG_PATH,
            )
            if source.mode == "unavailable":
                cam.status = "ERROR"
                db.session.commit()
                event_bus.publish("camera", cam.to_dict())
                return
            tracker = CentroidTracker()
            cam.status = "CONNECTING"
            db.session.commit()
            event_bus.publish("camera", cam.to_dict())

        self.alive = True
        Config.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

        idle_count = 0
        try:
            while not self._stop.is_set():
                frame = source.read()
                if frame is None:
                    idle_count += 1
                    if idle_count > 60:
                        from app.api.cameras import _placeholder_jpeg
                        with self.latest_lock:
                            self.latest_jpeg = _placeholder_jpeg("NO SIGNAL / RETRYING CONNECT...")
                        with self.app.app_context():
                            cam = db.session.get(Camera, self.camera_id)
                            if cam and cam.status != "STREAM_DISCONNECTED":
                                cam.status = "STREAM_DISCONNECTED"
                                db.session.commit()
                                event_bus.publish("camera", cam.to_dict())
                        tracker = CentroidTracker() # Wipe bounding boxes
                    time.sleep(0.05)
                    continue
                idle_count = 0
                self.frame_index += 1
                with self.app.app_context():
                    cam = db.session.get(Camera, self.camera_id)
                    if not cam or not cam.enabled:
                        break
                    mode = AppSetting.get("detection_mode", Config.DETECTION_MODE) or "auto"
                    resolved = resolve_mode(mode)
                    sim = source.simulated_objects() if hasattr(source, "simulated_objects") else []
                    # Prefer real CV; if auto/opencv yields nothing, overlay labeled simulation so demo always works.
                    dets, src_label = detect(frame, resolved, simulated=sim if resolved == "simulation" else None)
                    if not dets and resolved != "yolo":
                        dets, src_label = sim, "SIMULATION"
                    elif not dets and resolved == "yolo":
                        src_label = "YOLO"
                    dets = [d for d in dets if d.get("confidence", 0) >= 0.65]
                    self.detection_source = src_label
                    tracks = tracker.update(dets)
                    zones = [z.to_dict() for z in Zone.query.filter_by(camera_id=cam.id, enabled=True).all()]
                    h, w = frame.shape[:2]
                    annotated = frame.copy()
                    person_on_screen = False
                    _draw_zones(annotated, zones, w, h)

                    for tr in tracks:
                        if tr.hit_streak < 3:
                            continue
                        
                        person_on_screen = True if tr.label == "person" else person_on_screen
                        
                        x1, y1, x2, y2 = tr.bbox
                        color = (80, 220, 120) if tr.label == "person" else (70, 170, 240)
                        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                        conf_pct = int(round(tr.confidence * 100))
                        caption = f"{tr.label.upper()}  ID:{tr.track_id:02d}  {conf_pct}%"
                        cv2.putText(annotated, caption, (x1, max(18, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                        for i in range(1, len(tr.history)):
                            p1 = (int(tr.history[i - 1][0]), int(tr.history[i - 1][1]))
                            p2 = (int(tr.history[i][0]), int(tr.history[i][1]))
                            cv2.line(annotated, p1, p2, color, 1)

                        if self.frame_index % 12 == 0:
                            etype = "PERSON_DETECTED" if tr.label == "person" else "VEHICLE_DETECTED"
                            key = f"{etype}:{tr.track_id}"
                            if self._cooldown_ok(key, 8.0):
                                path = _save_still(annotated, cam.code, etype)
                                record_event(
                                    camera=cam,
                                    event_type=etype,
                                    object_type=tr.label,
                                    tracking_id=str(tr.track_id),
                                    confidence=tr.confidence,
                                    evidence_path=path,
                                    extra={"source": src_label, "human_verification": True},
                                )

                        hits = evaluate_track(tr, zones, w, h)
                        for hit in hits:
                            key = f"{hit['kind']}:{tr.track_id}:{hit['zone_id']}"
                            if self._cooldown_ok(key, 12.0):
                                path = _save_still(annotated, cam.code, hit["kind"])
                                record_event(
                                    camera=cam,
                                    event_type=hit["kind"],
                                    object_type=tr.label,
                                    tracking_id=str(tr.track_id),
                                    confidence=tr.confidence,
                                    severity=hit["severity"],
                                    evidence_path=path,
                                    extra={
                                        "zone_id": hit["zone_id"],
                                        "zone_name": hit.get("zone_name"),
                                        "source": src_label,
                                        "human_verification": True,
                                    },
                                )

                        if tr.label in ("car", "truck", "bus", "motorcycle") and self.frame_index % 40 == 0:
                            key = f"PLATE:{tr.track_id}"
                            if self._cooldown_ok(key, 20.0):
                                plate = recognize_plate(frame, tr.bbox, tr.track_id)
                                path = _save_still(annotated, cam.code, "PLATE")
                                record_event(
                                    camera=cam,
                                    event_type="PLATE_DETECTED",
                                    object_type=tr.label,
                                    tracking_id=str(tr.track_id),
                                    confidence=plate.get("confidence"),
                                    evidence_path=path,
                                    extra=plate,
                                    message=f"ANPR demo plate {plate.get('plate_text')} on {cam.code} ({plate.get('source')}). Verify manually.",
                                )

                    banner = f"BorderGuard AI  |  {cam.code}  |  {src_label}  |  VERIFY ALL ALERTS"
                    cv2.rectangle(annotated, (0, h - 28), (w, h), (12, 14, 18), -1)
                    cv2.putText(annotated, banner, (10, h - 9), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 210, 180), 1)

                    if person_on_screen:
                        # Draw a BELL SIGN on screen
                        # Flash based on time
                        if int(time.time() * 2) % 2 == 0:
                            cv2.rectangle(annotated, (20, 20), (320, 70), (0, 0, 255), -1)
                            cv2.putText(annotated, "[BELL] INTRUDER!", (35, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                        else:
                            cv2.rectangle(annotated, (20, 20), (320, 70), (0, 0, 180), 2)
                            cv2.putText(annotated, "[BELL] INTRUDER!", (35, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

                    ok, buf = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 72])
                    if ok:
                        with self.latest_lock:
                            self.latest_jpeg = buf.tobytes()
                    cam.status = "ONLINE"
                    cam.last_active_at = datetime.utcnow()
                    db.session.commit()
                time.sleep(0.07)
        except Exception as exc:
            with self.app.app_context():
                cam = db.session.get(Camera, self.camera_id)
                if cam:
                    cam.status = "ERROR"
                    db.session.commit()
                    record_event(camera=cam, event_type="SYSTEM_ERROR", extra={"error": str(exc)}, severity="HIGH")
        finally:
            self.alive = False
            source.close()
            with self.app.app_context():
                cam = db.session.get(Camera, self.camera_id)
                if cam and cam.status == "ONLINE":
                    cam.status = "OFFLINE"
                    db.session.commit()
                    event_bus.publish("camera", cam.to_dict())


def _draw_zones(frame, zones, w, h):
    for z in zones:
        coords = z.get("coordinates") or {}
        if z["zone_type"] == "restricted":
            pts = coords.get("points") or []
            if len(pts) >= 3:
                arr = np.array([[int(p["x"] * w), int(p["y"] * h)] for p in pts], np.int32)
                overlay = frame.copy()
                cv2.fillPoly(overlay, [arr], (40, 40, 180))
                cv2.addWeighted(overlay, 0.16, frame, 0.84, 0, frame)
                cv2.polylines(frame, [arr], True, (80, 80, 230), 2)
                cv2.putText(frame, z["name"], tuple(arr[0]), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 255), 1)
        elif z["zone_type"] == "line_crossing":
            line = coords.get("line") or coords
            if "x1" in line:
                p1 = (int(float(line["x1"]) * w), int(float(line["y1"]) * h))
                p2 = (int(float(line["x2"]) * w), int(float(line["y2"]) * h))
                cv2.line(frame, p1, p2, (40, 210, 220), 2)
                cv2.putText(frame, z["name"], p1, cv2.FONT_HERSHEY_SIMPLEX, 0.45, (40, 210, 220), 1)


def _save_still(frame, code: str, kind: str) -> str:
    name = f"{code}_{kind}_{int(time.time()*1000)}.jpg"
    path = Config.EVIDENCE_DIR / name
    cv2.imwrite(str(path), frame)
    return str(path.as_posix())


class AnalyticsRuntime:
    def __init__(self):
        self.app = None
        self.workers: dict[int, CameraWorker] = {}
        self.demo_running = False
        self._lock = threading.Lock()

    def init_app(self, app):
        self.app = app

    def start_demo(self) -> dict:
        with self._lock:
            self.demo_running = True
            with self.app.app_context():
                cams = Camera.query.filter_by(enabled=True).all()
                for cam in cams:
                    self._ensure_worker(cam.id)
            return {"demo_running": True, "workers": list(self.workers.keys())}

    def stop_all(self) -> dict:
        with self._lock:
            self.demo_running = False
            for w in list(self.workers.values()):
                w.stop()
            self.workers.clear()
            with self.app.app_context():
                for cam in Camera.query.all():
                    cam.status = "OFFLINE"
                db.session.commit()
            event_bus.publish("system", {"demo_running": False})
            return {"demo_running": False}

    def start_camera(self, camera_id: int):
        with self._lock:
            self._ensure_worker(camera_id)

    def stop_camera(self, camera_id: int):
        with self._lock:
            w = self.workers.pop(camera_id, None)
            if w:
                w.stop()

    def _ensure_worker(self, camera_id: int):
        w = self.workers.get(camera_id)
        if w and w.alive:
            return
        w = CameraWorker(self.app, camera_id)
        self.workers[camera_id] = w
        w.start()

    def jpeg_for(self, camera_id: int) -> bytes | None:
        w = self.workers.get(camera_id)
        if not w:
            return None
        with w.latest_lock:
            return w.latest_jpeg

    def source_label(self) -> str:
        for w in self.workers.values():
            if w.detection_source:
                return w.detection_source
        return "IDLE"


runtime = AnalyticsRuntime()
