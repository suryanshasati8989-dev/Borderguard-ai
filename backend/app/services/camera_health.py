"""Camera health polling — CAMERA_OFFLINE events when a stream fails."""

from __future__ import annotations

import threading
import time
from datetime import datetime

from app.database.db import db
from app.models.camera import Camera
from app.services.alert_engine import record_event
from app.services import event_bus


class HealthMonitor:
    def __init__(self, app):
        self.app = app
        self._stop = threading.Event()
        self._thread = None

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="camera-health")
        self._thread.start()

    def stop(self):
        self._stop.set()

    def _run(self):
        while not self._stop.is_set():
            with self.app.app_context():
                self._tick()
            self._stop.wait(8)

    def _tick(self):
        from app.services.analytics_runtime import runtime

        now = datetime.utcnow()
        for cam in Camera.query.all():
            if not cam.enabled:
                if cam.status != "OFFLINE":
                    cam.status = "OFFLINE"
                    db.session.commit()
                    event_bus.publish("camera", cam.to_dict())
                continue
            worker = runtime.workers.get(cam.id)
            live = worker and worker.alive
            if live:
                if cam.status != "ONLINE":
                    cam.status = "ONLINE"
                    cam.last_active_at = now
                    db.session.commit()
                    event_bus.publish("camera", cam.to_dict())
            else:
                if cam.camera_type == "ip_rtsp" and cam.status != "OFFLINE":
                    cam.status = "OFFLINE"
                    db.session.commit()
                    record_event(
                        camera=cam,
                        event_type="CAMERA_OFFLINE",
                        severity="CRITICAL",
                        extra={"reason": "stream_unavailable"},
                    )
                    event_bus.publish("camera", cam.to_dict())
                elif cam.camera_type == "demo_file" and not runtime.demo_running:
                    if cam.status != "OFFLINE":
                        cam.status = "OFFLINE"
                        db.session.commit()
                        event_bus.publish("camera", cam.to_dict())
