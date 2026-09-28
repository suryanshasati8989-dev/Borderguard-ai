from datetime import datetime

from app.config import Config
from app.database.db import db
from app.models.app_setting import AppSetting
from app.models.camera import Camera
from app.models.user import User
from app.models.zone import Zone


DEMO_CAMERAS = [
    ("CAM-01", "North Fence", "Perimeter / North sector"),
    ("CAM-02", "East Approach", "Access road east"),
    ("CAM-03", "Main Gate", "Primary checkpoint"),
    ("CAM-04", "Watchtower", "Elevated overwatch"),
    ("CAM-05", "River Bend", "Waterline sector"),
    ("CAM-06", "South Post", "Secondary post"),
]


def seed_if_needed():
    if not Config.BOOTSTRAP_ADMIN_PASSWORD or not Config.BOOTSTRAP_OPERATOR_PASSWORD:
        raise RuntimeError(
            "Set BOOTSTRAP_ADMIN_PASSWORD and BOOTSTRAP_OPERATOR_PASSWORD in backend/.env "
            "(copy from .env.example). Passwords are not hardcoded in source."
        )

    if not User.query.filter_by(username=Config.BOOTSTRAP_ADMIN_USERNAME).first():
        admin = User(username=Config.BOOTSTRAP_ADMIN_USERNAME, role="Administrator", created_at=datetime.utcnow())
        admin.set_password(Config.BOOTSTRAP_ADMIN_PASSWORD)
        db.session.add(admin)

    if not User.query.filter_by(username=Config.BOOTSTRAP_OPERATOR_USERNAME).first():
        op = User(username=Config.BOOTSTRAP_OPERATOR_USERNAME, role="Operator", created_at=datetime.utcnow())
        op.set_password(Config.BOOTSTRAP_OPERATOR_PASSWORD)
        db.session.add(op)

    if Camera.query.count() == 0:
        for code, name, loc in DEMO_CAMERAS:
            db.session.add(
                Camera(
                    code=code,
                    name=name,
                    location=loc,
                    stream_url=None,
                    status="OFFLINE",
                    camera_type="demo_file",
                    enabled=True,
                )
            )
        db.session.flush()
        gate = Camera.query.filter_by(code="CAM-03").first()
        if gate:
            db.session.add(
                Zone(
                    camera_id=gate.id,
                    name="RESTRICTED ZONE",
                    zone_type="restricted",
                    coordinates={
                        "points": [
                            {"x": 0.35, "y": 0.28},
                            {"x": 0.68, "y": 0.28},
                            {"x": 0.68, "y": 0.52},
                            {"x": 0.35, "y": 0.52},
                        ]
                    },
                )
            )
            db.session.add(
                Zone(
                    camera_id=gate.id,
                    name="VIRTUAL LINE",
                    zone_type="line_crossing",
                    coordinates={"line": {"x1": 0.15, "y1": 0.72, "x2": 0.88, "y2": 0.72}},
                )
            )
        # Same default geometry on all demo cameras so intrusion/line demos work everywhere
        for cam in Camera.query.all():
            if cam.code == "CAM-03":
                continue
            db.session.add(
                Zone(
                    camera_id=cam.id,
                    name="RESTRICTED ZONE",
                    zone_type="restricted",
                    coordinates={
                        "points": [
                            {"x": 0.35, "y": 0.28},
                            {"x": 0.68, "y": 0.28},
                            {"x": 0.68, "y": 0.52},
                            {"x": 0.35, "y": 0.52},
                        ]
                    },
                )
            )
            db.session.add(
                Zone(
                    camera_id=cam.id,
                    name="VIRTUAL LINE",
                    zone_type="line_crossing",
                    coordinates={"line": {"x1": 0.15, "y1": 0.72, "x2": 0.88, "y2": 0.72}},
                )
            )

    if not AppSetting.get("detection_mode"):
        db.session.add(AppSetting(key="detection_mode", value=Config.DETECTION_MODE))
    if not AppSetting.get("retention_days"):
        db.session.add(AppSetting(key="retention_days", value=str(Config.RETENTION_DAYS)))

    db.session.commit()
