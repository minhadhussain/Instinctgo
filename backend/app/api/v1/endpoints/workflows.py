from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.agents.graph import AIProviderError, AIUnavailableError, draft_workflow
from app.api.dependencies import DatabaseSession
from app.schemas.workflow import WorkflowCreate, WorkflowDraftRequest, WorkflowPlan, WorkflowRead
from app.services.workflow import WorkflowService

router = APIRouter()


@router.post("/draft", response_model=WorkflowPlan)
async def generate_draft(payload: WorkflowDraftRequest) -> WorkflowPlan:
    """Generate a proposed plan from a manual process, without executing or saving it."""
    try:
        return await draft_workflow(payload.process_description)
    except AIUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail="AI workflow drafting failed") from exc


@router.post("", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
async def create_workflow(payload: WorkflowCreate, session: DatabaseSession):
    return await WorkflowService(session).create(payload)


@router.get("", response_model=list[WorkflowRead])
async def list_workflows(
    session: DatabaseSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return await WorkflowService(session).list(limit=limit, offset=offset)


@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(workflow_id: UUID, session: DatabaseSession):
    workflow = await WorkflowService(session).get(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow
