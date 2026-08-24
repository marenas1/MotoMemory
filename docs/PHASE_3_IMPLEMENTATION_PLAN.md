# MotoMemory Phase 3 — Maintenance History Implementation Plan

Status: **Phase 3 implementation complete; Phase 5 GO**. See
the [Phase 3 completion and handoff record](./PHASE_3_COMPLETION_HANDOFF.md)
for measured validation and database-gated evidence.

This plan turns the [Phase 3 CONOPS](./PHASE_3_CONOPS.md) into an executable
implementation sequence. It starts from the completed Phase 1 mileage
workflow and Phase 2 private manual, OCR, retrieval, PDF viewer, and
manual-fact correction workflow.

Phase 3 adds individual service records and uses them to produce a
history-aware maintenance outlook. The rider selects one maintenance item per
record, enters the mileage at which the work was completed, and may edit or
delete the record later. Parts, cost, notes, and an optional service date are
metadata only; date-based due calculations are not part of this release.

## Table of Contents

- [Outcome](#outcome)
- [Implementation Choices](#implementation-choices)
- [Goals and Boundaries](#goals-and-boundaries)
- [Current Baseline](#current-baseline)
- [Architecture](#architecture)
  - [System Flow](#system-flow)
  - [Data Model Plan](#data-model-plan)
  - [Expected File Touch Points](#expected-file-touch-points)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Service Record Data Foundation](#phase-1-service-record-data-foundation)
  - [Phase 2: Service History API and UI](#phase-2-service-history-api-and-ui)
  - [Phase 3: History-Aware Maintenance Calculation](#phase-3-history-aware-maintenance-calculation)
  - [Phase 4: Outlook Integration and Explainability](#phase-4-outlook-integration-and-explainability)
  - [Phase 5: Hardening and Handoff](#phase-5-hardening-and-handoff)
- [Test Plan](#test-plan)
- [Operational Safety and Rollback](#operational-safety-and-rollback)
- [Definition of Done](#definition-of-done)
- [Deferred Work](#deferred-work)

## Outcome

The rider can record one completed maintenance item at a valid past-or-current
mileage, inspect the history, edit or delete an entry, and see the dashboard
calculate the next maintenance state from the selected manual interval and
the most recent applicable service record.

The visible status vocabulary is deliberately small:

- `not_recorded` — no service record exists for the item.
- `upcoming` — the next target has not been reached.
- `due` — current mileage has reached the target.
- `overdue` — current mileage has passed the target.
- `unknown` — the interval, mapping, or mileage inputs cannot support a calculation.

The outlook explains its inputs: current mileage, interval, last service
mileage, target mileage, and manual source link where applicable.

## Implementation Choices

| Area | Phase 3 choice |
|---|---|
| Service scope | One individual maintenance item per service record |
| Selection | Picker of active maintenance definitions plus `Other / unlinked` |
| Required input | Performed mileage, which cannot exceed current motorcycle mileage |
| Optional metadata | Parts, cost, notes, and service date; date is not used for due status |
| Corrections | Saved records can be edited; explicit deletion is supported |
| Calculation anchor | Latest applicable service mileage plus the active mileage interval |
| No history | Show `Not recorded`; do not present a personalized target |
| Statuses | Not recorded, Upcoming, Due, Overdue, Unknown |
| Manual facts | OCR and rider-corrected facts remain active; corrected values keep their definition identity |
| Answer model | Retrieval-only remains in place; no generated answer provider is added |
| Scope | One private motorcycle, using the existing server-side application boundary |

## Goals and Boundaries

### Goals

- Persist service history under the configured private motorcycle.
- Let the rider create, inspect, edit, and explicitly delete service records.
- Prevent recording work above the current motorcycle mileage.
- Calculate the next target from the latest applicable service event and manual-derived interval.
- Show `Not recorded` when no applicable completion event exists.
- Preserve Phase 1 mileage updates and Phase 2 manual evidence, facts, search, and PDF viewing.
- Make each calculated result explainable without an answer model.

### Boundaries

This plan does not include:

- Date-based maintenance calculations or time-only service intervals.
- Bundled service visits or a many-to-many service-to-definition relationship.
- Automatic fuzzy matching of free-text service descriptions to manual facts.
- A review queue, approval state, or confidence workflow for manual facts.
- Manual replacement/version lineage or automatic remapping after a future manual change.
- Parts inventory, cost analytics, calendar reminders, mobile, GPS, accounts, or multiple motorcycles.
- A generated answer model; manual questions continue using retrieval-only behavior.

## Current Baseline

The existing application already provides:

- A private single-motorcycle state with manually editable current mileage.
- `maintenance_definitions` with active manual-derived intervals, source pages,
  raw OCR context, and rider correction origin.
- A maintenance outlook currently calculated from current mileage and interval
  alone, with no service-history anchor.
- Manual PDF viewing, page-aware search, retrieval, and direct fact correction.
- Additive Supabase migrations and repository/API boundaries for Phase 1 and 2.

Phase 3 changes the outlook calculation only after service-history inputs are
available. It does not remove manual evidence or alter the PDF storage path.

## Architecture

### System Flow

```text
Current mileage ───────┐
                       ├──► history-aware calculation ───► outlook status
Service records ───────┤                                      │
                       │                                      ├── target/basis
Manual definitions ────┘                                      └── source link

Rider ── create/edit/delete ──► service history API ──► private PostgreSQL
```

The browser uses the existing Next.js server boundary. The server validates
the motorcycle scope, current mileage, selected definition, and performed
mileage before persistence. The calculation boundary reads active maintenance
definitions and service records, selects the latest applicable event, and
returns display-ready explanation fields. It does not call OCR, retrieval, or
an answer provider.

### Data Model Plan

Add one service-event table through an additive migration, using the existing
motorcycle identifier and maintenance-definition identifiers.

```text
maintenance_records
  id: uuid primary key
  motorcycle_id: text references motorcycle_state(id)
  definition_id: uuid references maintenance_definitions(id)?
  service_type: text
  performed_mileage: decimal
  performed_at: timestamptz?
  notes: text?
  parts: text[]?
  cost: decimal?
  created_at: timestamptz
  updated_at: timestamptz
```

`definition_id` is populated for a picker-selected item and remains null for
`Other / unlinked`. One record represents one maintenance item. There is no
uniqueness constraint on mileage, date, or service type because two records can
legitimately share a mileage. Deletion removes the record from active history
and calculations; it never removes a manual fact or PDF evidence.

Indexes:

- `(motorcycle_id, performed_mileage)` supports mileage history and latest-event lookup.
- `(motorcycle_id, performed_at)` supports optional chronological history display.
- `(motorcycle_id, definition_id, performed_mileage)` supports latest applicable event selection.

The record remains private and motorcycle-scoped through the existing server
repository boundary. No account or public access model is introduced.

### Expected File Touch Points

These are expected touch points; phase agents should confirm exact names and
existing contracts before editing:

```text
supabase/migrations/007_phase3_maintenance_history.sql
lib/domain/types.ts
lib/domain/maintenance.ts
lib/data/motorcycle-repository.ts
lib/data/maintenance-repository.ts       # new boundary if needed
lib/server/maintenance-records.ts        # validation/domain boundary if needed
app/api/maintenance/records/route.ts
app/api/maintenance/records/[recordId]/route.ts
components/maintenance-history-panel.tsx
components/maintenance-outlook.tsx
components/motorcycle-main-view.tsx
app/globals.css
tests/unit/maintenance-records.test.ts
tests/unit/maintenance.test.ts
tests/integration/maintenance-records.test.ts
tests/integration/maintenance-routes.test.ts
tests/e2e/maintenance-history.spec.ts
```

## Implementation Phases

### Phase 1: Service Record Data Foundation

**Objective:** Add the private persistence and domain contracts for individual service records.

**Deliverables:**

- Additive migration for `maintenance_records` with motorcycle and optional definition references.
- Repository methods for list, create, update, and delete under motorcycle scope.
- Domain types for service records and the five Phase 3 outlook statuses.
- Validation for required fields, finite non-negative mileage, allowed optional metadata, and current-mileage upper bound.
- Unit and integration coverage for persistence, scoping, and invalid writes.

**Go Criteria:**

- A valid record can be created, listed, updated, and deleted through the repository.
- A record above current mileage is rejected before persistence.
- A record from another motorcycle cannot be read, changed, or deleted through the scoped boundary.
- Existing Phase 1/2 migrations and repositories continue to pass their tests.

**No-Go Criteria:**

- Service records can bypass motorcycle scope.
- Invalid mileage can reach the database as a usable record.
- The migration requires destructive changes to existing Phase 1/2 tables.

**Dependencies:** Phase 1 and Phase 2 database and repository boundaries.

### Phase 2: Service History API and UI

**Objective:** Give the rider a usable history workflow for one service item at a time.

**Deliverables:**

- Server routes for listing/creating records and updating/deleting one record.
- Picker populated from active maintenance definitions, with `Other / unlinked`.
- Form for performed mileage plus optional parts, cost, notes, and date metadata.
- History list showing selected item, mileage, optional metadata, and edit/delete actions.
- Explicit saved, rejected, and failed feedback without clearing unrelated history.
- Styling consistent with the existing dashboard and manual workspace.

**Go Criteria:**

- A rider can create an individual record, reload the page, and see it in history.
- Edit and delete actions update active history and the outlook input set.
- The UI prevents or clearly rejects a performed mileage above current mileage.
- The picker does not offer bundled multi-item submission.

**No-Go Criteria:**

- A successful-looking action loses data on reload.
- Deleting a record removes manual facts or changes unrelated records.
- A service record can be written without a motorcycle scope or valid mileage.

**Dependencies:** Phase 1 service record data foundation.

### Phase 3: History-Aware Maintenance Calculation

**Objective:** Replace cadence-only maintenance projection with a deterministic calculation anchored to the latest applicable service.

**Deliverables:**

- Latest-applicable-record selection by definition and recorded mileage, not insertion order.
- Target calculation from `performed_mileage + interval_miles`.
- `Not recorded` when no applicable service record exists.
- `Upcoming`, `Due`, and `Overdue` based on target versus current mileage.
- `Unknown` for invalid current mileage, invalid interval, unusable mapping, or inconsistent history.
- Recalculation after current-mileage, service-record, or corrected-fact changes.
- Preservation of manual source metadata on every manual-backed outlook item.

**Go Criteria:**

- The calculation matrix passes for no history, upcoming, due, overdue, out-of-order events, current-mileage edits, missing intervals, and corrected intervals.
- The same records produce the same result regardless of insertion order.
- No-history items are not labeled overdue and do not show a personalized target.
- A service event above current mileage cannot enter the calculation set.

**No-Go Criteria:**

- The calculation silently falls back to a generic cadence when a known item has no service history.
- A corrected manual fact loses its source or changes the identity of an existing service link.
- A stale cached result remains after a relevant mileage or history change.

**Dependencies:** Phase 1 service records and Phase 2 active manual definitions.

### Phase 4: Outlook Integration and Explainability

**Objective:** Make the personalized calculation understandable and correctable from the normal rider workflow.

**Deliverables:**

- Outlook cards showing status, current mileage, interval, last service mileage, target, and remaining distance where applicable.
- `Not recorded` instruction telling the rider to add the completed service.
- Links from an outlook item to its service record and manual source page.
- Direct edit/delete refresh behavior in the same session.
- Regression coverage for the dashboard, manual viewer, search, retrieval, and fact correction paths.

**Go Criteria:**

- A reviewer can reconstruct every history-backed target from displayed inputs.
- A rider can reach the service record and manual source from the outlook without database access.
- Editing or deleting a service record updates the visible outlook without a full manual re-ingestion.
- The Phase 1 dashboard remains usable when manual data is unavailable.

**No-Go Criteria:**

- The UI shows a status without the inputs needed to explain it.
- The manual page link or raw OCR/source metadata disappears after a service-history change.
- Retrieval-only behavior is replaced by an unconfigured answer-model dependency.

**Dependencies:** Phase 2 and Phase 3 calculation gates.

### Phase 5: Hardening and Handoff

**Objective:** Verify the complete Phase 3 workflow and document the evidence needed for the next phase.

**Deliverables:**

- Full lint, typecheck, unit, integration, E2E, and production-build validation.
- Migration application check against the configured private database.
- E2E acceptance evidence for create, edit, delete, invalid mileage, no history, due, overdue, and source traceability.
- Updated Phase 3 completion/handoff record with measured results and known deviations.
- Implementation plan status and CONOPS references updated if behavior changed during enactment.

**Go Criteria:**

- All automated checks pass, apart from explicitly database-gated checks documented with their reason.
- The full calculation matrix passes with no unresolved MUST-level review findings.
- No manual PDF, credentials, or private source data is added to Git.
- The configured database can apply the migration and serve the new workflow.

**No-Go Criteria:**

- Any critical data-scope, deletion, mileage-validation, or calculation error remains.
- Phase 1 or Phase 2 behavior regresses.
- The completion record claims evidence that was not actually measured.

**Dependencies:** Phases 1–4.

## Test Plan

### Unit Tests

Verify service-record validation and calculation as pure behavior:

- valid mileage at zero, current mileage, and ordinary past mileage;
- rejection above current mileage, negative mileage, non-finite mileage, and invalid optional values;
- picker-linked and `Other / unlinked` records;
- edit and deletion state transitions;
- no history, upcoming, due, overdue, unknown interval, invalid current mileage, and inconsistent history;
- latest applicable event selected independently of insertion order;
- corrected interval changes target while preserving definition/source identity.

### Integration Tests

Verify repository and route behavior against the existing database boundary:

- migration-created table and indexes;
- motorcycle scoping on list/create/update/delete;
- successful persistence and reload;
- failed writes leave existing records unchanged;
- current-mileage upper-bound validation;
- outlook reads combine active definitions and service records;
- manual facts and source metadata are unchanged by service-record operations.

### End-to-End Tests

Cover the rider flow in the browser:

1. Open the dashboard and see the initial `Not recorded` state.
2. Create one picker-selected service record.
3. Verify the history and explanation fields.
4. Edit the record and verify the target changes.
5. Delete the record and verify the item returns to `Not recorded`.
6. Attempt a future-mileage entry and verify it is rejected.
7. Open the manual source link and verify the Phase 2 viewer still works.

### Full Validation Commands

Run these from the repository root after implementation:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
PLAYWRIGHT_PORT=3100 npm run test:e2e
npm run build
```

## Operational Safety and Rollback

### Additive migration

The migration adds `maintenance_records` and indexes. It does not rewrite
manual pages, chunks, facts, motorcycle state, or mileage history. If the
application rollback is needed, the old application can continue using Phase 1
and Phase 2 tables; the new table can remain unused until the code is restored.

### Scoped writes

Every record operation includes the configured motorcycle scope. Update and
delete use both motorcycle and record identity, preventing a client from
acting on an unrelated record.

### Mileage safety

Create and edit validate against the current mileage read at the time of the
operation. A later downward mileage correction does not delete history; it
marks the calculation inputs inconsistent until the rider corrects the data.

### Delete safety

Deletion requires an explicit rider action and refreshes the current outlook.
It does not cascade into manual definitions, OCR pages, chunks, facts, or the
PDF. No automatic deduplication or merge runs during delete.

### Manual evidence isolation

Service records reference maintenance definitions but never mutate raw OCR
context, source pages, or the original private PDF. Corrected manual facts
retain their existing definition identity and source traceability.

## Definition of Done

Phase 3 is complete when:

- A rider can create, inspect, edit, and delete one service item at a time.
- Service mileage above current motorcycle mileage is rejected.
- No-history items show `Not recorded` and instruct the rider to record service.
- History-backed items calculate `Upcoming`, `Due`, or `Overdue` deterministically.
- Unknown or inconsistent inputs show `Unknown` rather than an invented target.
- Each history-backed result exposes its current mileage, interval, last service, target, and source path.
- Manual facts remain active by default and retrieval remains the only answer behavior.
- Phase 1 mileage and Phase 2 manual behavior regressions are absent.
- All required validation and handoff evidence is recorded.

## Deferred Work

- Time-based maintenance intervals and calendar reminders.
- Bundled service visits and many-to-many maintenance associations.
- Automatic mapping of `Other / unlinked` records.
- Manual version replacement and citation migration.
- Audit history for deleted records.
- Accounts, multiple motorcycles, mobile, GPS, parts inventory, and cost analytics.
- Generated answer-model evaluation or provider selection.
