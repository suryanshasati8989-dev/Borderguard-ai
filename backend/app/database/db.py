from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

from flask_sqlalchemy import SQLAlchemy


# Models throughout the application use the Flask-SQLAlchemy API (db.Model,
# db.session and db.Column), so the database module must own that extension.
db = SQLAlchemy()
Base = db.Model
engine = None
SessionLocal = None


def init_engine(database_url: str):
    """Legacy placeholder retained for import compatibility.

    Database configuration is supplied through Flask's SQLALCHEMY_DATABASE_URI
    and initialized by init_db(app).
    """
    return database_url


def init_db(app):
    db.init_app(app)
    with app.app_context():
        from app import models  # noqa: F401

        db.create_all()


def get_db() -> Generator:
    yield db.session


@contextmanager
def session_scope() -> Generator:
    try:
        yield db.session
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
