from datetime import datetime

from app.database.db import db

EVENT_TYPES = (
    "PERSON_DETECTED",
    "VEHICLE_DETECTED",
    "INTRUSION_DETECTED",
    "LINE_CROSSING",
    "PLATE_DETECTED",
    "CAMERA_OFFLINE",
    "SYSTEM_ERROR",
)
SEVERITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")


class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)
    camera_id = db.Column(db.Integer, db.ForeignKey("cameras.id"), nullable=True, index=True)
    event_type = db.Column(db.String(40), nullable=False, index=True)
    object_type = db.Column(db.String(40), nullable=True)
    tracking_id = db.Column(db.String(40), nullable=True)
    confidence = db.Column(db.Float, nullable=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    severity = db.Column(db.String(16), nullable=False, default="MEDIUM")
    evidence_path = db.Column(db.String(400), nullable=True)
    extra = db.Column(db.JSON, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="OPEN")

    alerts = db.relationship("Alert", backref="event", lazy="dynamic")

    def to_dict(self):
        cam = self.camera
        return {
            "id": self.id,
            "event_id": f"EVT-{self.id:06d}",
            "camera_id": self.camera_id,
            "camera": cam.code if cam else None,
            "camera_name": cam.name if cam else None,
            "event_type": self.event_type,
            "object_type": self.object_type,
            "tracking_id": self.tracking_id,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat() + "Z",
            "severity": self.severity,
            "evidence_path": self.evidence_path,
            "extra": self.extra or {},
            "status": self.status,
        }
