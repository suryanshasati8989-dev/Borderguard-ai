import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


class Config:
    SECRET_KEY = _env("SECRET_KEY", "dev-only-change-me")
    JWT_SECRET = _env("JWT_SECRET", "dev-only-jwt-change-me")
    JWT_EXPIRES_HOURS = int(_env("JWT_EXPIRES_HOURS", "12"))
    # Default: PostgreSQL. For local fallback: sqlite:///borderguard.db
    SQLALCHEMY_DATABASE_URI = _env(
        "DATABASE_URL",
        "postgresql+psycopg2://borderguard:borderguard@localhost:5432/borderguard",
    )
    BOOTSTRAP_ADMIN_USERNAME = _env("BOOTSTRAP_ADMIN_USERNAME", "admin")
    BOOTSTRAP_ADMIN_PASSWORD = _env("BOOTSTRAP_ADMIN_PASSWORD")
    BOOTSTRAP_OPERATOR_USERNAME = _env("BOOTSTRAP_OPERATOR_USERNAME", "operator")
    BOOTSTRAP_OPERATOR_PASSWORD = _env("BOOTSTRAP_OPERATOR_PASSWORD")
    DETECTION_MODE = _env("DETECTION_MODE", "auto")
    YOLO_MODEL_PATH = _env("YOLO_MODEL_PATH", "")
    YOLO_CONFIDENCE = float(_env("YOLO_CONFIDENCE", "0.45"))
    RETENTION_DAYS = int(_env("RETENTION_DAYS", "30"))
    EVIDENCE_DIR = Path(_env("EVIDENCE_DIR", str(PROJECT_ROOT / "demo" / "evidence")))
    DEMO_VIDEO_DIR = Path(_env("DEMO_VIDEO_DIR", str(PROJECT_ROOT / "demo" / "videos")))
    FFMPEG_PATH = _env("FFMPEG_PATH", "ffmpeg")
    HOST = _env("HOST", "0.0.0.0")
    PORT = int(_env("PORT", "5000"))
    CORS_ORIGINS = [o.strip() for o in _env("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
