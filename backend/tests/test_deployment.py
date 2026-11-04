import importlib.util
import json
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import BACKEND_DIR, get_settings
from app.db import session
from app.main import app
from app.services import noting


async def test_vercel_can_start_without_a_local_database(monkeypatch):
    await session.dispose_engine()
    monkeypatch.setattr(get_settings(), "vercel", True)
    monkeypatch.setattr(get_settings(), "database_url", "sqlite+aiosqlite:///./data/instinctgo.db")
    monkeypatch.setattr(get_settings(), "openai_api_key", None)
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.get("/api/v1/health")).status_code == 200
            capabilities = await client.get("/api/v1/noting/capabilities")
            assert capabilities.status_code == 200
            assert capabilities.json()["local_drafting"] is True
            database = await client.get("/api/v1/workflows")
            assert database.status_code == 503
            assert "DATABASE_URL" in database.json()["detail"]
    assert session.get_engine.cache_info().currsize == 0


def test_managed_database_url_does_not_touch_local_storage(monkeypatch):
    monkeypatch.setattr(get_settings(), "vercel", True)
    monkeypatch.setattr(
        get_settings(), "database_url", "postgresql+asyncpg://user:password@db.example/instinctgo"
    )
    monkeypatch.setattr(Path, "mkdir", lambda *args, **kwargs: pytest.fail("Local write attempted"))
    assert session.resolve_database_url().host == "db.example"


def test_packaged_noting_sources_work_without_repository_samples(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location(
        "prepare_vercel", BACKEND_DIR / "scripts" / "prepare-vercel.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    destination = tmp_path / "function" / "resources" / "noting"
    module.prepare(BACKEND_DIR.parent / "samples", destination)
    monkeypatch.setattr(noting, "SOURCE_DIR", destination)
    monkeypatch.setattr(noting, "LIBRARY_PATH", destination / "noting-library.json")
    noting.load_note_library.cache_clear()
    try:
        library = noting.load_note_library()
        assert {"gpf", "consultancy"} == set(library["rulebooks"])
        for book in library["rulebooks"].values():
            assert (destination / book["path"]).read_bytes().startswith(b"%PDF")
        manifest = json.loads((destination / "noting-source-manifest.json").read_text())
        assert len(manifest["ruleSources"]) == 2
    finally:
        noting.load_note_library.cache_clear()
