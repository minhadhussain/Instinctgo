# Administrative playground

The homepage `#workspace` embeds a client-side administrative demonstration using the existing InstinctGo branding. The expanded workspace uses the same component and session state.

## Try the complete journey

1. The opening procurement case has a prepared AI-labelled draft. Open **Received** to inspect the original proposal or choose **Regenerate note**. New proposals use **Prepare note**.
2. Edit the note, select text for a simulated rewrite, insert current sample references, add an observation, save a version, and compare revisions.
3. Open **Review & route** and submit as **Dealing Assistant**.
4. Switch to **Section Officer**, compare the proposal and note, and complete the three verification checks. Return with a reason or forward to **Assistant Registrar**.
5. Continue through **Deputy Registrar** and **Registrar**. Every transition is guarded in the workflow module. The terminal authority records a reasoned decision.
6. Switch back to **Dealing Assistant**, record the sample final action or receipt, and close the file.

Returns go back one working level. A returned Dealing Assistant file requires a new correction version before resubmission. All earlier comments, snapshots and movements remain. Examination conflicts block approval until the predefined synthetic reconciliation is attached; unsupported new currency amounts and broken citations also block approval.

The eight current proposal categories have different facts, references, note sections, checks, arithmetic and routes. Five historical cases support session-aware search, rejection explanations and previous-case comparison. All historical notes, policies and simulated final orders are explicitly distinguished.

## Frontend boundaries

- `frontend/src/components/playground/`: shell, editor, assistant, source previews, repositories, workflow, overview and configuration views. Styling is scoped with `pg-` classes and consumes existing brand variables. The playground uses Poppins throughout, with upright text and a shared 11–28px type scale. Visible copy is limited to records, controls, statuses and concise operational messages; production architecture stays in documentation.
- `frontend/src/lib/playground/types.ts`: typed case, document, note, audit and adapter contracts.
- `data.ts`: synthetic current and archived records; no real notification numbers.
- `hierarchy.ts`: Registrar / Controller paths and explicit unconfigured PNC boundary.
- `workflow.ts`: pure transition guards, audit records and bounded validation.
- `assistant.ts`: read-only local response adapter, structured search and case filters.
- `renderer.ts`: escaped note generation and lazy-loaded DOCX / PDF exports. Exports carry synthetic-data and current-status labels; PDF spells out INR because its bundled font lacks a rupee glyph.
- `architecture.ts`: production integration descriptions.

## Simulation contract

All working state is in React memory and clears on reload. There is no institutional backend, live model, authentication, durable save, payment posting or real officer connection. The local assistant uses deterministic keyword matching and case templates; arbitrary questions outside its dataset receive an explicit limited-coverage response. Timed stages illustrate the processing sequence, not real model latency.

Text uploads accept synthetic `.txt` / `.md` fixtures up to 100 KB and store text and metadata in the current browser session. They are marked **Unverified**; uploading does not run OCR, index PDFs, approve policies or automatically resolve a validation conflict. The predefined sample clarification packet is a separate explicit demonstration action.

The demo checks supplied calculations, source links and unexpected INR values, but does not claim semantic verification of arbitrary edits. Supervisory comparison is required. Policy and authority settings are local demo configuration; PNC intermediate positions can be previewed but are not routed until institutional configuration exists.

## Future integration points

Production document processing, OCR, case storage, identity mappings, confidential rules and audit records belong in institution-controlled services. Local Presidio / GLiNER detection and a disclosure-policy gateway must precede permitted external reasoning calls. Pseudonymization is not anonymity. A production model adapter can combine typed bounded classifications, deterministic calculations and generative interpretation while returning evidence-bearing outputs.

Replace client transition execution with authenticated server-side workflow enforcement and durable transactions. Connect approved document indexing and retrieval, output validation and the note renderer through the typed boundaries; do not treat browser role selection as authorization.

## Verification

```sh
npm run test:playground --workspace @instinctgo/frontend
npm run typecheck
npm run lint:frontend
npm run build
```

The workflow tests exercise complete closure, level-skipping prevention, returns and corrections, role guards, critical evidence conflicts, archive immutability, amount/source validation, adaptive categories, assistant non-mutation, and compound search filters.
