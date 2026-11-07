import asyncio
import json
import re
import unicodedata
from functools import lru_cache

import structlog
from langchain_openai import ChatOpenAI

from app.agents.graph import AIProviderError, AIUnavailableError
from app.agents.prompts.noting import NOTING_SYSTEM_PROMPT
from app.core.config import BACKEND_DIR, get_settings
from app.schemas.noting import (
    NoteContent,
    NoteDraftRequest,
    NoteDraftResponse,
    NoteFinding,
    StyleSource,
)

logger = structlog.get_logger(__name__)
PACKAGED_SOURCES = BACKEND_DIR / "resources" / "noting"
REPOSITORY_SOURCES = BACKEND_DIR.parent / "samples"
SOURCE_DIR = (
    REPOSITORY_SOURCES
    if (REPOSITORY_SOURCES / "noting-library.json").is_file()
    else PACKAGED_SOURCES
)
LIBRARY_PATH = SOURCE_DIR / "noting-library.json"
MONEY = re.compile(
    r"(?:₹|\bINR\b|\bRs\.?)[ \t]*(?:\d{1,3}(?:[, ]\d{2,3})+|\d+)"
    r"(?:\.\d{1,2})?(?:[ \t]*(?:lakhs?|lacs?|crores?|thousand))?(?![A-Za-z0-9,]|\.\d)",
    re.I,
)


@lru_cache(maxsize=1)
def load_note_library() -> dict:
    library = json.loads(LIBRARY_PATH.read_text(encoding="utf-8"))
    source = SOURCE_DIR / library["formatSource"]
    if not source.is_file():
        raise ValueError("The configured note-format example is missing")
    for book in library["rulebooks"].values():
        if not (SOURCE_DIR / book["path"]).is_file():
            raise ValueError("A configured rulebook is missing")
    return library


def normal(text: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", text).split())


def money_value(text: str) -> float | None:
    match = MONEY.search(text)
    if not match:
        return None
    token = match.group()
    number = re.search(r"\d[\d, ]*(?:\.\d+)?", token)
    if number is None:
        return None
    scale = (
        10000000
        if re.search("crore", token, re.I)
        else 100000
        if re.search(r"la(?:kh|c)", token, re.I)
        else 1000
        if re.search("thousand", token, re.I)
        else 1
    )
    return round(float(re.sub(r"[, ]", "", number.group())) * scale, 2)


def clean_note_paragraphs(paragraphs: list[str], library: dict) -> list[str]:
    prefixes = [value.casefold() for value in library["notePresentation"]["omitPrefixes"]]
    reference_only = set(library["notePresentation"].get("referenceOnlyCategories", []))
    guidance = [
        profile["examination"]
        for profile in library["profiles"]
        if reference_only.intersection(profile["categories"])
    ] + [
        rule["application"]
        for rule in library["rules"]
        if reference_only.intersection(rule["categories"]) and rule.get("application")
    ]
    reference_guidance = {
        normal(part).casefold()
        for text in guidance
        for part in [text, *re.split(r"(?<=[.!?])(?=\s+[A-Z])", text)]
    }

    def boilerplate(text: str) -> bool:
        value = normal(re.sub(r"^\s*\d+[.)]\s*", "", text)).casefold()
        return value in reference_guidance or any(value.startswith(prefix) for prefix in prefixes)

    cleaned = []
    for paragraph in paragraphs:
        for block in re.split(r"\n\s*\n", paragraph):
            if boilerplate(block):
                continue
            sentences = re.split(r"(?<=[.!?])(?=\s+[A-Z])", block)
            text = "".join(sentence for sentence in sentences if not boilerplate(sentence)).strip()
            if text:
                cleaned.append(text)
    return cleaned


def rulebook_matches(book: dict, text: str, institution: str | None) -> bool:
    def matches(pattern: str) -> bool:
        return bool(
            re.search(pattern, unicodedata.normalize("NFKC", text), re.I | re.M)
            or re.search(pattern, normal(text), re.I | re.M)
        )

    if not matches(book["signalPattern"]):
        return False
    if book.get("scopePattern"):
        return matches(book["scopePattern"]) or bool(
            institution
            and any(
                normal(name).lower() == normal(institution).lower()
                for name in book.get("scopeInstitutions", [])
            )
        )
    return not institution or normal(institution).lower() == normal(book["institution"]).lower()


def validate_note_content(note: NoteContent, request: NoteDraftRequest, library: dict) -> None:
    sources = {request.proposal_id: request.proposal_text}
    sources.update({doc.id: doc.text for doc in request.supporting_documents})
    if len({fact.key for fact in note.facts}) != len(note.facts):
        raise ValueError("Duplicate fact fields")
    for fact in note.facts:
        source = sources.get(fact.source_id)
        if source is None or normal(fact.evidence) not in normal(source):
            raise ValueError("A note fact has no matching source evidence")
        if normal(fact.value) not in normal(fact.evidence):
            raise ValueError("A note fact is not copied from its evidence")
    if (
        note.institution
        and normal(note.institution).lower() not in normal(request.proposal_text).lower()
    ):
        raise ValueError("The institution is not supported by the proposal")

    gpf = bool(re.search(r"\bg\.?p\.?f\.?\b|general provident fund", request.proposal_text, re.I))

    def matches_book(book_id: str) -> bool:
        return rulebook_matches(
            library["rulebooks"][book_id], request.proposal_text, note.institution
        )

    matching_institution = matches_book("gpf")
    if note.category.startswith("gpf-") and not gpf:
        raise ValueError("GPF classification requires a GPF proposal")
    eligible = {
        rule["id"]
        for rule in library["rules"]
        if note.category in rule["categories"]
        and matches_book(rule.get("rulebook", "gpf"))
        and (
            not rule.get("requiresAny")
            or any(term in request.proposal_text.lower() for term in rule["requiresAny"])
        )
        and (
            not rule.get("requiresPattern")
            or re.search(rule["requiresPattern"], normal(request.proposal_text), re.I)
        )
    }
    ids = [rule.id for rule in note.applied_rules]
    if len(ids) != len(set(ids)) or any(rule_id not in eligible for rule_id in ids):
        raise ValueError("The draft includes an unsupported rule")

    allowed = {
        money_value(match.group()) for text in sources.values() for match in MONEY.finditer(text)
    }
    selected_books = set()
    for rule in library["rules"]:
        if rule["id"] not in ids:
            continue
        # Reviewed policy thresholds may be quoted only from an eligible, cited rule.
        for text in (rule["excerpt"], rule.get("application", "")):
            allowed.update(money_value(match.group()) for match in MONEY.finditer(text))
        selected_books.add(rule.get("rulebook", "gpf"))
    for book_id in sorted(selected_books):
        scope_note = library["rulebooks"][book_id].get("scopeNote")
        if scope_note and scope_note not in note.missing_information:
            note.missing_information.append(scope_note)
    facts = {fact.key: fact.value for fact in note.facts}
    principal = money_value(facts.get("amount_requested", ""))
    balance = money_value(facts.get("fund_balance", ""))
    pay = money_value(facts.get("monthly_pay", ""))
    if note.category == "gpf-advance" and matching_institution:
        if balance is not None:
            ceiling = int(balance * 50) / 100
            allowed.add(ceiling)
            if principal is not None and principal > ceiling:
                note.findings.append(
                    NoteFinding(
                        kind="error",
                        title="GPF advance exceeds Rule 12.1.2",
                        detail="Revise the request to at most 50% of the verified fund balance.",
                    )
                )
        count_text = facts.get("instalments", "")
        if count_text.isdigit():
            count = int(count_text)
            if count > 36:
                note.findings.append(
                    NoteFinding(
                        kind="error",
                        title="Recovery schedule exceeds Rule 12.1.4",
                        detail="Repayment cannot exceed 36 equal whole-rupee monthly instalments.",
                    )
                )
            elif 0 < count and principal is not None and principal % count == 0:
                allowed.add(principal / count)
    if (
        note.category == "gpf-withdrawal"
        and matching_institution
        and balance is not None
        and pay is not None
    ):
        ceiling = min(int(balance * 75) / 100, pay * 20)
        allowed.add(ceiling)
        if principal is not None and principal > ceiling:
            note.findings.append(
                NoteFinding(
                    kind="error",
                    title="GPF withdrawal exceeds Rule 13.2",
                    detail="Obtain a revised request within the verified withdrawal limit.",
                )
            )
    if matches_book("consultancy") and note.category in ("consultancy", "service-refund"):
        earnings = money_value(facts.get("consultancy_earnings", ""))
        if "du-consultancy-2-1-2" in ids and earnings is not None:
            allowed.update(round(earnings * share, 2) for share in (0.6, 0.4, 0.36, 0.24))
        if "du-consultancy-2-7" in ids:
            days = facts.get("consultancy_days", "")
            used = facts.get("yearly_consultancy_days", "")
            if days.isdigit() and int(days) > 5:
                note.findings.append(
                    NoteFinding(
                        kind="error",
                        title="Consultancy leave exceeds the single-spell limit",
                        detail="Rule 2.7 does not permit more than 5 days at a time.",
                    )
                )
            if days.isdigit() and used.isdigit() and int(days) + int(used) > 20:
                note.findings.append(
                    NoteFinding(
                        kind="error",
                        title="Consultancy leave exceeds the ordinary annual limit",
                        detail="Examine the ordinary 20-day calendar-year limit under Rule 2.7.",
                    )
                )
        annual_fees = money_value(facts.get("annual_consultancy_fees", ""))
        salary = money_value(facts.get("annual_salary", ""))
        if (
            any(rule_id in ids for rule_id in ("du-consultancy-3-i", "du-consultancy-3-iii"))
            and annual_fees is not None
            and salary is not None
            and annual_fees > salary
        ):
            note.findings.append(
                NoteFinding(
                    kind="error",
                    title="Consultancy fees exceed the annual salary ceiling",
                    detail="Examine the yearly fee ceiling under Rule 3(i) before acceptance.",
                )
            )
        note.missing_information.append(
            "Confirm transaction-date tax provisions; the PDF's service-tax rate is not verified "
            "as a current rate."
        )
        if note.category == "service-refund":
            note.missing_information.append(
                "The consultancy rules do not specify refund entitlement or a refund percentage; "
                "obtain the applicable contract / refund authority."
            )
    narrative = "\n".join([note.subject, *note.paragraphs, note.recommendation])
    if any(money_value(match.group()) not in allowed for match in MONEY.finditer(narrative)):
        raise ValueError("The draft contains an unsupported monetary amount")
    if not ids and not any(
        "polic" in value.lower() or "rule" in value.lower() for value in note.missing_information
    ):
        missing = "The applicable institutional policy and authority delegation must be supplied."
        note.missing_information.append(missing)
    note.paragraphs = clean_note_paragraphs(note.paragraphs, library)
    note.recommendation = ""
    if not note.paragraphs:
        raise ValueError("The response contains no substantive note text")


async def draft_note(request: NoteDraftRequest) -> NoteDraftResponse:
    settings = get_settings()
    if not settings.openai_api_key:
        raise AIUnavailableError("AI drafting is not configured; local drafting is available")
    library = load_note_library()
    model = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        timeout=settings.ai_timeout_seconds,
        max_retries=0,
    ).with_structured_output(NoteContent)
    payload = {
        "source_documents": [
            {"id": request.proposal_id, "title": request.title, "text": request.proposal_text},
            *(doc.model_dump() for doc in request.supporting_documents),
        ],
        "note_library": library,
    }
    try:
        output = await asyncio.wait_for(
            model.ainvoke(
                [
                    ("system", NOTING_SYSTEM_PROMPT),
                    ("human", json.dumps(payload, ensure_ascii=False)),
                ]
            ),
            timeout=settings.ai_timeout_seconds + 2,
        )
        note = NoteContent.model_validate(output)
        validate_note_content(note, request, library)
        profile = next(
            profile for profile in library["profiles"] if note.category in profile["categories"]
        )
        return NoteDraftResponse(
            **note.model_dump(),
            style_sources=[
                StyleSource(
                    path=library["formatSource"], pages=profile["pages"], title=profile["title"]
                )
            ],
        )
    except Exception as exc:
        logger.warning("noting_drafting_failed", error_type=type(exc).__name__)
        raise AIProviderError("AI note drafting failed") from exc
