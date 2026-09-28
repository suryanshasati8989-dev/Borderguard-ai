from datetime import datetime, timedelta

from app.config import Config
from app.database.db import db
from app.models.alert import Alert
from app.models.app_setting import AppSetting
from app.models.event import Event


def purge_old_records() -> int:
    days = int(AppSetting.get("retention_days", str(Config.RETENTION_DAYS)) or Config.RETENTION_DAYS)
    cutoff = datetime.utcnow() - timedelta(days=days)
    n_alerts = Alert.query.filter(Alert.created_at < cutoff).delete(synchronize_session=False)
    n_events = Event.query.filter(Event.timestamp < cutoff).delete(synchronize_session=False)
    db.session.commit()
    return int(n_alerts) + int(n_events)
