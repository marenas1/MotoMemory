# MotoMemory Phase 3 — Maintenance History and Personalized Outlook CONOPS

This document defines the operational concept for Phase 3 after the completed
Phase 1 motorcycle-state workflow and Phase 2 manual ingestion, OCR, PDF
viewer, retrieval, and manual-fact workflow. It describes what the rider should
be able to do and how MotoMemory should behave when history or manual evidence
is incomplete. It is not a requirements specification, architecture document,
or implementation task list.

Phase 3 keeps the current private, single-motorcycle boundary. Manual-derived
facts remain active by default, retrieval remains the answer model for now, and
the original manual remains the evidence source. This phase adds the missing
connection between what the manual recommends, what the rider has actually
done, and what is next for this motorcycle.

## Table of Contents

- [Purpose](#purpose)
- [Problem Statement](#problem-statement)
- [Stakeholders & Roles](#stakeholders--roles)
- [System Overview](#system-overview)
- [Part 1: Service History](#part-1-service-history)
- [Part 2: Personalized Maintenance Outlook](#part-2-personalized-maintenance-outlook)
- [Part 3: Explanation and Correction](#part-3-explanation-and-correction)
- [Schema / Data Model Additions](#schema--data-model-additions)
- [Implementation Phases](#implementation-phases)
  - [Phase 3A: Service Record Foundation](#phase-3a-service-record-foundation)
  - [Phase 3B: History-Aware Calculation](#phase-3b-history-aware-calculation)
  - [Phase 3C: Outlook and Correction Experience](#phase-3c-outlook-and-correction-experience)
- [Design Decisions](#design-decisions)
- [Test Strategy](#test-strategy)
- [Open Questions](#open-questions)

## Purpose

- Record completed motorcycle maintenance as durable, inspectable history.
- Replace generic mileage projections with guidance based on the last applicable service.
- Let the rider see why an item is upcoming, due, overdue, or unknown.
- Preserve useful behavior when service history or manual intervals are incomplete.
- Keep corrections simple without turning MotoMemory into a review or approval system.

## Problem Statement

| Problem | Observed Impact |
|---|---|
| Confirmed: Phase 1 calculates maintenance from current mileage and an interval, but stores no completed-service event. | The dashboard cannot distinguish work that was already performed from work that is actually next. |
| Confirmed: Phase 2 supplies manual-derived intervals and page evidence, but does not record rider-entered maintenance history. | Manual knowledge can explain the recommendation, but not whether this particular motorcycle has already received the work. |
| Projected: A rider may enter service events out of chronological order or correct the motorcycle mileage later. | A calculation that assumes entry order can select the wrong last service and show a misleading target. |
| Projected: Some manual facts will not map cleanly to a maintenance item or may not contain a usable interval. | The product could imply a precise due state where the source does not support one. |
| Projected: Requiring approval for every OCR-derived fact or service entry would slow a personal workflow. | The rider could spend more time reviewing the tool than recording or checking maintenance. |

## Stakeholders & Roles

| Stakeholder | Role | What They Need From This System |
|---|---|---|
| Motorcycle owner / rider | Records work, updates mileage, and checks what is next. | A quick service-history entry and a calculation that can be checked without reconstructing the manual by hand. |
| Product owner | Decides whether personalized maintenance guidance is useful and safe to advance. | Clear calculation rules, visible uncertainty, and measurable failure behavior. |
| Operator / maintainer | Keeps the private application and database available. | Recoverable write failures, scoped records, and observable calculation errors. |
| Phase 2 manual workflow | Supplies intervals and source evidence. | Stable fact identity, correction behavior, and no mutation of original OCR evidence when history is added. |
| Future web or mobile client | Reads and writes the same motorcycle history. | A shared service-event meaning rather than client-specific reminders or duplicate state. |

## System Overview

```text
 Rider records completed work
             │
             ▼
     Service history events ◄──── current motorcycle mileage
             │                              │
             └──────────────┬───────────────┘
                            ▼
     Manual-derived interval and source evidence
                            │
                            ▼
              History-aware maintenance outlook
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
     status and next target       basis, source, correction path
```

The rider supplies a completed-service event, usually with mileage and
optionally with a date, notes, parts, or cost. MotoMemory compares the current
mileage with the applicable manual-derived interval and the most recent
applicable service event. The resulting outlook shows a status and a target
when the inputs are sufficient; otherwise it explains what is missing instead
of presenting a false precision. The manual PDF, OCR passage, and corrected
fact remain available through the existing Manual workspace.

## Part 1: Service History

### Concept

The rider can record work performed on the motorcycle from a maintenance
history surface. A record identifies the work, requires the mileage at which it
was performed, and can optionally include the date, notes, parts used, and
cost. The rider can review previous records and correct an entry when a
mileage, date, or service description was entered incorrectly.

The history is an event list, not a single “last serviced” field. Older events
remain visible so the rider can reconstruct what happened and so a later
calculation can choose the most recent applicable event even when entries were
added out of order.

### Why This Approach

Persistent events are preferred over transient reminders because mileage-based
maintenance only becomes personal when MotoMemory knows when the work last
happened. The trade-off is additional rider entry and the need to handle
corrections. That trade-off is acceptable for this personal tool because a
single accurate service entry is more useful than a reminder that cannot show
what it is based on.

A checklist-only approach was considered, but it loses the mileage and timing
needed for the next target. Calendar reminders were also considered, but they
do not represent an odometer-first maintenance schedule. Automatic inference
from notes or OCR is deferred because it could mark work complete without the
rider's confirmation. The rider records the event explicitly; the system does
not require a review queue.

### Operational Scenarios

**Sunny day**

1. The rider opens the maintenance history area.
2. They choose one maintenance item from a picker, such as engine oil and oil
   filter. An `Other / unlinked` option can preserve useful history when no
   manual-derived item applies.
3. They enter the performed mileage, for example 27,000 mi.
4. They optionally add the date, parts, notes, or cost.
5. MotoMemory saves the event and shows it in history.
6. The next outlook refresh uses the event as the latest applicable service.

**Failure modes**

| Failure | Behavior |
|---|---|
| Mileage is missing, negative, or not a finite number. | Do not save the event; explain the required correction without changing existing history. |
| The event is entered at a lower mileage than an existing event. | Preserve the event as historical data, sort by the event's mileage or date as appropriate, and make any resulting inconsistency visible. |
| The same work is entered twice. | Preserve both records unless the rider explicitly corrects one; offer a clear edit or removal path rather than silently merging history. |
| The rider needs to record work with no matching manual definition. | Save it through `Other / unlinked` as history, but do not use it to calculate a manual-backed next target. |
| The entered service mileage is greater than the motorcycle's current mileage. | Reject the entry and explain that current mileage must be updated before recording that service. |
| The database write fails. | Show that the event was not confirmed, retain the form values where practical, and leave the previous history unchanged. |
| The rider edits a prior event. | Recalculate dependent outlooks from the corrected event and show that the result changed. |
| The rider deletes a prior event. | Require an explicit delete action, remove it from active history and calculations, and leave manual facts and unrelated records unchanged. |

### Implementation Touch Points

- Maintenance history surface - provides picker-based creation, listing, inspection, and correction of individual service events.
- Service-history API boundary - accepts rider-entered events and returns an explicit saved or failed result.
- Motorcycle data boundary - supplies the private motorcycle scope and current mileage.
- Maintenance domain contracts - represent service events and their relationship to maintenance definitions.
- PostgreSQL migration and repository boundary - persist history without changing Phase 1 mileage records or Phase 2 manual evidence.

### Expected Impact

At least 100% of valid service records in the acceptance set should survive a
page reload and remain associated with the configured motorcycle. Invalid
records should produce 0 new history rows. A rider should be able to identify
the most recent recorded event for a maintenance item in one history view,
without consulting the database directly.

## Part 2: Personalized Maintenance Outlook

### Concept

The dashboard changes from a cadence-only projection to a history-aware
outlook. For each maintenance definition with a usable mileage interval,
MotoMemory identifies the latest applicable service event and calculates a
next target from that event. The displayed result includes the current
mileage, the interval, the last-service mileage, and the resulting target.

When no applicable service exists, the product keeps a distinct “history not
recorded” condition. The manual-derived interval may remain visible as source
context, but any Phase 1 provisional cadence is not presented as a personalized
target. The item is labeled **Not recorded**, and the rider is told to record
the completed service. When no usable interval exists, the status is
**Unknown** and the rider is told why.

The recommended rider-facing status vocabulary is:

- **Not recorded** — no completed service history exists for this item.
- **Upcoming** — the next target has not been reached.
- **Due** — the current mileage has reached the next target.
- **Overdue** — the current mileage has passed the next target.
- **Unknown** — an interval, mapping, or mileage input is not usable.

“Not recorded” is intentionally different from “overdue.” It tells the rider
that MotoMemory has no completion record and that they need to enter one if
they want a personalized outlook. The Phase 3 calculation does not need
multiple levels of upcoming intensity.

### Why This Approach

The calculation uses the rider's mileage and the model-specific manual fact
because those are the strongest available inputs for this product. It does
not use a language model to decide whether service is due. Retrieval remains
useful for answering questions and showing evidence, while the numeric
outlook remains deterministic and inspectable.

A calendar-first calculation was considered, but the motorcycle currently
uses mileage as its primary maintenance signal and many manual intervals are
expressed in miles or kilometers. A calculation based only on the current
mileage was the Phase 1 fallback, but it cannot account for completed work.
Automatic fuzzy matching between free-text service descriptions and manual
facts was also considered; it is deferred because a wrong match can shift a
maintenance target without the rider noticing.

### Operational Scenarios

**Sunny day**

1. The manual provides a corrected, usable oil-change interval of 4,000 mi.
2. The rider has recorded an oil change at 18,000 mi.
3. Current motorcycle mileage is 19,700 mi.
4. MotoMemory calculates the next target as 22,000 mi.
5. The dashboard shows the status and remaining distance together with the
   18,000-mi last-service event and the manual source link.
6. After the rider records the next oil change, the target advances from the
   new service event rather than from a fixed global cadence.

**Failure modes**

| Failure | Behavior |
|---|---|
| No service history exists for a known interval. | Show **Not recorded** and tell the rider to enter the completed service if they want a personalized outlook; do not imply that MotoMemory knows the last completed service. |
| The manual fact is missing, unusable, or not associated with the service description. | Keep the history visible and show **Unknown** rather than inventing a task interval. |
| Current mileage is lower than the selected last-service mileage. | Flag the inconsistent inputs and avoid presenting the result as a reliable overdue or next-target calculation. |
| A service event is entered above current mileage. | Reject it rather than allowing future service history; the rider must first correct or update current mileage. |
| A historical event is added out of order. | Select the applicable event by its recorded mileage/date rules, not by insertion order, and expose the selected event. |
| A manual fact is corrected. | Recalculate affected outlooks from the corrected value while preserving the fact's source page, raw OCR context, and correction origin. |
| Current mileage is edited. | Recalculate all affected items immediately and preserve the mileage update history already supported by Phase 1. |

### Implementation Touch Points

- Maintenance outlook presentation - adds last-service, target, status, and basis details to each item.
- Calculation boundary - resolves applicable service history and computes mileage-based targets deterministically.
- Manual-fact repository - supplies active OCR or rider-corrected intervals and source metadata.
- Phase 1 mileage flow - remains the authoritative source for current mileage and triggers recalculation.
- Fallback behavior - preserves provisional guidance when Phase 2 knowledge is unavailable, with an explicit label.

### Expected Impact

Every non-unknown history-backed outlook item should expose enough inputs for a
reviewer to reproduce the result: current mileage, interval, last-service
mileage, and next target. The calculation acceptance matrix must match the
expected result for 100% of critical cases: no history, upcoming, due,
overdue, out-of-order history, corrected mileage, missing
interval, and corrected manual fact.

## Part 3: Explanation and Correction

### Concept

MotoMemory treats maintenance status as an explanation, not merely a colored
badge or reminder. The rider can follow an outlook item to the recorded
service event and to the manual fact that supplies the interval. The existing
PDF page link and raw OCR context remain the path for checking ambiguous
manual-derived values.

The rider can correct a service record directly. Manual facts continue to be
trusted by default and can be corrected directly through the existing Phase 2
flow. Neither path creates a mandatory fact-review workflow in this phase.

### Why This Approach

An inspectable calculation is safer and more useful than a generated
explanation that cannot show its inputs. The product can explain the result
with stored values and links, so no answer model is needed for this phase.
This accepts a less conversational experience in exchange for predictable
numbers and an obvious correction path.

A generated answer layer was considered for turning history into prose, but
the project has selected retrieval-only behavior for now and does not have a
chosen answer provider. A hidden audit log was also considered, but a rider
needs the correction and source links in the normal workflow rather than only
in operator tooling.

### Operational Scenarios

**Sunny day**

1. The rider sees “upcoming” for an oil service.
2. The item shows current mileage, last service, interval, and target.
3. The rider opens the service event to confirm the recorded mileage.
4. The rider opens the manual source link to inspect the page and raw OCR
   context.
5. If a value is wrong, the rider corrects the relevant record and sees the
   outlook refresh.

**Failure modes**

| Failure | Behavior |
|---|---|
| A source page cannot be opened. | Keep the extracted value visible with a source-unavailable state; do not remove history or imply that the source was verified. |
| A fact has raw OCR text but no usable task or interval. | Keep it searchable as manual evidence but exclude it from numeric outlook calculations. |
| A correction makes an interval or service mapping invalid. | Save only valid corrections, explain the rejected value, and retain the previous valid calculation. |
| Two records or facts appear to describe the same work. | Show both source records and avoid silently choosing one when the relationship is ambiguous. |

### Implementation Touch Points

- Outlook item details - displays calculation inputs, status meaning, and links.
- Service-record correction flow - lets the rider fix entered history without database access.
- Manual fact correction and source viewer - remains the Phase 2 evidence path.
- Retrieval-only manual search - remains available for explanatory questions and does not become a generated-answer dependency.

### Expected Impact

For 100% of history-backed outlook items in the acceptance set, a rider should
be able to reach both the selected service event and the manual interval source
within two navigation actions from the item. A correction should produce a
new, reproducible calculation without deleting the original manual evidence
or changing unrelated motorcycle history.

## Schema / Data Model Additions

Phase 3 adds a durable service-event node. The rider-facing term is “service
record”; the persistence name can remain `MaintenanceRecord` if that matches
the existing domain vocabulary.

```text
MaintenanceRecord
  id: identifier
  motorcycle_id: identifier
  definition_id: identifier?       # one selected manual-derived item; null for Other / unlinked
  service_type: text               # rider-visible description
  performed_mileage: decimal       # required mileage-first anchor
  performed_at: timestamp?         # optional history metadata; not used for due calculations in Phase 3
  notes: text?
  parts: list<text>?
  cost: decimal?
  created_at: timestamp
  updated_at: timestamp
```

The record belongs to exactly one motorcycle scope. `definition_id` is
optional because a rider may record useful work that has no matching manual
fact. A record without that link remains history but does not silently become
evidence for a different maintenance item.

Recommended indexes:

- `(motorcycle_id, performed_mileage)` supports the latest applicable service lookup and mileage history.
- `(motorcycle_id, performed_at)` supports chronological history views when dates are present.
- `(motorcycle_id, definition_id, performed_mileage)` supports selecting the latest event for one manual-derived definition.

There is intentionally no uniqueness rule on mileage, date, or service type.
Two individual services can legitimately happen at the same mileage, and
duplicate detection is not reliable enough to delete or merge rider history
silently. Phase 3 does not provide a bundled service-entry flow: one entry
represents one selected maintenance item.
All records remain private through the existing server-side application path;
future account or multi-motorcycle scope is deferred rather than inferred.

## Implementation Phases

### Phase 3A: Service Record Foundation

- Objective: Make individual completed maintenance items a persistent, rider-editable history.
- Deliverables:
  - Picker-based service record creation with required mileage and optional parts, cost, notes, and date metadata.
  - History listing and inspection for the configured motorcycle.
  - Validation and clear write-failure behavior.
  - Edit and delete paths that do not mutate Phase 2 manual evidence.
- Dependencies: Phase 1 motorcycle and mileage state; Phase 2 private application and database boundaries.
- Gate for Phase 3B: Valid records persist across reloads, invalid records create no rows, and an out-of-order record remains visible without corrupting existing history.

### Phase 3B: History-Aware Calculation

- Objective: Calculate a maintenance target from the current mileage, an active interval, and the latest applicable service event.
- Deliverables:
  - Definition-to-service association behavior.
  - No-history, unknown-interval, and inconsistent-mileage states.
  - Deterministic next-target and status calculation.
  - Recalculation after mileage, service, or manual-fact corrections.
- Dependencies: Phase 3A records; Phase 2 active facts and source metadata; Phase 1 current mileage updates.
- Gate for Phase 3C: The calculation matrix passes all critical cases and never presents an unsupported precise target for a missing or invalid input.

### Phase 3C: Outlook and Correction Experience

- Objective: Make every personalized result understandable and correctable from the normal rider workflow.
- Deliverables:
  - Outlook cards with status, target, current mileage, interval, and last-service basis.
  - Links from the outlook to service history and manual evidence.
  - Direct service-record correction and refresh behavior.
  - Regression coverage for the Phase 1 mileage flow and Phase 2 viewer, search, facts, and retrieval paths.
- Dependencies: Phase 3B calculation behavior and the completed Phase 2 handoff measurements.
- Gate for completion: A rider can record, inspect, correct, and explain a maintenance result in one private session; automated regression and the full calculation matrix pass.

## Design Decisions

| Decision | Rationale |
|---|---|
| Store service events, not only the latest completion value. | Historical events support correction, inspection, and reliable selection when entries are added out of order. |
| Require performed mileage; do not use dates for due calculations in Phase 3. | This motorcycle's current maintenance workflow is mileage-first, while older service dates may not be known. An optional date can remain history metadata. |
| Use a picker for one maintenance item per service record. | Explicit individual selection prevents bundled work and ambiguous fuzzy matches from shifting multiple targets at once. An `Other / unlinked` option preserves history that has no matching fact. |
| Make saved service records editable. | Mileage, task selection, and optional details can be entered incorrectly; direct correction keeps the personal workflow usable without an approval queue. |
| Allow explicit deletion of service records. | A mistaken or duplicate entry must be removable from active calculations; deletion is a rider action and never removes manual evidence. |
| Use the latest applicable event by its recorded maintenance context, not insertion order. | Riders may enter old receipts or correct history after newer records exist. |
| Keep no-history distinct from overdue. | Missing history is not evidence that maintenance was missed. |
| Reject service events above current mileage. | Phase 3 records completed work, not future plans; the rider must update current mileage before recording a later service. |
| Prefer active rider-corrected manual facts over OCR-derived values. | Phase 2 already provides a direct correction path, while preserving the raw OCR context and source page. |
| Keep maintenance-definition identity stable when a fact is corrected. | Existing service records remain attached to the same task; future calculations use the corrected value, while a materially different task is not silently remapped. |
| Keep the numeric calculation deterministic and retrieval-only. | A model is not needed to add two mileage values, and no answer provider has been selected. |
| Preserve source context without inventing a personalized target when inputs are incomplete. | Phase 1 fallback behavior can keep the app available during partial failure, but **Not recorded** takes precedence when there is no completed-service history. |
| Keep one private motorcycle in scope. | This matches the completed Phase 1/2 product and avoids inventing account, sharing, or multi-bike precedence rules. |
| Do not add parts inventory, cost analytics, or calendar reminders to the core calculation. | These fields can preserve useful history without expanding Phase 3 beyond the personalized mileage outlook. |

## Test Strategy

| Phase | Behavior to verify | Pass criterion | Escalation signal |
|---|---|---|---|
| 3A | Create, list, inspect, validate, correct, and delete service records. | All valid fixture events persist and reload under the right motorcycle; invalid inputs create 0 records; edits and explicit deletions are reflected in history and calculations. | A write appears successful but is absent after reload, crosses motorcycle scope, or silently changes another event. |
| 3B | Resolve applicable history and calculate targets/statuses. | 100% of critical matrix cases match expected target, status, and selected last-service event. | The calculation depends on insertion order, labels missing history as overdue, or produces a precise target without a usable interval. |
| 3C | Explain and correct an outlook item through the UI. | Every history-backed item in the acceptance set exposes current mileage, interval, last service, target, and source links; a correction refreshes the result. | A rider cannot reconstruct why an item is due or must use database/operator access to correct normal data. |
| Regression | Preserve Phase 1 and Phase 2 behavior. | Mileage updates, PDF viewing, OCR status, manual search, fact correction, and retrieval remain passing after Phase 3 changes. | A service-history change breaks manual evidence, changes unrelated mileage, or removes the private PDF path. |

The calculation matrix should include at least these cases: no history,
upcoming, exactly due, overdue, multiple
events at different mileages, out-of-order entry, current mileage correction,
missing manual interval, unusable mapping, and corrected manual interval. Each
case should record expected status, target, selected last-service event, and
the explanation inputs shown to the rider.

## Open Questions

- Should an `Other / unlinked` service record be mappable to a manual-derived
  item later if extraction improves? The safe current behavior is to leave it
  unlinked until the rider explicitly edits the record.
