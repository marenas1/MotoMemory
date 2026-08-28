-- MotoMemory Phase 3 acquisition checkup history.
--
-- The owner reported that the motorcycle received a general checkup around
-- 18,000 miles before acquisition. Seed one linked history event for each
-- active maintenance definition that does not already have service history.
-- The exact date, parts, and cost were not recorded.

insert into public.maintenance_records (
  motorcycle_id,
  definition_id,
  service_type,
  performed_mileage,
  performed_at,
  notes,
  parts,
  cost
)
select
  definition.motorcycle_id,
  definition.id,
  definition.name,
  18000,
  null,
  'Owner-supplied history: a general checkup was completed at approximately 18,000 miles before acquisition. Exact date, parts, and cost were not recorded.',
  null,
  null
from public.maintenance_definitions as definition
where definition.motorcycle_id = 'gs750'
  and definition.status = 'active'
  and not exists (
    select 1
    from public.maintenance_records as existing_record
    where existing_record.motorcycle_id = definition.motorcycle_id
      and existing_record.definition_id = definition.id
  );
