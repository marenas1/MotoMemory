# MotoMemory Phase 2 — Real-Manual Acceptance Record

Keep the completed copy of this record outside Git. This template contains no
manual content and no credentials. Copy it to `/tmp/motomemory-phase-2-acceptance-record.md`
or to the ignored `local-acceptance/` directory before running the owner's
manual.

## Source and command

Owner PDF path:

```text
/absolute/path/to/owner/67-page-gs750-manual.pdf
```

Run the capability sample:

```bash
npm run manual:capability -- /absolute/path/to/owner/67-page-gs750-manual.pdf \
  --sample-pages 1,34,67
```

Run the full local OCR acceptance:

```bash
npm run manual:ocr:acceptance -- /absolute/path/to/owner/67-page-gs750-manual.pdf \
  --all-pages
```

Record the date, OS, Node version, Poppler version, Tesseract version, and
browser used for page citation checks. Do not paste the PDF, OCR text, or
secret values into this record.

## Measured document evidence

| Field | Result |
|---|---|
| Motorcycle association | `gs750` |
| File name | — |
| File size in bytes | — |
| Page count | — |
| SHA-256 | — |
| OCR engine/command | — |
| PDF renderer/command | — |
| Capability sample result | `pending` |
| Full OCR result | `pending` |

## Page accounting

| Field | Result |
|---|---:|
| Total PDF pages | — |
| OCR-available pages | — |
| Explicit OCR-failure pages | — |
| Pending pages after completion | — |
| Searchable chunks with PDF page provenance | — |
| Printed page labels retained | — |

List failed page numbers and the short failure reason. If there are no failures,
write `none`.

| PDF page | Failure reason | Retry result |
|---:|---|---|
| — | — | — |

## Extracted maintenance facts

| Fact/task | Interval | Unit | PDF page | Printed label | Origin |
|---|---:|---|---:|---|---|
| — | — | — | — | — | — |

Confirm that facts are visible by default, retain raw OCR context, and can be
corrected from the source-linked view without changing current mileage.

## Ten-question evaluation

Use the fixed questions in [PHASE_2_QUESTION_EVALUATION.md](./PHASE_2_QUESTION_EVALUATION.md).
Record only identifiers, measurements, states, and page coordinates here.

| Question ID | Top PDF page | Printed label | Top rank | State | Citation opened expected page? |
|---|---:|---|---:|---|---|
| oil-change-interval | — | — | — | — | — |
| valve-clearance | — | — | — | — | — |
| spark-plug | — | — | — | — | — |
| chain-adjustment | — | — | — | — | — |
| brake-fluid | — | — | — | — | — |
| air-filter | — | — | — | — | — |
| coolant | — | — | — | — | — |
| battery | — | — | — | — | — |
| tire-brand | — | — | — | — | — |
| winter-storage-location | — | — | — | — | — |

Answer-provider choice: `unselected / unavailable / selected: __________`

## Workflow gates

| Gate | Result |
|---|---|
| Upload within 25 MB and 100 pages | pending |
| Identical reupload rejected without new document | pending |
| Original PDF opened through `/api/manual/file` | pending |
| No public storage URL exposed | pending |
| OCR failures visible and retryable | pending |
| Source citation opened the expected PDF page | pending |
| Fact correction updated the outlook and preserved mileage | pending |
| Phase 1 dashboard/mileage behavior unchanged | pending |

## Notes and deviations

Record any browser/runtime limitation, OCR failure, provider outage, or
deviation from the Phase 2 CONOPS. The real-manual record is not complete until
the `pending` values above are replaced with measured results or an explicit
`not run — reason`.
