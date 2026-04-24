from celery import Celery
from celery.schedules import crontab

from backend.app.config import settings
import ssl

celery_app = Celery(
    "worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "backend.app.auth.tasks",
        "backend.app.services.scheduled_tasks",
    ],
)

celery_app.conf.update(
    broker_use_ssl={"ssl_cert_reqs": ssl.CERT_NONE},
    redis_backend_use_ssl={"ssl_cert_reqs": ssl.CERT_NONE},
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "daily-phase-insights": {
        "task": "ayna.daily_phase_insights",
        # Runs every day at 08:00 UTC.
        "schedule": crontab(hour=8, minute=0),
    },
}