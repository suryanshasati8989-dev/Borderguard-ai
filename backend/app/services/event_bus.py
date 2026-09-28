"""In-process pub/sub for Server-Sent Events."""

from __future__ import annotations

import json
import queue
import threading
from typing import Any

_lock = threading.Lock()
_subs: list[queue.Queue] = []


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=200)
    with _lock:
        _subs.append(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    with _lock:
        if q in _subs:
            _subs.remove(q)


def publish(event_name: str, payload: dict[str, Any]) -> None:
    packet = {"event": event_name, "data": payload}
    dead = []
    with _lock:
        targets = list(_subs)
    for q in targets:
        try:
            q.put_nowait(packet)
        except queue.Full:
            dead.append(q)
    for q in dead:
        unsubscribe(q)


def format_sse(packet: dict) -> str:
    return f"event: {packet['event']}\ndata: {json.dumps(packet['data'])}\n\n"
