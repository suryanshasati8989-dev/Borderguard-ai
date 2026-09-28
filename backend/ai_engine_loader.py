"""Loads ai-engine modules regardless of folder hyphen."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load(name: str, rel: str):
    path = ROOT / rel
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    # Dataclasses resolve postponed annotations through sys.modules while the
    # module body is executing. Register dynamically loaded pipeline modules
    # before exec_module so tracker loading is reliable on Python 3.12+.
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def load_ai():
    det = _load("bg_det", "ai-engine/detection/detector.py")
    trk = _load("bg_trk", "ai-engine/tracking/tracker.py")
    rules = _load("bg_rules", "ai-engine/processing/rules.py")
    frames = _load("bg_frames", "ai-engine/processing/frames.py")
    anpr = _load("bg_anpr", "ai-engine/anpr/anpr.py")
    return (
        det.detect,
        det.resolve_mode,
        trk.CentroidTracker,
        rules.evaluate_track,
        frames.FrameSource,
        anpr.recognize_plate,
    )
