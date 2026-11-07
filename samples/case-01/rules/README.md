# Shared rulebook sources

The shared source directory is:

```text
D:\instinctgo\samples\case-01\rules\
```

The supplied procurement manuals are now registered, alongside GPF and consultancy:

| Original PDF | Actual pages | Registered provisions |
| --- | --- | --- |
| `dms22_assam_public_procurement_rules_2020.pdf` | 104 | 23 reviewed Assam procurement entries |
| `Revision_of_Manual_for_Procurement_of_Works_2019.pdf` | 187 | 12 reviewed central works entries |

Both originals remain intact. The full PDFs are available through the current
proposal's applicable references; the panel displays only selected provisions.

These PDFs are reference material for future proposals. They are registered in the
shared `samples/noting-library.json` with their institution/scope, edition, clause
summaries, applicable proposal categories and PDF page locators. Preparation then
copies registered PDFs to public assets and the backend bundle and records source
hashes. Future files also require registration rather than just copying them here.

The application's single proposal upload flow identifies the request from reviewed
text and selects the note profile and applicable registered rules automatically.
There is no procurement/type/mode selector in that flow.

The browser's 100-page, 20 MB and 200,000-character limits apply to an individual
proposal conversion. They are not limits on storing these reference manuals here.

See [procurement source review and applicability](../../procurement-sources.md).
