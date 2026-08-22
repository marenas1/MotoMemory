# MotoMemory Phase 1 — Frontend Implementation Plan

Status: Implemented.

This plan enacts the decisions in [`PHASE_1_FRONTEND_DESIGN.md`](./PHASE_1_FRONTEND_DESIGN.md) without expanding Phase 1 into manual ingestion, maintenance history, GPS, authentication, or health scoring.

## Objective

Turn the existing functional dashboard into a focused personal garage view for the 1981 Suzuki GS750. The final pass should make the motorcycle identity, current mileage, next maintenance target, and upcoming reminders immediately legible while preserving the existing server-backed mileage behavior.

## Implementation phases

### 1. Establish the visual foundation

- Replace the neutral starter styling with gunmetal canvas, raised panels, warm text, and amber action accents.
- Add reusable CSS tokens for surfaces, borders, text, status colors, focus rings, and spacing.
- Update document metadata to describe the dashboard as a personal motorcycle companion.
- Keep global CSS as the styling mechanism; no new UI dependency is needed for this pass.

### 2. Build the dashboard shell

- Create the desktop-first dashboard composition from the approved wireframe.
- Add a compact brand/header region and a clear “Personal · one motorcycle” scope label.
- Keep the dashboard as the only real Phase 1 view.
- Represent future Manual and History destinations as deferred/quiet navigation only when useful; do not add empty routes.
- Make the shell collapse into a single-column mobile layout without horizontal scrolling.

### 3. Implement the core data regions

- Add the supplied GS750 garage image as the hero panel background, with readable gunmetal overlays and an accessible fallback concept.
- Show the identity as `1981 Suzuki GS750` from the motorcycle record.
- Keep current mileage as the strongest numeric element, with unit and last-updated metadata.
- Preserve the existing mileage form, pending state, success state, error state, and server-confirmed value behavior.
- Present the nearest configured maintenance item as “Next maintenance.”
- Present only real configured maintenance items as upcoming reminders; at the seeded state this is the provisional 1,000-mile schedule.
- Remove unsupported graph and health-overview concepts from the rendered dashboard.

### 4. Add honest Phase 1 interactions

- Keep “Update mileage” as the primary working quick action.
- Add a working “Review upcoming” jump to the maintenance section.
- Omit or visibly defer service logging, notes, manual upload, and history actions until their later data models exist.
- Preserve accessible labels, keyboard focus, status announcements, and readable error feedback.

### 5. Verify and hand off

- Run lint, typecheck, unit/integration tests, and the existing end-to-end test suite.
- Check the dashboard with the database-backed seeded state and the disconnected fallback.
- Confirm the 18,501-mile state calculates a 19,000-mile target with 499 miles remaining.
- Review the diff for accidental scope expansion, unsupported motorcycle claims, or leaked configuration values.

## Files expected to change

- `app/globals.css` — visual tokens, layout, responsive rules, and component styling.
- `app/layout.tsx` — page metadata update.
- `components/motorcycle-main-view.tsx` — dashboard shell, hero, reminders, and quick actions.
- `components/maintenance-outlook.tsx` — presentation of the next-maintenance and reminder regions.
- `components/mileage-form.tsx` — styling hooks and accessible interaction details if needed.
- `app/page.tsx` — disconnected state styling hooks if needed.

The implementation includes the supplied decorative background asset `public/images/gs750-garage-background.png`. The hero identity and dashboard remain data-driven, and the asset can be replaced later without changing the data model.

## Acceptance criteria

- Gunmetal and amber styling is applied consistently across the dashboard.
- The garage background and `1981 Suzuki GS750` identity are prominent.
- Current mileage is visually dominant and remains server-backed.
- Next maintenance and reminders use only configured database data.
- No empty graph, unsupported health score, or fabricated maintenance entries are rendered.
- Only working Phase 1 actions are presented as active.
- The UI works on narrow screens and keeps visible keyboard focus.
- Existing functional tests continue to pass.

## Verification note

`npm run lint`, `npm run typecheck`, unit tests, integration tests, and `npm run build` pass. The Playwright web server could not be started in the restricted execution environment because localhost port binding was denied; the application code and production build remain verified.
