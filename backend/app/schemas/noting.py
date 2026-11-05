from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

NoteCategory = Literal[
    "fee-refund",
    "admission-refund",
    "hostel-refund",
    "service-refund",
    "gpf-advance",
    "gpf-withdrawal",
    "gpf-final",
    "consultancy",
    "leave",
    "procurement",
    "general",
]
FactKey = Literal[
    "applicant",
    "department",
    "reference",
    "application_date",
    "amount_requested",
    "amount_mentioned",
    "fund_balance",
    "instalments",
    "monthly_pay",
    "consultancy_earnings",
    "consultancy_days",
    "yearly_consultancy_days",
    "annual_consultancy_fees",
    "annual_salary",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SupportingDocument(StrictModel):
    id: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=240)
    text: str = Field(min_length=1, max_length=100000)


class NoteDraftRequest(StrictModel):
    title: str = Field(min_length=1, max_length=240)
    proposal_text: str = Field(min_length=20, max_length=200000)
    proposal_id: str = Field(min_length=1, max_length=160)
    supporting_documents: list[SupportingDocument] = Field(default_factory=list, max_length=20)
    drafting_style: Literal["standard", "sws-procurement"] = "standard"
    word_limit: int = Field(default=300, ge=100, le=1000)

    @model_validator(mode="after")
    def validate_context(self):
        total = len(self.proposal_text) + sum(len(doc.text) for doc in self.supporting_documents)
        if total > 200000:
            raise ValueError("The combined proposal and supporting text exceeds 200,000 characters")
        ids = [self.proposal_id, *(doc.id for doc in self.supporting_documents)]
        if len(ids) != len(set(ids)):
            raise ValueError("Source document IDs must be unique")
        return self


class NoteFact(StrictModel):
    key: FactKey
    value: str = Field(min_length=1, max_length=240)
    evidence: str = Field(min_length=1, max_length=1200)
    source_id: str = Field(min_length=1, max_length=160)


class AppliedRule(StrictModel):
    id: str = Field(min_length=1, max_length=160)
    reason: str = Field(min_length=1, max_length=1000)


class NoteFinding(StrictModel):
    kind: Literal["warning", "error"]
    title: str = Field(min_length=1, max_length=160)
    detail: str = Field(min_length=1, max_length=1200)


class NoteSection(StrictModel):
    heading: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=4000)


class NoteContent(StrictModel):
    subject: str = Field(min_length=1, max_length=240)
    category: NoteCategory
    institution: str | None = Field(max_length=160)
    routing: str = Field(min_length=1, max_length=500)
    facts: list[NoteFact] = Field(max_length=20)
    paragraphs: list[Annotated[str, Field(min_length=1, max_length=4000)]] = Field(
        min_length=3, max_length=10
    )
    recommendation: str = Field(min_length=1, max_length=2000)
    applied_rules: list[AppliedRule] = Field(max_length=24)
    missing_information: list[Annotated[str, Field(min_length=1, max_length=1200)]] = Field(
        max_length=20
    )
    findings: list[NoteFinding] = Field(max_length=20)
    sections: list[NoteSection] = Field(default_factory=list, max_length=4)


class StyleSource(StrictModel):
    path: str
    pages: list[int]
    title: str


class NoteDraftResponse(NoteContent):
    engine: Literal["ai"] = "ai"
    style_sources: list[StyleSource]
