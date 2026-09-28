from datetime import datetime, timedelta

import jwt
from flask import g, request

from app.config import Config
from app.database.db import db
from app.models.audit import AuditLog
from app.models.user import User


def issue_token(user: User) -> str:
    payload = {
        # JWT "sub" is defined as a string identifier. PyJWT validates this
        # strictly, so an integer user ID produces a token that cannot be
        # authenticated on the next protected request.
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "exp": datetime.utcnow() + timedelta(hours=Config.JWT_EXPIRES_HOURS),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])


def current_user() -> User | None:
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        token = header[7:]
    else:
        token = request.args.get("token") or ""
    if not token:
        return None
    try:
        data = decode_token(token)
        return db.session.get(User, data.get("sub"))
    except Exception:
        return None


def require_auth(roles: tuple[str, ...] | None = None):
    def decorator(fn):
        from functools import wraps

        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = current_user()
            if not user:
                return {"error": "Authentication required"}, 401
            if roles and user.role not in roles:
                return {"error": "Insufficient permissions"}, 403
            g.user = user
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def audit(action: str, details: str = "") -> None:
    user = getattr(g, "user", None)
    db.session.add(
        AuditLog(
            user_id=user.id if user else None,
            username=user.username if user else None,
            action=action,
            details=details[:2000] if details else None,
        )
    )
    db.session.commit()
