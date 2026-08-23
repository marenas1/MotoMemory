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
- [Part 4: Public Demo Mode](#part-4-public-demo-mode)
- [Part 5: Mobile Companion](#part-5-mobile-companion)
- [Part 6: Automatic Ride Tracking](#part-6-automatic-ride-tracking)
- [Schema / Data Model Additions](#schema--data-model-additions)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Next.js Web App + Manual Mileage](#phase-1-nextjs-web-app--manual-mileage)
  - [Phase 2: Manual Ingestion / RAG](#phase-2-manual-ingestion--rag)
  - [Phase 3: Maintenance History](#phase-3-maintenance-history)
  - [Phase 4: Public Demo Mode](#phase-4-public-demo-mode)
  - [Phase 5: Expo Mobile Client](#phase-5-expo-mobile-client)
  - [Phase 6: GPS Ride Tracking](#phase-6-gps-ride-tracking)
- [Design Decisions](#design-decisions)
- [Test Strategy](#test-strategy)
- [Open Questions](#open-questions)

## Purpose

- Give a rider one trustworthy view of a motorcycle's current mileage, service history, and next maintenance concerns.
- Ground maintenance answers in the service manual for the rider's actual motorcycle.
- Reduce repetitive manual updates while keeping the rider in control of important state changes.
- Grow the product in useful increments so every phase can operate independently.
- Demonstrate a clear path from a simple web tool to a lightweight motorcycle digital twin.

## Problem Statement

The following concerns motivate MotoMemory. No production measurements exist yet; the projected items should be validated as the product is used.

| Problem | Observed Impact |
|---|---|
| Projected: mileage, service history, and manual guidance are commonly kept in separate places. | A rider must reconstruct the motorcycle's state before deciding what maintenance is next, increasing the chance of missed or duplicated work. |
| Projected: generic AI answers do not reliably reflect the exact year, model, market, or service schedule of a motorcycle. | A confident but incorrect answer can lead to unnecessary work or missed maintenance. |
| Projected: mileage is the main trigger for many maintenance intervals, but it is often updated only when a rider remembers to do it. | The digital record becomes stale between rides, so upcoming-maintenance calculations lose value. |
| Confirmed by project direction: a full mobile and GPS solution would introduce more privacy, battery, permission, and platform concerns than are needed to prove the core idea. | Building automation first would delay the first useful experience and make it harder to isolate whether the underlying maintenance model is correct. |
| Projected: recruiters and engineers need to understand the product quickly without creating an account or supplying their own motorcycle data. | A private or setup-heavy project is harder to evaluate as a portfolio artifact. |

## Stakeholders & Roles

| Stakeholder | Role | What They Need From This System |
|---|---|---|
| Motorcycle owner | Primary user; maintains one or more motorcycles and supplies mileage, manuals, and service records. | A concise, current answer to “what should I be thinking about next?” with enough source and history to trust it. |
| Rider | Uses the mobile client during or immediately after a ride. | Low-friction ride controls and a clear way to review or accept mileage changes. |
| Portfolio reviewer | Evaluates the public demo as a recruiter, engineer, or prospective collaborator. | An understandable, safe, interactive tour of the product's value and evolution. |
| Product owner | Decides whether a phase is ready to advance. | Evidence that the current phase is useful on its own and that its data can support the next phase. |
| Operator / maintainer | Keeps the application, document processing, and client integrations available. | Visible failures, recoverable processing, and clear boundaries around external services and user data. |

## System Overview

```text
 Rider / Reviewer
       │
       ▼
 Web Dashboard ────────┐
                       ├── MotoMemory motorcycle state
 Expo Mobile Client ──┘       │
                               ├── Mileage and ride updates
 Service Manual ──────────────┤
                               ├── Maintenance history and projections
 Rider Questions ──────────────┤
                               └── Source-backed answers
```

MotoMemory maintains a digital representation of a motorcycle. For Phase 1, that representation is one configured 1981 Suzuki GS750 with an initial mileage of 18,501 mi; it does not require an owner profile or account. The state then gains manual-specific knowledge, service history, a public demonstration surface, and a mobile interface. GPS ride tracking is the final planned automation: it estimates miles traveled and proposes or applies a new mileage state according to the product's trust and confirmation rules. The web and mobile clients are different views over the same motorcycle state rather than separate products with separate records.

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

## Part 4: Public Demo Mode

### Concept

Phase 4 packages the working experience as a safe, portfolio-friendly demo. A visitor can open a preloaded GS750 profile, inspect example mileage and service history, ask manual-backed questions, simulate mileage changes, and mark demo maintenance items complete without creating an account or changing a real rider's data.

The demo is an operational mode, not a second product. It should make the product's story legible: stored motorcycle state leads to personalized maintenance guidance, and the manual provides evidence for AI answers.

### Why This Approach

A preloaded, isolated demo is chosen over requiring sign-up because a portfolio reviewer has limited time and no reason to provide personal information before understanding the value. The trade-off is that the demo needs seeded data, reset behavior, and clear labeling. That cost is acceptable because discoverability is a direct project goal and demo data can exercise more of the experience than an empty account would.

An alternative was a static video or screenshots. Those explain the interface but do not demonstrate state transitions or source-backed answers. Another alternative was to expose a development environment with real data. That would create privacy and integrity risks and would make the experience less predictable for reviewers.

### Operational Scenarios

Sunny day:

1. A visitor opens the demo link and lands on the preloaded motorcycle.
2. The visitor reviews current mileage, maintenance history, and upcoming work.
3. The visitor simulates additional miles or marks a demo service complete.
4. The maintenance outlook changes immediately and the visitor can reset the scenario.
5. The visitor follows links to the live demo, source repository, and architecture documentation.

Failure modes:

| Failure | Behavior |
|---|---|
| A visitor changes demo state. | Keep the change within the demo scope and prevent it from affecting real motorcycle data. |
| The demo is left in a confusing state. | Provide an obvious reset and restore the known seed scenario. |
| Manual question answering is unavailable. | Keep the profile and maintenance walkthrough usable, and label the AI feature unavailable. |
| Seed data or manual references are missing. | Fail visibly in the demo environment and provide enough fallback state to explain the product. |
| A visitor mistakes simulated mileage for real data. | Label simulation and demo state consistently at the point of interaction. |

### Implementation Touch Points

- Public entry point: demo discovery, mode labeling, and portfolio links.
- Demo data scope: seeded motorcycle, history, manual, and repeatable scenario state.
- Simulation controls: temporary mileage and maintenance changes with reset behavior.
- Isolation boundary: prevents demo writes from reaching real user records.
- Project documentation: GitHub, architecture, and phase narrative links.

### Expected Impact

A reviewer should reach the core value proposition without authentication and complete at least one meaningful state change in a short visit. The measurement is demo completion rate for the profile-to-maintenance walkthrough and the percentage of demo sessions in which reset restores the seed state. The demo is successful when it communicates the product without an operator needing to explain setup or provide live data.

## Part 5: Mobile Companion

### Concept

Phase 5 adds an Expo-based iOS and Android client to the same MotoMemory backend used by the web application. The rider can check current mileage, review upcoming maintenance, log work, ask manual questions, and use quick ride controls from a phone.

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

## Part 6: Automatic Ride Tracking

### Concept

Phase 6 uses the phone's GPS to estimate miles traveled during a motorcycle ride. The rider starts a ride, the app records location data according to the available permissions and operating-system limits, and the rider ends the ride. MotoMemory calculates a distance estimate, shows the result, and updates the motorcycle mileage according to the product's confirmation policy before recalculating maintenance.

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
  scope_id: identifier              # user scope or demo scope
  make: text
  model: text
  year: integer?
  current_mileage: decimal
  mileage_unit: enum(mi, km)
  manual_id: identifier?

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

- `(scope_id, id)` on `MotorcycleProfile` keeps real and demo data isolated and makes scoped lookup explicit.
- `(motorcycle_id, performed_mileage)` and `(motorcycle_id, performed_at)` on `MaintenanceRecord` support last-service and historical views.
- `(motorcycle_id, name)` on `MaintenanceDefinition` supports maintenance projections for one motorcycle.
- `(manual_id, page_number, section_label)` on `ManualChunk` supports source navigation and citations.
- The searchable representation on `ManualChunk` supports relevant manual passage retrieval.
- `(motorcycle_id, started_at)` on `RideSession` supports ride history and recovery inspection.

The principal relationships are: a motorcycle has one active manual and many manual-derived chunks, definitions, service records, and ride sessions; a maintenance record may reference a definition; a definition may reference the manual chunk that supports it; and a ride session may produce one mileage update. All records carry or inherit motorcycle scope. Demo records use a dedicated demo scope and never share a write path with a rider's real records.

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

### Phase 4: Public Demo Mode

- Objective: Make the working product safely explorable without an account or real motorcycle data.
- Deliverables:
  - Seeded GS750 profile, manual, history, and maintenance state.
  - Mileage simulation, completion actions, reset, and demo labeling.
  - Links to the live demo, GitHub, and architecture documentation.
- Dependencies: Phases 1–3 provide the state, knowledge, and history experiences to demonstrate.
- Gate for Phase 5: An unauthenticated reviewer can complete the core walkthrough, change demo state, and restore the seed state without any change to real data. The demo failure and reset paths are observable.

### Phase 5: Expo Mobile Client

- Objective: Provide a native mobile view and action surface over the same motorcycle state as the web app.
- Deliverables:
  - iOS and Android client for mileage, maintenance, history, manual questions, and ride controls.
  - Shared identity and backend state access.
  - Permission, connectivity, refresh, and write-recovery behavior.
- Dependencies: Stable shared state behavior from Phases 1–4 and an agreed user-scope/authentication model.
- Gate for Phase 6: Cross-client consistency checks pass for core reads and writes, and mobile behavior remains understandable during offline or denied-permission conditions. GPS is not enabled until this gate passes.

### Phase 6: GPS Ride Tracking

- Objective: Estimate ride distance and reduce manual mileage updates while preserving rider control over authoritative state.
- Deliverables:
  - Start/end ride workflow with permission and lifecycle states.
  - GPS distance estimate and quality/confidence information.
  - Review or confirmation path, mileage update, and maintenance recalculation.
  - Incomplete-session, duplicate-finalization, privacy, and recovery handling.
- Dependencies: Phase 5 mobile client, shared mileage update behavior, and an agreed GPS accuracy, battery, retention, and confirmation policy.
- Gate for completion: Representative rides establish that distance accuracy, battery impact, interruption recovery, and correction behavior meet the agreed thresholds. If the thresholds are not met, the feature remains optional and never silently overrides manual mileage.

## Design Decisions

| Decision | Rationale |
|---|---|
| Establish motorcycle state before adding automation. | Explicit profile and mileage flows prove the foundation while keeping GPS, permissions, and battery concerns out of the first usable release. |
| Use the rider's service manual as the source for model-specific answers. | Generic model knowledge is not sufficient for year- and model-specific maintenance; citations make the answer inspectable. |
| Keep manual mileage available through every phase. | GPS and mobile capabilities can be unavailable, inaccurate, or unwanted. Manual entry is the reliable fallback and a necessary correction path. |
| Treat maintenance projections as explanations, not just reminders. | Showing current mileage, interval, and last service mileage lets the rider assess why an item is approaching or overdue. |
| Keep history as persistent events. | A service event needs mileage and time context so later calculations can identify the applicable last service. |
| Separate demo scope from real user scope. | Portfolio exploration must be safe, repeatable, and independent of real rider data. |
| Keep web and mobile on one backend state. | Two clients should produce one motorcycle state; separate client stores would invite drift and conflicting maintenance views. |
| Make GPS mileage an estimate with visible origin and confidence. | Phone GPS is convenient but not an authoritative odometer. The rider must be able to review or reject uncertain updates. |
| Use explicit ride sessions instead of always-on tracking. | Start and end controls make consent, battery use, and data retention easier to understand and operate. |
| Keep the project useful without AI, mobile, or GPS. | Each phase must deliver standalone value and should not be blocked by later capability risk. |

## Test Strategy

Testing is organized around observable behavior and phase gates rather than implementation internals.

| Phase | Behavior to verify | Pass criterion | Escalation signal |
|---|---|---|---|
| 1 | Create, view, update, and validate motorcycle mileage. | Valid updates persist and recalculate consistently; invalid updates never replace the last valid state. | A user can see a mileage value that was not accepted or cannot tell whether an update saved. |
| 2 | Ingest manuals, retrieve evidence, and answer questions. | Backed answers point to relevant source sections; unsupported or ambiguous questions are labeled as such. | The system answers confidently without evidence or associates a manual with the wrong motorcycle. |
| 3 | Record service and calculate due status. | Results match the calculation matrix and expose the interval and last-service inputs. | The same history produces different statuses or an overdue item appears current without explanation. |
| 4 | Enter, mutate, reset, and revisit demo state. | A reviewer can complete the walkthrough without authentication and reset returns to the known seed state. | Demo writes leak into real data, or a broken dependency leaves the reviewer unable to understand the product. |
| 5 | Read and write shared state from web and mobile. | Accepted changes converge across clients and offline/permission failures are explicit and recoverable. | Clients show conflicting authoritative mileage or silently lose a service record. |
| 6 | Track rides, estimate distance, handle interruptions, and update mileage. | Measured accuracy, battery, recovery, and correction results meet the agreed thresholds for supported configurations. | GPS silently changes mileage after a degraded or interrupted session, or error exceeds the accepted maintenance-planning tolerance. |

## Open Questions

- Which exact maintenance items and intervals should replace the provisional Phase 1 1,000-mile cadence after manual ingestion? Phase 1 uses the provisional cadence so the app can be exercised before the manual is processed.
- Which manual formats and scan quality levels are in scope for the first ingestion release? This determines the evidence and extraction-quality threshold.
- How should conflicting intervals from a manual be presented when the difference depends on market, usage severity, or model year? This needs product guidance before interval extraction is treated as authoritative.
- Should a rider confirm every GPS mileage estimate, or only estimates below a confidence threshold? This is deferred until representative ride accuracy data exists.
- What distance error and battery-impact thresholds are acceptable for GPS tracking? These should be based on real supported-device measurements rather than assumed GPS precision.
- What authentication and account model is required when one rider owns multiple motorcycles or uses more than one client? The demo can remain anonymous, but real cross-client state needs an explicit scope.
- What privacy and retention policy applies to route data, derived distance, and ride timestamps? This must be resolved before collecting location data outside a local test context.
- Which maintenance data is advisory versus safety-critical, and what rider-facing language should distinguish the two? This affects answer tone, warnings, and the boundary between assistance and professional service advice.
