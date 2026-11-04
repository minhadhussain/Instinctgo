from fastapi import APIRouter, HTTPException

from app.agents.graph import AIProviderError, AIUnavailableError
from app.core.config import get_settings
from app.schemas.noting import NoteDraftRequest, NoteDraftResponse
from app.services.noting import draft_note

router = APIRouter()


@router.get("/capabilities")
async def capabilities():
    return {"ai_available": bool(get_settings().openai_api_key), "local_drafting": True}


@router.post("/draft", response_model=NoteDraftResponse)
async def generate_note(payload: NoteDraftRequest) -> NoteDraftResponse:
    try:
        return await draft_note(payload)
    except AIUnavailableError as exc:
        raise HTTPException(
            status_code=503, detail={"code": "ai_not_configured", "message": str(exc)}
        ) from exc
    except AIProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "ai_drafting_failed", "message": "AI note drafting was unavailable."},
        ) from exc
