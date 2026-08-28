-- MotoMemory Phase 4.5 shared public abuse-control store.
--
-- This table contains only normalized client-network operational counters. It
-- is never joined to showcase data and is not a source for public responses.
-- The function is SECURITY DEFINER because the application uses a server-side
-- PostgreSQL connection while Supabase Data API roles remain denied.

create table if not exists public.public_rate_limit_windows (
  client_ip inet not null,
  route_class text not null check (
    route_class in ('manual_search', 'manual_question', 'manual_pdf')
  ),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0 and request_count <= 10000),
  violation_count smallint not null default 0 check (violation_count >= 0 and violation_count <= 10),
  throttle_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (client_ip, route_class)
);

create index if not exists public_rate_limit_windows_updated_idx
  on public.public_rate_limit_windows (updated_at);

alter table public.public_rate_limit_windows enable row level security;
revoke all on table public.public_rate_limit_windows from anon, authenticated;

create or replace function public.consume_public_rate_limit(
  p_client_ip inet,
  p_route_class text,
  p_limit integer,
  p_window_seconds integer default 60,
  p_cooldown_seconds integer default 300,
  p_throttle_after_violations integer default 3
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  throttled boolean,
  request_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
  v_violation_count smallint;
  v_throttle_until timestamptz;
  v_retry integer;
  v_throttled boolean := false;
begin
  if p_client_ip is null
     or p_route_class not in ('manual_search', 'manual_question', 'manual_pdf')
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 3600
     or p_cooldown_seconds < 1 or p_cooldown_seconds > 86400
     or p_throttle_after_violations < 2 or p_throttle_after_violations > 10 then
    raise exception using
      errcode = '22023',
      message = 'Invalid public rate-limit arguments';
  end if;

  -- Keep one current row per IP/class and remove inactive rows. The entry cap
  -- below prevents an unbounded scan/insert attack from growing this store.
  delete from public.public_rate_limit_windows
   where updated_at < v_now - make_interval(secs => greatest(p_window_seconds, p_cooldown_seconds) * 2);

  if not exists (
    select 1
      from public.public_rate_limit_windows
     where client_ip = p_client_ip
       and route_class = p_route_class
  ) then
    -- Serialize only first-seen keys so the global entry cap cannot be
    -- crossed by a burst of concurrent proxy requests.
    perform pg_advisory_xact_lock(4810092026);
    if not exists (
      select 1
        from public.public_rate_limit_windows
       where client_ip = p_client_ip
         and route_class = p_route_class
    ) then
      if (select count(*) from public.public_rate_limit_windows) >= 100000 then
        delete from public.public_rate_limit_windows
         where ctid in (
           select ctid
             from public.public_rate_limit_windows
            where throttle_until is null or throttle_until <= v_now
            order by updated_at asc
            limit 1000
         );
      end if;
      if (select count(*) from public.public_rate_limit_windows) >= 100000 then
        raise exception using
          errcode = '54000',
          message = 'Public rate-limit store is at capacity';
      end if;

      insert into public.public_rate_limit_windows (
        client_ip, route_class, window_started_at, request_count,
        violation_count, throttle_until, updated_at
      )
      values (p_client_ip, p_route_class, v_now, 0, 0, null, v_now);
    end if;
  end if;

  select window_started_at, request_count, violation_count, throttle_until
    into v_window_started_at, v_request_count, v_violation_count, v_throttle_until
    from public.public_rate_limit_windows
   where client_ip = p_client_ip
     and route_class = p_route_class
   for update;

  if v_throttle_until is not null and v_throttle_until > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_throttle_until - v_now)))::integer);
    return query select false, v_retry, true, v_request_count;
    return;
  end if;

  if v_now >= v_window_started_at + make_interval(secs => p_window_seconds) then
    update public.public_rate_limit_windows
       set window_started_at = v_now,
           request_count = 1,
           throttle_until = null,
           updated_at = v_now
     where client_ip = p_client_ip
       and route_class = p_route_class;
    return query select true, 0, false, 1;
    return;
  end if;

  if v_request_count >= p_limit then
    v_violation_count := least(10, v_violation_count + 1);
    v_throttled := v_violation_count >= p_throttle_after_violations;
    if v_throttled then
      v_throttle_until := v_now + make_interval(secs => p_cooldown_seconds);
      v_retry := p_cooldown_seconds;
    else
      v_retry := greatest(
        1,
        ceil(extract(epoch from (
          v_window_started_at + make_interval(secs => p_window_seconds) - v_now
        )))::integer
      );
    end if;

    update public.public_rate_limit_windows
       set violation_count = v_violation_count,
           throttle_until = v_throttle_until,
           updated_at = v_now
     where client_ip = p_client_ip
       and route_class = p_route_class;
    return query select false, v_retry, v_throttled, v_request_count;
    return;
  end if;

  v_request_count := v_request_count + 1;
  update public.public_rate_limit_windows
     set request_count = v_request_count,
         updated_at = v_now
   where client_ip = p_client_ip
     and route_class = p_route_class;
  return query select true, 0, false, v_request_count;
end;
$$;

revoke execute on function public.consume_public_rate_limit(inet, text, integer, integer, integer, integer)
  from public, anon, authenticated;
