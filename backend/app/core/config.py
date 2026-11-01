from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "InstinctGo API"
    app_env: Literal["development", "test", "production"] = "development"
    debug: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    database_url: str = "sqlite+aiosqlite:///./data/instinctgo.db"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4.1-mini"
    ai_timeout_seconds: float = Field(default=60, gt=0, le=300)


@lru_cache
def get_settings() -> Settings:
    return Settings()
