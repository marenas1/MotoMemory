# MotoMemory Phase 2 — Completion and Handoff

Status: **Conditional handoff**

The application-side Phase 2 workflow is implemented and its credential-free
automated gates are covered. The owner-specific acceptance run remains open:
the copyrighted 67-page PDF is intentionally outside this repository, and the
current environment does not contain the owner's file or a Tesseract
executable. This note therefore leaves real-manual measurements fillable
instead of claiming OCR quality that has not been observed.

## Scope delivered

- One upload-only PDF associated with the private `gs750` motorcycle.
- 25 MB and 100-page intake limits with PDF header, page-count, and SHA-256 validation.
- Byte-identical duplicate rejection without a second document or ingestion run.
- Private server-mediated original PDF streaming with native browser viewing and range support.
- Page-aware OCR ingestion with resumable page rows, explicit page failures, printed-label retention, searchable chunks, and fact extraction.
- PostgreSQL full-text retrieval with source-linked PDF and printed-page coordinates.
- Provider-neutral answer boundary that fails closed as provider-unavailable until a model is chosen from real-manual evaluation evidence.
- Source-linked direct maintenance-fact correction without an approval queue.
- Phase 1 mileage repository and dashboard behavior preserved by additive migrations and regression tests.

## Automated validation record

Run these commands serially from the repository root:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
PLAYWRIGHT_PORT=3100 npm run test:e2e
npm run build
```

Current credential-free evidence:

| Gate | Result |
|---|---|
| Lint | pass |
| Typecheck | pass |
| Unit tests | pass |
| Integration tests | pass |
| E2E tests | pass — 4 passed, 2 expected database-gated skips; loopback permission was supplied for the run |
| Production build | pass |
| Private manual or secret in Git | pass — checked during Phase 8 |

The E2E suite includes mocked browser coverage for upload, duplicate rejection,
private PDF viewing, source citations, OCR-failure visibility, fact
correction, and the isolated Phase 1 mileage API contract. A configured local
database remains required for the existing connected dashboard journey.

## Real-manual measurements

Complete [the real-manual acceptance record](./PHASE_2_ACCEPTANCE_RECORD_TEMPLATE.md)
outside Git using the owner's exact absolute PDF path.

| Measurement | Result |
|---|---|
| Owner PDF path | `/absolute/path/to/owner/67-page-gs750-manual.pdf` |
| File size | pending |
| Page count | pending; expected 67 |
| SHA-256 | pending |
| OCR engine and version | pending; local Tesseract CLI candidate |
| OCR-available pages | pending `/ 67` |
| Explicit OCR-failure pages | pending |
| Searchable chunks with page provenance | pending |
| Extracted maintenance facts | pending |
| Answer-provider choice | unavailable until evaluation is complete |
| Answerable-question retrieval result | pending `/ 8` |
| Unsupported-question refusals | pending `/ 2` |
| Citation page-open checks | pending |
| Duplicate upload check | pending |
| Fact correction and mileage-preservation check | pending |

## Explicit deviations and conditions from the CONOPS

1. **Real-manual evidence is not yet measured.** The CONOPS requires evidence
   from the actual scanned manual; this environment has only synthetic tests and
   injected OCR doubles. The real-manual record is a release condition for a
   full GO.
2. **OCR implementation is the local Tesseract CLI adapter.** The CONOPS kept
   the OCR engine replaceable and the plan listed Tesseract.js as a candidate;
   the implementation selected Poppler rendering plus Tesseract CLI for the
   first local capability boundary. The adapter can be replaced without
   changing storage, provenance, or retrieval contracts.
3. **No answer model is selected.** The CONOPS intentionally deferred provider
   choice. The shipped default is `MOTOMEMORY_ANSWER_PROVIDER=unavailable`, so
   browsing and search work while generated answers fail closed. Phase 3 must
   select and evaluate a provider before enabling it.
4. **Access remains private by deployment convention, not user authentication.**
   The PDF bucket and route are server-mediated and do not expose a public
   storage URL, matching the current private-app decision. Authentication,
   ownership, and RLS remain required before public deployment.
5. **The acceptance UI reports aggregate failure counts.** Durable page rows
   retain individual failure messages for operational inspection, while the
   current workspace shows status, counts, and the document-level failure
   message. A richer page-error drilldown is deferred until real-manual use
   demonstrates that it is needed.
6. **The browser-native viewer is tested at the route/DOM boundary.** Native PDF
   rendering varies by browser and cannot be fully asserted by a headless DOM
   test; the suite verifies private HEAD/GET behavior, page-target URLs, and
   the iframe source, while the owner acceptance record requires a real browser
   page-open check.

## Phase 3 handoff rules

- Keep `manual_documents.sha256` and the original private object immutable.
- Treat `manual_pages` as the page-accounting ledger; never silently skip a page.
- Preserve both 1-based PDF page index and printed page label in every source reference.
- Keep answer-provider credentials and calls server-only; do not enable a model by changing only a client setting.
- Keep corrections separate from raw OCR evidence and preserve correction origin/timestamp.
- Do not add multiple manuals, replacement lineage, public access, or service history without revisiting the CONOPS.
- Re-run the full validation suite after any OCR, retrieval, storage, or source-link change.
