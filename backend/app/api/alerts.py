from datetime import datetime

from flask import Blueprint, g, request

from app.database.db import db
from app.models.alert import ALERT_STATUSES, Alert
from app.services.auth_service import audit, require_auth
from app.services import event_bus

bp = Blueprint("alerts", __name__)


@bp.get("")
@require_auth()
def list_alerts():
    q = Alert.query
    status = request.args.get("status")
    if status:
        q = q.filter(Alert.status == status.upper())
    rows = q.order_by(Alert.created_at.desc()).limit(300).all()
    return {"alerts": [a.to_dict() for a in rows], "statuses": list(ALERT_STATUSES)}


@bp.put("/<int:alert_id>")
@require_auth()
def update_alert(alert_id):
    alert = db.session.get(Alert, alert_id)
    if not alert:
        return {"error": "Alert not found"}, 404
    data = request.get_json(silent=True) or {}
    status = (data.get("status") or "").upper()
    if status not in ALERT_STATUSES:
        return {"error": "status must be OPEN, ACKNOWLEDGED, or RESOLVED"}, 400
    alert.status = status
    if status == "ACKNOWLEDGED":
        alert.acknowledged_at = datetime.utcnow()
        alert.acknowledged_by = g.user.id
    if status == "RESOLVED":
        alert.resolved_at = datetime.utcnow()
        if alert.event:
            alert.event.status = "RESOLVED"
    db.session.commit()
    audit("alert.update", f"id={alert.id} status={status}")
    event_bus.publish("alert", alert.to_dict())
    return {"alert": alert.to_dict()}
