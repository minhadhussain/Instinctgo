# Case 01: GPF higher-education advance

## Try it

1. Upload `proposals/gpf-advance-proposal.pdf`, or choose **Use sample** in the playground.
2. Choose **Convert to text**. This stage shows the proposal text and AI Assistant only.
3. Review the text, then choose **Convert to note**.
4. The note uses the format in the supplied note sample. The sidebar now shows the seven applied GPF rule entries and their application to this case.

The reference output is `notes/gpf-advance-note.pdf`. Readable `.txt` versions are included beside both generated PDFs. The original PDF, reviewed proposal text and editable note are kept separately in the browser session.

## Supplied sources

- **Rules:** `rules/GPF-RULE-FINAL.pdf`, Dibrugarh University General Provident Fund Rules, 2013. Relevant PDF pages: 4, 7 and 8.
- **Format:** `notes/Untitled design (5).pdf`, particularly PDF pages 6–7. The routing heading, applicant table, formal examination paragraphs, conditional recommendation and closing inform the new format. Its fee-refund facts and accounting codes are not used as GPF authority.
- `case-manifest.json` records the source paths, rule-page mapping and SHA-256 digest of the supplied rulebook.

## Fictional application particulars

- Applicant: Dr. Aditi Bora, Assistant Professor, Department of Physics.
- Permanent appointment: 15 July 2002; CPF membership before 1 February 2005 and continued service on 31 March 2013 are declared.
- Declared GPF subscription-and-interest balance: Rs. 6,00,000.
- Advance sought for dependent daughter Anika Bora's higher education: Rs. 1,80,000.
- Principal recovery: 36 monthly instalments of Rs. 5,000.
- No previous advance is declared outstanding.

## Applied rules

| Provision | Application |
| --- | --- |
| Rule 5 | Subscriber eligibility and service-record checks |
| Rule 12.1 | Vice-Chancellor is the sanctioning authority |
| Rule 12.1.1(iii) | Higher education of an actually dependent person; pecuniary circumstances must justify the advance |
| Rules 12.1.2–12.1.3 | 50% balance ceiling (Rs. 3,00,000 here) and repayment of the previous advance |
| Rule 12.1.4 | At most 36 equal whole-rupee principal instalments |
| Rule 12.1.5 | Recovery begins with the first full-month pay after the advance |
| Rule 12.1.6 | University-determined interest and its recovery |

This is a refundable advance under Rule 12. The Rule 13 withdrawal service conditions are not applied. No numerical interest rate, real bank account, verified institutional ledger or head-of-account code is fabricated. The note requests verification and consideration; it is not a sanction order.

## Generation contract

The first-case template reads the labelled fields from the reviewed proposal text, rather than selecting a note based on the filename. Missing, conflicting or unsupported fields produce an error while preserving the proposal. The prescribed eligibility declarations, 50% ceiling, no-outstanding-advance condition and equal-instalment arithmetic are checked before the note is prepared. This is a local, bounded template for this case, not a general-purpose note-generation model.

Generated files are produced by the same template used by the frontend:

```sh
npm run prepare:case --workspace @instinctgo/frontend
```

The command regenerates the named GPF proposal / note PDFs and text versions, copies them and the supplied rulebook to `frontend/public/samples/case-01/`, and updates the manifest. It also runs before frontend development and production builds. The supplied scanned format example is not copied into public assets.
