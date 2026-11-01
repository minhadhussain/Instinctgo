from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import Workflow


class WorkflowRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, workflow: Workflow) -> Workflow:
        self.session.add(workflow)
        await self.session.flush()
        return workflow

    async def get(self, workflow_id: UUID) -> Workflow | None:
        return await self.session.get(Workflow, workflow_id)

    async def list(self, *, limit: int, offset: int) -> Sequence[Workflow]:
        query = (
            select(Workflow)
            .order_by(Workflow.created_at.desc(), Workflow.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return (await self.session.scalars(query)).all()
