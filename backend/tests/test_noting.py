import copy

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr, ValidationError

from app.api.v1.endpoints import noting as endpoint
from app.core.config import Settings, get_settings
from app.main import app
from app.schemas.noting import (
    AppliedRule,
    NoteContent,
    NoteDraftRequest,
    NoteDraftResponse,
    NoteFact,
)
from app.services import noting


@pytest.fixture
def proposal():
    return NoteDraftRequest(
        title="New fee refund application",
        proposal_id="uploaded-request",
        proposal_text=(
            "I, Nisha Rao, request a refund of INR 3200 paid twice as examination fees. "
            "Department: Physics. Please verify the receipts and refund the duplicate payment."
        ),
    )


@pytest.fixture
def content():
    return NoteContent(
        subject="Refund of duplicate examination fee",
        category="fee-refund",
        institution=None,
        routing="Finance & Accounts / Internal Audit",
        facts=[
            NoteFact(
                key="applicant",
                value="Nisha Rao",
                evidence="I, Nisha Rao,",
                source_id="uploaded-request",
            )
        ],
        paragraphs=[
            "An application has been received from Nisha Rao.",
            "The applicant requests refund of a duplicate payment of INR 3200.",
            "Verify the receipts, ledger and applicable refund policy before a decision.",
        ],
        recommendation="Place the verified claim before the competent authority.",
        applied_rules=[],
        missing_information=["Applicable refund policy"],
        findings=[],
    )


def test_new_proposals_need_no_demo_reference(proposal, content):
    noting.validate_note_content(content, proposal, noting.load_note_library())
    assert content.facts[0].value == "Nisha Rao"
    assert "DEMO-GPF-001" not in proposal.proposal_text


def test_ai_note_omits_clarification_footer_closing_and_disclaimers(proposal, content):
    original = list(content.paragraphs)
    content.paragraphs.extend(
        [
            "The following particulars / records require clarification "
            "before a final recommendation: "
            "Application date is not clearly stated. The requested amount is not clearly stated.",
            "If the particulars are verified, the file may be placed "
            "before the competent authority.",
            "Put up for your kind perusal and necessary order please.",
            "This note is not an official document.",
        ]
    )
    noting.validate_note_content(content, proposal, noting.load_note_library())
    assert content.paragraphs == original
    assert content.recommendation == ""


def test_output_rejects_example_fact_leakage(proposal, content):
    content.facts[0].value = "Dr. Aditi Bora"
    with pytest.raises(ValueError, match="not copied"):
        noting.validate_note_content(content, proposal, noting.load_note_library())


def test_output_rejects_unsupported_amount_and_unrelated_rule(proposal, content):
    bad_amount = copy.deepcopy(content)
    bad_amount.paragraphs[1] = "Refund INR 180000."
    with pytest.raises(ValueError, match="monetary"):
        noting.validate_note_content(bad_amount, proposal, noting.load_note_library())
    bad_rule = content.model_copy(
        update={
            "applied_rules": [AppliedRule(id="du-gpf-12-1", reason="Use this rule for the refund.")]
        }
    )
    with pytest.raises(ValueError, match="unsupported rule"):
        noting.validate_note_content(bad_rule, proposal, noting.load_note_library())


def test_context_limits_and_duplicate_ids(proposal):
    with pytest.raises(ValidationError, match="unique"):
        NoteDraftRequest(
            **{
                **proposal.model_dump(),
                "supporting_documents": [
                    {"id": proposal.proposal_id, "title": "copy", "text": "text"}
                ],
            }
        )
    with pytest.raises(ValidationError, match="200,000"):
        NoteDraftRequest(
            title="Large request",
            proposal_id="request",
            proposal_text="x" * 150000,
            supporting_documents=[{"id": "extra", "title": "Extra", "text": "x" * 60000}],
        )


async def test_ai_service_uses_example_library_and_grounded_response(
    monkeypatch, proposal, content
):
    captured = {}

    class Model:
        def __init__(self, **kwargs):
            captured["model_options"] = kwargs

        def with_structured_output(self, schema):
            assert schema is NoteContent
            return self

        async def ainvoke(self, messages):
            captured["messages"] = messages
            return content

    monkeypatch.setattr(noting, "ChatOpenAI", Model)
    monkeypatch.setattr(noting, "get_settings", lambda: Settings(openai_api_key=SecretStr("test")))
    result = await noting.draft_note(proposal)
    assert result.engine == "ai"
    assert result.style_sources[0].path.endswith("Untitled design (5).pdf")
    assert "note_library" in captured["messages"][1][1]
    assert "Nisha Rao" in captured["messages"][1][1]
    assert result.applied_rules == []


async def test_api_capabilities_and_missing_provider(monkeypatch, proposal):
    monkeypatch.setattr(get_settings(), "openai_api_key", None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        capabilities = await client.get("/api/v1/noting/capabilities")
        assert capabilities.json() == {"ai_available": False, "local_drafting": True}
        response = await client.post("/api/v1/noting/draft", json=proposal.model_dump())
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "ai_not_configured"


async def test_api_accepts_new_proposal_and_returns_note(monkeypatch, proposal, content):
    async def generate(payload):
        assert payload.proposal_text == proposal.proposal_text
        return NoteDraftResponse(**content.model_dump(), style_sources=[])

    monkeypatch.setattr(endpoint, "draft_note", generate)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.post("/api/v1/noting/draft", json=proposal.model_dump())
        assert result.status_code == 200
        assert result.json()["subject"] == content.subject
        assert "signature" not in result.json()


def test_consultancy_rules_and_calculations_use_the_new_source(content):
    request = NoteDraftRequest(
        title="Consultancy earnings",
        proposal_id="new-consultancy",
        proposal_text=(
            "Dibrugarh University\nDistribution of consultancy earnings\n"
            "Distributable consultancy earnings: INR 100000"
        ),
    )
    content.category = "consultancy"
    content.institution = "Dibrugarh University"
    content.facts = [
        NoteFact(
            key="consultancy_earnings",
            value="INR 100000",
            source_id="new-consultancy",
            evidence="Distributable consultancy earnings: INR 100000",
        )
    ]
    content.applied_rules = [
        AppliedRule(
            id="du-consultancy-2-1-2", reason="Examine distribution after report submission."
        )
    ]
    content.paragraphs = [
        "The group share is INR 60000 and University share INR 40000.",
        "The group share subdivides into INR 36000 consultants and INR 24000 eligible staff.",
        "Verify the earnings base, staff participation and report submission before release.",
    ]
    library = noting.load_note_library()
    noting.validate_note_content(content, request, library)
    assert library["rulebooks"]["consultancy"]["path"].endswith(
        "Consultancy-Service-Rules-of-Dibrugarh-University.pdf"
    )
    assert any("tax" in entry for entry in content.missing_information)
    content.applied_rules = [AppliedRule(id="du-gpf-12-1", reason="Incorrect cross-domain rule")]
    with pytest.raises(ValueError, match="unsupported rule"):
        noting.validate_note_content(content, request, library)
