# MotoMemory Phase 2 — Manual Ingestion and Source Viewer CONOPS

This document refines Phase 2 of the [MotoMemory Concept of Operations](./MOTOMEMORY_CONOPS.md). It starts from the completed Phase 1 web application, PostgreSQL persistence, and manual mileage workflow. Phase 2 adds the motorcycle's service manual as an inspectable source: the rider can open the Manual tab, view the actual PDF, navigate to cited pages, and use ingested manual content for source-backed maintenance guidance.

This is an operational concept. It defines the user experience, operational boundaries, decisions, and evidence needed before implementation planning. It does not define a database vendor, extraction library, model provider, or code task list.

This revision records the current working choices: the first release is upload-only, supports one scanned 67-page/3.7 MB PDF, uses OCR for searchable text, shows both PDF and printed page labels, uses a browser-native PDF surface with barebones controls, rejects identical reuploads, and keeps the document private through the server-side application path.

The companion [Phase 2 Implementation Plan](./PHASE_2_IMPLEMENTATION_PLAN.md) translates this operational concept into an executable sequence with architecture, phase gates, test coverage, and handoff criteria.

## Table of Contents

- [Purpose](#purpose)
- [Problem Statement](#problem-statement)
- [Stakeholders & Roles](#stakeholders--roles)
- [System Overview](#system-overview)
- [Part 1: Manual Intake and Document Lifecycle](#part-1-manual-intake-and-document-lifecycle)
- [Part 2: Actual PDF Manual Viewer](#part-2-actual-pdf-manual-viewer)
- [Part 3: Searchable Manual Knowledge](#part-3-searchable-manual-knowledge)
- [Part 4: Manual-Grounded Maintenance Guidance](#part-4-manual-grounded-maintenance-guidance)
- [Schema / Data Model Additions](#schema--data-model-additions)
- [Implementation Phases](#implementation-phases)
  - [Phase 2A: Manual Storage and Intake](#phase-2a-manual-storage-and-intake)
  - [Phase 2B: PDF Viewer and Page References](#phase-2b-pdf-viewer-and-page-references)
  - [Phase 2C: Extraction, Retrieval, and Grounded Guidance](#phase-2c-extraction-retrieval-and-grounded-guidance)
- [Design Decisions](#design-decisions)
- [Test Strategy](#test-strategy)
- [Open Questions](#open-questions)

## Purpose

- Replace the provisional Phase 1 maintenance cadence with knowledge tied to the motorcycle's actual service manual.
- Let the rider inspect the original PDF instead of trusting extracted text or generated answers alone.
- Make every manual-backed answer and displayed interval traceable to a page or section.
- Preserve a usable manual-browsing experience when extraction, search, or answer generation is unavailable.
- Establish evidence for later service-history calculations without bringing service records, mobile, or GPS into this phase.

## Problem Statement

The following statements distinguish what is already true in the Phase 1 application from concerns that Phase 2 must measure.

| Problem | Observed Impact |
|---|---|
| Confirmed: the left rail contains 1 deferred Manual navigation item and no manual workspace. | The rider currently has 0 in-app paths to inspect the service manual or verify a maintenance answer. |
| Confirmed: Phase 1 uses a provisional 1,000-mile maintenance cadence rather than the service manual. | The current outlook can identify a mileage target, but it does not identify the actual service operation or source page behind that target. |
| Confirmed: Phase 1 persists motorcycle state and mileage, but 0 manual-document processing states or source references are persisted. | A manual cannot yet be uploaded, retried, associated with the GS750, or reported as ready or failed. |
| Confirmed: the selected source is 1 scanned PDF measuring 67 pages and 3.7 MB. | Phase 2 must run OCR before the document can support searchable questions, while preserving the original pages for inspection. |
| Projected: OCR can lose tables, diagrams, page boundaries, or text from scanned pages. | A single missed interval or safety note could produce an incomplete answer; OCR coverage and page traceability must be measured on at least 1 real manual. |
| Projected: Sending an entire manual to an answer model on every question creates uncontrolled context and weak source attribution. | Retrieval must be evaluated with a question set of at least 10 representative questions, including questions whose answers are absent from the manual. |

## Stakeholders & Roles

| Stakeholder | Role | What They Need From This System |
|---|---|---|
| Motorcycle owner / rider | Supplies the service manual, browses it, and asks maintenance questions. | A direct view of the original document and answers that can be checked against it. |
| Product owner | Decides whether Phase 2 is useful and safe to advance. | Clear ingestion status, measurable evidence quality, and explicit behavior when the manual cannot support an answer. |
| Operator / maintainer | Keeps document storage, processing, and answer services available. | Recoverable failures, observable processing states, and no false “ready” status. |
| Future service-history user | Uses manual-derived intervals in a later phase. | Stable definitions with the source page and exact manual identity that produced them. |
| Portfolio reviewer | Inspects the product's intended workflow. | A coherent Manual tab that demonstrates the source document rather than a hidden or simulated knowledge layer. |

## System Overview

```text
 Rider
   │ upload / open Manual / ask question
   ▼
 Manual Workspace ───────────────► Original PDF Viewer
   │                                      │
   │                                      └── page and section inspection
   ▼
 Document Processing ───────────► Page-aware Searchable Knowledge
   │                                      │
   │                                      ├── cited answer passages
   └── status / OCR errors                 └── manual-backed intervals
                                          │
 Motorcycle Profile ◄────────────────────┘
        │
        └── maintenance outlook with source references
```

Phase 2 connects one service-manual PDF to the Phase 1 GS750 motorcycle state. The original file remains the source a rider can view. A separate processing path extracts page-aware text and maintenance facts for search and answers. The viewer, retrieved passages, and maintenance definitions all refer back to the same manual identity so the rider can move from an answer to the page that supports it.

## Part 1: Manual Intake and Document Lifecycle

### Concept

The rider enters the Manual area from the left rail and sees the manual associated with the configured 1981 Suzuki GS750. If no manual exists, the workspace explains what is missing and offers the upload path. The first Phase 2 workflow is upload-only and supports one service-manual PDF for this motorcycle; it does not require the rider to create an account or manage multiple motorcycles.

After the rider supplies a PDF, MotoMemory keeps the original document and reports its lifecycle: not uploaded, uploaded, processing, ready, or failed. The rider can tell whether the document is available for browsing, whether its searchable knowledge is ready, and whether a retry is needed. A failed processing attempt does not remove a previously ready manual or replace the last usable source with partial output.

### Why This Approach

Associating the manual with the existing motorcycle profile keeps the source context explicit. A question about the GS750 should not depend on an unscoped document list or on the rider remembering which file was intended. The accepted trade-off is a single-manual, upload-only scope in the first release; that keeps model/year association and source selection understandable while the ingestion behavior is being proven.

An alternative was to bundle a PDF in the application and skip intake. That would make the first demonstration quick but would hide the real document lifecycle and make upload and retry behavior impossible to validate. Another alternative was to support multiple manuals immediately. That would help with supplements and market variants, but it would require source precedence and conflict rules before the basic workflow is trustworthy.

For the selected 67-page, 3.7 MB PDF, a working starting guardrail is 25 MB and 100 pages per upload. These limits are not claimed as universal platform standards; they provide roughly 6.7 times the observed file-size headroom and 1.5 times the observed page-count headroom while keeping accidental oversized uploads out of the first release. They should be revisited after the real upload and processing path is exercised.

The first release does not create a user-facing manual-version history. A second manual or supplement is outside this phase. Reprocessing the same uploaded file may still happen when extraction improves, but that is an operational retry, not a new source that requires citation migration.

### Operational Scenarios

**Sunny Day**

1. The rider selects Manual in the left rail.
2. The workspace identifies the current motorcycle and shows whether an active manual is available.
3. The rider uploads or selects the service-manual PDF.
4. MotoMemory stores the original file, associates it with the GS750, and reports processing progress.
5. The rider can open the PDF while processing status and later searchable knowledge status remain visible.
6. When processing completes, the manual is ready for page-linked search and source-backed questions.

**Failure Modes**

| Failure | Behavior |
|---|---|
| The file is not a PDF, is empty, or cannot be read. | Keep the prior manual unchanged, identify the intake problem, and provide a retry path. |
| The upload is interrupted. | Do not show the file as ready; preserve the last complete manual and allow a new attempt. |
| Processing fails after the file is stored. | Keep the original PDF available for viewing, mark searchable knowledge as failed, and expose a retry action. |
| A manual is associated with the wrong motorcycle or model/year. | Flag the mismatch before it becomes the active knowledge source; do not silently answer from it. |
| An identical copy of the current PDF is uploaded again. | Reject the duplicate before creating a new document or restarting ingestion; the existing source remains unchanged. |
| The storage service is unavailable. | Show a clear unavailable state and do not report a successful upload or processing completion. |

### Implementation Touch Points

- `components/motorcycle-main-view.tsx` - replaces the deferred Manual rail item with a route into the manual workspace while preserving the Phase 1 dashboard.
- New manual workspace route under `app/` - presents motorcycle association, document state, intake, and access to the viewer.
- New manual API routes under `app/api/` - expose upload, status, retry, and source metadata without exposing database credentials.
- `lib/data/motorcycle-repository.ts` - remains the Phase 1 motorcycle boundary and supplies the association target.
- New manual repository and storage boundary - retains document identity, original-file location, processing state, and error state.
- Upload guardrail - starts at 25 MB and 100 pages, pending validation against the selected manual and similar future inputs.
- Supabase migration files under `supabase/migrations/` - add the document lifecycle records without changing the accepted Phase 1 mileage behavior.

### Expected Impact

The rider should be able to determine the active manual's state in 1 visit to the Manual workspace and recover from a failed processing attempt without database intervention. For the first real PDF, all observed lifecycle transitions must end in a truthful state: ready only when the original file is viewable and searchable knowledge has passed its evidence checks; failed when it has not. The measurement is a transition audit covering at least 1 successful and 1 failed or deliberately interrupted ingestion path, plus confirmation that the 67-page, 3.7 MB file remains below the working limits.

### Access Boundary Discussion

Phase 2 remains a private personal workflow. The uploaded PDF is available to the configured motorcycle through the server-side application path, not as a public document listing or direct public storage URL. The browser-native viewer may expose the normal controls supported by the browser, such as download or print, because the rider supplied the source and needs to inspect it.

This is the access decision for Phase 2. If MotoMemory later becomes publicly reachable, authentication and private storage access can be revisited as a separate product decision. Phase 2 does not add public sharing or a public manual URL.

## Part 2: Actual PDF Manual Viewer

### Concept

The Manual item in the left rail becomes a working navigation entry that switches from the dashboard to a manual page. That page displays the actual stored service-manual PDF, not only a text extraction, summary, or generated answer. The rider can move through pages, see the current page relative to the document, and return to the dashboard without losing the motorcycle state.

The viewer is also the inspection surface for trust. When a search result, maintenance interval, or answer cites a page, the rider can open that citation in the PDF viewer and compare the explanation with the original page. Citations retain both the PDF page index used for navigation and the printed page label when one is visible in the scan. The viewer remains useful when the answer service is unavailable; source browsing is a separate capability from retrieval and generation.

### Why This Approach

Showing the original PDF beside page-aware references gives the rider a direct verification path. A browser-native PDF surface is the working choice for this release, with the application providing only the surrounding Manual page, document status, return navigation, and citation page target. It accepts the trade-off that native controls and page-target behavior can vary by supported browser. That cost is justified because the first release needs source inspection more than a custom document-reading product.

An alternative was to open a raw download or native PDF URL without a MotoMemory manual page. That preserves the file but weakens the connection between citations, processing status, and the Manual tab. Another alternative was to build a custom PDF reader with thumbnails, custom zoom, text search, and print controls. That would improve consistency but would make a 67-page source viewer larger than the Phase 2 problem requires. A text-only manual reader was also considered; it would be easier to control, but it would not satisfy the need to inspect the actual manual page and would hide extraction errors.

The barebones viewer experience is therefore: open the original PDF, show document status, support a page target for citations, provide a clear return to Dashboard, and let the browser supply its normal PDF controls where available. Thumbnails, custom search, custom zoom, and print controls are not Phase 2 product requirements.

### Operational Scenarios

**Sunny Day**

1. The rider selects Manual in the left rail.
2. The manual page opens the active PDF at its first page or the page named by the incoming citation.
3. The rider uses previous/next controls or a page selector to browse the document.
4. The rider selects a cited source from a manual-backed answer.
5. The viewer switches to the cited PDF page and identifies the relevant page or section.
6. The rider returns to Dashboard and sees the same persisted mileage and maintenance state as before.

**Failure Modes**

| Failure | Behavior |
|---|---|
| The original PDF is missing or cannot be rendered. | Show the document-unavailable state, retain any source metadata, and do not imply that extracted text is the original page. |
| A citation points to a page outside the document range. | Mark the citation invalid, open the nearest safe manual state if possible, and log the mismatch for correction. |
| A page contains an image, diagram, or table that is not extractable. | Preserve the PDF page as the inspection source and label text-based search as incomplete rather than inventing missing content. |
| The rider refreshes while viewing a page. | Reopen the same manual and page when the source is still available, or explain why the position could not be restored. |
| PDF rendering is slow or blocked by the browser. | Show a loading or unavailable state with a direct source access fallback; keep the rest of the manual workspace understandable. |
| The manual is still processing. | Allow browsing of the original PDF when possible, but distinguish page viewing from searchable-answer readiness. |

### Implementation Touch Points

- Manual navigation in `components/motorcycle-main-view.tsx` - activates the left-rail Manual item and communicates the current page context.
- New manual route under `app/` - provides the full-page manual workspace and return path to Dashboard.
- New PDF viewer component under `components/` - displays the original file, page controls, loading state, and citation navigation.
- Browser-native PDF surface - renders the original file and delegates zoom, search, download, and print controls to the supported browser where available.
- New source endpoint under `app/api/` - authorizes or scopes access to the original PDF and its metadata.
- `app/globals.css` - extends the existing gunmetal/amber visual system to the manual workspace without changing the Phase 1 dashboard contract.
- Manual page and citation metadata - keeps PDF page indexes and printed page labels aligned with retrieved passages and extracted maintenance facts.

### Expected Impact

For a selected real manual, the rider should reach any valid cited page in no more than 2 actions after selecting the citation, and the displayed PDF page should match the citation metadata in 100% of the supported-browser page-navigation test cases. When a printed label is available, it should be shown alongside the PDF page index. The viewer is successful when a reviewer can distinguish the original PDF from extracted content and can browse the source even when retrieval or answer generation is unavailable.

## Part 3: Searchable Manual Knowledge

### Concept

Once the original PDF is stored, MotoMemory creates searchable representations that retain page and section context. The rider does not need to understand chunks, embeddings, or extraction internals; they see processing status and later receive relevant passages with enough location information to open the source page.

The processing path treats OCR as the searchable representation of the scan, not as a replacement for the original manual. It preserves page boundaries, the PDF page index, and the printed page label when one is visible. Search can return no evidence. A missing result is an honest limitation rather than an invitation to answer from general motorcycle knowledge.

### Extraction and OCR Quality Discussion

Because the selected PDF is scanned, OCR is required to make its words searchable. OCR looks at each page image and guesses the characters shown there. It can confuse characters and symbols such as `1` and `l`, `0` and `O`, decimal points, fractions, or punctuation in a torque value. The original PDF page remains the authority when the OCR text is unclear.

The safe starting point is deliberately simple. Process all 67 pages, keep the original scan, map every OCR result to its PDF page index, retain the printed page label when it is visible, and ingest the extracted facts by default. Do not build a review queue or require approval before the facts appear. If a fact looks ambiguous, the rider can follow its source link, compare it with the scan, and correct the captured task, interval, unit, or note directly.

For this phase, “good enough” means the OCR is operationally traceable, not that every character is perfect. The first acceptance check is:

- 67 of 67 pages are accounted for after OCR.
- Every searchable passage and maintenance fact links to a PDF page index.
- Printed page labels are retained when they can be read from the scan.
- OCR processing failures are visible instead of silently producing empty pages.
- The 10-question evidence evaluation measures whether answers find the right source pages; it does not create a human approval requirement for every extracted fact.

There is no separate user-facing OCR confidence state in this release. A page is either available for search, or it has an OCR failure that is visible while the original page remains available for inspection. This keeps the workflow understandable while preserving the safe fallback: the scan is always available for double-checking.

### Why This Approach

Page-aware retrieval is chosen because it balances useful question answering with inspectable source context. It accepts the trade-off that content must be split and indexed carefully and that some questions may require more than one passage. That is preferable to treating the PDF as one opaque prompt, where context size, page references, and contradictions become difficult to control.

An alternative was to extract only a hand-written maintenance table. That would make interval calculations simple for one manual but would omit procedures, warnings, troubleshooting, and the explanations riders may ask about. Another alternative was to use a general web search or model memory. That could produce broader answers, but it would weaken the exact model/year relationship and would not provide a reliable page in the rider's own manual.

### Operational Scenarios

**Sunny Day**

1. Processing reads the PDF and records page-aware text and section metadata.
2. The system records whether each page's OCR output is available or failed.
3. The rider asks a question about a procedure, interval, specification, or warning.
4. Search returns the most relevant manual passages with page and section references.
5. The rider opens a passage in the actual PDF viewer to verify it.

**Failure Modes**

| Failure | Behavior |
|---|---|
| OCR returns no text for a page. | Retain the original page, mark OCR unavailable for that page, and avoid claiming that the manual has no answer there. |
| OCR produces low-confidence or garbled text. | Keep the original page view available, expose the source link, and let the rider double-check or correct the captured fact later. |
| A table is split across pages or columns. | Preserve page range and section context; do not collapse the table into one unverified value. |
| Search returns weak or unrelated passages. | Report that manual evidence is insufficient instead of returning a confident generic response. |
| Processing is retried for the same uploaded file. | Keep the document identity, replace only the incomplete OCR result, and preserve the original PDF as the source. No user-facing manual-version migration is needed in this phase. |
| The searchable index is unavailable. | Keep PDF browsing available and report search as unavailable; do not fabricate retrieval results. |

### Implementation Touch Points

- New OCR and page extraction boundary under `lib/` - converts the scanned PDF into page-aware searchable text while preserving the original source.
- Page traceability - accounts for all 67 pages and links every extracted passage and maintenance fact to its PDF page index and printed label when available.
- New retrieval boundary under `lib/` - searches manual content while returning source page, section, and manual identity.
- New ingestion status and observability path - records pending, ready, failed, and page-level OCR errors.
- Manual database migration - stores pages, chunks, extraction metadata, and searchable representations.
- `lib/domain/types.ts` - adds application-level contracts for manual documents, source references, and processing state.
- Manual API routes - expose status and retrieval results without allowing the browser to bypass the server boundary.

### Expected Impact

Before Phase 2 is accepted, the first real manual must be evaluated with at least 10 questions: procedure questions, interval questions, specification questions, and at least 2 questions whose answers are not present. The working pass criterion is that every accepted result includes a valid manual identity and page reference, at least 9 of 10 answerable questions return relevant evidence, unanswered questions are labeled insufficient rather than answered without evidence, and all 67 pages remain traceable to the original PDF. OCR facts are ingested by default; a later correction path handles facts the rider finds ambiguous.

## Part 4: Manual-Grounded Maintenance Guidance

### Concept

The rider can ask MotoMemory what the manual says about a maintenance task, and the response is presented as an explanation tied to retrieved manual passages. The answer distinguishes the manual's wording from MotoMemory's explanation and gives the rider a path to inspect the cited page. If the manual does not support the question, the product says so and leaves the rider with the source-browsing option.

Phase 2 also identifies model-specific maintenance definitions from the OCR output. The working trust rule is simple: ingest the facts that the manual presents, use their source pages as the double-check path, and do not require approval before they appear. If a fact is ambiguous, the rider can inspect the original page and directly correct the captured task, interval, unit, or note. The correction changes the active value while preserving the source reference; it is not a review queue. Phase 2 does not record completed service events or calculate personalized overdue status; those remain Phase 3 responsibilities.

### Why This Approach

Grounded answers are chosen over model-only advice because the service manual is the most relevant source for this motorcycle's procedures and intervals. The trade-off is narrower coverage and more visible uncertainty when the manual is silent or ambiguous. That is acceptable for maintenance guidance, where a clearly limited answer is safer and more trustworthy than a fluent unsupported one.

An alternative was to replace the provisional schedule with manually entered intervals without showing the source. That would improve the numbers but would make later corrections difficult and would not help with procedural questions. Another alternative was to add a formal human approval queue for every extracted fact. That would improve control but would turn this personal tool into review-management software before the rider has seen whether the OCR is useful. The chosen trade-off is to ingest by default, preserve traceability, and keep correction lightweight.

### Answer Model Discussion

The answer model is still an open selection. The important boundary is not a particular vendor; it is that the model receives only the relevant manual evidence, identifies the page used, and declines to answer as manual-backed when retrieval is insufficient.

There are three reasonable directions:

- A retrieval-only or templated response can be highly predictable and inexpensive, but it may feel rigid for questions that need explanation across two passages.
- A hosted language model supplied with retrieved manual passages will likely provide the most natural first experience, but it introduces service cost, latency, availability, and data-handling choices.
- A local model keeps the manual and questions closer to the private application, but it adds setup and may not meet the quality needed for precise maintenance language on the first attempt.

The first evaluation should compare these options on the same 10-question set. The deciding signals are evidence adherence, refusal when evidence is absent, accuracy of numbers and units, citation correctness, response time, and operating cost. A model that sounds fluent but changes a page-supported number is a failure regardless of how natural the answer feels.

### Operational Scenarios

**Sunny Day**

1. The rider asks, “What does the manual say about the next valve inspection?”
2. MotoMemory retrieves relevant page-aware passages.
3. The response explains the applicable interval or procedure and links to the supporting page or pages.
4. The rider opens the citation in the PDF viewer and verifies the source.
5. If OCR captured a value incorrectly, the rider corrects the fact from the source-linked fact view.
6. The dashboard uses the ingested or corrected manual-derived interval, while retaining a source label for the outlook item.

**Failure Modes**

| Failure | Behavior |
|---|---|
| The question has no supporting passage. | Say that the current manual evidence is insufficient and do not present a model-only answer as manual guidance. |
| The manual contains different values for different conditions, markets, or model years. | Show the captured value with its source pages so the rider can compare and correct the active fact; do not hide the ambiguity or require approval for unrelated facts. |
| A generated response contradicts its cited passage. | Mark the answer failed, avoid showing it as trusted guidance, and retain the source for correction. |
| An interval is extracted without a clear task or unit. | Preserve the captured fact and source page for inspection; allow the rider to add or correct the missing context before using it for a calculated outlook. |
| Manual knowledge is ready but the dashboard refresh fails. | Preserve the last accepted motorcycle state and label the maintenance outlook as stale or unavailable rather than showing an uncommitted change. |
| The rider asks for safety-critical advice beyond the manual evidence. | State the limitation, point to the relevant source if available, and encourage qualified service judgment without pretending to diagnose the motorcycle. |

### Implementation Touch Points

- Manual question experience under the new manual workspace - accepts questions and presents answer, evidence, and uncertainty states.
- New answer and citation boundary under `lib/` and `app/api/` - keeps generated text linked to retrieved source references.
- `lib/domain/types.ts` - extends maintenance outlook and source contracts with manual provenance where needed.
- `lib/data/motorcycle-repository.ts` - continues to load the motorcycle and maintenance outlook, with manual-derived definitions added through a bounded data path.
- Existing `components/maintenance-outlook.tsx` - displays whether an outlook item is provisional or manual-backed and provides source navigation when available.
- Manual fact view and correction action - shows the ingested value, opens its source page, and lets the rider update the active fact without introducing a human approval queue or Phase 3 service history.

### Expected Impact

The provisional 1,000-mile cadence should be replaced by ingested manual-derived facts when the manual provides enough task and unit context to calculate an outlook. Every displayed manual-derived item must have a source page, and the rider must be able to trace and correct it from the original scan. In the 10-question evaluation, 100% of accepted answers must include inspectable evidence, and 0 answers may silently substitute general knowledge when the manual evidence is absent or ambiguous.

## Schema / Data Model Additions

The following is a logical data model for Phase 2. It extends the Phase 1 motorcycle state without deciding the final storage or search technology.

```text
ManualDocument
  id: identifier
  motorcycle_id: identifier
  file_name: text
  content_type: text
  storage_key: text
  file_size_bytes: integer
  checksum: text
  page_count: integer?
  status: enum(not_uploaded, uploaded, processing, ready, failed)
  extraction_method: enum(ocr, none)
  error_message: text?
  uploaded_at: timestamp?
  processed_at: timestamp?
  is_active: boolean

ManualPage
  id: identifier
  manual_id: identifier
  page_number: integer
  printed_page_label: text?
  extracted_text: text?
  extraction_status: enum(available, failed)

ManualChunk
  id: identifier
  manual_id: identifier
  page_start: integer
  page_end: integer
  section_label: text?
  content: text
  searchable_representation: opaque
  processor_version: text?

MaintenanceDefinition additions
  source_manual_id: identifier?
  source_page_start: integer?
  source_page_end: integer?
  source_section: text?
  source_printed_page_label: text?
  origin: enum(ocr, rider_corrected)
  corrected_at: timestamp?
```

Indexes support the operational questions Phase 2 must answer:

- `(motorcycle_id, is_active)` on `ManualDocument` identifies the active source for the GS750 and prevents an unscoped document from becoming authoritative.
- `(manual_id, page_number)` on `ManualPage` supports direct viewer navigation and page-count checks.
- `(manual_id, page_start, page_end)` on `ManualChunk` supports source display and citation-to-page navigation.
- The searchable representation on `ManualChunk` supports relevant passage retrieval without sending the entire document for every question.
- `(motorcycle_id, source_manual_id)` on maintenance definitions supports source-backed outlook items for the configured motorcycle.
- `origin` and `corrected_at` distinguish an OCR-ingested fact from a rider correction without creating an approval workflow.

The original PDF and its processed representations share one `manual_id`. This keeps citations tied to the exact uploaded document. `processor_version` can identify a retry or processing change for diagnostics, but it does not create a user-facing manual version or require citation migration. Phase 2 remains scoped to the existing private GS750 state; user accounts, multiple motorcycles, public demo isolation, and manual sharing are later concerns.

## Implementation Phases

### Phase 2A: Manual Storage and Intake

- Objective: Store one service-manual PDF for the Phase 1 GS750 and expose a truthful document lifecycle.
- Deliverables:
  - Working Manual navigation entry and manual workspace.
  - Upload-only intake for one active PDF, with 25 MB and 100 page starting limits.
  - Original PDF storage and metadata for the selected 67-page, 3.7 MB source.
  - Motorcycle association and active-document state.
  - Duplicate detection that rejects an identical reupload without changing the current document.
  - Upload, processing, failed, retry, and unavailable states.
- Dependencies: Completed Phase 1 motorcycle state, PostgreSQL connection, and the selected 67-page, 3.7 MB service-manual PDF.
- Gate for Phase 2B: At least 1 real PDF can be stored, reopened, and associated with the GS750; a deliberately failed or interrupted attempt preserves the prior valid state and reports failure without claiming readiness.

### Phase 2B: PDF Viewer and Page References

- Objective: Let the rider inspect the actual manual PDF and move from a source reference to the corresponding page.
- Deliverables:
  - Manual route that switches from the dashboard when selected in the left rail.
  - Browser-native PDF surface with document status, citation page target, and a barebones return path.
  - Page-aware source metadata with both PDF page index and printed page label when available.
  - Return path to Dashboard that preserves Phase 1 motorcycle state.
- Dependencies: Phase 2A original-file storage and document identity.
- Gate for Phase 2C: A reviewer can open the manual, use the supported browser's native page controls, return to Dashboard, and open a supplied page reference; 100% of tested valid references land on the intended page and invalid references produce a visible recovery state.

### Phase 2C: Extraction, Retrieval, and Grounded Guidance

- Objective: Create searchable, page-aware manual knowledge and use it for inspectable maintenance guidance.
- Deliverables:
  - OCR extraction with page-level available or failed status.
  - OCR-backed searchable passages with PDF page index, printed page label, manual identity, and processor metadata.
  - Manual-backed questions with citations and an insufficient-evidence state.
  - Ingested manual-derived maintenance definitions that can replace the provisional cadence when task and unit context is available.
  - Source-linked fact view with direct correction for task, interval, unit, or note; no approval queue.
- Dependencies: Phase 2A document lifecycle, Phase 2B page references, and an agreed evaluation manual and question set.
- Gate for completion: All 67 pages are accounted for by OCR or an explicit page failure, every searchable passage and displayed maintenance fact has a PDF page index, printed labels are retained when available, a rider can correct a captured fact from its source-linked view, and on at least 10 representative questions every accepted answer cites the correct manual and page, at least 9 of 10 answerable questions return relevant evidence, and 2 or more unanswered questions are refused or labeled insufficient. OCR facts are ingested by default; a human approval queue is not a completion gate.

## Design Decisions

| Decision | Rationale |
|---|---|
| Make the left-rail Manual item a real page/workspace in Phase 2. | The current deferred item is the visible entry point for the feature; a modal or hidden route would not provide a durable place for browsing, status, and citations. |
| Preserve and display the original PDF. | The rider needs to inspect diagrams, tables, warnings, and layout that text extraction may lose. |
| Use upload-only intake for one active PDF, reject identical reuploads, and omit user-facing manual-version history. | The selected scanned 67-page, 3.7 MB manual is the only source in scope; supplements, replacement lineage, and citation migration would add decisions without helping this release. |
| Start with 25 MB and 100 pages as upload guardrails. | These limits provide roughly 6.7 times the selected file's size and 1.5 times its page count, while leaving room for similar manuals. They remain provisional until real uploads are observed. |
| Use a browser-native PDF surface with barebones MotoMemory controls. | Native rendering keeps Phase 2 focused on source inspection; custom thumbnails, zoom, search, and print controls are deliberately deferred. |
| Tie every extracted passage and interval to a manual identity and page range. | A source link is only useful when it can be checked against the exact document that produced it. |
| Separate PDF viewing from searchable knowledge readiness. | A rider should still be able to browse the source when extraction, indexing, or answer generation is unavailable. |
| Use explicit processing states and retry behavior. | Partial extraction must not look ready, and a failed attempt must not destroy the last usable source. |
| Use OCR as the searchable representation while preserving the original scan as the authority. | OCR makes a scanned manual searchable, but the rider needs the original page to double-check a questionable character, number, or unit. |
| Ingest extracted facts by default and expose their source pages with direct correction. | The rider wants usable manual knowledge without turning Phase 2 into review-management software; traceability and an explicit edit provide the safe path when a fact needs correction. |
| Do not present model-only answers as manual-backed guidance. | The purpose of this phase is source-grounded help, not a generic chatbot with a manual label. |
| Keep public sharing, service history, authentication, mobile, and GPS outside Phase 2. | The current workflow is private and personal; these capabilities depend on later decisions about scope and stable manual evidence. |

## Test Strategy

Testing focuses on observable document behavior and evidence quality.

| Phase | Behavior to verify | Pass criterion | Escalation signal |
|---|---|---|---|
| 2A | Upload, size-check, associate, reject duplicate, process, retry, and preserve manual state. | The 67-page, 3.7 MB PDF stays within the 25 MB/100-page starting limits and reaches a truthful ready state; an identical reupload is rejected; failed or interrupted attempts remain recoverable and do not replace the prior valid source. | The UI reports ready for an unreadable or incomplete file, accepts a duplicate as a new document, or a retry loses the prior source. |
| 2B | Open the Manual tab, view the original PDF in the supported browser, use native page controls, and follow a page reference. | Valid references reach the intended PDF page in 100% of tested cases; printed page labels appear when available; invalid references are visible and recoverable. | The viewer shows only extracted text, cannot identify the current page, citations cannot be inspected in the source, or custom PDF features become a new Phase 2 dependency. |
| 2C | OCR page content, retrieve evidence, answer questions, identify intervals, and correct a captured fact. | All 67 pages are accounted for by OCR or an explicit page failure; every searchable passage and displayed fact has a PDF page index; a rider can correct a fact from its source link; at least 9 of 10 answerable evaluation questions retrieve relevant evidence; unanswered questions remain explicitly unsupported. | An answer has no evidence, cites the wrong model/year, an OCR failure is hidden, a correction cannot be traced to its source, or the system requires manual approval before facts can be used. |
| Cross-phase | Preserve Phase 1 dashboard and mileage behavior while manual capabilities are unavailable. | Manual failures do not corrupt motorcycle mileage or make the existing dashboard claim an unsaved state. | A document failure changes accepted mileage, breaks dashboard loading, or hides the distinction between provisional and manual-backed outlooks. |

## Open Questions

The following choices are now settled for this release: the source is scanned and will use OCR; upload-only intake supports one PDF; identical reuploads are rejected; the browser-native viewer shows both PDF and printed page labels when available; the starting limit is 25 MB and 100 pages; OCR facts are ingested by default; no human approval queue is required; and the original PDF remains private through the server-side application path.

- **Will OCR work well enough on all 67 pages?**
  - The safe starting check is operational rather than a claimed character-accuracy percentage: account for 67 of 67 pages, retain the original scan, map every OCR result to a PDF page index, and make OCR failures visible.
  - The first 10-question evaluation will show whether the searchable text finds useful evidence. A weak OCR result is not silently treated as a missing manual; the rider can follow the source page and inspect the scan.
  - This remains open until the actual file has been processed because scan quality, skew, contrast, handwriting, tables, and page labels cannot be known from the file size alone.

- **Are 25 MB and 100 pages enough headroom?**
  - The selected file is 3.7 MB and 67 pages, so the starting limits provide approximately 6.7 times the file-size headroom and 1.5 times the page-count headroom.
  - This is enough for the current document and a modestly larger similar document. Revisit the limits only if real processing time, memory use, or another in-scope manual shows that 100 pages is too close.

- **How much correction detail is needed for an ambiguous ingested fact?**
  - Phase 2 includes a lightweight correction path, not a review queue. The source fact appears with its PDF page index, printed label when available, and a path to the original scan.
  - The proposed edit surface covers task, interval, unit, and note, and records that the active value was rider-corrected. The exact wording, whether to retain the OCR value visibly, and whether a correction note is useful can be refined after the first ambiguity is encountered.

- **Which answer model should explain retrieved OCR passages?**
  - The model is not the source of truth. Retrieval and page references determine what evidence is available; the model explains that evidence in rider-friendly language.
  - Options remain a retrieval-only/template response, a hosted language model supplied only with retrieved passages, or a local model. Compare them against the same 10-question set for citation correctness, numeric fidelity, unsupported-answer refusal, response time, and cost.
  - The model choice is deferred until OCR output exists, because the quality and shape of the retrieved passages will affect which option is practical.

- **How should printed page labels be handled when OCR cannot read them?**
  - The working rule is to show the PDF page index always and the printed label only when it can be identified. Never guess a printed page number.
  - The remaining choice is the exact citation wording and whether a small “PDF page” versus “printed page” label is clearest in the viewer.

- **What should happen if the private app is deployed publicly later?**
  - The Phase 2 decision is private server-side access with no public document listing or direct public storage URL.
  - Authentication, storage permissions, and any public-demo use of the manual are future decisions. They do not block the current private workflow.
