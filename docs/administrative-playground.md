# University Finance Noting playground

The homepage `#workspace` embeds an intake page and a two-stage editing workspace: proposal text first, then a finance note. Expanded view uses the same session and draft state. The active demonstration is a single GPF advance case described in `samples/case-01/README.md`.

Site scrolling uses Lenis with smooth wheel and in-page anchor navigation, synchronized hero parallax and reduced-motion support. Document panels, rule lists, chat, previews and dialogs retain native independent scrolling. Page momentum pauses while a dialog or the expanded workspace is open and resumes after the final scroll lock closes.

## Page 1: Document intake

- Drop a document, choose **Upload proposal**, or **Scan document**. The camera flow captures a JPEG and includes a native photo/file fallback, permission errors and retry.
- Accepted formats: PDF, DOCX, UTF-8 TXT / Markdown, PNG and JPEG, up to 20 MB. Empty files, unsupported types, invalid text encoding and mismatched binary signatures produce errors. FileReader supplies actual local-read progress; an in-flight read can be cancelled or replaced.
- The upload card changes to **Ready to extract text** with the file name, size and a **Convert to text** action. Extraction opens the proposal workspace. Progress, cancellation, changing / clearing the selection and retry are available. Full format, page and text limits are under **File requirements**.
- The sidebar contains the **AI Assistant** only, with guidance for this first case. Rules are introduced after note generation.
- **Recent documents** starts empty and holds searchable, status-filtered session uploads. Select an item to reopen its current stage without losing edits.
- **Use sample** loads `gpf-advance-proposal.pdf` through the ordinary upload path; it does not bypass extraction or note preparation. The standalone PDF is also available in `samples/case-01/proposals/`. The workspace title is **Noting workspace**.

## Proposal text → finance note

- **Documents** returns to intake. The heading retains the original proposal and file details. The proposal stage has a wider, taller assistant beside the text editor, with no rules panel or rules tab.
- **Convert to note** is an explicit action after text extraction. `gpf-case.ts` reads the reviewed text's labelled fields, checks the configured GPF conditions and creates the formatted note. Unrelated, incomplete or inconsistent requests show an error and remain at the proposal stage. Saving or editing extracted text does not change the stage.
- The generated note uses the routing heading, underlined subject, applicant table, examination paragraphs, conditional recommendation and closing from the supplied note-format sample. Its facts and reasoning come from the generated proposal and supplied GPF Rules, 2013.
- The note stage introduces **Rules & Regulations** with seven applied rule entries, their PDF page locations and explanations of their application. Selecting an entry opens the supplied rulebook at the relevant page. The original proposal and the reviewed text used for generation remain separately available.
- The editor supports bold, italic, underline, font size, paragraph / heading styles, source links, undo and redo. Changes are saved in React session memory as they are made. Converted documents also offer **Copy text** and a plain-text download.
- The **AI Assistant** uses only proposal context before conversion. It can check required fields and direct the user to the conversion button, but does not create a note through chat. After conversion it can explain the applied GPF rules and suggest a next-action paragraph. The assistant remains a deterministic local adapter. It cannot approve, sign or route a file.
- **Preview text** / **Preview note** opens the current stage with page navigation and zoom. Formatting and the generated applicant table are retained. Long blocks paginate without discarding content.
- The sticky action bar offers **Save text**, **Download**, and **Convert to note** at the proposal stage. After conversion it offers **Save note** and the permitted review action. Word and PDF exports preserve the note's table and current edited text. **More actions** retains versions and activity.
- **Approve & Sign** appears only for the assigned terminal authority after a note exists and has reached that role. The GPF case terminates at the Vice-Chancellor under Rule 12.1. Proposal text cannot be submitted or approved. A name, grounds, verification and explicit confirmation are required for the session-only demo signature.
- Mobile tabs show **Proposal text / AI Assistant** before conversion and **Note / Rules / AI Assistant** afterwards. Desktop panels scroll independently.

The workspace uses black text, white document surfaces and brand blue for primary actions, status accents and focus states. Secondary metadata remains available in labelled disclosures.

## First-case source mapping

The supplied `GPF-RULE-FINAL.pdf` governs the employee GPF case. The scanned `Untitled design (5).pdf` supplies the note's format only. The default request is Rs. 1,80,000 against a declared Rs. 6,00,000 subscription-and-interest balance, recovered in 36 instalments of Rs. 5,000. The note applies Rules 5, 12.1, 12.1.1(iii), 12.1.2–12.1.3, 12.1.4, 12.1.5 and 12.1.6. It requests record verification and Vice-Chancellor consideration; it does not invent an interest rate or use Rule 13 withdrawal conditions.

Inline rule highlighting is disabled in the editor, note preview and source preview. Rule references are plain text in the note and are listed explicitly in the post-conversion sidebar.

`npm run prepare:case --workspace @instinctgo/frontend` regenerates the sample proposal and reference note from the same case template used by the application. It runs before development and builds. The original supplied PDFs are retained; the scanned format example is not served publicly.

## Browser-side text conversion

- TXT / Markdown are decoded as UTF-8.
- Mammoth extracts DOCX paragraphs and table text.
- PDF.js extracts selectable PDF text in page order. Pages without a text layer are rendered locally and passed to OCR.
- Tesseract.js converts PNG / JPEG images and scanned PDF pages using the bundled English language model. Camera captures use the same path.
- The extracted text fills the editable document, is escaped before HTML rendering, and becomes the first saved **Browser extraction** version. It is a transcription, not an AI-generated finance recommendation. OCR output can be checked against the preserved original.
- PDF work and OCR workers are disposed after completion or cancellation. Processing continues if the user navigates back to intake and reopens the same document.
- Browser conversion supports PDFs up to 100 pages and results up to 200,000 characters. Empty results, unreadable documents and password-protected PDFs show errors rather than silently losing text.

`npm install`, `npm run dev` and `npm run build` prepare version-matched PDF / OCR worker assets under `frontend/public/document-workers/`. The files are copied from installed packages, ignored by Git and served from the same origin. English model data can be cached by Tesseract in the browser; document contents are not sent to an extraction service. To prepare these assets manually:

```sh
npm run prepare:documents --workspace @instinctgo/frontend
```

## Integration boundaries

All originals, drafts, history and demo signatures are held in the current browser session and clear on reload. Blob URLs are released on unmount. “Uploaded” means copied into the local session, not sent to a server.

Document conversion uses browser libraries, independently of the Python extraction helper. Note generation is a bounded local template for this single GPF case, driven by the reviewed fields rather than the filename. There is no general-purpose finance-note model, authenticated permission API or signing provider. The unrelated workflow-planning endpoint is not used. Extraction and template checks do not certify applicant-supplied account or service particulars.

Production services should supply approved rule matches with source IDs and locators, authenticated roles, durable saves, document retrieval, audit events and verified signature operations. The existing pure sequential workflow guards remain in use for the sample review journey. Browser role selection and a typed signatory name are demonstrations, not authentication or a digital-signature service.

## Main files

- `frontend/src/components/playground/administrative-playground.tsx`: two-page shell, session records, local preparation and permissions integration.
- `document-intake.tsx`, `scan-document.tsx`: intake, history and camera capture.
- `studio.tsx`, `note-editor.tsx`, `editor-extensions.ts`: stage-dependent editor / assistant layout and table-capable note formatting.
- `proposal-preview.tsx`: paginated live-draft preview.
- `finance-actions.tsx`: permitted actions and confirmation forms.
- `frontend/src/lib/playground/intake.ts`: supported formats, original-file records and local text reading.
- `extract-document.ts`, `document-text.ts`: browser conversion, progress / cancellation, PDF reading order and escaped draft creation.
- `frontend/public/document-ocr.js`: owned OCR worker using the bundled Tesseract engine.
- `frontend/scripts/prepare-document-workers.mjs`: prepares same-origin PDF / OCR assets and English model data.
- `gpf-case.ts`: first-case fields, rule extracts, checks, note format and explicit proposal-to-note transition.
- `document-pdf.ts`, `prepare-first-case.mts`: formatted PDF output and first-case artifact generation.
- `finance-actions.ts`, `workflow.ts`: assignment checks, sequential transitions and demo signature recording.

## Verification

```sh
npm run test:playground --workspace @instinctgo/frontend
npm run typecheck
npm run lint:frontend
npm run build
```

Tests cover sequential review and closure, source / amount validation, intake and extraction, proposal preservation, stage-specific approval restrictions, expected GPF note generation, source-page associations, field-driven output, and rejection of unsupported or inconsistent requests.
