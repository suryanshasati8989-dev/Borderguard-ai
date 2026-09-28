from datetime import datetime

from app.database.db import db

ZONE_TYPES = ("restricted", "line_crossing")


class Zone(db.Model):
    __tablename__ = "zones"

    id = db.Column(db.Integer, primary_key=True)
    camera_id = db.Column(db.Integer, db.ForeignKey("cameras.id"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    coordinates = db.Column(db.JSON, nullable=False)
    zone_type = db.Column(db.String(32), nullable=False, default="restricted")
    enabled = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "camera_id": self.camera_id,
            "name": self.name,
            "coordinates": self.coordinates,
            "zone_type": self.zone_type,
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat() + "Z",
        }
