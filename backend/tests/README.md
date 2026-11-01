# Backend tests

Put service-level tests in `unit/` and API/database/provider tests in `integration/`.
Pytest, pytest-asyncio, and HTTPX are installed. Use isolated databases and mock external
providers; routine tests should not require API credits.

Run `uv run pytest` from `backend/` after adding tests.
