from flask import Blueprint, request

from app.config import Config
from app.models.app_setting import AppSetting
from app.models.audit import AuditLog
from app.services.auth_service import audit, require_auth
from app.services.retention import purge_old_records

bp = Blueprint("settings", __name__)


@bp.get("")
@require_auth()
def get_settings():
    return {
        "retention_days": int(AppSetting.get("retention_days", str(Config.RETENTION_DAYS))),
        "detection_mode": AppSetting.get("detection_mode", Config.DETECTION_MODE),
        "disclaimer": "BorderGuard AI is a decision-support prototype. Operators must verify every alert. It does not classify people as threats and does not perform mass face identification.",
    }


@bp.put("")
@require_auth(roles=("Administrator",))
def update_settings():
    data = request.get_json(silent=True) or {}
    if "retention_days" in data:
        days = int(data["retention_days"])
        if days < 1 or days > 365:
            return {"error": "retention_days must be 1-365"}, 400
        AppSetting.set("retention_days", str(days))
    if "detection_mode" in data:
        mode = str(data["detection_mode"]).lower()
        if mode not in ("auto", "yolo", "opencv", "simulation"):
            return {"error": "invalid detection_mode"}, 400
        AppSetting.set("detection_mode", mode)
    audit("settings.update", json_dumps(data))
    return get_settings()


@bp.get("/audit")
@require_auth(roles=("Administrator",))
def audit_logs():
    rows = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(200).all()
    return {"logs": [r.to_dict() for r in rows]}


@bp.post("/retention/purge")
@require_auth(roles=("Administrator",))
def purge():
    n = purge_old_records()
    audit("retention.purge", f"removed={n}")
    return {"removed": n}


def json_dumps(data):
    import json

    return json.dumps(data)[:500]
