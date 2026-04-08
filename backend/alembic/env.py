from logging.config import fileConfig
from urllib.parse import urlparse, urlunparse
from sqlalchemy import engine_from_config, pool
from alembic import context

from backend.app.config import settings
from backend.app.database import Base

from backend.app.models.user import User
from backend.app.models.patient import Patient
from backend.app.models.doctor import Doctor
from backend.app.models.manager import Manager
from backend.app.models.appointment import DoctorSchedule, Appointment
from backend.app.models.article import Article
from backend.app.models.chat import ChatSession, ChatMessage
from backend.app.models.cycle import MenstrualCycle, CycleDay
from backend.app.models.medication import Medication, MedicationLog
from backend.app.models.mood import MoodEntry
from backend.app.models.notification import Notification
from backend.app.models.recommendation import DoctorRecommendation
from backend.app.models.subscription import SubscriptionPlan, Subscription
from backend.app.models.symptom import Symptom, PatientSymptom
from backend.app.models.test_requirement import SymptomTestMapping

config = context.config

# Convert asyncpg URL to sync psycopg2 and strip all query params
db_url = settings.DATABASE_URL
db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
parsed = urlparse(db_url)
db_url = urlunparse(parsed._replace(query=""))
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    import certifi
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={
            "sslmode": "require",
            "sslrootcert": certifi.where(),
        },
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
