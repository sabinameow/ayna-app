import ssl
from urllib.parse import urlparse

import certifi

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.app.config import settings

ssl_context = ssl.create_default_context(cafile=certifi.where())


def get_connect_args() -> dict:
    parsed = urlparse(settings.DATABASE_URL)
    hostname = parsed.hostname or ""

    # Local Postgres setups commonly run without SSL, while hosted providers
    # like Neon require it. Only force SSL for non-local database hosts.
    if hostname in {"localhost", "127.0.0.1"}:
        return {}

    return {"ssl": ssl_context}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=get_connect_args(),
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
