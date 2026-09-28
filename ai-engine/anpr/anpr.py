"""Authorized ANPR demonstration — OCR on vehicle crops from demo/test footage only."""

from __future__ import annotations

import logging
import re

import numpy as np

logger = logging.getLogger(__name__)

_ocr_ready = None


def recognize_plate(frame: np.ndarray, bbox: tuple[int, int, int, int], track_id: int) -> dict:
    """Return plate text. If OCR is unavailable, labeled simulation is used."""
    x1, y1, x2, y2 = bbox
    h = max(1, y2 - y1)
    crop_y1 = y1 + int(h * 0.55)
    crop = frame[crop_y1:y2, x1:x2]
    text, conf, source = _ocr(crop)
    if not text:
        text = _simulated_plate(track_id)
        conf = 0.42
        source = "SIMULATION"
    return {
        "plate_text": text,
        "confidence": conf,
        "source": source,
        "demo_only": True,
        "note": "ANPR demonstration on authorized test/demo footage. Requires human verification.",
    }


def _ocr(crop: np.ndarray) -> tuple[str | None, float, str]:
    global _ocr_ready
    if crop is None or crop.size == 0:
        return None, 0.0, "NONE"
    try:
        import cv2
        import pytesseract

        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        raw = pytesseract.image_to_string(th, config="--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        cleaned = re.sub(r"[^A-Z0-9]", "", raw.upper())
        if 4 <= len(cleaned) <= 10:
            return cleaned, 0.72, "OCR"
        return None, 0.0, "OCR"
    except Exception as exc:
        if _ocr_ready is not False:
            logger.info("Tesseract OCR unavailable (%s). ANPR uses labeled simulation.", exc)
        _ocr_ready = False
        return None, 0.0, "NONE"


def _simulated_plate(track_id: int) -> str:
    prefixes = ["BG", "IN", "MH", "DL", "RJ"]
    p = prefixes[track_id % len(prefixes)]
    return f"{p}{track_id:02d}AB{(track_id * 7) % 90 + 10}"
