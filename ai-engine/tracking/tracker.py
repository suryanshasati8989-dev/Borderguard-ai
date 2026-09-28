"""Object tracking using centroid association with temporary IDs."""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class Track:
    track_id: int
    centroid: tuple[float, float]
    bbox: tuple[int, int, int, int]
    label: str
    confidence: float
    missing: int = 0
    hit_streak: int = 1
    history: list[tuple[float, float]] = field(default_factory=list)
    crossed: set[int] = field(default_factory=set)
    in_zones: set[int] = field(default_factory=set)


class CentroidTracker:
    def __init__(self, max_distance: float = 80.0, max_missing: int = 15):
        self.max_distance = max_distance
        self.max_missing = max_missing
        self.next_id = 1
        self.tracks: dict[int, Track] = {}

    def update(self, detections: list[dict]) -> list[Track]:
        if not detections:
            to_drop = []
            for tid, tr in self.tracks.items():
                tr.missing += 1
                if tr.missing > self.max_missing:
                    to_drop.append(tid)
            for tid in to_drop:
                self.tracks.pop(tid, None)
            return list(self.tracks.values())

        unused = set(self.tracks.keys())
        assigned_tracks: list[Track] = []

        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            best_id = None
            best_d = self.max_distance
            for tid in unused:
                tr = self.tracks[tid]
                if tr.label.split()[0] != det["label"].split()[0] and tr.label != det["label"]:
                    # keep person/vehicle families loosely matched
                    if not _same_family(tr.label, det["label"]):
                        continue
                d = math.hypot(tr.centroid[0] - cx, tr.centroid[1] - cy)
                if d < best_d:
                    best_d = d
                    best_id = tid
            if best_id is None:
                tr = Track(
                    track_id=self.next_id,
                    centroid=(cx, cy),
                    bbox=det["bbox"],
                    label=det["label"],
                    confidence=det["confidence"],
                    history=[(cx, cy)],
                )
                self.next_id += 1
                self.tracks[tr.track_id] = tr
                assigned_tracks.append(tr)
            else:
                unused.discard(best_id)
                tr = self.tracks[best_id]
                tr.centroid = (cx, cy)
                tr.bbox = det["bbox"]
                tr.label = det["label"]
                tr.confidence = det["confidence"]
                tr.missing = 0
                tr.hit_streak += 1
                tr.history.append((cx, cy))
                if len(tr.history) > 60:
                    tr.history = tr.history[-60:]
                assigned_tracks.append(tr)

        for tid in unused:
            self.tracks[tid].missing += 1
            self.tracks[tid].hit_streak = 0
            if self.tracks[tid].missing > self.max_missing:
                self.tracks.pop(tid, None)

        return list(self.tracks.values())


def _same_family(a: str, b: str) -> bool:
    vehicles = {"car", "motorcycle", "truck", "bus", "vehicle"}
    aa, bb = a.lower(), b.lower()
    if aa == "person" and bb == "person":
        return True
    return aa in vehicles and bb in vehicles
