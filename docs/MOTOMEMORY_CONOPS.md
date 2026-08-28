# MotoMemory — Concept of Operations

This document is the operational baseline for MotoMemory. It describes the problem the product solves, how a rider interacts with it as the product grows, and what each phase must prove before the next phase begins. It intentionally stays above detailed requirements, architecture, and implementation tasks. The detailed Phase 2 concept is documented in [PHASE_2_CONOPS.md](./PHASE_2_CONOPS.md).

## Table of Contents

- [Purpose](#purpose)
- [Problem Statement](#problem-statement)
- [Stakeholders & Roles](#stakeholders--roles)
- [System Overview](#system-overview)
- [Part 1: Core Motorcycle State](#part-1-core-motorcycle-state)
- [Part 2: Manual-Grounded Knowledge](#part-2-manual-grounded-knowledge)
- [Part 3: Personalized Maintenance History](#part-3-personalized-maintenance-history)
- [Part 4: Live Read-Only Workspace and Local Owner Mode](#part-4-live-read-only-workspace-and-local-owner-mode)
- [Stretch Goal A: Mobile Companion](#stretch-goal-a-mobile-companion)
- [Stretch Goal B: Automatic Ride Tracking](#stretch-goal-b-automatic-ride-tracking)
- [Schema / Data Model Additions](#schema--data-model-additions)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Next.js Web App + Manual Mileage](#phase-1-nextjs-web-app--manual-mileage)
  - [Phase 2: Manual Ingestion / RAG](#phase-2-manual-ingestion--rag)
  - [Phase 3: Maintenance History](#phase-3-maintenance-history)
  - [Phase 4: Live Read-Only Workspace and Local Owner Mode](#phase-4-live-read-only-workspace-and-local-owner-mode)
  - [Stretch Goal A: Expo Mobile Client](#stretch-goal-a-expo-mobile-client)
  - [Stretch Goal B: GPS Ride Tracking](#stretch-goal-b-gps-ride-tracking)
- [Design Decisions](#design-decisions)
- [Test Strategy](#test-strategy)
- [Open Questions](#open-questions)

## Purpose

- Give a rider one trustworthy view of a motorcycle's current mileage, service history, and next maintenance concerns.
- Ground maintenance answers in the service manual for the rider's actual motorcycle.
- Reduce repetitive manual updates while keeping the rider in control of important state changes.
- Grow the product in useful increments so every committed phase can operate independently.
- Let visitors see the real product while protecting the owner's ability to change private data.
- Leave mobile and GPS as optional extensions rather than making them prerequisites for the web product.

## Problem Statement

The following concerns motivate MotoMemory. No production measurements exist yet; the projected items should be validated as the product is used.

| Problem | Observed Impact |
|---|---|
| Projected: mileage, service history, and manual guidance are commonly kept in separate places. | A rider must reconstruct the motorcycle's state before deciding what maintenance is next, increasing the chance of missed or duplicated work. |
| Projected: generic AI answers do not reliably reflect the exact year, model, market, or service schedule of a motorcycle. | A confident but incorrect answer can lead to unnecessary work or missed maintenance. |
| Projected: mileage is the main trigger for many maintenance intervals, but it is often updated only when a rider remembers to do it. | The digital record becomes stale between rides, so upcoming-maintenance calculations lose value. |
| Confirmed by project direction: a full mobile and GPS solution would introduce more privacy, battery, permission, and platform concerns than are needed to prove the core idea. | Mobile and GPS remain stretch goals; building them first would delay the useful web experience. |
| Projected: visitors need to understand the product quickly without creating an account or supplying their own motorcycle data. | A private or setup-heavy project is harder to evaluate as a portfolio artifact. |
| Accepted product decision: supported owner records are visible to guests immediately. | Guest reads must be server-side and read-only so public access cannot mutate the motorcycle state. |

## Stakeholders & Roles

| Stakeholder | Role | What They Need From This System |
|---|---|---|
| Motorcycle owner | Primary user; maintains the motorcycle, supplies mileage/manual/history, and controls the private local owner process. | A concise, current answer to “what should I be thinking about next?” with local write access and immediate guest visibility. |
| Guest / portfolio reviewer | Views the live motorcycle, searches the manual, and asks source-backed questions without signing in. | An understandable view of the real product without the ability to change owner data. |
| Product owner | Decides whether a phase is ready to advance. | Evidence that the current phase is useful on its own and that its data can support the next phase. |
| Operator / maintainer | Keeps the application, document processing, and client integrations available. | Visible failures, recoverable processing, and clear boundaries around external services and user data. |

## System Overview

```text
 Guest ─────── live read-only workspace ──┐
                                        │
 Owner ─────── private local process ─────┼── live public motorcycle view
                                        │
 Manual / history / mileage ────────────┘
```

MotoMemory maintains a digital representation of one configured 1981 Suzuki
GS750. The owner uses a private local process to update the source state. A
guest sees the same supported motorcycle, manual, service history, maintenance
outlook, and retrieval experience through server-side read routes. Guest reads
have no write path back to the owner workspace.
Mobile and GPS remain optional future views and automation rather than part of
the committed web product sequence.

## Part 1: Core Motorcycle State

### Concept

Phase 1 gives the owner a simple web home for one configured motorcycle. The app starts at 18,501 mi for the 1981 Suzuki GS750, and the owner returns later to set the current mileage manually. The product turns that state into a small, visible view: motorcycle identity, current mileage, and maintenance items that are approaching based on the provisional 1,000-mile cadence.

The experience should be useful before AI, mobile, or GPS exists. A rider must be able to understand the motorcycle's current state at a glance and see that a mileage change produces a corresponding change in the maintenance view.

### Why This Approach

The web-first, manual-mileage approach proves the central state model with the fewest environmental dependencies. It is easier to validate motorcycle identity, mileage validation, and maintenance projection when the owner explicitly supplies the odometer reading. The accepted trade-off is that the record can become stale between updates; that is acceptable because the product has not yet proven that automatic tracking is accurate or worth its privacy and battery costs.

An alternative was to begin with a native mobile app so the product could access the phone from day one. That would add platform and permission work before the core motorcycle state is useful. Another alternative was to start with generic AI maintenance advice. That would create a conversational surface without first establishing the structured facts needed to make the advice personal and testable.

### Operational Scenarios

Sunny day:

1. The owner opens the configured GS750 motorcycle view at 18,501 mi.
2. MotoMemory shows the bike's basic information and provisional mileage-based maintenance outlook.
3. The owner returns after a ride or service and sets the mileage to the desired valid value.
4. MotoMemory recalculates the visible outlook using the new value.

Failure modes:

| Failure | Behavior |
|---|---|
| Mileage is missing, negative, or malformed. | Explain the problem, preserve the last valid state, and do not recalculate from invalid input. |
| The motorcycle state cannot be saved or loaded. | Show a recoverable error and avoid presenting unsaved values as current. |
| No maintenance schedule is available for the motorcycle. | Show the motorcycle state and clearly label the maintenance outlook as unavailable rather than inventing intervals. |
| A user refreshes or leaves during an update. | The user can determine whether the update was saved; the system does not silently create a duplicate state. |

### Implementation Touch Points

- Web client: motorcycle view, mileage entry, state summary, and maintenance outlook.
- Motorcycle state service: fixed motorcycle identity, current mileage, and valid state transitions.
- Maintenance projection capability: turns mileage and available intervals into upcoming items.
- Persistent store: retains the motorcycle profile and latest valid mileage.

### Expected Impact

The first phase should let the owner understand the configured motorcycle's current state in one short session. The acceptance measurement is completion of the view, update, and recalculate journey for representative valid and invalid mileage inputs, with 100% of critical cases preserving the last valid state after an error. The phase is successful when the product is useful without any later phase enabled.

## Part 2: Manual-Grounded Knowledge

### Concept

Phase 2 lets the rider supply the service manual for the motorcycle. MotoMemory processes the manual into searchable knowledge, identifies maintenance intervals and procedures, and uses relevant manual sections when answering questions. Answers show where the information came from so the rider can inspect the source instead of treating the model as an unsupported authority.

This phase changes the product from a general maintenance tracker into a motorcycle-specific assistant. The Manual item in the left rail becomes a working page that displays the actual service-manual PDF, supports page navigation, and lets a rider move from a cited answer to the source page. The manual is the source of truth for model-specific advice; the assistant's job is to find and explain relevant material, not to replace the manual.

### Why This Approach

Manual-grounded retrieval is chosen over relying on the language model's general knowledge because the service manual contains the exact schedule and procedures for the rider's motorcycle. The trade-off is ingestion complexity and the possibility of imperfect extraction from PDFs or scans. That cost is acceptable because source visibility and answer traceability are more important than a broader but less reliable knowledge base.

An alternative was to encode the complete schedule by hand. That could produce predictable intervals for one model but would not scale across manuals and would lose procedure detail. Another alternative was to answer directly from the whole manual on every question. That would make source selection, context size, and citation quality harder to control and would provide less predictable behavior as manuals grow.

### Operational Scenarios

Sunny day:

1. The rider uploads a manual and associates it with a motorcycle profile.
2. MotoMemory reports whether ingestion is pending, complete, or needs attention.
3. The rider asks a maintenance question in ordinary language.
4. MotoMemory retrieves relevant sections, answers in context, and presents supporting page or section references.
5. The rider can use the answer to inspect the manual or inform a maintenance decision.

Failure modes:

| Failure | Behavior |
|---|---|
| The file format is unsupported, unreadable, or empty. | Keep the prior knowledge source intact, explain that ingestion failed, and provide a retry path. |
| The manual is a scan or has poor text extraction. | Mark extraction quality as uncertain and avoid claiming that a missing passage proves a procedure does not exist. |
| A question has no relevant retrieved passage. | Say that the manual evidence is insufficient and avoid an uncited, model-only answer. |
| Retrieved passages conflict or identify a different model/year. | Surface the ambiguity and ask the rider to verify the applicable manual rather than choosing silently. |
| The answer service is unavailable. | Allow manual browsing or a clear unavailable state; do not display a generated answer without its source context. |

### Implementation Touch Points

- Manual intake experience: upload, association, processing status, and source inspection.
- Manual workspace and PDF viewer: turns the left-rail Manual item into a page for browsing the original document and opening cited pages.
- Document processing capability: extraction, chunking, metadata, and searchable representations.
- Question-answering capability: relevant passage retrieval, answer generation, and citations.
- Maintenance schedule projection: consumes intervals identified from the manual when available.
- Storage and observability: preserves document identity, processing state, and recoverable failures.

### Expected Impact

For a representative set of questions drawn from an ingested manual, every answer presented as manual-backed should include a traceable source location. The phase should reduce unsupported generic answers; the measurement is the share of evaluated answers with relevant evidence, correct model association, and no material contradiction with the cited text. The threshold is to be set after a representative manual corpus is selected, because scan quality and manual formats are not yet known.

## Part 3: Personalized Maintenance History

### Concept

Phase 3 records work performed on the motorcycle. A service entry can include service type, mileage, date, notes, parts, and optional cost. MotoMemory combines the current mileage, the applicable maintenance interval, and the last recorded service mileage to explain what is due, approaching, or overdue for this particular bike.

The rider no longer has to ask only “what does the manual recommend?” The product can answer “what is next for my motorcycle?” based on what has already happened to it.

### Why This Approach

Persistent service records are chosen over transient reminders because a maintenance interval has meaning only in relation to the last completed service. The trade-off is more data entry and more responsibility for correcting historical records. That is acceptable because the history is the basis for personalized calculations and can later be reused by both web and mobile clients.

An alternative was to keep only a checklist of completed items. A checklist would lose mileage and date context and could not reliably calculate the next due point. Another alternative was to use calendar reminders alone. Calendar reminders are useful for time-based work but cannot represent odometer-driven intervals or explain how the last service affects the next one.

### Operational Scenarios

Sunny day:

1. The rider logs an oil change at 27,000 miles and optionally records date, parts, notes, and cost.
2. The motorcycle reaches 28,700 miles.
3. MotoMemory applies the applicable 3,000-mile interval.
4. The product shows the next oil change at 30,000 miles and the remaining 1,300 miles, alongside any other relevant items.

Failure modes:

| Failure | Behavior |
|---|---|
| A record has missing or invalid service mileage/date. | Reject or quarantine the invalid record and keep it out of calculations until corrected. |
| A service record is entered out of chronological order. | Preserve the historical event and recalculate from the most recent applicable service, making the calculation basis visible. |
| The rider logs the same work twice. | Allow correction or deletion through an explicit action and flag likely duplicates when evidence is strong. |
| Current mileage is lower than a recorded service mileage. | Identify the inconsistency and avoid presenting a precise due calculation as trustworthy. |
| A service type has no known interval. | Preserve the record as history and label its next-due status as unknown. |

### Implementation Touch Points

- Maintenance history experience: create, inspect, edit, and correct service records.
- Service record store: retains structured events and rider-entered detail.
- Due-date and due-mileage projection: combines current state, intervals, and last service.
- Manual knowledge integration: supplies model-specific intervals and procedure context.
- Shared state access: exposes the same history and calculations to future clients.

### Expected Impact

The phase should let a rider explain every projected maintenance item in terms of an interval and a last-service event. The acceptance measurement is a calculation matrix covering before-due, due, overdue, missing-history, and inconsistent-mileage cases; all critical cases must produce the expected status and explain the inputs used. The product should make repeated manual lookups unnecessary for routine planning.

## Part 4: Live Read-Only Deployment and Local Owner Mode

### Concept

Phase 4 makes the actual GS750 experience publicly viewable without making the
owner's data publicly writable. A guest sees the normal MotoMemory workspace,
including live mileage, maintenance history, the manual, search, and
retrieval-only questions. Guest actions never change mileage, service records,
manual facts, or any source data.

The owner runs the same application locally with
`MOTOMEMORY_RUNTIME_MODE=owner`. The normal dashboard and Manual tab are
editable without an authentication step. The deployed application uses
`MOTOMEMORY_RUNTIME_MODE=readonly`, serves the same live data, and rejects all
state-changing requests on the server. This is a live view of the real product
and real motorcycle data, not a fictional scenario.

### Why This Approach

Server-side live reads are chosen because the owner explicitly accepts
immediate public visibility and does not need a publish or review workflow.
Guests receive allowlisted read DTOs from server routes; they do not receive a
database connection, Storage key, or mutation-capable scope. Every write is
allowed only in the private local owner process.

An alternative was fabricated demo data. That would be easier to isolate, but
it would not demonstrate the actual manual, extracted facts, history, or
maintenance state the owner wants reviewers to see. Another alternative was
anonymous browser/database access; that would make future authorization mistakes
more dangerous. A static video or screenshot would lose the useful search, PDF
inspection, and source-backed question experience.

The public boundary must enforce permissions on the server. A hidden or
disabled button is not an access control. Guest requests can read the live
allowlisted DTOs; the centralized runtime-mode guard enables writes only in the
private local owner process. This avoids Google OAuth, Supabase Auth, email
delivery, account mapping, account recovery, and a second owner application.

### Operational Scenarios

**Sunny day — guest**

1. A visitor opens the normal MotoMemory link without signing in.
2. The visitor sees the owner's current GS750 mileage, service history, and
   maintenance outlook.
3. The visitor searches the manual, asks a question, and opens the cited PDF.
4. The visitor can inspect real product behavior but has no write control.

**Sunny day — owner**

1. The owner starts the private local application with runtime mode `owner`.
2. The owner opens the normal dashboard or Manual tab directly.
3. The owner updates mileage or records completed service as usual.
4. Guests see the new value on their next live read.

**Failure modes**

| Failure | Behavior |
|---|---|
| A guest attempts to change mileage or service history. | Reject the write server-side and leave source data unchanged. |
| Owner secret is unavailable or malformed. | Keep live read-only views available and make owner writes unavailable. |
| The local owner process is unavailable. | Restart it with the database, Storage, and `MOTOMEMORY_RUNTIME_MODE=owner` configuration; no data migration is needed. |
| Manual search or question retrieval is unavailable. | Keep the profile and PDF browsing available, and label retrieval as unavailable. |
| The manual has not been uploaded or OCR is incomplete. | Keep the original state honest and explain which evidence is unavailable. |
| A guest reaches a write-capable route directly. | Apply the same authorization check as the UI and return a safe denial without mutation. |

### Implementation Touch Points

- Server-only runtime-mode resolution with production fail-closed behavior.
- Centralized server-side guards on every state-changing route.
- Server-side live read routes with allowlisted motorcycle, history, manual,
  and retrieval data.
- Owner authorization checks on mileage, service, manual, OCR, and fact routes.
- Read-only guest controls that explain local owner editing.
- Manual PDF storage adapter retaining its private Supabase Storage boundary.

### Expected Impact

A reviewer should reach the core value proposition without authentication and
inspect the same mileage, history, manual evidence, and maintenance reasoning
the owner uses. Acceptance requires a complete guest walkthrough with zero
successful mutation attempts, successful source-page opening, and successful
retrieval where evidence exists. Successful owner changes must appear on the
next guest read without a publish step or snapshot rebuild.

No guest action may change the private motorcycle scope.

## Stretch Goal A: Mobile Companion

### Concept

An optional future effort could add an Expo-based iOS and Android client to the
same MotoMemory backend used by the web application. The rider could check
current mileage, review upcoming maintenance, log work, ask manual questions,
and use quick ride controls from a phone.

The mobile client is a more convenient surface for riding-related actions. The web dashboard remains the main portfolio and deep-review experience, while both clients reflect the same motorcycle state and service history.

### Why This Approach

A shared backend is chosen so the web dashboard and mobile application agree about the motorcycle, history, and maintenance outlook. The trade-off is that the mobile client must respect shared data rules and tolerate mobile connectivity constraints. That is preferable to separate client-specific records that drift apart and undermine trust in the digital state.

An alternative was to make the mobile app the primary product and later add the web experience. That would prioritize device-specific workflows before the core model has been demonstrated publicly. Another alternative was to build a mobile-only local store. Local-first behavior could improve offline use, but it would introduce synchronization decisions before the shared state contract is proven.

### Operational Scenarios

Sunny day:

1. The rider opens the app and sees the same current mileage and maintenance outlook as on the web.
2. The rider logs a service immediately after performing it.
3. The rider asks a manual question while inspecting or planning work.
4. The rider uses quick ride controls to begin or end a ride when GPS tracking is enabled.
5. The web dashboard later reflects the same accepted changes.

Failure modes:

| Failure | Behavior |
|---|---|
| The phone is offline during a read. | Show the last known state with its freshness, rather than implying it is current. |
| A write cannot reach the backend. | Preserve the user's entered information where safe, show that it is pending or unsaved, and avoid duplicate submission on retry. |
| The app and backend versions do not agree. | Fail the affected operation clearly and preserve compatibility for core state reads where possible. |
| The user denies required permissions. | Keep non-GPS features available and explain which feature is unavailable. |
| Mobile and web display different state. | Treat the backend's accepted state as authoritative and make synchronization or refresh status visible. |

### Implementation Touch Points

- Expo client: mobile views, navigation, quick actions, and permission-aware flows.
- Shared backend interface: motorcycle state, history, manual questions, and maintenance projections.
- Authentication and user scope: identifies the rider's records across clients.
- Mobile resilience: connectivity, pending actions, refresh, and error feedback.
- Release surface: iOS and Android packaging, environment configuration, and client compatibility.

### Expected Impact

The phase should make common maintenance actions practical from a phone without changing the underlying source of truth. The acceptance measurement is cross-client consistency: changes made through either client are observable in the other after synchronization, and critical reads remain understandable when offline. The mobile client is ready to support GPS only after permission handling and recovery behavior are proven independently.

## Stretch Goal B: Automatic Ride Tracking

### Concept

An optional future effort could use the phone's GPS to estimate miles traveled
during a motorcycle ride. The rider would start a ride, the app would record
location data according to the available permissions and operating-system
limits, and the rider would end the ride. MotoMemory would calculate a
distance estimate, show the result, and update motorcycle mileage only under
an agreed confirmation policy.

The feature is deliberately an estimate. GPS distance can be affected by signal quality, route shape, device settings, and background execution limits. The operational goal is to reduce repeated odometer entry while preserving a trustworthy distinction between measured, estimated, and rider-confirmed state.

### Why This Approach

Phone GPS is chosen as the first automation source because it requires no dedicated motorcycle hardware and fits the mobile companion already planned. The trade-off is imperfect distance accuracy, battery use, privacy considerations, and platform-specific background limits. Those costs are acceptable only if the product makes ride state visible, handles interruptions safely, and gives the rider control over whether an estimate changes the authoritative mileage.

An alternative was to keep mileage fully manual. That is simpler and more accurate when the rider enters the odometer correctly, but it does not address stale state between updates. Another alternative was to integrate an OBD device or motorcycle telemetry hardware. That may provide a stronger odometer signal for supported bikes, but it adds hardware, compatibility, pairing, and cost barriers. Always-on background tracking was also considered, but explicit ride sessions better limit battery use and make consent understandable.

### Operational Scenarios

Sunny day:

1. The rider grants the required location permissions and starts a ride.
2. The app tracks the session and displays its active state.
3. The rider ends the ride.
4. MotoMemory calculates the distance estimate, shows the starting and resulting mileage, and applies the accepted update.
5. The maintenance outlook is recalculated from the new mileage.

Failure modes:

| Failure | Behavior |
|---|---|
| Location permission is denied or revoked. | Do not start or continue a false tracking session; keep manual mileage available. |
| Background tracking is paused by the operating system. | Mark the ride as incomplete or degraded, show the limitation, and avoid presenting the distance as fully measured. |
| GPS signal is lost or produces implausible jumps. | Filter or flag suspect distance, retain session diagnostics, and require review when confidence is low. |
| The app or phone stops during a ride. | Recover the session if safe, otherwise mark it incomplete without silently adding mileage. |
| End ride is submitted twice. | Finalize one ride session and make repeated requests idempotent. |
| The rider rejects the estimate. | Preserve the ride record for review if appropriate, but leave authoritative motorcycle mileage unchanged. |

### Implementation Touch Points

- Mobile ride controls: start, active, degraded, end, review, and confirmation states.
- Location collection capability: permission handling, session lifecycle, and platform behavior.
- Distance estimation: route points, quality signals, and confidence status.
- Motorcycle mileage update: applies an accepted estimate and records its origin.
- Maintenance projection: recalculates after a mileage change.
- Privacy and data controls: explains retention and gives the rider control over ride data.

### Expected Impact

The phase should reduce the number of manual mileage updates required for riders who use ride tracking. Before release, representative rides must establish median and worst-case distance error, battery impact, interruption recovery rate, and the proportion of sessions requiring rider correction. Success means the agreed accuracy and battery thresholds are met for the supported device and permission configurations; if they are not, GPS remains an optional estimate and manual mileage remains the safe fallback.

## Schema / Data Model Additions

The following is a logical data model for the evolving product. It is a planning model, not a final database schema.

```text
MotorcycleProfile
  id: identifier
  scope_id: identifier              # private owner scope
  make: text
  model: text
  year: integer?
  current_mileage: decimal
  mileage_unit: enum(mi, km)
  manual_id: identifier?

RuntimeAccess
  mode: enum(owner, readonly)
  motorcycle_id: identifier          # server-resolved gs750 scope
  process_boundary: server

ManualDocument
  id: identifier
  motorcycle_id: identifier
  file_name: text
  processing_status: enum(pending, ready, failed)
  source_model_label: text?

ManualChunk
  id: identifier
  manual_id: identifier
  section_label: text?
  page_number: integer?
  content: text
  searchable_representation: opaque

MaintenanceDefinition
  id: identifier
  motorcycle_id: identifier
  name: text
  interval_miles: decimal?
  interval_days: integer?
  source_chunk_id: identifier?

MaintenanceRecord
  id: identifier
  motorcycle_id: identifier
  definition_id: identifier?
  service_type: text
  performed_mileage: decimal
  performed_at: timestamp
  notes: text?
  parts: list<text>?
  cost: decimal?

RideSession
  id: identifier
  motorcycle_id: identifier
  started_at: timestamp
  ended_at: timestamp?
  distance_estimate: decimal?
  mileage_before: decimal
  mileage_after: decimal?
  status: enum(active, complete, degraded, rejected)
  mileage_update_origin: enum(manual, gps, rider_confirmed)?
```

Important indexes support the operational questions the product must answer:

- `(scope_id, id)` on `MotorcycleProfile` keeps server-side scope lookup explicit.
- `(motorcycle_id, performed_mileage)` and `(motorcycle_id, performed_at)` on `MaintenanceRecord` support last-service and historical views.
- `(motorcycle_id, name)` on `MaintenanceDefinition` supports maintenance projections for one motorcycle.
- `(manual_id, page_number, section_label)` on `ManualChunk` supports source navigation and citations.
- The searchable representation on `ManualChunk` supports relevant manual passage retrieval.
- `(motorcycle_id, started_at)` on `RideSession` supports ride history and recovery inspection.

The principal relationships are: the server resolves the process runtime mode
and fixed GS750 scope; a private motorcycle has one active manual and many
manual-derived chunks, definitions, and service records;
a maintenance record may reference a definition; a definition may reference
the manual chunk that supports it; and server-side read routes expose supported
values to guests without granting a write path. Mobile and ride-session records
are reserved for the stretch goals.

## Implementation Phases

### Phase 1: Next.js Web App + Manual Mileage

- Status: Complete. See [PHASE_1_COMPLETION.md](./PHASE_1_COMPLETION.md).
- Objective: Establish a persistent state for one 1981 Suzuki GS750 with a visible, manually controlled mileage value.
- Deliverables:
  - Next.js web motorcycle view with fixed GS750 identity and 🏍️ visual placeholder.
  - Initial mileage set to 18,501 mi.
  - Manual mileage update flow with validation and clear saved-state feedback.
  - Provisional maintenance cadence calculated every 1,000 mi until the manual is ingested.
- Dependencies: A private Supabase project with PostgreSQL persistence and a local Next.js deployment; the initial mileage and provisional cadence are already defined. Future hosted deployment, likely through Vercel, remains outside Phase 1.
- Gate for Phase 2: A representative acceptance matrix shows 100% pass for view loading, valid upward and downward mileage settings, invalid-input handling, persistence, and deterministic recalculation. The product is usable without manual ingestion or mobile features.

### Phase 2: Manual Ingestion / RAG

- Objective: Make maintenance knowledge specific to the motorcycle by ingesting and retrieving its service manual.
- Deliverables:
  - Working Manual navigation from the left rail into a dedicated manual workspace.
  - Upload-only intake for one active manual PDF and original PDF storage with a browser-native viewer and page navigation.
  - Manual upload and processing status with retry and visible OCR page-failure states.
  - Searchable, page-aware manual sections with source metadata.
  - Manual-backed answers, citation-to-page navigation, and manual-derived maintenance intervals with source links and a later correction path.
- Dependencies: Phase 1 motorcycle identity and storage scope.
- Gate for Phase 3: A representative question set produces traceable answers whose cited passages support the response, the original PDF viewer can open each cited page, and failed or ambiguous ingestion does not create uncited guidance. The evaluation corpus and evidence threshold must be recorded.

### Phase 3: Maintenance History

- Objective: Calculate personalized maintenance outlook from current mileage, manual intervals, and recorded service events.
- Deliverables:
  - Service record creation and review.
  - Next-due and overdue calculations.
  - Explanation of the last service and interval behind each projection.
- Dependencies: Phase 1 state and Phase 2 manual-derived intervals, with a safe fallback for unavailable intervals.
- Gate for Phase 4: The calculation matrix passes for before-due, due, overdue, missing-history, out-of-order, and inconsistent-data cases, and a reviewer can reconstruct each result from displayed inputs.

### Phase 4: Live Read-Only Workspace and Local Owner Mode

- Objective: Let guests inspect the actual motorcycle experience while preserving local owner write access.
- Deliverables:
  - Local owner mode for mileage, history, manual, and fact changes.
  - Guest access to the normal live motorcycle view, service history, manual viewing, search, and retrieval-backed questions.
  - Server-side authorization that rejects guest mutations regardless of UI controls.
  - Read-only permission affordances that explain local owner editing.
- Dependencies: Phases 1–3 provide the state, knowledge, and history experiences; a server-only runtime-mode boundary must be added before public exposure.
- Gate for completion: An unauthenticated reviewer can inspect the current real-data walkthrough, open source pages, and ask questions; every guest write attempt is rejected; and owner changes appear on the next live read.

### Stretch Goal A: Expo Mobile Client

- Objective: Provide an optional native mobile view and action surface over the same authorized motorcycle state.
- Deliverables:
  - iOS and Android client for mileage, maintenance, history, and manual questions.
  - Shared identity and backend state access.
  - Permission, connectivity, refresh, and write-recovery behavior.
- Dependencies: Stable web state and an agreed user-scope/authentication model.
- Gate: Cross-client consistency and mobile recovery behavior meet agreed thresholds. This goal is not required for the live guest workspace.

### Stretch Goal B: GPS Ride Tracking

- Objective: Optionally estimate ride distance while preserving rider control over authoritative mileage.
- Deliverables:
  - Start/end ride workflow with permission and lifecycle states.
  - GPS distance estimate and quality/confidence information.
  - Review or confirmation path, mileage update, and maintenance recalculation.
  - Incomplete-session, duplicate-finalization, privacy, and recovery handling.
- Dependencies: The mobile stretch goal, shared mileage behavior, and agreed GPS accuracy, battery, retention, and confirmation policies.
- Gate: Representative rides meet the agreed accuracy, battery, interruption-recovery, and correction thresholds. If not, GPS remains optional and never silently overrides manual mileage.

## Design Decisions

| Decision | Rationale |
|---|---|
| Establish motorcycle state before adding automation. | Explicit profile and mileage flows prove the foundation while keeping GPS, permissions, and battery concerns out of the first usable release. |
| Use the rider's service manual as the source for model-specific answers. | Generic model knowledge is not sufficient for year- and model-specific maintenance; citations make the answer inspectable. |
| Keep manual mileage available through every phase. | GPS and mobile capabilities can be unavailable, inaccurate, or unwanted. Manual entry is the reliable fallback and a necessary correction path. |
| Treat maintenance projections as explanations, not just reminders. | Showing current mileage, interval, and last service mileage lets the rider assess why an item is approaching or overdue. |
| Keep history as persistent events. | A service event needs mileage and time context so later calculations can identify the applicable last service. |
| Keep guest reads server-side and local owner writes server-guarded. | Guests need to see current real product data without receiving a write path to the owner's motorcycle. |
| Use a process-wide runtime mode for private writes. | The single trusted owner edits through a private local process; adding accounts or a login flow would add complexity without adding a second owner. |
| Use live server-side reads instead of a publish projection. | The owner wants saved values visible immediately and does not want a publish workflow. |
| Keep local owner editing separate from the deployment. | The deployed application can show the actual live data while production remains fail-closed read-only. |
| Keep guests fully unauthenticated. | The normal app URL should open directly to a live read-only workspace with no guest account or login prompt. |
| Show supported owner details immediately. | The owner explicitly accepted public visibility; the browser still cannot mutate or access the database directly. |
| Keep web as the committed primary client. | A future mobile client must use the same authorized backend state, but it is not required for the live guest workspace. |
| Keep GPS mileage as a future estimate with visible origin and confidence. | GPS is convenient but not an authoritative odometer; it remains a stretch goal until accuracy, battery, privacy, and correction behavior are proven. |
| Keep the project useful without AI, mobile, or GPS. | The committed web phases deliver standalone value and are not blocked by later capability risk. |

## Test Strategy

Testing is organized around observable behavior and phase gates rather than implementation internals.

| Phase | Behavior to verify | Pass criterion | Escalation signal |
|---|---|---|---|
| 1 | Create, view, update, and validate motorcycle mileage. | Valid updates persist and recalculate consistently; invalid updates never replace the last valid state. | A user can see a mileage value that was not accepted or cannot tell whether an update saved. |
| 2 | Ingest manuals, retrieve evidence, and answer questions. | Backed answers point to relevant source sections; unsupported or ambiguous questions are labeled as such. | The system answers confidently without evidence or associates a manual with the wrong motorcycle. |
| 3 | Record service and calculate due status. | Results match the calculation matrix and expose the interval and last-service inputs. | The same history produces different statuses or an overdue item appears current without explanation. |
| 4 | Guest reads, local owner mode, live synchronization, and write rejection. | A guest completes the real-data walkthrough with 0 successful mutations; local owner changes appear on the next live read. | A guest can mutate source data, private manual evidence leaks unintentionally, or the guest view becomes fabricated/stale. |
| Stretch A | Read and write shared state from a future mobile client. | Accepted changes converge across clients and offline/permission failures are explicit and recoverable. | A future client shows conflicting authoritative mileage or silently loses a service record. |
| Stretch B | Track rides, estimate distance, handle interruptions, and update mileage. | Measured accuracy, battery, recovery, and correction results meet agreed thresholds for supported configurations. | GPS silently changes mileage after a degraded or interrupted session, or error exceeds the accepted maintenance-planning tolerance. |

## Open Questions

- Which exact maintenance items and intervals should replace the provisional Phase 1 1,000-mile cadence after manual ingestion? Phase 1 uses the provisional cadence so the app can be exercised before the manual is processed.
- Which manual formats and scan quality levels are in scope for the first ingestion release? This determines the evidence and extraction-quality threshold.
- How should conflicting intervals from a manual be presented when the difference depends on market, usage severity, or model year? This needs product guidance before interval extraction is treated as authoritative.
- Phase 4 exposes supported motorcycle, mileage, outlook, history, service-record, manual, OCR, and retrieval details to guests immediately. Credentials, storage keys, private identifiers, and server-only data remain private.
- The normal dashboard and Manual tab are read-only in the deployed application. Mileage, service records, uploads, ingestion, and fact corrections work only in the local process configured with `MOTOMEMORY_RUNTIME_MODE=owner`; guests are not sent through a login flow.
- What rate-limit values should be adjusted after the first public traffic is observed? Start with 60 manual searches per minute per IP, 10 retrieval-only questions per minute per IP, and 120 PDF/page requests per minute per IP. Bound search and question lengths, return `429` with retry guidance, and temporarily throttle sustained abuse. Guests remain unauthenticated and no CAPTCHA or guest account is required; tune the figures later only if normal visitors are blocked or abuse is observed.
- Which maintenance data is advisory versus safety-critical, and what rider-facing language should distinguish the two? This affects answer tone, warnings, and the boundary between assistance and professional service advice.

Mobile and GPS remain deferred stretch goals, not Phase 4 decisions that need to
be answered now.
