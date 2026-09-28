"""Synthetic checkpoint scene + local, RTSP, and MJPEG frame sources."""

from __future__ import annotations

import math
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np


class FrameSource:
    def __init__(self, camera: dict, demo_dir: Path, ffmpeg: str):
        self.camera = camera
        self.demo_dir = Path(demo_dir)
        self.ffmpeg = ffmpeg
        self.cap = None
        self.proc = None
        self.w, self.h = 960, 540
        self.t0 = time.time()
        self.frame_i = 0
        self.mode = "unavailable"
        self._open()

    def _open(self):
        ctype = self.camera.get("camera_type")
        url = self.camera.get("stream_url") or ""
        
        if ctype == "mobile_browser":
            self.mode = "mobile_browser"
            return
            
        if ctype in ("ip_rtsp", "mobile_stream") and url:
            if self._open_network(url):
                return
            # RTSP phone apps can fall back to a local FFmpeg process when
            # OpenCV's bundled backend cannot negotiate the stream.
            if url.lower().startswith(("rtsp://", "rtsps://")):
                self._open_rtsp(url)
            return
        if url and Path(url).exists():
            self.cap = cv2.VideoCapture(url)
            if self.cap.isOpened():
                self.mode = "file"
                self.w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH) or self.w)
                self.h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or self.h)
                return
        files = sorted(self.demo_dir.glob("*.mp4"))
        idx = max(0, (self.camera.get("id") or 1) - 1) % max(len(files), 1) if files else 0
        if files:
            self.cap = cv2.VideoCapture(str(files[idx]))
            if self.cap.isOpened():
                self.mode = "file"
                self.w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH) or self.w)
                self.h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or self.h)
                return
        self.mode = "synthetic"

    def _open_network(self, url: str) -> bool:
        capture = cv2.VideoCapture(url)
        if not capture.isOpened():
            capture.release()
            return False
        self.cap = capture
        self.mode = "network"
        self.w = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or self.w)
        self.h = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or self.h)
        return True

    def _open_rtsp(self, url: str):
        cmd = [
            self.ffmpeg,
            "-rtsp_transport",
            "tcp",
            "-i",
            url,
            "-an",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-s",
            f"{self.w}x{self.h}",
            "-r",
            "10",
            "pipe:1",
        ]
        try:
            self.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            self.mode = "rtsp"
        except FileNotFoundError:
            self.mode = "unavailable"

    def read(self) -> np.ndarray | None:
        self.frame_i += 1
        if self.mode == "mobile_browser":
            from app.api.realtime import mobile_frames
            cam_id = self.camera.get("id")
            data = mobile_frames.get(cam_id)
            if data:
                # Need to clear it so we don't process same frame multiple times if phone drops
                mobile_frames[cam_id] = None
                np_arr = np.frombuffer(data, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                if frame is not None:
                    self.w, self.h = frame.shape[1], frame.shape[0]
                    return frame
            return None
            
        if self.mode == "file" and self.cap:
            ok, frame = self.cap.read()
            if not ok:
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ok, frame = self.cap.read()
            return frame if ok else self._synthetic()
        if self.mode == "network" and self.cap:
            ok, frame = self.cap.read()
            return frame if ok else None
        if self.mode == "rtsp" and self.proc and self.proc.stdout:
            nbytes = self.w * self.h * 3
            raw = self.proc.stdout.read(nbytes)
            if len(raw) != nbytes:
                return self._synthetic()
            return np.frombuffer(raw, dtype=np.uint8).reshape((self.h, self.w, 3)).copy()
        if self.mode == "synthetic":
            return self._synthetic()
        return None

    def simulated_objects(self) -> list[dict]:
        """Ground-truth-like moving boxes for labeled simulation / overlay when CV misses."""
        t = self.frame_i
        w, h = self.w, self.h
        px = int((0.12 + 0.55 * ((math.sin(t / 40.0) + 1) / 2)) * w)
        py = int((0.42 + 0.12 * math.sin(t / 18.0)) * h)
        pw, ph = int(0.06 * w), int(0.22 * h)
        vx = int((0.05 + 0.75 * ((t % 220) / 220.0)) * w)
        vy = int(0.62 * h)
        vw, vh = int(0.16 * w), int(0.12 * h)
        mx = int((0.7 - 0.4 * ((t % 160) / 160.0)) * w)
        my = int(0.58 * h)
        return [
            {"label": "person", "confidence": 0.91, "bbox": (px, py, px + pw, py + ph)},
            {"label": "car", "confidence": 0.88, "bbox": (vx, vy, vx + vw, vy + vh)},
            {"label": "motorcycle", "confidence": 0.84, "bbox": (mx, my, mx + int(0.08 * w), my + int(0.08 * h))},
        ]

    def _synthetic(self) -> np.ndarray:
        w, h = self.w, self.h
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        frame[:] = (28, 32, 26)
        # terrain / fence
        cv2.rectangle(frame, (0, int(h * 0.55)), (w, h), (42, 48, 38), -1)
        for x in range(0, w, 28):
            cv2.line(frame, (x, int(h * 0.18)), (x, int(h * 0.55)), (70, 78, 62), 2)
        cv2.line(frame, (0, int(h * 0.18)), (w, int(h * 0.18)), (90, 96, 80), 3)
        cv2.putText(frame, "BORDER CHECKPOINT — DEMO FEED", (18, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (180, 200, 160), 2)
        cv2.putText(frame, self.camera.get("code", "CAM"), (18, 58), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (140, 180, 220), 1)
        # restricted zone visual
        zx1, zy1, zx2, zy2 = int(w * 0.35), int(h * 0.28), int(w * 0.68), int(h * 0.52)
        overlay = frame.copy()
        cv2.rectangle(overlay, (zx1, zy1), (zx2, zy2), (40, 40, 180), -1)
        frame = cv2.addWeighted(overlay, 0.18, frame, 0.82, 0)
        cv2.rectangle(frame, (zx1, zy1), (zx2, zy2), (60, 60, 220), 2)
        cv2.putText(frame, "RESTRICTED ZONE", (zx1 + 8, zy1 + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 255), 1)
        # virtual line
        cv2.line(frame, (int(w * 0.15), int(h * 0.72)), (int(w * 0.88), int(h * 0.72)), (40, 200, 220), 2)
        cv2.putText(frame, "VIRTUAL LINE", (int(w * 0.16), int(h * 0.71)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (40, 200, 220), 1)
        for obj in self.simulated_objects():
            x1, y1, x2, y2 = obj["bbox"]
            color = (80, 220, 120) if obj["label"] == "person" else (80, 160, 230)
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, -1)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (20, 20, 20), 1)
        return frame

    def close(self):
        if self.cap:
            self.cap.release()
        if self.proc:
            self.proc.kill()
