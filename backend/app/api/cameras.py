from datetime import datetime

from flask import Blueprint, Response, request, stream_with_context

from app.database.db import db
from app.models.camera import CAMERA_STATUSES, CAMERA_TYPES, Camera
from app.services.auth_service import audit, require_auth
from app.services.analytics_runtime import runtime
from app.services import event_bus

bp = Blueprint("cameras", __name__)


def _validate_camera_payload(data, partial=False):
    errors = []
    if not partial or "name" in data:
        if not (data.get("name") or "").strip():
            errors.append("name is required")
    if "status" in data and data["status"] not in CAMERA_STATUSES:
        errors.append("invalid status")
    if "camera_type" in data and data["camera_type"] not in CAMERA_TYPES:
        errors.append("invalid camera_type")
    camera_type = data.get("camera_type")
    stream_url = (data.get("stream_url") or "").strip()
    if camera_type == "mobile_stream" and not stream_url and not partial:
        errors.append("a mobile RTSP or MJPEG stream URL is required")
    if stream_url and camera_type in ("ip_rtsp", "mobile_stream"):
        allowed = ("rtsp://", "rtsps://", "http://", "https://")
        if not stream_url.lower().startswith(allowed):
            errors.append("stream URL must start with rtsp://, rtsps://, http://, or https://")
    return errors


@bp.get("")
@require_auth()
def list_cameras():
    q = Camera.query
    status = request.args.get("status")
    search = (request.args.get("search") or "").strip()
    if status:
        q = q.filter(Camera.status == status.upper())
    if search:
        like = f"%{search}%"
        q = q.filter(db.or_(Camera.name.ilike(like), Camera.code.ilike(like), Camera.location.ilike(like)))
    cams = q.order_by(Camera.id.asc()).all()
    return {"cameras": [c.to_dict(include_stream=True) for c in cams]}


@bp.post("")
@require_auth(roles=("Administrator",))
def create_camera():
    data = request.get_json(silent=True) or {}
    errors = _validate_camera_payload(data)
    if errors:
        return {"error": "; ".join(errors)}, 400
    code = (data.get("code") or "").strip().upper() or _next_code()
    if Camera.query.filter_by(code=code).first():
        return {"error": "Camera ID already exists"}, 409
    cam = Camera(
        code=code,
        name=data["name"].strip(),
        location=(data.get("location") or "").strip(),
        stream_url=(data.get("stream_url") or "").strip() or None,
        status="OFFLINE",
        camera_type=data.get("camera_type") or "ip_rtsp",
        enabled=bool(data.get("enabled", True)),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.session.add(cam)
    db.session.commit()
    audit("camera.create", cam.code)
    return {"camera": cam.to_dict(include_stream=True)}, 201


@bp.put("/<int:camera_id>")
@require_auth(roles=("Administrator",))
def update_camera(camera_id):
    cam = db.session.get(Camera, camera_id)
    if not cam:
        return {"error": "Camera not found"}, 404
    data = request.get_json(silent=True) or {}
    errors = _validate_camera_payload(data, partial=True)
    if errors:
        return {"error": "; ".join(errors)}, 400
    if "name" in data:
        cam.name = data["name"].strip()
    if "location" in data:
        cam.location = (data.get("location") or "").strip()
    if "stream_url" in data:
        val = (data.get("stream_url") or "").strip()
        if val:
            cam.stream_url = val
    if "camera_type" in data:
        cam.camera_type = data["camera_type"]
    if "enabled" in data:
        cam.enabled = bool(data["enabled"])
        if not cam.enabled:
            runtime.stop_camera(cam.id)
            cam.status = "OFFLINE"
    if "code" in data and data["code"]:
        cam.code = data["code"].strip().upper()
    cam.updated_at = datetime.utcnow()
    db.session.commit()
    audit("camera.update", cam.code)
    event_bus.publish("camera", cam.to_dict())
    return {"camera": cam.to_dict(include_stream=True)}


@bp.delete("/<int:camera_id>")
@require_auth(roles=("Administrator",))
def delete_camera(camera_id):
    cam = db.session.get(Camera, camera_id)
    if not cam:
        return {"error": "Camera not found"}, 404
    runtime.stop_camera(cam.id)
    code = cam.code
    db.session.delete(cam)
    db.session.commit()
    audit("camera.delete", code)
    return {"ok": True}


@bp.post("/<int:camera_id>/test")
@require_auth()
def test_connection(camera_id):
    cam = db.session.get(Camera, camera_id)
    if not cam:
        return {"error": "Camera not found"}, 404
    if cam.camera_type == "demo_file":
        return {"ok": True, "message": "Demo file source is ready (no physical camera required)."}
    url = cam.stream_url or ""
    if not url:
        return {"ok": False, "message": "No stream URL is configured on the server."}, 400
    import shutil

    from app.config import Config

    ffmpeg = shutil.which(Config.FFMPEG_PATH) or shutil.which("ffmpeg")
    import subprocess

    if not ffmpeg:
        # OpenCV's packaged video backend can handle many RTSP and MJPEG phone
        # feeds, so a standalone FFmpeg executable is not a prerequisite.
        import cv2

        capture = cv2.VideoCapture(url)
        try:
            ok, _frame = capture.read() if capture.isOpened() else (False, None)
            return {
                "ok": ok,
                "message": "Mobile stream probe succeeded." if ok else "Stream probe failed. Check the phone app, URL, and shared Wi-Fi.",
            }
        finally:
            capture.release()

    try:
        proc = subprocess.run(
            [ffmpeg, "-rtsp_transport", "tcp", "-i", url, "-frames:v", "1", "-f", "null", "-"],
            capture_output=True,
            timeout=8,
        )
        ok = proc.returncode == 0
        return {"ok": ok, "message": "Stream probe succeeded." if ok else "Stream probe failed. Check the phone app, URL, and network."}
    except Exception:
        return {"ok": False, "message": "Stream probe timed out or failed. Check the phone app, URL, and network."}, 400


@bp.get("/<int:camera_id>/mjpeg")
@require_auth()
def mjpeg(camera_id):
    cam = db.session.get(Camera, camera_id)
    if not cam:
        return {"error": "Camera not found"}, 404

    def generate():
        boundary = b"--frame"
        idle = _placeholder_jpeg("NO SIGNAL")
        while True:
            jpeg = runtime.jpeg_for(camera_id) or idle
            yield boundary + b"\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
            import time

            time.sleep(0.08)

    return Response(stream_with_context(generate()), mimetype="multipart/x-mixed-replace; boundary=frame")


def _next_code() -> str:
    n = Camera.query.count() + 1
    return f"CAM-{n:02d}"


def _placeholder_jpeg(text: str) -> bytes:
    import cv2
    import numpy as np

    img = np.zeros((270, 480, 3), dtype=np.uint8)
    img[:] = (18, 20, 16)
    cv2.putText(img, text, (140, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (160, 170, 140), 2)
    ok, buf = cv2.imencode(".jpg", img)
    return buf.tobytes() if ok else b""
