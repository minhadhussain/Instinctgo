from typing import Any

from arq.connections import RedisSettings

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import dispose_engine
from app.workers.tasks import draft_and_save_workflow


async def startup(ctx: dict[str, Any]) -> None:
    configure_logging(get_settings().log_level)


async def shutdown(ctx: dict[str, Any]) -> None:
    await dispose_engine()


class WorkerSettings:
    functions = [draft_and_save_workflow]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    on_startup = startup
    on_shutdown = shutdown
    job_timeout = 600
    max_jobs = 5
