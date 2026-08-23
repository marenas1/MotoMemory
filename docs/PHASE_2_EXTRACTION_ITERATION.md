# MotoMemory Phase 2 — Manual Fact Extraction Iteration

Status: **implemented and validated against the owner-supplied OCR output**

This record explains how the Phase 2 maintenance-fact extractor evolved after
the first real 67-page scanned manual was ingested. It is intentionally focused
on extraction behavior, not on the PDF upload, viewer, or answer-provider work.

## Starting point

The first extractor used deterministic regular expressions to find a
maintenance action near a mileage interval. It was deliberately simple and
provider-free:

```text
OCR text → action + interval pattern → maintenance fact → mileage outlook
```

The initial real-manual run demonstrated that the OCR itself was usable but
not clean. The manual is a scanned document with tables, line breaks, and
recognition errors. The first visible fact results included values such as:

- `tivelna har slernant Clean every 2,000 miles`
- repeated mile and kilometer versions of the same interval
- task names containing table headers, OCR fragments, and sentence leftovers
- facts whose task and interval were separated by an OCR line break

The problem was not that the PDF was unavailable. The original PDF, page rows,
page labels, OCR text, and searchable chunks were all retained. The problem was
that the fact extractor was treating noisy OCR layout as if it were ordinary
prose.

## Iteration 1 — stricter filtering

The first corrective pass added safety filters intended to prevent obviously
bad facts from replacing the Phase 1 fallback:

- recognized maintenance action vocabulary such as `check`, `clean`,
  `change`, `inspect`, `replace`, and `adjust`;
- rejected subjects containing digits, mileage units, table symbols, or
  equality/pipe artifacts;
- required a recognizable motorcycle-maintenance hint such as `oil`, `chain`,
  `cable`, `spark`, `brake`, or `valve`;
- preferred the mile value when miles and kilometers appeared together;
- deduplicated repeated task names.

This removed the obvious table garbage, including the corrupted page-28 row.
However, it over-corrected for this particular scan. Valid instructions often
looked like this after OCR:

```text
Replace the air cleaner element with
a new one every 7,500 miles (12,000 km).
```

or:

```text
At initial 600 miles (1,000 km) and every
4,000 miles (6,000 km), adjust the clutch
```

The strict same-line assumption caused the extractor to return no usable
facts, even though the relevant task and interval were present in nearby OCR
text. Reprocessing then replaced the previous OCR facts with the empty result.
That behavior is accepted for the current one-manual, operator-controlled
phase: a future upload is expected to be ingested once, and reprocessing is an
operator tool used after code changes. The source PDF and OCR ledger remain
available, but the current replacement path does not preserve superseded OCR
fact rows.

## Iteration 2 — context-aware extraction

The final extractor keeps the safety filters but removes the same-line
assumption. For each mileage interval it considers a small OCR context window:

- the current normalized OCR line;
- up to two preceding lines;
- the following line.

Within that window it looks for an action in either direction:

```text
task → action → interval
interval → action → task
```

Additional handling includes:

- line-boundary cleanup so a preceding heading does not become part of a task;
- removal of trailing prose such as `at the`, `with a new one`, and
  `should be`;
- recognition of consecutive actions such as `clean and oil the chain`;
- rejection of subjects that still contain table noise, digits, or units;
- preservation of the source PDF page, optional printed-page label, and raw OCR
  context for every accepted fact;
- mile preference when a mile value and its kilometer equivalent occur in the
  same OCR statement;
- one fact per normalized task name, retaining the larger mileage interval
  when the same task appears at an initial and recurring interval. This keeps
  the recurring service cadence for the current single-interval maintenance
  definition model.

## Results from the real manual shape

The updated rules are designed around the observed OCR rather than around an
idealized transcription. They recover facts from detail pages even when the
periodic-maintenance table itself is too corrupted to identify a subject.
Representative recoveries include:

| Manual instruction | Extracted interval | Evidence |
|---|---:|---|
| Clean the air cleaner element | 2,000 mi | PDF page 33 |
| Replace the air cleaner element | 7,500 mi | PDF page 34 |
| Replace the spark plugs | 7,500 mi | PDF page 35 |
| Change the engine oil and oil filter | 4,000 mi recurring interval | PDF page 36 |
| Adjust the clutch | 4,000 mi recurring interval | PDF page 39 |
| Inspect the drive chain | 4,000 mi recurring interval | PDF page 40 |

The page-28 table fragment containing `tivelna har slernant` is rejected because
its candidate subject contains table noise and no trustworthy maintenance
component. The corresponding air-cleaner facts are recovered from pages 33
and 34, where the task is explicit.

## Evidence and correction model

Extraction remains trusted by default for this phase. It is not an approval or
fact-review workflow. Every accepted fact retains:

- the 1-based PDF page index;
- the printed page label when OCR can identify one;
- a source link that opens the private PDF at the page;
- the raw OCR context used for extraction.

The rider can inspect that evidence and correct an ambiguous fact directly.
Corrections are stored separately from OCR-origin facts and are not silently
replaced by a later OCR refresh.

## Validation added

The unit coverage now includes:

- ordinary same-line task and interval extraction;
- rejection of isolated mileage values;
- rejection of the corrupted table-row sample;
- mile-versus-kilometer deduplication;
- task and interval pairs split across lines;
- intervals appearing before the action;
- initial and recurring intervals for the same task;
- source page and raw OCR context retention.

The final implementation passed:

| Check | Result |
|---|---|
| Typecheck | pass |
| Lint | pass |
| Unit tests | 76 passed |
| Integration tests | 22 passed |

## Current boundaries

This extractor is a deterministic first release. It does not perform visual
table reconstruction, confidence scoring, human approval, or LLM-based
semantic interpretation. That is intentional for Phase 2: the application
should expose inspectable evidence and a correction path before it becomes a
review-management system.

The known limitations are:

- badly corrupted table rows may remain unextractable;
- two genuinely different intervals for one task are represented by the
  recurring/larger interval under the current unique task definition model;
- OCR quality still depends on local Tesseract and PDF rendering settings;
- an extraction refresh can replace OCR-origin facts with its new result, so
  reprocessing should be treated as an explicit operator action.

## Operator procedure after extractor changes

For the existing uploaded manual:

1. Keep the uploaded PDF; no re-upload is required.
2. Wait until OCR page processing is complete.
3. Select **Reprocess manual** in the Manual workspace.
4. Inspect the regenerated facts through their source links and raw OCR
   context.
5. Correct only values that remain ambiguous after checking the original scan.

For a future manual upload, the normal path is upload, OCR, extraction, and
source inspection once the processing status reaches complete.

## Decision

Keep the context-aware deterministic extractor for the remainder of Phase 2.
It is materially better suited to this scanned manual than either the original
same-line parser or a permissive parser that promotes every nearby mileage
number. Revisit OCR confidence, table reconstruction, and model-assisted
extraction only when real usage demonstrates that source-linked correction is
insufficient.
