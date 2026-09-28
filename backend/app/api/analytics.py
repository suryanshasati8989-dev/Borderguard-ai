from datetime import datetime, timedelta

from flask import Blueprint, request
from sqlalchemy import func

from app.database.db import db
from app.models.alert import Alert
from app.models.camera import Camera
from app.models.event import Event
from app.models.app_setting import AppSetting
from app.services.auth_service import audit, require_auth
from app.services.analytics_runtime import runtime

bp = Blueprint("analytics", __name__)


@bp.get("")
@require_auth()
def analytics():
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    cameras = Camera.query.all()
    events_today = Event.query.filter(Event.timestamp >= today).all()
    persons = sum(1 for e in events_today if e.event_type == "PERSON_DETECTED")
    vehicles = sum(1 for e in events_today if e.event_type == "VEHICLE_DETECTED")
    intrusions = sum(1 for e in events_today if e.event_type == "INTRUSION_DETECTED")
    active_alerts = Alert.query.filter(Alert.status == "OPEN").count()

    hours = []
    for h in range(24):
        start = today + timedelta(hours=h)
        end = start + timedelta(hours=1)
        c = Event.query.filter(Event.timestamp >= start, Event.timestamp < end).count()
        hours.append({"hour": f"{h:02d}:00", "count": c})

    days = []
    for i in range(6, -1, -1):
        d0 = today - timedelta(days=i)
        d1 = d0 + timedelta(days=1)
        days.append(
            {
                "day": d0.strftime("%a %d"),
                "count": Event.query.filter(Event.timestamp >= d0, Event.timestamp < d1).count(),
                "persons": Event.query.filter(Event.timestamp >= d0, Event.timestamp < d1, Event.event_type == "PERSON_DETECTED").count(),
                "vehicles": Event.query.filter(Event.timestamp >= d0, Event.timestamp < d1, Event.event_type == "VEHICLE_DETECTED").count(),
                "intrusions": Event.query.filter(Event.timestamp >= d0, Event.timestamp < d1, Event.event_type == "INTRUSION_DETECTED").count(),
            }
        )

    by_camera = []
    for cam in cameras:
        by_camera.append(
            {
                "camera": cam.code,
                "events": Event.query.filter_by(camera_id=cam.id).count(),
                "status": cam.status,
            }
        )

    uptime = [
        {
            "camera": c.code,
            "online": 1 if c.status == "ONLINE" else 0,
            "status": c.status,
        }
        for c in cameras
    ]

    return {
        "kpis": {
            "total_cameras": len(cameras),
            "online_cameras": sum(1 for c in cameras if c.status == "ONLINE"),
            "offline_cameras": sum(1 for c in cameras if c.status != "ONLINE"),
            "active_alerts": active_alerts,
            "events_today": len(events_today),
            "persons_detected": persons,
            "vehicles_detected": vehicles,
            "intrusions": intrusions,
        },
        "events_per_hour": hours,
        "events_per_day": days,
        "events_by_camera": by_camera,
        "camera_uptime": uptime,
        "demo_running": runtime.demo_running,
        "detection_source": runtime.source_label(),
        "detection_mode": AppSetting.get("detection_mode", "auto"),
        "disclaimer": "All detections are alerts for human verification. This is not an autonomous targeting system.",
    }


@bp.post("/start")
@require_auth()
def start_analytics():
    data = request.get_json(silent=True) or {}
    demo = data.get("demo", True)
    if demo:
        result = runtime.start_demo()
        audit("demo.start")
        return {"ok": True, "mode": "demo", **result}
    cam_id = data.get("camera_id")
    if cam_id:
        runtime.start_camera(int(cam_id))
        audit("analytics.start", f"camera={cam_id}")
        return {"ok": True, "camera_id": cam_id}
    result = runtime.start_demo()
    return {"ok": True, **result}


@bp.post("/stop")
@require_auth()
def stop_analytics():
    data = request.get_json(silent=True) or {}
    cam_id = data.get("camera_id")
    if cam_id:
        runtime.stop_camera(int(cam_id))
        return {"ok": True, "stopped": cam_id}
    result = runtime.stop_all()
    audit("demo.stop")
    return {"ok": True, **result}
