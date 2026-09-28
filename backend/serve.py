"""
BorderGuard AI — Production server (Windows)
Uses Waitress WSGI server instead of Flask dev server.
Run: python serve.py
"""
from waitress import serve
from app.main import app
from app.config import Config

if __name__ == "__main__":
    host = Config.HOST or "0.0.0.0"
    port = int(Config.PORT or 5000)
    print(f"\n{'='*50}")
    print(f"  BorderGuard AI — PRODUCTION SERVER")
    print(f"  http://{host if host != '0.0.0.0' else 'localhost'}:{port}")
    print(f"  Ctrl+C to stop")
    print(f"{'='*50}\n")
    serve(app, host=host, port=port, threads=8)
