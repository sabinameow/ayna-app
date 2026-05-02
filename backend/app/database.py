import ssl
import certifi
from urllib.parse import urlparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.app.config import settings

ssl_context = ssl.create_default_context(cafile=certifi.where())

database_url = settings.async_database_url
parsed_database_url = urlparse(settings.database_url_with_neon_ssl)

if parsed_database_url.scheme.startswith("sqlite"):
    raise RuntimeError("SQLite fallback is not allowed. DATABASE_URL must point to Neon PostgreSQL.")

if not parsed_database_url.hostname or "neon.tech" not in parsed_database_url.hostname:
    raise RuntimeError("DATABASE_URL must point to a Neon host.")

engine = create_async_engine(
    database_url,
    echo=settings.DEBUG,
    pool_pre_ping=False,
    pool_recycle=1800,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_use_lifo=True,
    connect_args={
        "ssl": ssl_context,
        "timeout": 30,
        "command_timeout": 30,
    },
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def verify_neon_connection() -> None:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
