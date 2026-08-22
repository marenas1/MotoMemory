# MotoMemory Phase 1 — Personal Motorcycle Web App CONOPS

This document refines Phase 1 of the [MotoMemory Concept of Operations](./MOTOMEMORY_CONOPS.md). It defines the first useful product for one owner and one motorcycle: a web application that shows the motorcycle's current state, accepts manual mileage updates, and identifies maintenance that is approaching.

This is an operational concept, not a visual design specification. The later frontend design document will define layout, typography, colors, spacing, responsive behavior, and detailed interaction design. Phase 1 uses a motorcycle emoji as the temporary visual state; a final image or model can replace it later.

The companion [Phase 1 Implementation Plan](./PHASE_1_IMPLEMENTATION_PLAN.md) translates this operational concept into the build sequence, database migrations, application boundaries, tests, and completion gates.

The companion [Phase 1 Frontend Design](./PHASE_1_FRONTEND_DESIGN.md) defines the gunmetal/amber dashboard direction, centered GS750 visual, mileage presentation, quick actions, and upcoming-reminder treatment.

## Table of Contents

- [Purpose](#purpose)
- [Problem Statement](#problem-statement)
- [Stakeholders & Roles](#stakeholders--roles)
- [System Overview](#system-overview)
- [Phase 1 Scope](#phase-1-scope)
- [Part 1: Single Motorcycle Main View](#part-1-single-motorcycle-main-view)
- [Part 2: Manual Mileage State](#part-2-manual-mileage-state)
- [Part 3: Mileage-Based Maintenance Outlook](#part-3-mileage-based-maintenance-outlook)
- [Part 4: Personal Persistence Boundary](#part-4-personal-persistence-boundary)
- [Technology Direction](#technology-direction)
  - [Database Options](#database-options)
- [Schema / Data Model Additions](#schema--data-model-additions)
- [Implementation Phases](#implementation-phases)
  - [Phase 1: Personal Web Baseline](#phase-1-personal-web-baseline)
- [Design Decisions](#design-decisions)
- [Test Strategy](#test-strategy)
- [Open Questions](#open-questions)

## Purpose

- Give the owner one dependable place to see the 1981 Suzuki GS750's current mileage and maintenance outlook.
- Replace scattered notes or memory with a persistent motorcycle state.
- Make manual mileage entry quick, explicit, and recoverable.
- Establish the smallest useful web foundation for later manual ingestion, service history, mobile access, and GPS tracking.
- Keep the first release personal and focused instead of introducing account and multi-motorcycle complexity prematurely.

## Problem Statement

Phase 1 is based on the project direction and personal use case. There are no production measurements yet, so projected concerns include a measurement plan.

| Problem | Observed Impact |
|---|---|
| Confirmed by the requested scope: the product is for one owner and one 1981 Suzuki GS750, not a general account-based motorcycle platform. | User profiles, registration, account recovery, and multi-bike navigation would add surface area without improving the owner's first maintenance workflow. |
| Projected: the motorcycle's current mileage is not always immediately visible or kept in one persistent place. | The owner must reconstruct the bike's state before deciding whether maintenance is approaching. |
| Projected: mileage-based maintenance is difficult to act on when intervals are only remembered as raw numbers. | The owner sees an interval but not a direct answer about whether an item is upcoming, due, or overdue. |
| Confirmed by the requested scope: no suitable 3D model or final motorcycle image is available yet. | Building the experience around a visual asset would delay the useful state and maintenance flows, so Phase 1 uses a motorcycle emoji. |
| Projected: choosing a mobile-first or cross-platform UI before the web experience is proven would increase platform work early. | The first usable version would arrive later and make it harder to validate the underlying motorcycle state. |

## Stakeholders & Roles

| Stakeholder | Role | What They Need From This System |
|---|---|---|
| Motorcycle owner | Sole user; enters mileage and reads the motorcycle's maintenance outlook. | A fast, readable main view and confidence that accepted mileage survives refreshes and restarts. |
| Project owner / maintainer | Owns the data, makes corrections, and decides when later phases are worthwhile. | A simple data boundary, visible failures, and a foundation that does not require redesigning the motorcycle state later. |
| Future Phase 2, 3, 5, and 6 capabilities | Consumers of the Phase 1 motorcycle state. | A stable motorcycle identifier, mileage value, unit, timestamps, and clear update origin. |

There is no end-user account role in Phase 1. The app is intentionally scoped to one known motorcycle. This is a product scope decision, not a claim that the application is ready for multiple users or public access.

## System Overview

```text
 Owner
   │
   ▼
 Next.js Web App ────────► Motorcycle State
   │                              │
   │ manual mileage update        ├── current mileage
   │                              ├── motorcycle identity
   └──────────────────────────────└── maintenance outlook
```

The owner opens the web app and lands on the motorcycle's main view. The view presents the fixed motorcycle identity, a 🏍️ visual state, current mileage, and mileage-based maintenance items. When the owner submits a new mileage, the app validates it, persists the accepted value, and recalculates the maintenance outlook. The first version does not require a user profile, authentication, manual upload, AI questions, maintenance history, mobile client, or GPS.

## Phase 1 Scope

### In Scope

- One configured motorcycle: a 1981 Suzuki GS750.
- Initial current mileage: 18,501 mi.
- One main web view for the motorcycle.
- Temporary motorcycle visual state represented by the 🏍️ emoji.
- Current mileage display.
- Manual mileage update with validation and saved-state feedback.
- A provisional maintenance check configured at every 1,000 miles.
- Maintenance status such as upcoming, due, overdue, or unknown where the schedule supports it.
- Persistent storage of the motorcycle state and accepted mileage.
- Local private deployment for Phase 1, using Supabase as the hosted database platform.
- Clear handling of empty, invalid, unavailable, and unsaved states.

### Out of Scope

- User accounts, authentication, registration, password reset, or user profiles.
- Multiple motorcycles or a motorcycle selector.
- Public demo behavior and anonymous visitor isolation.
- Service records, parts, costs, notes, or maintenance completion history.
- Service manual upload, document parsing, RAG, or AI question answering.
- Mobile or native application behavior.
- GPS, background location, ride sessions, or automatic mileage updates.
- 3D motorcycle models, generated motorcycle artwork, or final visual branding.
- Detailed frontend layout and styling decisions; those belong in a separate design document.

The schedule shown in Phase 1 is a deliberately limited configuration, not the final manual-grounded knowledge system. For now, the next maintenance target is the next 1,000-mile boundary. At 18,501 mi, the initial target is 19,000 mi, with 499 mi remaining. The app should label this cadence as provisional and should never imply that missing configured items are not required for the motorcycle.

## Part 1: Single Motorcycle Main View

### Concept

The main view is the owner's home screen for MotoMemory. It answers three questions without navigation: what motorcycle is this, how many miles does it have, and what maintenance deserves attention next?

The motorcycle identity is fixed for Phase 1: 1981 Suzuki GS750. The view uses the 🏍️ emoji as a temporary visual state. The application remains complete enough to use without a photograph, illustration, or 3D model.

The operational information hierarchy is more important than the final visual arrangement. The owner should be able to locate the current mileage, the mileage update action, and the maintenance outlook quickly. The later frontend design document will decide how those elements are arranged and styled.

### Why This Approach

A single main view is chosen because the owner has one motorcycle and one primary question: what should be considered next? It avoids navigation and entity-management work that does not serve the Phase 1 user. The trade-off is that the first screen may need to grow more carefully as history, manual questions, and ride tracking arrive. That is acceptable because the initial view establishes the central state rather than pretending all future features already exist.

An alternative was to build a general dashboard with profile setup and multiple sections. That would better match a future multi-user product but would create empty or unnecessary controls for the current owner. Another alternative was to lead with a motorcycle image or 3D model. That would make the product visually distinctive, but the asset is not available and the image does not provide the maintenance value by itself.

### Operational Scenarios

Sunny day:

1. The owner opens MotoMemory.
2. The main view identifies the bike as a 1981 Suzuki GS750.
3. The visual area shows the 🏍️ placeholder.
4. The owner sees the current mileage and maintenance outlook without creating or selecting a profile.
5. The owner updates mileage from the same primary experience.

Failure modes:

| Failure | Behavior |
|---|---|
| A final motorcycle image is unavailable. | Keep the 🏍️ placeholder and preserve all informational controls. Do not show a broken-image icon or block the page. |
| Motorcycle identity data is incomplete. | Show the known values and label missing values; do not replace them with guessed details. |
| The main state cannot be loaded. | Show a clear unavailable state and explain whether the issue is loading, storage, or configuration. |
| The page contains no configured maintenance items. | Explain that the schedule is not configured yet; do not show an empty list as proof that no work is due. |

### Implementation Touch Points

- Main web route: the single entry point for the motorcycle state.
- Motorcycle identity configuration: fixed make, model, year, and emoji visual state.
- Mileage display and update surface: shows current value, last update time, and update feedback.
- Maintenance outlook surface: presents derived status without owning the underlying calculation.
- Empty and error states: preserve usability when optional visual or data inputs are unavailable.

### Expected Impact

The owner should understand the motorcycle's current state within one page load and without setup. The initial usability check is that the owner can identify the bike, find the mileage, locate the maintenance outlook, and begin a mileage update in one session. The main view passes when it remains fully useful with the 🏍️ visual state and no profile-management flow.

## Part 2: Manual Mileage State

### Concept

The owner can set the motorcycle's current odometer mileage manually. MotoMemory treats the last accepted value as the current motorcycle state and records when it was updated and how it was supplied. The initial value is 18,501 mi.

The update flow should distinguish between an entered value, a validated value, and a persisted value. The owner should always be able to tell whether the new mileage was accepted. A rejected value must never replace the last known valid value.

Phase 1 does not need a user-facing mileage history screen. It only needs enough metadata to show the current state, support correction, and give later GPS or service-history phases a clear origin and timestamp.

### Why This Approach

Manual entry is the most direct way to establish a trustworthy initial mileage state. It avoids GPS permission, battery, signal, and background-execution concerns while the product validates its basic calculations. The trade-off is that the owner must remember to update the number after riding; later phases can reduce that burden without changing the basic state concept.

An alternative was to use browser local storage only. That would be quick for a local prototype, but it would make persistence dependent on one browser and device and would provide a weak foundation for the future mobile client. A small persistent data boundary is more work, but it protects the core state and keeps the later migration path open.

The normal update action will accept any valid non-negative mileage, including a lower value. This makes corrections straightforward and matches the owner's preference. The trade-off is that the app cannot assume mileage is monotonic; later GPS and maintenance-history phases should record update origin and make corrections visible rather than silently treating every change as riding progress.

### Operational Scenarios

Sunny day:

1. The owner opens the mileage update control.
2. The owner enters any valid non-negative mileage, whether higher, equal to, or lower than the current value.
3. MotoMemory validates the value and shows the resulting state before or as it saves.
4. The accepted mileage persists after refresh or restart.
5. The maintenance outlook recalculates from the new mileage.

Failure modes:

| Failure | Behavior |
|---|---|
| Input is empty, non-numeric, negative, or outside the supported precision. | Explain the expected format and preserve the current mileage. |
| New mileage is lower than the current value. | Accept it as an explicit manual setting, save it clearly, and recalculate from the new value. |
| Persistence fails after validation. | Show that the update was not saved, keep the prior persisted value authoritative, and avoid claiming that recalculation is durable. |
| The owner submits the same update twice. | Treat repeated submission as one effective state change and do not create conflicting current values. |
| The owner needs to correct a typo. | Allow the owner to set the corrected value through the same visible update flow and show the resulting saved state. |

### Implementation Touch Points

- Mileage input and validation boundary: defines accepted numeric format, unit, precision, and non-negative behavior.
- Motorcycle state persistence: stores the accepted current mileage and update metadata.
- Update feedback: communicates pending, saved, rejected, and failed states.
- Derived maintenance calculation: receives only the accepted mileage.
- Future shared state boundary: preserves a stable field and update origin for mobile and GPS phases.

### Expected Impact

The owner should be able to update mileage in under one short interaction from the main view. The pass measurement is a set of valid, invalid, repeated, lower-value, refresh, and restart cases in which 100% of invalid updates leave the last valid persisted state unchanged and valid lower values persist as requested. The owner must never need to guess whether the displayed mileage is saved.

## Part 3: Mileage-Based Maintenance Outlook

### Concept

The maintenance outlook converts configured intervals into actionable mileage states. For each configured item, MotoMemory compares the current mileage with the next relevant mileage threshold and reports whether the work is not near, upcoming, due, overdue, or unknown.

Phase 1 only needs a small schedule for the GS750. For now it contains a provisional maintenance check every 1,000 miles. At the starting mileage of 18,501 mi, the next target is 19,000 mi and the remaining distance is 499 mi. The schedule may be entered as structured configuration while the service manual ingestion work is deferred. Each item should make its basis visible enough for the owner to understand that the status came from a configured interval, not from an ungrounded AI answer.

The outlook is an aid to planning, not a service-history system. It does not claim that a maintenance item was completed, because Phase 3 is responsible for recording work performed and using the last service mileage.

### Why This Approach

A deterministic mileage calculation is the right first behavior because it is easy to explain and test. It gives the owner immediate value while creating a clear seam for Phase 2 manual-derived intervals and Phase 3 service history. The trade-off is that a Phase 1 item may be incomplete or provisional until the manual is ingested. That is acceptable if the interface labels the 1,000-mile cadence as provisional and never represents missing configuration as “not due.”

An alternative was to show only raw interval numbers, such as “inspect every N miles.” That would force the owner to perform the comparison mentally and would not answer the product's central question. Another alternative was to use AI to infer the schedule before manual ingestion. That would make the first screen harder to validate and could create false confidence about model-specific maintenance.

### Operational Scenarios

Sunny day:

1. The app loads the configured GS750 maintenance items.
2. It compares each item's interval or next threshold with the current mileage.
3. It labels each item using the agreed Phase 1 status rules.
4. The owner updates mileage.
5. The same items recalculate without requiring a separate refresh action.

Failure modes:

| Failure | Behavior |
|---|---|
| An interval is missing or invalid. | Show the item as unknown or unavailable and exclude it from precise due calculations. |
| A maintenance item has conflicting configuration values. | Flag the item for correction and do not silently choose one interval. |
| Current mileage is unavailable. | Show the motorcycle identity but do not manufacture a maintenance status. |
| The schedule is provisional or incomplete. | Label it as Phase 1 configured guidance and make the limitation visible. |
| A recalculation fails. | Keep the last known calculation clearly marked as stale or unavailable; do not show it as current. |

### Implementation Touch Points

- Phase 1 maintenance schedule: a small, editable set of named interval definitions.
- Maintenance calculation boundary: compares accepted mileage with configured thresholds.
- Main view status presentation: exposes due state and the calculation basis.
- Configuration validation: prevents malformed or ambiguous intervals from becoming advice.
- Later manual integration seam: allows a source reference to replace or supersede provisional configuration.

### Expected Impact

For every configured item, the owner should be able to understand why it is listed and what mileage change would affect its status. The pass measurement is a calculation matrix covering below-threshold, within-upcoming-window, exactly-due, overdue, missing, and invalid interval cases. Every critical case must produce the expected status or an explicit unknown state.

## Part 4: Personal Persistence Boundary

### Concept

Phase 1 stores one motorcycle state for one owner. There is no account or profile-management experience, but the app still has a durable boundary around the motorcycle data. The owner should be able to close the browser and return later to the same accepted mileage and configured outlook.

The boundary is intentionally narrow. It stores the motorcycle, current mileage, schedule configuration, and update metadata. It does not attempt to model users, permissions, multiple bikes, public demo sessions, or a complete maintenance history.

### Why This Approach

A single known motorcycle record matches the actual use case and keeps the first release focused. The trade-off is that the data model is not directly multi-user-ready. That is acceptable because account management is not a current user need; future expansion can add ownership or scope around the existing motorcycle state if the product becomes public.

An alternative was to build user accounts immediately “for future-proofing.” That would add authentication, authorization, onboarding, and recovery paths before there is a second user. Another alternative was to store everything only in browser state. That would make the app easy to start but would weaken persistence and complicate the mobile and public-demo phases.

### Operational Scenarios

Sunny day:

1. The app loads the known GS750 state.
2. The owner updates mileage.
3. The app stores the accepted value and update timestamp.
4. A later page load shows the same accepted value.

Failure modes:

| Failure | Behavior |
|---|---|
| The persistent store is empty on first run. | Initialize the known motorcycle and clearly identify any values that still need owner input. |
| Stored data is malformed or incomplete. | Refuse unsafe calculations, show the recoverable problem, and preserve the raw state for correction where possible. |
| The app is accessed from an unintended environment. | Keep the Phase 1 app local and private; do not expose it publicly until a hosting and access boundary is deliberately added. |
| A future migration adds users or demo mode. | Preserve the stable motorcycle identifier and add explicit scope rather than reusing the single-owner assumption invisibly. |

### Implementation Touch Points

- Single-owner data configuration: identifies the known GS750 without a user profile.
- Persistence adapter: reads and writes the current motorcycle state.
- Initialization and migration behavior: creates the known record and handles future schema changes.
- Deployment configuration: keeps the personal Phase 1 instance private until access control exists.

### Expected Impact

The owner should see the same accepted motorcycle state after at least 10 consecutive refresh or restart checks, with no unexplained resets. The phase passes when data loss, malformed state, and first-run initialization are visible and recoverable rather than silently turning into incorrect maintenance guidance.

## Technology Direction

### Next.js vs React + React Native Later

The important correction is that Next.js is not an alternative to React. Next.js is a framework for building React web applications. Its App Router provides file-based routing and supports React's server and client rendering model; the current official documentation positions it as a framework for both full-stack applications and single-page applications. See the [Next.js App Router documentation](https://nextjs.org/docs/app) and its [SPA guidance](https://nextjs.org/docs/app/guides/single-page-applications).

React Native is a separate rendering target for native mobile interfaces. It uses React concepts, but its components render to native platform UI rather than browser HTML. The React Native project recommends using a framework such as Expo for new applications; [Expo Router](https://docs.expo.dev/router/introduction/) can later provide routes across Android, iOS, and web. That does not mean a Next.js page can be reused unchanged as a React Native screen.

### Recommendation

Use Next.js for the Phase 1 web app, while keeping the motorcycle calculations and data contract independent of the web UI. Later, add an Expo / React Native client that talks to the same backend boundary. Share domain types, validation rules, maintenance calculations, and API behavior where useful; do not assume that the web components themselves will be portable to native mobile.

This recommendation fits the current order of operations:

1. The first useful surface is a web dashboard, not a ride-time mobile workflow.
2. Next.js gives the web app routing, a production-oriented application structure, and an incremental path to server-backed data without adding a separate web framework and backend on day one.
3. The single-owner scope does not require authentication or a multi-tenant backend, but it still benefits from a persistent state boundary that a later mobile client can call.
4. The future Expo app can be introduced when permissions, native behavior, and GPS are actually needed.

### Option Comparison

| Option | Phase 1 fit | Benefit | Cost / risk | Assessment |
|---|---|---|---|---|
| Next.js App Router + React | Strong | Best fit for a web-first dashboard; provides routing and a path to a server-backed app in one web project. | More framework behavior than a minimal SPA; server/client boundaries need to stay understandable. | Recommended. |
| Vite + React now, React Native later | Strong for a local web prototype | Lean web development experience and a small client-side starting point. Vite describes itself as a fast, lean build tool for modern web projects; see the [official Vite guide](https://vite.dev/guide/). | Requires a separate persistence/backend decision earlier if data must survive beyond one browser; routing and server concerns are assembled separately. | Good fallback if the first goal is explicitly a local-only prototype. |
| Expo / React Native from the start, with web support | Medium | Could provide a universal React Native project for web and future mobile. | Brings mobile and universal-platform decisions into a web-first phase; web UI trade-offs may be paid before GPS or native behavior is needed. | Defer until mobile is an active requirement. |
| Plain browser app with local storage | Strong for a throwaway prototype | Fastest possible demonstration of one mileage field. | Weak persistence boundary; poor path to shared web/mobile state and later deployment. | Not recommended for the durable Phase 1 baseline. |

The recommendation is therefore: Next.js now, React Native through Expo later, with a clean shared data and domain boundary between them. If the project goal changes to “learn or validate only a local browser mockup,” Vite + React becomes the better short-term choice. Based on the stated roadmap—persistent motorcycle state, public demo later, and a shared mobile backend—Next.js is the stronger Phase 1 starting point.

### Database Options

The database does not need to support users, permissions, or high traffic in Phase 1. It does need to preserve the motorcycle state beyond a single page session and leave a reasonable path for the future service manual, file storage, mobile client, and RAG work.

| Option | Best fit | Benefits | Trade-offs | Assessment |
|---|---|---|---|---|
| SQLite | Local development or a private app hosted on a machine with durable disk. | Very small operational footprint, no separate database server, one portable file, and full SQL transactions. See the [SQLite overview](https://www.sqlite.org/about.html). | File persistence can be awkward on serverless or ephemeral hosting. A later mobile client cannot connect to the local file without another service boundary. | Not selected for the main path; retained as a learning/prototype alternative. |
| Supabase Postgres | Hosted MotoMemory that should grow toward manual uploads and RAG. | Managed full PostgreSQL, dashboard, backups on paid plans, optional storage for manuals/images, and Postgres extensions such as `pgvector` for future retrieval work. See [Supabase Database](https://supabase.com/docs/guides/database/overview) and [Supabase Storage](https://supabase.com/docs/guides/storage). | Introduces an external platform and more concepts than one motorcycle currently needs. Auth and row-level security exist, but Phase 1 does not need to expose them. | Selected for Phase 1. |
| Neon Postgres | Hosted Next.js app where a focused managed Postgres service is preferred. | Managed serverless Postgres with branching and a direct database workflow. See the [Neon introduction](https://neon.com/docs/introduction). | Manual files, authentication, and other services would be selected separately; it is less of an all-in-one platform for the later manual workflow. | Strong alternative if database simplicity and Next.js hosting are the priority. |
| Turso / libSQL | A hosted SQLite-compatible direction with an edge-oriented deployment model. | Keeps a SQLite-like model while adding a hosted service. See the [libSQL documentation](https://docs.turso.tech/libsql). | Adds another vendor-specific choice and is not necessary for the current single-record application. | Interesting, but not the first choice for this project. |

Browser `localStorage` is not treated as the Phase 1 database. It is acceptable for a throwaway mockup, but it would make the state belong to one browser and complicate future web/mobile synchronization.

Decision: MotoMemory will use Supabase as its Phase 1 platform and PostgreSQL as its database. Supabase gives the project a managed Postgres instance now, file storage for the future service manual and images, and optional capabilities such as authentication, realtime updates, and edge functions later. Phase 1 will not use every Supabase feature: there is still no user authentication, and the main data access should remain understandable as standard PostgreSQL rather than hiding the database behind provider-specific behavior. The code should keep persistence behind a small adapter so the main view and mileage calculation remain portable.

## Schema / Data Model Additions

Phase 1 introduces only the minimum logical data needed for one motorcycle. It does not introduce a `UserProfile` or account entity.

```text
MotorcycleState
  id: identifier                    # fixed Phase 1 value, for example gs750
  make: text                        # Suzuki
  model: text                       # GS750
  model_year: integer               # 1981
  current_mileage: decimal          # initial value: 18501
  mileage_unit: enum(mi, km)         # Phase 1 display is expected to use miles
  visual_state: enum(emoji, image_available)
  visual_emoji: text                 # initial value: 🏍️
  last_mileage_update_at: timestamp?
  last_mileage_update_origin: enum(manual)

MaintenanceDefinition
  id: identifier
  motorcycle_id: identifier
  name: text                        # provisional: General maintenance check
  interval_miles: decimal            # initial value: 1000
  due_window_miles: decimal          # initial value: 1000
  status: enum(active, unknown, disabled)
  source: enum(phase1_configured)
  notes: text?

MileageUpdate
  id: identifier
  motorcycle_id: identifier
  previous_mileage: decimal
  accepted_mileage: decimal
  recorded_at: timestamp
  origin: enum(manual)
```

`MaintenanceOutlook` is derived from `MotorcycleState.current_mileage` and the active `MaintenanceDefinition` records. It does not need to be persisted in Phase 1; recalculating it avoids stale status after a mileage update.

Useful indexes are:

- `MotorcycleState.id` for the single known motorcycle lookup and future stable references.
- `(MaintenanceDefinition.motorcycle_id, status)` for retrieving active configured items and excluding disabled items.
- `(MileageUpdate.motorcycle_id, recorded_at)` for the latest accepted update and future diagnostic review.

Phase 1 uses one fixed motorcycle scope rather than a user scope. The deployment should remain private because the absence of authentication is intentional and does not provide multi-user data isolation. If the product later adds a public demo or additional owners, a scope or owner relationship should be added explicitly rather than inferred from the Phase 1 record.

## Implementation Phases

### Phase 1: Personal Web Baseline

- Objective: Give the owner a persistent, single-page view of the 1981 Suzuki GS750 with manually controlled mileage and a transparent mileage-based maintenance outlook.
- Deliverables:
  - Next.js web application with one primary motorcycle route.
  - Fixed GS750 identity, initial mileage of 18,501 mi, and 🏍️ visual placeholder state.
  - Persistent current mileage with validation, update feedback, and update metadata.
  - Provisional 1,000-mile maintenance cadence with explicit source labeling.
  - Derived upcoming, due, overdue, and unknown maintenance statuses where applicable.
  - Recoverable loading, empty, invalid, unsaved, and persistence-failure states.
- Dependencies: A private Supabase project and PostgreSQL schema, with the Next.js app running locally. The initial mileage and provisional cadence are set to 18,501 mi and every 1,000 mi.
- Gate for Phase 2: The owner can load the main view, update mileage upward or downward, refresh or restart, and see the same accepted state. Critical invalid-input and persistence-failure cases preserve the last valid state. The app remains useful with the 🏍️ visual placeholder, no AI, no service history, no account, and no mobile client.

## Design Decisions

| Decision | Rationale |
|---|---|
| Model one known motorcycle, not a user profile. | The current product is tailored to one owner and one 1981 GS750; account and multi-bike flows add no immediate value. |
| Use Next.js for the web app. | The first surface is web-first, and Next.js provides a React-based application framework with routing and a path to server-backed behavior. |
| Add React Native through Expo later. | Mobile permissions, native UI, and GPS are future needs; introducing them now would increase Phase 1 scope. |
| Share domain behavior and data contracts, not necessarily UI components. | Web React and native React Native render different primitives. Shared calculations and state semantics are more valuable than forced visual reuse. |
| Keep a persistent motorcycle state boundary. | The owner needs data to survive browser restarts, and later mobile access needs a durable state source. |
| Use the 🏍️ emoji as the Phase 1 visual state. | No available 3D model or final image should delay the functional app or force a misleading visual. |
| Use a small configured schedule in Phase 1. | The app needs enough data to show value before manual ingestion, but it must label the schedule as provisional and incomplete. |
| Do not show maintenance completion in Phase 1. | Completion requires service history and last-service mileage, which belong to Phase 3. |
| Allow the owner to set any valid non-negative mileage. | The app is personal, so straightforward correction is more valuable than enforcing monotonic mileage before GPS exists. |
| Use Supabase with PostgreSQL for the project database. | Supabase reduces infrastructure setup while preserving real PostgreSQL experience and providing a later path for manual files, vector search, and mobile access. |
| Run the Next.js app locally in Phase 1. | Local operation avoids premature hosting and access-control work while the owner validates the core application. Vercel remains a likely future hosting option. |
| Defer detailed frontend design. | Operational priority and data behavior can be established now; visual decisions will be captured in a dedicated design document. |

## Test Strategy

| Area | Behavior to verify | Pass criterion | Escalation signal |
|---|---|---|---|
| Main view | Load the known motorcycle and show the required state. | The owner sees the 1981 Suzuki GS750, 18,501 mi, the 1,000-mile provisional outlook, and the 🏍️ visual state without setup. | The app asks for a profile, requires an image, or hides the current state behind unnecessary navigation. |
| Mileage update | Accept valid mileage and recalculate. | A valid accepted value persists through refresh/restart and changes the derived outlook consistently. | The displayed value changes but the persisted value does not, or the outlook remains stale. |
| Validation | Reject malformed, negative, or unsupported values while accepting valid lower values. | 100% of invalid cases preserve the last valid persisted state; valid lower values save and recalculate. | An invalid value replaces current mileage or produces a plausible-looking calculation. |
| Maintenance outlook | Calculate configured statuses. | Test cases for below-window, upcoming, due, overdue, missing, and invalid intervals return the expected status or explicit unknown. | Missing configuration appears as “not due,” or the calculation basis cannot be understood. |
| Persistence failure | Handle unavailable or failed storage. | The owner is told the update was not saved and the app does not claim a durable state change. | The UI reports success when storage failed or silently resets state. |
| Emoji visual state | Operate before a motorcycle asset exists. | The page remains complete and usable with the 🏍️ placeholder and no broken image. | Missing artwork changes the app's behavior or leaves a broken visual element. |
| Single-owner boundary | Avoid unnecessary account behavior. | There is one known motorcycle and no profile, registration, or multi-bike flow in Phase 1. | Scope expands into account management before the core state works. |

## Open Questions

- Which motorcycle image and visual treatment should replace the 🏍️ placeholder? The replacement is decided; the specific asset and presentation are deferred to the future frontend design document.
