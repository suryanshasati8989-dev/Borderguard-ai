from datetime import datetime, timedelta

from flask import Blueprint, request, send_file
from pathlib import Path

from app.database.db import db
from app.models.camera import Camera
from app.models.event import EVENT_TYPES, SEVERITIES, Event
from app.services.auth_service import require_auth

bp = Blueprint("events", __name__)


@bp.get("")
@require_auth()
def list_events():
    q = Event.query
    camera = request.args.get("camera")
    event_type = request.args.get("event_type")
    severity = request.args.get("severity")
    object_type = request.args.get("object_type")
    date = request.args.get("date")
    if camera:
        q = q.join(Camera, Event.camera_id == Camera.id).filter(Camera.code == camera)
    if event_type:
        q = q.filter(Event.event_type == event_type)
    if severity:
        q = q.filter(Event.severity == severity)
    if object_type:
        q = q.filter(Event.object_type == object_type)
    if date:
        try:
            start = datetime.strptime(date, "%Y-%m-%d")
            q = q.filter(Event.timestamp >= start, Event.timestamp < start + timedelta(days=1))
        except ValueError:
            pass
    rows = q.order_by(Event.timestamp.desc()).limit(500).all()
    return {
        "events": [e.to_dict() for e in rows],
        "filters": {"event_types": list(EVENT_TYPES), "severities": list(SEVERITIES)},
    }


@bp.get("/<int:event_id>")
@require_auth()
def get_event(event_id):
    ev = db.session.get(Event, event_id)
    if not ev:
        return {"error": "Event not found"}, 404
    return {"event": ev.to_dict()}


@bp.get("/<int:event_id>/evidence")
@require_auth()
def evidence(event_id):
    ev = db.session.get(Event, event_id)
    if not ev or not ev.evidence_path:
        return {"error": "No evidence"}, 404
    p = Path(ev.evidence_path)
    if not p.exists():
        return {"error": "Evidence file missing"}, 404
    return send_file(p, mimetype="image/jpeg")
