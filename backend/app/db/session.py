from collections.abc import AsyncIterator
from functools import lru_cache
from pathlib import Path

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import BACKEND_DIR, get_settings


class DatabaseNotConfiguredError(RuntimeError):
    pass


def resolve_database_url():
    settings = get_settings()
    url = make_url(settings.database_url)
    if settings.vercel and url.get_backend_name() == "sqlite":
        raise DatabaseNotConfiguredError(
            "Set DATABASE_URL to a managed PostgreSQL database on Vercel."
        )
    if url.get_backend_name() == "sqlite" and url.database and url.database != ":memory:":
        database_path = Path(url.database)
        if not database_path.is_absolute():
            database_path = BACKEND_DIR / database_path
        database_path.parent.mkdir(parents=True, exist_ok=True)
        url = url.set(database=str(database_path.resolve()))
    return url


@lru_cache(maxsize=1)
def get_engine() -> AsyncEngine:
    options = {"poolclass": NullPool} if get_settings().vercel else {}
    return create_async_engine(resolve_database_url(), pool_pre_ping=True, **options)


def session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def dispose_engine() -> None:
    if get_engine.cache_info().currsize:
        await get_engine().dispose()
        get_engine.cache_clear()


async def get_session() -> AsyncIterator[AsyncSession]:
    async with session_factory()() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
