from functools import lru_cache

import structlog
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

from app.agents.prompts.planner import PLANNER_SYSTEM_PROMPT
from app.agents.state import WorkflowAgentState
from app.core.config import get_settings
from app.schemas.workflow import WorkflowPlan

logger = structlog.get_logger(__name__)


class AIUnavailableError(RuntimeError):
    pass


class AIProviderError(RuntimeError):
    pass


async def plan_process(state: WorkflowAgentState) -> dict[str, WorkflowPlan]:
    settings = get_settings()
    model = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        timeout=settings.ai_timeout_seconds,
        max_retries=2,
    ).with_structured_output(WorkflowPlan)
    output = await model.ainvoke(
        [
            ("system", PLANNER_SYSTEM_PROMPT),
            ("human", state["process_description"]),
        ]
    )
    return {"plan": WorkflowPlan.model_validate(output)}


@lru_cache
def get_planner_graph():
    graph = StateGraph(WorkflowAgentState)
    graph.add_node("plan_process", plan_process)
    graph.add_edge(START, "plan_process")
    graph.add_edge("plan_process", END)
    return graph.compile()


async def draft_workflow(process_description: str) -> WorkflowPlan:
    if not get_settings().openai_api_key:
        raise AIUnavailableError("Set OPENAI_API_KEY in backend/.env to enable AI drafting")
    try:
        result = await get_planner_graph().ainvoke({"process_description": process_description})
        return WorkflowPlan.model_validate(result["plan"])
    except Exception as exc:
        logger.warning("workflow_drafting_failed", error_type=type(exc).__name__)
        raise AIProviderError("AI provider request failed") from exc
