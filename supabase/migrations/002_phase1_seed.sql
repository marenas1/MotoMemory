-- MotoMemory Phase 1 seed.
-- ON CONFLICT DO NOTHING keeps this safe to run during local setup without
-- resetting a manually corrected mileage value.

insert into public.motorcycle_state (
  id,
  make,
  model,
  model_year,
  current_mileage,
  mileage_unit,
  visual_state,
  visual_emoji
)
values (
  'gs750',
  'Suzuki',
  'GS750',
  1981,
  18501,
  'mi',
  'emoji',
  '🏍️'
)
on conflict (id) do nothing;

insert into public.maintenance_definitions (
  motorcycle_id,
  name,
  interval_miles,
  due_window_miles,
  status,
  source,
  notes
)
values (
  'gs750',
  'General maintenance check',
  1000,
  1000,
  'active',
  'phase1_configured',
  'Provisional cadence until the 1981 Suzuki GS750 service manual is ingested.'
)
on conflict (motorcycle_id, name) do nothing;
