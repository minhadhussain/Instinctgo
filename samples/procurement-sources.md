# Procurement source integration

Reviewed and registered on 7 November 2026. All proposals continue through the same
upload → review text → convert to note workflow, with automatic category, profile and
source selection.

## Supplied sources

| Source | Original file | PDF pages | Public URL |
| --- | --- | --- | --- |
| Assam Public Procurement Rules, 2020 | `case-01/rules/dms22_assam_public_procurement_rules_2020.pdf` | 104 | `/samples/case-01/assam-public-procurement-rules-2020.pdf` |
| Government of India Manual for Procurement of Works, 2019 | `case-01/rules/Revision_of_Manual_for_Procurement_of_Works_2019.pdf` | 187 | `/samples/case-01/manual-procurement-works-2019.pdf` |

The Assam source is scanned. Text was extracted with local English OCR and the
registered summaries reviewed against the source, including visual checks of the
notification and numerical RFQ/security provisions. Raw OCR is not supplied as an
authoritative rule library. The works PDF contains extractable text.

Source SHA-256 values are recorded in `noting-source-manifest.json`. Preparation
copies the full PDFs without modification. Backend packaging verifies manifest
coverage, paths, hashes and registered page counts.

## Applicability

- `assam-procurement`: procurement category plus Assam Government/Act/Rules or an
  explicit State/Jurisdiction label in the proposal, or the configured Dibrugarh
  University institutional mapping. Entity coverage, commencement/amendment
  notifications and financial delegation remain matters to confirm.
- `goi-works`: procurement category, a works subject, and Central Government context
  or explicit reference/adoption of the works manual. Ordinary goods procurement
  does not inherit works rules solely because it is a government purchase.
- Assam works do not automatically acquire central-manual authority. Both sets can
  appear when the proposal explicitly identifies both applicable frameworks, with
  separately named sources and provisions.
- Neither procurement source supplies GPF eligibility rules, student-refund
  entitlements or the distribution rules for University-provided consultancy.
- `requiresAny` and `requiresPattern` narrow clause relevance. Short method names
  are matched as tokens: “engagement” does not select GeM, and “alternative” does
  not select LTE.

The Assam notification is dated **2 September 2020**, published **8 September 2020**.
Rule 1(2) provides for notified commencement, so the library does not invent an
effective date. The central manual's foreword is dated **6 June 2019** and describes
contents up to March 2019. These are the editions provided by the user.

## Registered Assam provisions

All locators below are **PDF page positions**, not Gazette page numbers.

| Rule | Subject | PDF pages |
| --- | --- | --- |
| 3 | Public need, specifications and realistic estimate | 3–4 |
| 4 | Procurement plan, funding and approval | 4–5 |
| 8 | Sanctions, delegated powers and available funds | 9–10 |
| 13 | Clear specifications and substantially equivalent products | 15 |
| 24 | Preferred method and recorded alternative-method reasons | 49 |
| 5, 6, 12 | Eligibility, conflicts and integrity | 5–8, 13–14 |
| 9, 11 | Registers and procurement proceedings | 10–13 |
| 14–15 | Bid envelopes, technical qualification and evaluation | 15–16 |
| 16 | Price negotiations | 18 |
| 17 | State procurement portal and method exceptions | 18, 17, 19 |
| 24(A) | Open/international competitive bidding | 49–50 |
| 24(B) | Limited bidding | 50 |
| 24(C) | Single source and proprietary articles | 51–52 |
| 24(D) | Two-stage bidding | 52–54 |
| 24(F) | Request for quotations | 57–58 |
| 24(G) | Spot purchase | 59 |
| 24(I)(1) | Rate contracts | 61–65 |
| 24(I)(2) | GeM | 65–66 |
| 25 | Hiring consultancy/non-consultancy services | 86–89 |
| 29 | Bid security | 98–100 |
| 30 | Performance security | 100 |
| 31 | Agreement and order | 101 |
| 33 | Repeat orders | 102 |

Pages 17 and 18 are out of printed-page order in the supplied scan; Rule 17's
multi-page locator preserves the actual PDF positions.

## Registered central works provisions

| Paragraph | Subject | PDF pages |
| --- | --- | --- |
| 1.3 | Works and institutional scope | 28–29 |
| 1.10 | Prerequisites, integrated project and no splitting | 32–35 |
| 2.2–2.4 | PPR/DPR and estimates | 37–40 |
| 2.5–2.7 | Administrative/expenditure/technical sanctions and funding | 40 |
| 3.5.1 | Open tendering | 58–60 |
| 3.5.5 | Limited tender enquiry | 61–62 |
| 3.5.7 | Single tender/nomination | 63–64 |
| 4.11 | Bid security | 75 |
| 4.12–4.13 | Performance security and retention | 75–76 |
| 5.1–5.3 | Evaluation, procurement powers and comparative note | 81–82 |
| 6.5.2 | Measurement and payment | 105–107 |
| 6.6–6.7 | Handover and closure | 109–110 |

These 35 reviewed entries supplement the existing 26 GPF/consultancy entries.
They cover the main supported examination topics; the full original manuals remain
available for provisions beyond these summaries. This is a curated rule library,
not automatic executable interpretation of every clause in the PDFs.

## Numerical provisions kept separate

- Assam Rule 24(F): **less than INR 100000** per occasion, at most **INR 500000**
  per financial year in the supplied edition; at least three requested sealed quotes
  and the other stated conditions. Subsequent notification changes are possible.
- Assam Rule 29: generally 2–5% bid security and **28 days** beyond bid validity.
- Works paragraph 4.11: generally 2–5% bid security and **45 days** beyond validity.
- Works paragraph 3.5.1: the supplied edition describes OTE above **INR 500000**.
  This is not the Assam RFQ per-occasion ceiling.

The applicable reference entries explain these source-specific conditions. Generic
procurement checklists and copied rule-application paragraphs are omitted from the
note body; case-specific analysis can still cite an applicable condition. No new automatic sanction,
tax calculation, procurement execution or annual-ledger verification is performed.
The AI validator permits monetary policy limits only from eligible cited entries;
uncited or cross-scope thresholds are rejected.

## Runtime and maintenance

- Browser local drafting: `frontend/src/lib/playground/note-draft.ts`.
- Backend applicability and monetary checks: `backend/app/services/noting.py`.
- Reviewed metadata/excerpts: `samples/noting-library.json`, version 6.
- Asset preparation: `npm run prepare:case --workspace @instinctgo/frontend`.
- Backend packaging: `uv run --directory backend python scripts/prepare-vercel.py`.
- Reference display includes issuing body, complete PDF size in pages, source
  edition, primary page link and multi-page provision locators.
- Only selected applicable provisions and their rulebooks are shown beside a note
  and in its assistant/source picker; the complete registered catalog is not appended.

Restart a running backend after library changes because its library is cached.
Rebuild/redeploy hosted services to publish the new assets and application code.
