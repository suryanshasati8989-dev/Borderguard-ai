from flask import Blueprint, request

from app.database.db import db
from app.models.camera import Camera
from app.models.zone import ZONE_TYPES, Zone
from app.services.auth_service import audit, require_auth

bp = Blueprint("zones", __name__)


@bp.get("/<int:camera_id>")
@require_auth()
def list_zones(camera_id):
    cam = db.session.get(Camera, camera_id)
    if not cam:
        return {"error": "Camera not found"}, 404
    rows = Zone.query.filter_by(camera_id=camera_id).all()
    return {"zones": [z.to_dict() for z in rows]}


@bp.get("")
@require_auth()
def list_all():
    camera_id = request.args.get("camera_id")
    q = Zone.query
    if camera_id:
        q = q.filter_by(camera_id=int(camera_id))
    return {"zones": [z.to_dict() for z in q.all()]}


@bp.post("")
@require_auth(roles=("Administrator",))
def create_zone():
    data = request.get_json(silent=True) or {}
    camera_id = data.get("camera_id")
    name = (data.get("name") or "").strip()
    zone_type = data.get("zone_type") or "restricted"
    coordinates = data.get("coordinates")
    if not camera_id or not name or not coordinates:
        return {"error": "camera_id, name, and coordinates are required"}, 400
    if zone_type not in ZONE_TYPES:
        return {"error": "zone_type must be restricted or line_crossing"}, 400
    if not db.session.get(Camera, camera_id):
        return {"error": "Camera not found"}, 404
    z = Zone(camera_id=camera_id, name=name, coordinates=coordinates, zone_type=zone_type, enabled=True)
    db.session.add(z)
    db.session.commit()
    audit("zone.create", f"{name} on camera {camera_id}")
    return {"zone": z.to_dict()}, 201


@bp.put("/item/<int:zone_id>")
@require_auth(roles=("Administrator",))
def update_zone(zone_id):
    z = db.session.get(Zone, zone_id)
    if not z:
        return {"error": "Zone not found"}, 404
    data = request.get_json(silent=True) or {}
    if "name" in data:
        z.name = data["name"].strip()
    if "coordinates" in data:
        z.coordinates = data["coordinates"]
    if "enabled" in data:
        z.enabled = bool(data["enabled"])
    if "zone_type" in data and data["zone_type"] in ZONE_TYPES:
        z.zone_type = data["zone_type"]
    db.session.commit()
    audit("zone.update", str(z.id))
    return {"zone": z.to_dict()}


@bp.delete("/item/<int:zone_id>")
@require_auth(roles=("Administrator",))
def delete_zone(zone_id):
    z = db.session.get(Zone, zone_id)
    if not z:
        return {"error": "Zone not found"}, 404
    db.session.delete(z)
    db.session.commit()
    audit("zone.delete", str(zone_id))
    return {"ok": True}
