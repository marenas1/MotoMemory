-- MotoMemory Phase 4 passphrase owner-login abuse control.
--
-- This table stores only normalized client-network counters. It never stores
-- a passphrase, session value, request body, user agent, or identity.

create table if not exists public.owner_login_rate_limits (
  client_ip inet primary key,
  window_started_at timestamptz not null,
  failure_count integer not null check (failure_count >= 0 and failure_count <= 100),
  throttle_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists owner_login_rate_limits_updated_idx
  on public.owner_login_rate_limits (updated_at);

alter table public.owner_login_rate_limits enable row level security;
revoke all on table public.owner_login_rate_limits from public, anon, authenticated;

create or replace function public.check_owner_login_attempt(
  p_client_ip inet,
  p_max_failures integer default 5,
  p_window_seconds integer default 900,
  p_cooldown_seconds integer default 900
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  throttled boolean,
  failure_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_failure_count integer;
  v_throttle_until timestamptz;
  v_retry integer;
begin
  if p_client_ip is null
     or p_max_failures < 1 or p_max_failures > 100
     or p_window_seconds < 60 or p_window_seconds > 86400
     or p_cooldown_seconds < 60 or p_cooldown_seconds > 86400 then
    raise exception using errcode = '22023', message = 'Invalid owner login rate-limit arguments';
  end if;

  delete from public.owner_login_rate_limits
   where updated_at < v_now - make_interval(secs => greatest(p_window_seconds, p_cooldown_seconds) * 2);

  if not exists (
    select 1 from public.owner_login_rate_limits where client_ip = p_client_ip
  ) then
    perform pg_advisory_xact_lock(4810092027);
    if not exists (
      select 1 from public.owner_login_rate_limits where client_ip = p_client_ip
    ) then
      if (select count(*) from public.owner_login_rate_limits) >= 100000 then
        delete from public.owner_login_rate_limits
         where ctid in (
           select ctid from public.owner_login_rate_limits
            where throttle_until is null or throttle_until <= v_now
            order by updated_at asc
            limit 1000
         );
      end if;
      if (select count(*) from public.owner_login_rate_limits) >= 100000 then
        raise exception using errcode = '54000', message = 'Owner login rate-limit store is at capacity';
      end if;
      insert into public.owner_login_rate_limits (
        client_ip, window_started_at, failure_count, throttle_until, updated_at
      ) values (p_client_ip, v_now, 0, null, v_now);
    end if;
  end if;

  select window_started_at, failure_count, throttle_until
    into v_window_started_at, v_failure_count, v_throttle_until
    from public.owner_login_rate_limits
   where client_ip = p_client_ip
   for update;

  if v_throttle_until is not null and v_throttle_until > v_now then
    v_retry := greatest(1, ceil(extract(epoch from (v_throttle_until - v_now)))::integer);
    return query select false, v_retry, true, v_failure_count;
    return;
  end if;

  if v_now >= v_window_started_at + make_interval(secs => p_window_seconds) then
    update public.owner_login_rate_limits
       set window_started_at = v_now, failure_count = 0,
           throttle_until = null, updated_at = v_now
     where client_ip = p_client_ip;
    return query select true, 0, false, 0;
    return;
  end if;

  if v_failure_count >= p_max_failures then
    v_retry := greatest(1, ceil(extract(epoch from (
      v_window_started_at + make_interval(secs => p_window_seconds) - v_now
    )))::integer);
    return query select false, v_retry, false, v_failure_count;
    return;
  end if;

  return query select true, 0, false, v_failure_count;
end;
$$;

create or replace function public.record_owner_login_failure(
  p_client_ip inet,
  p_max_failures integer default 5,
  p_window_seconds integer default 900,
  p_cooldown_seconds integer default 900
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  throttled boolean,
  failure_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_failure_count integer;
  v_throttle_until timestamptz;
begin
  if p_client_ip is null
     or p_max_failures < 1 or p_max_failures > 100
     or p_window_seconds < 60 or p_window_seconds > 86400
     or p_cooldown_seconds < 60 or p_cooldown_seconds > 86400 then
    raise exception using errcode = '22023', message = 'Invalid owner login rate-limit arguments';
  end if;

  delete from public.owner_login_rate_limits
   where updated_at < v_now - make_interval(secs => greatest(p_window_seconds, p_cooldown_seconds) * 2);

  if not exists (
    select 1 from public.owner_login_rate_limits where client_ip = p_client_ip
  ) then
    perform pg_advisory_xact_lock(4810092027);
    if not exists (
      select 1 from public.owner_login_rate_limits where client_ip = p_client_ip
    ) then
      if (select count(*) from public.owner_login_rate_limits) >= 100000 then
        delete from public.owner_login_rate_limits
         where ctid in (
           select ctid from public.owner_login_rate_limits
            where throttle_until is null or throttle_until <= v_now
            order by updated_at asc
            limit 1000
         );
      end if;
      if (select count(*) from public.owner_login_rate_limits) >= 100000 then
        raise exception using errcode = '54000', message = 'Owner login rate-limit store is at capacity';
      end if;
      insert into public.owner_login_rate_limits (
        client_ip, window_started_at, failure_count, throttle_until, updated_at
      ) values (p_client_ip, v_now, 0, null, v_now);
    end if;
  end if;

  select window_started_at, failure_count, throttle_until
    into v_window_started_at, v_failure_count, v_throttle_until
    from public.owner_login_rate_limits
   where client_ip = p_client_ip
   for update;

  if v_throttle_until is not null and v_throttle_until > v_now then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_throttle_until - v_now)))::integer),
      true, v_failure_count;
    return;
  end if;

  if v_now >= v_window_started_at + make_interval(secs => p_window_seconds) then
    v_window_started_at := v_now;
    v_failure_count := 0;
  end if;

  v_failure_count := least(100, v_failure_count + 1);
  if v_failure_count >= p_max_failures then
    v_throttle_until := v_now + make_interval(secs => p_cooldown_seconds);
    update public.owner_login_rate_limits
       set window_started_at = v_window_started_at,
           failure_count = v_failure_count,
           throttle_until = v_throttle_until,
           updated_at = v_now
     where client_ip = p_client_ip;
    return query select false, p_cooldown_seconds, true, v_failure_count;
    return;
  end if;

  update public.owner_login_rate_limits
     set window_started_at = v_window_started_at,
         failure_count = v_failure_count,
         throttle_until = null,
         updated_at = v_now
   where client_ip = p_client_ip;
  return query select true, 0, false, v_failure_count;
end;
$$;

create or replace function public.reset_owner_login_failures(p_client_ip inet)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_client_ip is null then
    raise exception using errcode = '22023', message = 'Invalid owner login client IP';
  end if;
  delete from public.owner_login_rate_limits where client_ip = p_client_ip;
end;
$$;

revoke execute on function public.check_owner_login_attempt(inet, integer, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.record_owner_login_failure(inet, integer, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.reset_owner_login_failures(inet)
  from public, anon, authenticated;
