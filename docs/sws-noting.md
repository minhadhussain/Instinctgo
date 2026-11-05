# Student Welfare procurement noting

Choose **Student Welfare · Procurement** in the noting workspace's **Module** selector.
Upload a proposal or choose **Use sample**, convert it to text, review it, then select
**Convert to note**. Each case retains its selected module and layout for the session.

## Concise note structure

SWS notes use four sections:

1. Issue / Proposal Summary
2. Financial Implication & Budget Head
3. Rule Justification (GFR / Assam Procurement)
4. Recommendation / Seeking Approval

Local drafting uses the reviewed proposal's particulars and short template wording.
When OpenAI drafting is configured, the backend requests the same four sections and rejects
responses over the requested word target or containing unsupported procurement-rule citations.
Failure uses the local draft. No procurement provision is borrowed from the GPF or consultancy books.

The default target is **300 body words per note**, configurable from 100 to 1,000 in
**Layout & brevity**. Live word/character counts and a shortening prompt appear when a human-edited
note exceeds the target. Editing remains possible and text is never silently truncated.

**Add note** appends another four-section note. Note headings are numbered automatically
(`Note #1`, `Note #2`, ...); nonempty top-level paragraphs are renumbered within each note.
Table-cell paragraphs and section headings are excluded from paragraph numbering.

## Paper and printing

- Default: **Legal portrait, 215.9 × 355.6 mm (8.5 × 14 inches)**.
- Alternative: **A3 portrait, 297 × 420 mm**.
- Defaults: **35 mm left binding margin**, 20 mm top/right/bottom. Margins are editable.
- Type: 12-point Times-family body text with common spacing in the writing canvas and print renderer.
- The writing canvas fits the available screen width; **Print layout** shows automatic page breaks,
  repeated table headers, continuation paragraphs and `Page X of Y` footers.
- Choose white for ordinary paper or printing onto physical green stock; choose green to include
  the pale-green background in the preview and output.

The same paginated HTML/CSS layout drives the on-screen print view, printing, and both downloads.
**PDF and fixed-layout Word downloads contain high-resolution page images**, preserving the page
appearance, merged cells, numbering and margins without Word reflow. Edit the content in the workspace
and re-export. For selectable-text PDF, use **Print layout → Print → Save as PDF** in the browser.
Use the matching paper size, 100% scale, no browser headers/footers, and background printing when green
colour is selected. Printer hardware and print-dialog overrides can affect physical output.

The writing canvas is continuous for editing; the paginated print view is the output reference.
Long paragraphs split while retaining inline formatting; tables split between rows and repeat
their header. Vertically merged row groups remain together. A merged group taller than the writing
area produces an actionable layout error rather than clipped output.

## Table controls

The **Table** menu provides insertion, rows above/below, columns before/after, deletion,
merge/split, header-row toggling and auto-fit. Drag across cells to select a range for merging.
The alignment control supports left, centre, right and justified text. SWS tables fit the
writing width; merged-row and merged-column attributes are retained in the print renderer.

## Procurement reference slots — pending source PDFs

The SWS sidebar reserves two distinct groups:

- **GFR & University Procurement Rules** — including the University's adopted amendments.
- **Assam Procurement Rules** — including the applicable State guidelines.

The user deferred adding these sources. No clauses, financial thresholds or procurement-method
eligibility have been invented. The groups remain labelled **Rulebook to be added**, and the
draft identifies the pending rule justification. Clause import, tagging and insertion will be
connected after the exact PDFs are provided.

**Reminder:** supply both sets of rulebooks before completing procurement rule integration.

## Checks

```powershell
npm run test:sws --workspace @instinctgo/frontend
npm run test:playground --workspace @instinctgo/frontend
uv run --directory backend pytest -q
npm run lint:frontend
npm run lint:backend
npm run build
```

Browser verification covers the SWS sample flow, separate source placeholders, table row/column
changes and merge/split, automatic note numbering, long-paragraph/table pagination, both paper
sizes, margin and word-target changes, PDF page dimensions and fixed-layout Word page dimensions.
