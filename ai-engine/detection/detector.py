"""YOLO / OpenCV / labeled simulation detectors."""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

VEHICLE_LABELS = {"car", "motorcycle", "truck", "bus", "vehicle"}
PERSON_LABELS = {"person"}

_yolo_model = None
_yolo_attempted = False
_hog = None


def resolve_mode(configured: str) -> str:
    mode = (configured or "auto").lower()
    if mode in ("simulation", "sim"):
        return "simulation"
    if mode == "yolo":
        return "yolo" if _load_yolo() else "simulation"
    if mode == "opencv":
        return "opencv"
    if _load_yolo():
        return "yolo"
    return "opencv"


def _load_yolo():
    global _yolo_model, _yolo_attempted
    if _yolo_attempted:
        return _yolo_model is not None
    _yolo_attempted = True
    try:
        from ultralytics import YOLO

        from app.config import Config

        path = Config.YOLO_MODEL_PATH or "yolov8n.pt"
        _yolo_model = YOLO(path)
        logger.info("YOLO model loaded: %s", path)
        return True
    except Exception as exc:
        logger.info("YOLO unavailable (%s). Falling back.", exc)
        _yolo_model = None
        return False


def detect(frame: np.ndarray, mode: str, simulated: list[dict] | None = None) -> tuple[list[dict], str]:
    """Return (detections, source_label). Detections are alerts for human review."""
    if mode == "simulation":
        return list(simulated or []), "SIMULATION"
    if mode == "yolo":
        dets = _detect_yolo(frame)
        return dets, "YOLO"
    dets = _detect_hog(frame)
    if dets:
        return dets, "OPENCV_HOG"
    if simulated:
        return list(simulated), "SIMULATION"
    return [], "OPENCV_HOG"


def _detect_yolo(frame: np.ndarray) -> list[dict]:
    if _yolo_model is None:
        return []
    from app.config import Config

    names_keep = PERSON_LABELS | VEHICLE_LABELS
    results = _yolo_model.predict(frame, verbose=False, conf=Config.YOLO_CONFIDENCE)
    out = []
    for r in results:
        if r.boxes is None:
            continue
        for box in r.boxes:
            cls_id = int(box.cls[0])
            name = r.names.get(cls_id, str(cls_id)).lower()
            if name not in names_keep:
                continue
            xyxy = box.xyxy[0].tolist()
            out.append(
                {
                    "label": "person" if name == "person" else name,
                    "confidence": float(box.conf[0]),
                    "bbox": (int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])),
                }
            )
    return out


def _detect_hog(frame: np.ndarray) -> list[dict]:
    global _hog
    import cv2

    # Some current OpenCV builds omit the legacy HOG API. Returning no HOG
    # detections lets the caller use its explicitly labeled simulation fallback
    # instead of terminating the entire camera worker.
    if not hasattr(cv2, "HOGDescriptor"):
        return []
    if _hog is None:
        _hog = cv2.HOGDescriptor()
        _hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
    rects, weights = _hog.detectMultiScale(gray, winStride=(8, 8), padding=(8, 8), scale=1.05)
    dets = []
    for (x, y, w, h), wt in zip(rects, weights):
        conf = float(min(0.99, max(0.45, wt[0] if hasattr(wt, "__len__") else wt)))
        dets.append({"label": "person", "confidence": conf, "bbox": (int(x), int(y), int(x + w), int(y + h))})
    return dets
