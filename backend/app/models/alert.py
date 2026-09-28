from datetime import datetime

from app.database.db import db

ALERT_STATUSES = ("OPEN", "ACKNOWLEDGED", "RESOLVED")


class Alert(db.Model):
    __tablename__ = "alerts"

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("events.id"), nullable=True, index=True)
    camera_id = db.Column(db.Integer, db.ForeignKey("cameras.id"), nullable=True)
    severity = db.Column(db.String(16), nullable=False, default="MEDIUM")
    message = db.Column(db.String(400), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="OPEN", index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    acknowledged_at = db.Column(db.DateTime, nullable=True)
    acknowledged_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        ev = self.event
        return {
            "id": self.id,
            "event_id": self.event_id,
            "event_type": ev.event_type if ev else None,
            "camera_id": self.camera_id,
            "camera": ev.camera.code if ev and ev.camera else None,
            "object_type": ev.object_type if ev else None,
            "severity": self.severity,
            "message": self.message,
            "description": self.message,
            "status": self.status,
            "created_at": self.created_at.isoformat() + "Z",
            "timestamp": self.created_at.isoformat() + "Z",
            "resolved_at": self.resolved_at.isoformat() + "Z" if self.resolved_at else None,
            "acknowledged_at": self.acknowledged_at.isoformat() + "Z" if self.acknowledged_at else None,
            "evidence_path": ev.evidence_path if ev else None,
            "requires_human_verification": True,
        }
