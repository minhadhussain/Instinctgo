# InstinctGo: landing-page content roadmap

## Positioning

**What we are:** A physical-to-action agentic workflow platform for university administrative
blocks and government departments. The Digital Green Sheet brings administrative noting,
drafting, financial scrutiny, and evidence-linked approvals into one workspace.

**Our goal:** Move institutions from fragmented physical records and repetitive file handling
to verifiable decisions and connected operations, with a traceable record of how work was completed.

**How we do it:** Read documents with their layout intact, link claims to the original evidence,
help officials prepare rule-backed notes, and connect an authorized approval to the appropriate
ledger entries, formal orders, dispatch, and receipts.

## Minimum navigation

1. **Platform** — What is InstinctGo, who is it for, and why does it matter?
2. **How it works** — Read → verify → approve → act.
3. **Workspace** — See the Digital Green Sheet and click-to-verify interactions.
4. **Trust & audit** — Understand evidence, arithmetic checks, authority, and execution records.
5. **Contact / Request a walkthrough** — A real enquiry form or scheduling destination.

Place **Our goal** within the Platform story, or give it its own navigation link while the
initial site is small. The implemented first version uses Platform, How it works, Workspace,
and Our goal, with a working anchor to the interactive preview as its main call to action.

## Content order

| Order | Section | Minimum content |
| --- | --- | --- |
| 1 | Hero: what we are | Headline, one-sentence definition, university/government audience, and one primary CTA. |
| 2 | Show the workspace | Green Sheet, proposal preview, reference library, AI co-pilot, and an interactive citation. |
| 3 | The problem and our goal | Physical files lose context; verification is repetitive; approval often leaves systems unchanged. Explain the intended outcome. |
| 4 | How the solution works | Layout-aware intake; linked source boxes; rule-backed notes and financial checks; approval-triggered actions with receipts. |
| 5 | Trust and accountability | Source provenance, deterministic arithmetic, document versions, authority boundaries, and action receipts. Distinguish available capabilities from the roadmap. |
| 6 | One concrete use case | A furniture purchase: vendor invoice → budget/rule check → note → approval → ledger update → sanction order → receipt. |
| 7 | Final CTA and footer | A real walkthrough/contact route, company identity, and applicable privacy information. |

## Hero copy

**Eyebrow:** Physical files. Agentic workflows.

**Headline:** From physical files to verified action.

**Description:** The AI workspace for administrative noting, financial scrutiny, and approvals.
Turn scattered paperwork into evidence-backed decisions—and decisions into work done.

**Primary CTA:** Explore the workspace.

**Secondary CTA:** How it works.

**Audience line:** Purpose-built for universities and government departments.

## Core differentiators to explain

- **Layout-aware reading:** Preserve tables, stamps, handwriting, and the placement of information.
- **Click-to-verify provenance:** A cited amount or rule points to the original page region.
- **Financial scrutiny:** Arithmetic and budget checks should be deterministic and independently inspectable.
- **Closed-loop execution:** Approval starts connected work; completion and failure receipts return to the file.

Use concrete claims such as **evidence-linked**, **traceable**, and **audit-ready**. Avoid presenting
absolute claims like “zero hallucinations” or “audit-proof” as guarantees.

## Current frontend preview

- Responsive hero, navigation, a three-step explanation, and a goal section.
- An illustrative Digital Green Sheet for a ₹47,200 office-chair procurement.
- Clicking the amount, budget head, or rule opens the matching sample source and highlighted region.
- The proposal preview can be toggled, and library items open their corresponding sources.
- The co-pilot displays a clearly labeled example response.
- “Approve & sign — DEMO” simulates a ledger deduction, order, and receipt in browser state;
  reset restores the sample. The calculation is ₹2,40,000 − ₹47,200 = ₹1,92,800.

## Build sequence

1. **Now:** Establish positioning and the hero; demonstrate the core concept visually.
2. **Next:** Add the trust section, full procurement story, and a working contact/walkthrough form.
3. **Then:** Add FAQs on institutional rules, document formats, integrations, and deployment options.
4. **As evidence becomes available:** Publish actual pilot results and permissioned customer stories.
