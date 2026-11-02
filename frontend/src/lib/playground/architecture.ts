export const integrationBoundaries = [
  { name: "Document processing & OCR", scope: "Institution-controlled", detail: "Original files and extracted content remain local. This demo previews supplied text and accepts local text fixtures; OCR is not connected." },
  { name: "Sensitive-data detection", scope: "Future local service", detail: "Presidio and GLiNER inspect content within the institution. Identity mappings stay local; pseudonymization is not a guarantee of anonymity." },
  { name: "Privacy gateway", scope: "Future policy boundary", detail: "Apply disclosure policy, minimization and sensitivity checks before any external API call. Confidential rules and case records stay institution-controlled." },
  { name: "Adaptive reasoning", scope: "Local mock adapter", detail: "Case-specific templates choose relevant checks. Production can combine local or permitted API models, bounded typed classification and deterministic tools." },
  { name: "Knowledge & evidence", scope: "Synthetic collection", detail: "Production retrieval, indexing, source approval and evidence validators connect here. No crawling or authoritative policy verification is active." },
  { name: "Workflow & case storage", scope: "Browser session only", detail: "The demo enforces sequential movement in client state. Production requires authenticated server-side permissions, durable audit records and a case database." },
];
