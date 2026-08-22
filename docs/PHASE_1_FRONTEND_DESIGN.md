# MotoMemory Phase 1 — Frontend Design

Status: Implemented frontend direction for the final Phase 1 pass.

This document translates the provided MotoMemory dashboard image into an implementable Phase 1 frontend direction. The image is a visual reference only. Its motorcycle artwork, health score, graph, maintenance facts, and dates are not treated as verified MotoMemory data.

## Design intent

MotoMemory should feel like a focused personal garage dashboard: dark gunmetal surfaces, warm amber actions, a clear view of the motorcycle, and immediate answers to:

1. Which motorcycle is this?
2. What is its current mileage?
3. What maintenance should I think about next?

Phase 1 remains a single-dashboard experience for one owner and one motorcycle. The interface should look complete without pretending that later data exists.

## Phase 1 decisions

| Area | Decision |
|---|---|
| Primary surface | One dashboard view; no separate Manual or History pages yet |
| Motorcycle identity | `1981 Suzuki GS750`, shown beside or below the hero image |
| Hero visual | Supplied GS750 garage image used as the hero panel background; 🏍️ remains the safe fallback concept |
| Color direction | Gunmetal background and panels with amber accents |
| Mileage | Large current-mileage display plus the existing manual update form |
| Maintenance | One primary next-maintenance card and upcoming reminders based only on configured data |
| Graph | Omitted from Phase 1 because there is no historical mileage data to plot |
| Health overview | Omitted from Phase 1 because there is no evidence-backed health model |
| Quick actions | Keep the area, but only make Phase 1 actions active |
| Manual and History | Stretch goals for later phases; no fake routes or empty feature promises |

## Page structure

```text
┌──────────────────────────────────────────────────────────────────────┐
│ MotoMemory                         Personal · One Motorcycle          │
├───────────────┬──────────────────────────────────────────────────────┤
│ Brand / nav   │                    GS750 hero                        │
│               │              1981 Suzuki GS750                       │
│ Dashboard     ├───────────────────────────────┬──────────────────────┤
│               │ Current mileage               │ Upcoming reminders   │
│ Future:       │ 18,501 mi                     │ General check        │
│ Manual        │ Last updated                 │ 19,000 mi · 499 left  │
│ History       │ Manual update form           ├──────────────────────┤
│               │                               │ Quick actions        │
│               ├───────────────────────────────┤ Update mileage       │
│               │ Next maintenance              │ View upcoming        │
│               │ General maintenance check    │                      │
└───────────────┴───────────────────────────────┴──────────────────────┘
```

The exact grid, spacing, and responsive breakpoints remain implementation details. The important hierarchy is the motorcycle garage visual, the identity, mileage, and the next actionable maintenance information.

## Visual system

These are starting tokens, not a final brand system:

```css
--color-canvas: #0b0f10;
--color-panel: #141a1c;
--color-panel-raised: #1b2224;
--color-border: #30383a;
--color-text: #f3eadb;
--color-muted: #a9aaa3;
--color-amber: #f0a12b;
--color-amber-bright: #ffb23d;
--color-success: #a9c46c;
--color-danger: #e8755f;
```

### Usage rules

- Use gunmetal for the page canvas, navigation, and content surfaces.
- Use amber for primary actions, active navigation, mileage emphasis, focus states, and maintenance status accents.
- Keep large text warm-white rather than pure white.
- Use muted gray-green text for secondary metadata.
- Use amber sparingly so it continues to mean “action” or “attention.”
- Preserve visible keyboard focus and sufficient contrast in every state.
- Avoid decorative gradients or data visualizations that imply information the system does not have.

## Core regions

### 1. Motorcycle hero

- Use the supplied GS750 garage image as a full-bleed background for the upper dashboard stage, continuing behind the header and mileage panel, with gunmetal overlays for text contrast.
- Display `1981 Suzuki` and `GS750` directly over the hero panel as data-driven identity text.
- Keep the 🏍️ placeholder available as the conceptual fallback if the background asset is later unavailable.
- Treat the supplied artwork as decorative UI imagery, not as verified service-manual or historical evidence.
- Keep identity text data-driven from the motorcycle record.

### 2. Current mileage

Retain the current mileage treatment from the reference:

- Large numeric value.
- `mi` unit beside or below it.
- Last update timestamp and origin.
- Manual mileage form with a clear Save action.
- Pending, saved, invalid, and persistence-failure feedback.

The form continues to allow any valid non-negative mileage, including a lower correction. The displayed value must remain the last persisted value until the server confirms a save.

Do not add a graph in Phase 1. There is no historical data to backfill, so a chart would be visually persuasive but operationally empty.

### 3. Next maintenance

Use one prominent maintenance card for the nearest configured item:

- Maintenance name.
- Interval and source.
- Next target mileage.
- Remaining miles.
- Upcoming or due status.
- Visible provisional label while the schedule is still configured at 1,000 miles.

For the seeded state, the card should calculate dynamically from the database. At 18,501 mi it displays a 19,000-mi target and 499 mi remaining.

### 4. Upcoming reminders

Keep an upcoming-reminders area, but render only real configured maintenance definitions.

- Do not invent oil changes, carburetor sync, health categories, or other schedule items before the manual is ingested.
- If only one item exists, it is acceptable to show only one reminder rather than duplicating filler rows.
- Later manual ingestion can populate the list with source-backed intervals.

### 5. Quick actions

Keep a compact quick-action area for actions that reduce friction:

Active in Phase 1:

- Update mileage.
- Jump to or review upcoming maintenance.

Deferred actions:

- Log service / repair.
- Add note.
- View maintenance history.
- Upload manual.

Deferred actions should either be omitted or clearly marked as future work. They should not appear to work before their data models and flows exist.

## Navigation and future pages

Phase 1 needs only the dashboard route. Manual and History are later capabilities, not required navigation destinations now.

If a navigation rail is retained from the reference image:

- Dashboard is the only active item.
- Manual and History can be represented as deferred items only if their disabled state is clear.
- Do not create empty routes solely to fill the navigation.
- Maintenance can initially mean the dashboard's upcoming-maintenance section rather than a separate page.

## Explicitly omitted from Phase 1

- Mileage history graph or sparkline.
- Health percentage or engine/electrical/fluids scoring.
- Claims about the motorcycle's mechanical condition.
- Maintenance items not present in the configured database schedule.
- Manual page and document upload flow.
- Maintenance history page and service-record workflow.
- Settings page, authentication, profile management, or multi-bike navigation.

## Required UI states

The frontend must design and test these states using the same gunmetal/amber system:

- Loading.
- Database disconnected or unavailable.
- Motorcycle row missing.
- No active maintenance schedule.
- Mileage input invalid.
- Mileage save pending.
- Mileage save succeeded.
- Mileage save failed.
- Stale page conflict requiring refresh.
- Responsive narrow-screen layout.

## Image asset decision

The dashboard now uses `public/images/gs750-garage-background.png` as the supplied decorative hero background. It is intentionally not treated as a verified historical reference for the 1981 GS750. Before replacing or publishing the asset, confirm:

- It depicts the intended 1981 Suzuki GS750 accurately enough for the portfolio.
- Its source or generation rights are acceptable.
- It is stored as a repository asset or future Supabase Storage object.
- It has an accessible text alternative and does not become required for the dashboard to function.

## Phase 1 frontend completion criteria

The frontend pass is complete when:

- The dashboard uses gunmetal and amber tokens consistently.
- The garage background and `1981 Suzuki GS750` identity are clear.
- Current mileage remains the strongest numeric element.
- Mileage can be updated and gives honest server-backed feedback.
- The next maintenance item and upcoming reminders use only real configured data.
- No empty graph, unsupported health score, or fabricated maintenance facts are shown.
- Quick actions expose only working Phase 1 behavior.
- Manual and History remain explicitly deferred.
- The layout works with the 🏍️ fallback and with a future image asset.
