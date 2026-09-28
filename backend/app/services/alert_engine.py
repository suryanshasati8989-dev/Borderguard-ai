from datetime import datetime

from app.database.db import db
from app.models.alert import Alert
from app.models.camera import Camera
from app.models.event import Event
from app.services import event_bus

SEVERITY_FOR_TYPE = {
    "PERSON_DETECTED": "LOW",
    "VEHICLE_DETECTED": "LOW",
    "INTRUSION_DETECTED": "HIGH",
    "LINE_CROSSING": "MEDIUM",
    "PLATE_DETECTED": "MEDIUM",
    "CAMERA_OFFLINE": "CRITICAL",
    "SYSTEM_ERROR": "HIGH",
}


def record_event(
    *,
    camera: Camera | None,
    event_type: str,
    object_type: str | None = None,
    tracking_id: str | None = None,
    confidence: float | None = None,
    severity: str | None = None,
    evidence_path: str | None = None,
    extra: dict | None = None,
    message: str | None = None,
) -> tuple[Event, Alert]:
    sev = severity or SEVERITY_FOR_TYPE.get(event_type, "MEDIUM")
    ev = Event(
        camera_id=camera.id if camera else None,
        event_type=event_type,
        object_type=object_type,
        tracking_id=tracking_id,
        confidence=confidence,
        timestamp=datetime.utcnow(),
        severity=sev,
        evidence_path=evidence_path,
        extra=extra or {},
        status="OPEN",
    )
    db.session.add(ev)
    db.session.flush()
    msg = message or _default_message(event_type, camera, object_type)
    alert = Alert(
        event_id=ev.id,
        camera_id=camera.id if camera else None,
        severity=sev,
        message=msg,
        status="OPEN",
        created_at=datetime.utcnow(),
    )
    db.session.add(alert)
    if camera:
        camera.detection_count = (camera.detection_count or 0) + 1
        camera.last_event_at = datetime.utcnow()
        camera.last_active_at = datetime.utcnow()
    db.session.commit()
    payload = {"event": ev.to_dict(), "alert": alert.to_dict()}
    event_bus.publish("detection", payload)
    event_bus.publish("alert", alert.to_dict())
    return ev, alert


def _default_message(event_type: str, camera, object_type) -> str:
    cam = camera.code if camera else "SYSTEM"
    obj = object_type or "object"
    labels = {
        "PERSON_DETECTED": f"Person detected on {cam} — verify before action.",
        "VEHICLE_DETECTED": f"Vehicle ({obj}) detected on {cam} — verify before action.",
        "INTRUSION_DETECTED": f"INTRUSION DETECTED on {cam}: {obj} entered a restricted zone. Human verification required.",
        "LINE_CROSSING": f"Virtual line crossed on {cam} by {obj}. Human verification required.",
        "PLATE_DETECTED": f"Plate candidate on {cam} (ANPR demo). Human verification required.",
        "CAMERA_OFFLINE": f"Camera {cam} is unavailable.",
        "SYSTEM_ERROR": "System error — operator review required.",
    }
    return labels.get(event_type, f"{event_type} on {cam}")
