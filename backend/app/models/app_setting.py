from app.database.db import db


class AppSetting(db.Model):
    __tablename__ = "app_settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(80), unique=True, nullable=False)
    value = db.Column(db.String(400), nullable=True)

    @staticmethod
    def get(key: str, default: str | None = None) -> str | None:
        row = AppSetting.query.filter_by(key=key).first()
        return row.value if row else default

    @staticmethod
    def set(key: str, value: str) -> None:
        row = AppSetting.query.filter_by(key=key).first()
        if not row:
            row = AppSetting(key=key, value=value)
            db.session.add(row)
        else:
            row.value = value
        db.session.commit()
