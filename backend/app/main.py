import sys
from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import Config
from app.database.db import db, init_db
from app.api.auth import bp as auth_bp
from app.api.cameras import bp as cameras_bp
from app.api.events import bp as events_bp
from app.api.alerts import bp as alerts_bp
from app.api.analytics import bp as analytics_bp
from app.api.zones import bp as zones_bp
from app.api.realtime import bp as realtime_bp
from app.api.settings import bp as settings_bp
from app.services.analytics_runtime import runtime
from app.services.camera_health import HealthMonitor
from app.services.seed import seed_if_needed
from app.services.retention import purge_old_records


FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


def create_app():
    app = Flask(
        __name__,
        static_folder=str(FRONTEND_DIST) if FRONTEND_DIST.exists() else None,
        static_url_path="",
    )
    app.config.from_object(Config)
    CORS(app, origins=Config.CORS_ORIGINS, supports_credentials=True)
    init_db(app)

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(cameras_bp, url_prefix="/api/cameras")
    app.register_blueprint(events_bp, url_prefix="/api/events")
    app.register_blueprint(alerts_bp, url_prefix="/api/alerts")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(zones_bp, url_prefix="/api/zones")
    app.register_blueprint(realtime_bp, url_prefix="/api/stream")
    app.register_blueprint(settings_bp, url_prefix="/api/settings")

    Config.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    Config.DEMO_VIDEO_DIR.mkdir(parents=True, exist_ok=True)

    @app.get("/api/health")
    def health():
        return {"ok": True, "name": "BorderGuard AI"}

    @app.get("/api/evidence/<path:filename>")
    def evidence_file(filename):
        return send_from_directory(Config.EVIDENCE_DIR, filename)

    # Serve React SPA for all non-API routes
    if FRONTEND_DIST.exists():
        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_spa(path):
            target = FRONTEND_DIST / path
            if path and target.exists():
                return send_from_directory(str(FRONTEND_DIST), path)
            return send_from_directory(str(FRONTEND_DIST), "index.html")

    with app.app_context():
        seed_if_needed()
        purge_old_records()

    runtime.init_app(app)
    HealthMonitor(app).start()
    return app


app = create_app()


if __name__ == "__main__":
    app.run(host=Config.HOST, port=Config.PORT, debug=True, threaded=True)
