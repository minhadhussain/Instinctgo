# Noting sources and example case

`case-01` is now configured for a refundable GPF advance for a dependent child's higher education, using the supplied Dibrugarh University GPF Rules, 2013.

```text
case-01/
  proposals/   Generated GPF application PDF and readable text
  rules/       Applicable regulations, circulars and rulebook pages
  notes/       Example completed notes for writing style and structure
```

Upload your own proposal or `case-01/proposals/gpf-advance-proposal.pdf` to try the complete workflow. A fixed reference note is `case-01/notes/gpf-advance-note.pdf`; the workspace now uses the general drafting flow, so its wording can differ. The supplied rules PDFs and scanned note-format example are retained in their original folders.

PDF is supported; there is no need to convert the files to Word. Searchable PDFs are preferred. Scanned pages can use the playground's English OCR.

Sample notes need not follow these particular rules. They are examples of format, wording and structure; the supplied rules determine the new note's reasoning and citations.

## First-case flow

1. Upload the generated GPF application, or select **Use sample** in the playground.
2. Convert it to text and review the extracted content.
3. Choose **Convert to note** as a separate action.
4. Prepare the note using the applicable supplied rules.
5. Browse the full rule reference library beside the note. Inline highlighting is disabled for now.
6. Review and edit the note.

See `case-01/README.md` and `case-01/case-manifest.json` for the source mapping and regeneration command.

## Library used for newly uploaded proposals

`noting-library.json` contains the reviewed format guide and clause summaries consumed by both
the frontend local drafter and backend AI drafter. Format pages refer to PDF page positions,
not handwritten page numbers. The format guide comes from `case-01/notes/Untitled design (5).pdf`:
fee refunds (6–7, 13), admission refunds (10–11, 15), service refunds (8–9), and hostel refunds (12).

Rule sources:

- `case-01/rules/GPF-RULE-FINAL.pdf`: subscriber eligibility, advances, withdrawals and final payment.
- `case-01/rules/Consultancy-Service-Rules-of-Dibrugarh-University.pdf`: seven scanned pages,
  endorsed as approved at the EC's 345th meeting on 23–24 March 2021, Resolution 18. The library
  covers administration/prior approval (2–3), billing and earnings distribution (3), acceptance,
  TA/DA and hospitality (4), taxation and fee components (5), consultancy leave (5–6), categories
  (6–7), and records (7). Its stated service-tax rate is recorded as source wording requiring
  transaction-date verification, not applied automatically to a new transaction.
- `case-01/rules/dms22_assam_public_procurement_rules_2020.pdf`: 104 scanned pages;
  Assam Public Procurement Rules, 2020, notification dated 2 September and Gazette
  dated 8 September 2020. The library contains 23 reviewed entries.
- `case-01/rules/Revision_of_Manual_for_Procurement_of_Works_2019.pdf`: 187 pages;
  Government of India works manual, 2019 edition. The library contains 12 reviewed entries.

Consultancy clauses are used for University consultancy and relevant consultancy-service refunds.
They do not establish a student-fee refund policy or refund percentage. Earnings distribution is
60% to the consultants/staff group and 40% to the University, with a further 60:40 split *within*
the group share. Unknown staff participation or distributable earnings require confirmation.

To add another rulebook, review the original PDF, add its metadata and relevant summaries to the
library, connect its request category/relevance conditions, and run the frontend preparation command.
New PDFs are not automatically treated as applicable rules. Preparation copies registered rulebooks
to public assets and records their SHA-256 hashes in `noting-source-manifest.json`.

## Procurement manuals and automatic note selection

Both procurement manuals are registered from `samples/case-01/rules/`
(`D:\instinctgo\samples\case-01\rules\` in this checkout). Their original filenames
and contents are retained. See [source review](procurement-sources.md) and
[source-folder instructions](case-01/rules/README.md).

Every proposal uses the same upload → review text → convert to note flow. The
software detects the request category from the subject and reviewed body, then
selects its note profile internally. Procurement has an automatically selected
examination profile for requirements, expenditure, sourcing and financial authority;
it has no separate screen or mode selector. Assam-context procurement selects the
Assam rules; central-context works or explicit adoption of the central manual can
select works provisions. A supplier address alone does not establish jurisdiction.
Quoted policy limits come only from selected provisions and remain distinct from
the applicant's amounts. Applicable amendments, institutional coverage and actual
financial delegations are recorded for confirmation in draft metadata.
