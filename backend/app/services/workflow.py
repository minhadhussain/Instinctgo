from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import Workflow
from app.repositories.workflow import WorkflowRepository
from app.schemas.workflow import WorkflowCreate


class WorkflowService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = WorkflowRepository(session)

    async def create(self, payload: WorkflowCreate, *, workflow_id: UUID | None = None) -> Workflow:
        workflow = Workflow(**payload.model_dump())
        if workflow_id is not None:
            workflow.id = workflow_id
        await self.repository.add(workflow)
        await self.session.commit()
        await self.session.refresh(workflow)
        return workflow

    async def list(self, *, limit: int, offset: int) -> Sequence[Workflow]:
        return await self.repository.list(limit=limit, offset=offset)

    async def get(self, workflow_id: UUID) -> Workflow | None:
        return await self.repository.get(workflow_id)
