from datetime import datetime

from app.database.db import db

CAMERA_STATUSES = ("ONLINE", "OFFLINE", "CONNECTING", "ERROR", "STREAM_DISCONNECTED")
CAMERA_TYPES = ("demo_file", "ip_rtsp", "mobile_stream", "mobile_browser")


class Camera(db.Model):
    __tablename__ = "cameras"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(32), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    location = db.Column(db.String(200), nullable=False, default="")
    stream_url = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="OFFLINE")
    camera_type = db.Column(db.String(32), nullable=False, default="demo_file")
    enabled = db.Column(db.Boolean, nullable=False, default=True)
    detection_count = db.Column(db.Integer, nullable=False, default=0)
    last_event_at = db.Column(db.DateTime, nullable=True)
    last_active_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    events = db.relationship("Event", backref="camera", lazy="dynamic")
    zones = db.relationship("Zone", backref="camera", lazy="dynamic", cascade="all, delete-orphan")

    def to_dict(self, include_stream=False):
        data = {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "location": self.location,
            "status": self.status,
            "camera_type": self.camera_type,
            "enabled": self.enabled,
            "detection_count": self.detection_count,
            "last_event_at": self.last_event_at.isoformat() + "Z" if self.last_event_at else None,
            "last_active_at": self.last_active_at.isoformat() + "Z" if self.last_active_at else None,
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z",
            "stream_configured": bool(self.stream_url),
        }
        if include_stream:
            data["stream_url_redacted"] = redact_stream_url(self.stream_url)
        return data


def redact_stream_url(url: str | None) -> str | None:
    if not url:
        return None
    if "://" not in url:
        return url
    try:
        scheme, rest = url.split("://", 1)
        if "@" in rest and ":" in rest.split("@", 1)[0]:
            creds, host = rest.split("@", 1)
            return f"{scheme}://***:***@{host}"
        return url
    except Exception:
        return "[redacted]"
