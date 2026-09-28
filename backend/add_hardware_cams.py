from app.main import create_app
from app.database.db import db
from app.models.camera import Camera

app = create_app()
with app.app_context():
    laptop = Camera.query.filter_by(code="CAM-LAPTOP").first()
    if not laptop:
        db.session.add(Camera(code="CAM-LAPTOP", name="Laptop Webcam", location="HQ Command", camera_type="mobile_browser", status="OFFLINE", enabled=True))
    mobile = Camera.query.filter_by(code="CAM-MOBILE").first()
    if not mobile:
        db.session.add(Camera(code="CAM-MOBILE", name="Field Operative", location="Mobile Patrol", camera_type="mobile_browser", status="OFFLINE", enabled=True))
    db.session.commit()
    print("Added hardware cameras")
