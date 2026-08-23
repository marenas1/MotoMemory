-- Atomically set the current mileage and record the manual update.
--
-- The row lock makes the read/compare/update/event sequence safe when two
-- requests arrive close together. Same-value submissions are successful
-- no-ops and do not create duplicate mileage events.

create or replace function public.update_motorcycle_mileage(
  p_motorcycle_id text,
  p_new_mileage numeric,
  p_origin text default 'manual'
)
returns table (
  motorcycle_id text,
  previous_mileage numeric,
  current_mileage numeric,
  changed boolean,
  updated_at timestamptz,
  last_mileage_update_origin text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current_mileage numeric;
  v_updated_at timestamptz;
  v_origin text;
begin
  if p_new_mileage is null or p_new_mileage < 0 then
    raise exception using
      errcode = '22023',
      message = 'Mileage must be zero or greater.';
  end if;

  if p_origin is distinct from 'manual' then
    raise exception using
      errcode = '22023',
      message = 'Phase 1 mileage updates must use the manual origin.';
  end if;

  select m.current_mileage, m.updated_at, m.last_mileage_update_origin
    into v_current_mileage, v_updated_at, v_origin
    from public.motorcycle_state as m
   where m.id = p_motorcycle_id
   for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Motorcycle state was not found.';
  end if;

  if v_current_mileage = p_new_mileage then
    return query
    select p_motorcycle_id,
           v_current_mileage,
           v_current_mileage,
           false,
           v_updated_at,
           v_origin;
    return;
  end if;

  v_updated_at := clock_timestamp();
  v_origin := p_origin;

  update public.motorcycle_state
     set current_mileage = p_new_mileage,
         last_mileage_update_at = v_updated_at,
         last_mileage_update_origin = v_origin,
         updated_at = v_updated_at
   where id = p_motorcycle_id;

  insert into public.mileage_updates (
    motorcycle_id,
    previous_mileage,
    accepted_mileage,
    recorded_at,
    origin
  )
  values (
    p_motorcycle_id,
    v_current_mileage,
    p_new_mileage,
    v_updated_at,
    v_origin
  );

  return query
  select p_motorcycle_id,
         v_current_mileage,
         p_new_mileage,
         true,
         v_updated_at,
         v_origin;
end;
$$;
