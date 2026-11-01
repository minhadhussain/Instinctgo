from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WorkflowStep(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    key: str = Field(min_length=1, max_length=80, pattern=r"^[a-z][a-z0-9_]*$")
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=4000)
    kind: Literal["human", "agent", "integration"]
    depends_on: list[str] = Field(max_length=100)


class WorkflowPlan(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=10000)
    steps: list[WorkflowStep] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_step_dependencies(self):
        """Require a topologically ordered plan with unique step keys."""
        seen: set[str] = set()
        for step in self.steps:
            if step.key in seen:
                raise ValueError(f"Duplicate step key: {step.key}")
            if not set(step.depends_on).issubset(seen):
                raise ValueError(f"Step {step.key} must depend only on earlier steps")
            seen.add(step.key)
        return self


class WorkflowCreate(WorkflowPlan):
    pass


class WorkflowRead(WorkflowPlan):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: Literal["draft"]
    created_at: datetime


class WorkflowDraftRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    process_description: str = Field(min_length=20, max_length=20000)
