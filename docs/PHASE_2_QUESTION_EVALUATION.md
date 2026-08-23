# Phase 2 Manual Question Evaluation

This is the fixed ten-question evaluation set for Phase 6 retrieval and manual-grounded answers. The first eight questions are expected to have relevant evidence in the selected service manual. The final two are deliberately unsupported and must produce `insufficient_evidence` when retrieval returns no supporting passage.

The evaluation records retrieval and answer behavior, not model fluency. Every accepted answer must identify the exact manual and cite a valid PDF page. A provider response with a citation that does not match the retrieved passage is a `citation_mismatch` and is not accepted.

| ID | Question | Expected result |
|---|---|---|
| oil-change-interval | What oil change interval does the manual specify? | Relevant evidence |
| valve-clearance | What valve clearance should I use? | Relevant evidence |
| spark-plug | Which spark plug specification does the manual list? | Relevant evidence |
| chain-adjustment | How does the manual describe drive-chain adjustment? | Relevant evidence |
| brake-fluid | What brake-fluid maintenance instruction is in the manual? | Relevant evidence |
| air-filter | When does the manual say to inspect or replace the air filter? | Relevant evidence |
| coolant | What coolant capacity does the manual specify? | Relevant evidence |
| battery | What battery charging instruction does the manual provide? | Relevant evidence |
| tire-brand | Which tire brand should I buy according to the manual? | `insufficient_evidence` |
| winter-storage-location | Which garage should I use for winter storage? | `insufficient_evidence` |

## Run record

After the private 67-page manual is OCR'd, record the observed page index, printed label, top retrieval rank, answer state, and whether the citation opened the expected page. The source PDF remains outside Git; this document stores only evaluation metadata.

| ID | PDF page | Printed label | Top rank | State | Citation checked |
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

The production default is intentionally provider-unavailable until an answer provider is selected and configured. Search and PDF browsing must remain usable during that state.
