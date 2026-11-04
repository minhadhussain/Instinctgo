from typing import Any
from uuid import UUID

from app.agents.graph import draft_workflow
from app.db.session import session_factory
from app.schemas.workflow import WorkflowCreate
from app.services.workflow import WorkflowService


async def draft_and_save_workflow(ctx: dict[str, Any], process_description: str) -> str:
    """Draft a workflow in the background, returning its persisted ID.

    Reuse the ARQ job ID as the workflow ID so a retry after commit is idempotent.
    Enqueue with a UUID string as _job_id; see backend/README.md.
    """
    workflow_id = UUID(ctx["job_id"])
    async with session_factory()() as session:
        service = WorkflowService(session)
        existing = await service.get(workflow_id)
        if existing is not None:
            return str(existing.id)
        plan = await draft_workflow(process_description)
        workflow = await service.create(
            WorkflowCreate(**plan.model_dump()), workflow_id=workflow_id
        )
        return str(workflow.id)
