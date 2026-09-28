"""Rule engine: restricted-zone intrusion and virtual line crossing."""

from __future__ import annotations


def point_in_polygon(x: float, y: float, points: list[dict]) -> bool:
    if not points or len(points) < 3:
        return False
    inside = False
    j = len(points) - 1
    for i, p in enumerate(points):
        xi, yi = float(p["x"]), float(p["y"])
        xj, yj = float(points[j]["x"]), float(points[j]["y"])
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside


def segments_intersect(a1, a2, b1, b2) -> bool:
    def orient(p, q, r):
        return (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])

    def on_seg(p, q, r):
        return min(p[0], r[0]) <= q[0] <= max(p[0], r[0]) and min(p[1], r[1]) <= q[1] <= max(p[1], r[1])

    o1 = orient(a1, a2, b1)
    o2 = orient(a1, a2, b2)
    o3 = orient(b1, b2, a1)
    o4 = orient(b1, b2, a2)
    if o1 * o2 < 0 and o3 * o4 < 0:
        return True
    if o1 == 0 and on_seg(a1, b1, a2):
        return True
    if o2 == 0 and on_seg(a1, b2, a2):
        return True
    if o3 == 0 and on_seg(b1, a1, b2):
        return True
    if o4 == 0 and on_seg(b1, a2, b2):
        return True
    return False


def evaluate_track(track, zones: list[dict], frame_w: int, frame_h: int) -> list[dict]:
    """zones items: {id, zone_type, coordinates, name} with normalized coords 0-1."""
    hits = []
    cx, cy = track.centroid
    nx, ny = cx / max(frame_w, 1), cy / max(frame_h, 1)

    for zone in zones:
        zid = zone["id"]
        coords = zone.get("coordinates") or {}
        ztype = zone.get("zone_type")
        if ztype == "restricted":
            points = coords.get("points") or []
            inside = point_in_polygon(nx, ny, points)
            was_inside = zid in track.in_zones
            if inside:
                track.in_zones.add(zid)
                if not was_inside:
                    hits.append(
                        {
                            "kind": "INTRUSION_DETECTED",
                            "zone_id": zid,
                            "zone_name": zone.get("name"),
                            "severity": "HIGH",
                        }
                    )
            else:
                track.in_zones.discard(zid)
        elif ztype == "line_crossing":
            line = coords.get("line") or coords
            if "x1" not in line:
                continue
            a1 = (float(line["x1"]) * frame_w, float(line["y1"]) * frame_h)
            a2 = (float(line["x2"]) * frame_w, float(line["y2"]) * frame_h)
            if len(track.history) < 2:
                continue
            b1 = track.history[-2]
            b2 = track.history[-1]
            if zid not in track.crossed and segments_intersect(a1, a2, b1, b2):
                track.crossed.add(zid)
                hits.append(
                    {
                        "kind": "LINE_CROSSING",
                        "zone_id": zid,
                        "zone_name": zone.get("name"),
                        "severity": "MEDIUM",
                    }
                )
    return hits
