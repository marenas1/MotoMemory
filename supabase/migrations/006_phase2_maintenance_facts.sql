-- MotoMemory Phase 2 maintenance facts and direct corrections.
--
-- Facts live on the existing maintenance definition row so the Phase 1
-- outlook query remains the single calculation path. The OCR context and
-- source coordinates are immutable evidence; corrections change only the
-- active value and its metadata.

alter table public.maintenance_definitions
  add column if not exists interval_value numeric;

update public.maintenance_definitions
   set interval_value = interval_miles
 where interval_value is null;

alter table public.maintenance_definitions
  alter column interval_value set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'maintenance_definitions_interval_value_check'
       and conrelid = 'public.maintenance_definitions'::regclass
  ) then
    alter table public.maintenance_definitions
      add constraint maintenance_definitions_interval_value_check
      check (interval_value > 0);
  end if;
end
$$;

alter table public.maintenance_definitions
  add column if not exists interval_unit text not null default 'mi';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'maintenance_definitions_interval_unit_check'
       and conrelid = 'public.maintenance_definitions'::regclass
  ) then
    alter table public.maintenance_definitions
      add constraint maintenance_definitions_interval_unit_check
      check (interval_unit in ('mi', 'km'));
  end if;
end
$$;

alter table public.maintenance_definitions
  add column if not exists source_ocr_context text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'maintenance_definitions_manual_source_check'
       and conrelid = 'public.maintenance_definitions'::regclass
  ) then
    alter table public.maintenance_definitions
      add constraint maintenance_definitions_manual_source_check
      check (
        source_manual_id is null
        or (
          source_page_start is not null
          and source_page_end is not null
          and source_page_start > 0
          and source_page_end >= source_page_start
          and source_ocr_context is not null
        )
      );
  end if;
end
$$;

create index if not exists maintenance_definitions_manual_facts_idx
  on public.maintenance_definitions (motorcycle_id, source_manual_id, status);

-- A manual-derived active definition is enough to retire the Phase 1
-- fallback. If no usable fact is ingested, the provisional row remains active.
create or replace function public.disable_provisional_maintenance_if_manual_fact_exists(
  p_motorcycle_id text,
  p_manual_id uuid
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.maintenance_definitions as provisional
     set status = 'disabled'
   where provisional.motorcycle_id = p_motorcycle_id
     and provisional.source = 'phase1_configured'
     and provisional.status = 'active'
     and exists (
       select 1
         from public.maintenance_definitions as fact
        where fact.motorcycle_id = p_motorcycle_id
          and fact.source_manual_id = p_manual_id
          and fact.status = 'active'
          and fact.interval_value > 0
          and fact.interval_miles > 0
     );
$$;
