from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import BACKEND_DIR, get_settings


def resolve_database_url():
    url = make_url(get_settings().database_url)
    if url.get_backend_name() == "sqlite" and url.database and url.database != ":memory:":
        database_path = Path(url.database)
        if not database_path.is_absolute():
            database_path = BACKEND_DIR / database_path
        database_path.parent.mkdir(parents=True, exist_ok=True)
        url = url.set(database=str(database_path.resolve()))
    return url


engine = create_async_engine(resolve_database_url(), pool_pre_ping=True)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
