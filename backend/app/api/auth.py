from flask import Blueprint, request

from app.database.db import db
from app.models.user import User
from app.services.auth_service import audit, issue_token, require_auth
from app.services.auth_service import current_user

bp = Blueprint("auth", __name__)


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return {"error": "Username and password are required"}, 400
    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return {"error": "Invalid credentials"}, 401
    token = issue_token(user)
    from flask import g

    g.user = user
    audit("login", f"user={username}")
    return {"token": token, "user": user.to_dict()}


@bp.post("/logout")
@require_auth()
def logout():
    audit("logout")
    return {"ok": True}


@bp.get("/me")
@require_auth()
def me():
    return {"user": current_user().to_dict()}
