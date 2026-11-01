from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.dependencies import DatabaseSession

router = APIRouter()


@router.get("")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "instinctgo-backend"}


@router.get("/ready")
async def readiness(session: DatabaseSession) -> dict[str, str]:
    try:
        await session.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc
    return {"status": "ready", "database": "ok"}
