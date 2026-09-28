import json
import queue

from flask import Blueprint, Response, stream_with_context

from app.services.auth_service import require_auth
from app.services import event_bus

bp = Blueprint("realtime", __name__)


@bp.get("/events")
@require_auth()
def sse():
    q = event_bus.subscribe()

    def generate():
        yield "event: ready\ndata: {\"ok\": true}\n\n"
        try:
            while True:
                try:
                    packet = q.get(timeout=15)
                    yield event_bus.format_sse(packet)
                except queue.Empty:
                    yield ": keepalive\n\n"
        finally:
            event_bus.unsubscribe(q)

    return Response(stream_with_context(generate()), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

mobile_frames = {}

from flask import request

@bp.post("/mobile_frame/<int:camera_id>")
def push_mobile_frame(camera_id):
    # Receives JPEG bytes directly or via multipart
    data = request.get_data()
    if data:
        mobile_frames[camera_id] = data
    return {"ok": True}
