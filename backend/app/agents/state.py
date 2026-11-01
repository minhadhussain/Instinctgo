from typing import NotRequired, TypedDict

from app.schemas.workflow import WorkflowPlan


class WorkflowAgentState(TypedDict):
    process_description: str
    plan: NotRequired[WorkflowPlan]
