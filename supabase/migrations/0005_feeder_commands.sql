-- Hardware layer: the ESP8266 command queue.
--
-- Until now "Feed Now" inserted a feed_events row and hoped — no device was
-- ever told to do anything (the TODO(hardware) in /api/feed/manual). This
-- replaces that with a real queue: the app enqueues a command, the feeder
-- claims it, moves the servo, and reports back; only then is a feed_event
-- written.
--
-- The firmware authenticates with the *public* anon key, exactly like the
-- browser does, so the anon key cannot be the credential. Instead every
-- device-facing entry point is a SECURITY DEFINER function that verifies a
-- per-device shared secret, and anon gets EXECUTE on those functions and no
-- direct DML anywhere. The service-role key never leaves the server.

-- ------------------------------------------------------------------ devices ---
-- Re-introduced (0002 dropped the auth-era table of the same name) purely as
-- the home for the per-device secret. It cannot live on device_status: that
-- table is world-readable and realtime-published, so the secret would be
-- broadcast to every open dashboard.
create table if not exists devices (
  device_id text primary key,
  label text not null default '',
  -- sha256 hex of a 256-bit random provisioning token. Not bcrypt: this is
  -- verified on every 1 Hz poll (86,400 times per device per day), and a slow
  -- KDF buys nothing against a secret that was never guessable. sha256() is a
  -- pg_catalog builtin, so this needs no pgcrypto and no extensions schema.
  secret_hash text not null,
  created_at timestamptz not null default now()
);

alter table devices enable row level security;
-- No policies at all. RLS with zero policies denies everything; the revoke is
-- belt-and-braces against Supabase's default grants on new public tables.
revoke all on table devices from anon, authenticated;

-- ---------------------------------------------------------- feeder_commands ---
create table if not exists feeder_commands (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  command text not null default 'feed' check (command in ('feed')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'failed')),
  -- Fixed when the command is enqueued, not when it executes: a dispense that
  -- straddles a slot boundary belongs to the slot the human asked in.
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner')),
  source text not null default 'app' check (source in ('app', 'schedule', 'retry')),
  target_g numeric not null check (target_g >= 0),
  -- What the load cell actually measured, which is not the same as target_g.
  dispensed_g numeric check (dispensed_g is null or dispensed_g >= 0),
  tray_before_g numeric,
  tray_after_g numeric,
  -- Machine-readable failure code (timeout_pickup / timeout_execute / jam /
  -- empty_tank / no_scale / aborted / device_error). English and machine
  -- readable on purpose: the Thai user-facing string is produced in
  -- src/lib/feeder-commands.ts so the mapping lives in one place.
  error text,
  attempts int not null default 0,
  -- Deliberately not foreign keys: 0002 dropped every FK in this schema and
  -- that stance is kept. Orphan ids are possible and tolerated.
  retry_of uuid,
  feed_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  executed_at timestamptz,
  finished_at timestamptz
);

-- Hot path: the 1 Hz poll. Partial, so the index stays a handful of pages
-- forever however large the command history grows.
create index if not exists feeder_commands_pending_idx
  on feeder_commands (device_id, created_at)
  where status = 'pending';

-- Drives expire_stale_commands(), which scans by status + age across devices.
create index if not exists feeder_commands_active_idx
  on feeder_commands (status, created_at)
  where status in ('pending', 'running');

-- History reads, mirroring feed_events_device_ts_idx from 0001.
create index if not exists feeder_commands_device_created_idx
  on feeder_commands (device_id, created_at desc);

-- Structurally prevents double-feeding: a double-tapped button, or two open
-- browser tabs, cannot produce two live commands for one device.
-- enqueue_feed_command() expires stale rows first, so a dead command never
-- blocks a new one.
create unique index if not exists feeder_commands_one_active_idx
  on feeder_commands (device_id)
  where status in ('pending', 'running');

alter table feeder_commands enable row level security;

-- The dashboard needs realtime UPDATE payloads to flip its "กำลังเทอาหาร..."
-- toast, and Realtime evaluates postgres_changes under the *subscriber's*
-- role — so anon must be able to SELECT here or no payload is ever delivered
-- and the toast hangs forever. This row carries no secret (that lives in
-- devices, which is deny-all), and every other table in this schema has been
-- world-readable since 0002, so a readable command log is not a new exposure
-- class. The write side stays fully closed.
drop policy if exists "feeder_commands_select_all" on feeder_commands;
create policy "feeder_commands_select_all" on feeder_commands for select using (true);

revoke all on table feeder_commands from anon, authenticated;
grant select on table feeder_commands to anon, authenticated;

-- ------------------------------------------------- device_status additions ---
-- device_status is already the liveness table, already realtime-published and
-- already fetched with select("*") by the dashboard, so these columns reach
-- the client with zero query changes.
alter table device_status add column if not exists last_seen_at timestamptz;
alter table device_status add column if not exists last_feed_at timestamptz;
alter table device_status add column if not exists firmware_version text;
alter table device_status add column if not exists wifi_rssi int;

-- ------------------------------------------------------ close the old holes ---
-- feed_events is now written exclusively by device_report_result(). Leaving
-- the open insert policy from 0002 would let anyone holding the (public) anon
-- key forge meal history, which is precisely what this migration exists to
-- prevent.
drop policy if exists "feed_events_insert_all" on feed_events;
revoke insert, update, delete on table feed_events from anon, authenticated;

-- feeder_readings finally gains a writer (device_report_reading), but still
-- not a direct one.
revoke insert, update, delete on table feeder_readings from anon, authenticated;
revoke insert, update, delete on table device_status from anon, authenticated;

-- --------------------------------------------------------------- functions ---

-- Lazy expiry instead of pg_cron: called at the top of the device poll path
-- and of device_health() (which the dashboard hits), so a command times out
-- the moment anyone next looks at the system. Nothing schedules this.
create or replace function public.expire_stale_commands()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.feeder_commands
     set status = 'failed',
         error = case when status = 'pending' then 'timeout_pickup'
                      else 'timeout_execute' end,
         updated_at = now(),
         finished_at = now()
   where (status = 'pending' and created_at  < now() - interval '60 seconds')
      or (status = 'running' and executed_at < now() - interval '120 seconds');
$$;

-- The only credential check in the system. Comparing a hash with = is not
-- constant-time, but the timing leak is over a *hash prefix*, which reveals
-- nothing about a 256-bit random preimage.
create or replace function public.assert_device(p_device_id text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_device_id is null or p_secret is null
     or not exists (
       select 1 from public.devices
        where device_id = p_device_id
          and secret_hash = encode(sha256(convert_to(p_secret, 'utf8')), 'hex')
     )
  then
    -- SQLSTATE class 28 makes PostgREST answer 403, which the firmware can
    -- tell apart from a transport failure by HTTP status alone.
    raise exception 'unauthorized device' using errcode = '28000';
  end if;
end;
$$;

create or replace function public.device_poll_command(p_device_id text, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.feeder_commands;
begin
  perform public.assert_device(p_device_id, p_secret);
  perform public.expire_stale_commands();

  -- Coarse heartbeat. device_status is realtime-published, so an
  -- unconditional update here would broadcast to every open dashboard once
  -- per second and churn the WAL for nothing. 10s granularity is far finer
  -- than the 30s online/offline threshold needs.
  insert into public.device_status (device_id, last_seen_at, updated_at)
  values (p_device_id, now(), now())
  on conflict (device_id) do update
     set last_seen_at = now(),
         updated_at   = now()
   where device_status.last_seen_at is null
      or device_status.last_seen_at < now() - interval '10 seconds';

  -- skip locked: two firmware threads, or a device plus a debugging curl, can
  -- never claim the same command.
  select * into v_cmd
    from public.feeder_commands
   where device_id = p_device_id and status = 'pending'
   order by created_at
   limit 1
   for update skip locked;

  -- PostgREST renders SQL NULL as a 4-byte `null` body — the cheapest
  -- possible idle poll, which matters at 1 Hz on a chip with 80 KB of RAM.
  if not found then
    return null;
  end if;

  update public.feeder_commands
     set status = 'running',
         executed_at = now(),
         updated_at = now(),
         attempts = attempts + 1
   where id = v_cmd.id;

  return jsonb_build_object(
    'id', v_cmd.id,
    'command', v_cmd.command,
    'target_g', v_cmd.target_g,
    'meal_slot', v_cmd.meal_slot
  );
end;
$$;

create or replace function public.device_report_result(
  p_device_id     text,
  p_secret        text,
  p_command_id    uuid,
  p_success       boolean,
  p_dispensed_g   numeric default null,
  p_tray_weight_g numeric default null,
  p_error         text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.feeder_commands;
  v_event_id uuid;
begin
  perform public.assert_device(p_device_id, p_secret);

  -- device_id in the predicate is the anti-forgery guard: a device holding
  -- PETFEEDER-002's secret cannot close out PETFEEDER-001's command.
  select * into v_cmd
    from public.feeder_commands
   where id = p_command_id and device_id = p_device_id
   for update;

  if not found then
    raise exception 'unknown command for this device' using errcode = '22023';
  end if;

  -- Idempotent. A report retried after a dropped TLS connection must not
  -- insert a second feed_event; anything not still 'running' is terminal.
  if v_cmd.status <> 'running' then
    return jsonb_build_object('ok', true, 'status', v_cmd.status,
                              'feed_event_id', v_cmd.feed_event_id,
                              'duplicate', true);
  end if;

  if not p_success then
    update public.feeder_commands
       set status = 'failed',
           error = coalesce(p_error, 'device_error'),
           dispensed_g = p_dispensed_g,
           tray_after_g = p_tray_weight_g,
           updated_at = now(),
           finished_at = now()
     where id = v_cmd.id;

    return jsonb_build_object('ok', true, 'status', 'failed');
  end if;

  -- feed_events is written here rather than by a trigger: the correctness
  -- property is "exactly one event on the running -> success *edge*", which
  -- is a two-line guard above. A trigger would fire for any future writer, so
  -- a manual UPDATE to unstick a row would fabricate a meal.
  --
  -- Same columns the app has always used, so /history and /api/chat are
  -- untouched: target_g stays "the amount we commanded" and actual_eaten_g
  -- starts at 0 until device_report_consumption() backfills it.
  insert into public.feed_events (device_id, meal_slot, target_g, actual_eaten_g)
  values (p_device_id, v_cmd.meal_slot, v_cmd.target_g, 0)
  returning id into v_event_id;

  update public.feeder_commands
     set status = 'success',
         dispensed_g = coalesce(p_dispensed_g, v_cmd.target_g),
         tray_after_g = p_tray_weight_g,
         feed_event_id = v_event_id,
         error = null,
         updated_at = now(),
         finished_at = now()
   where id = v_cmd.id;

  insert into public.device_status (device_id, last_feed_at, last_seen_at, updated_at)
  values (p_device_id, now(), now(), now())
  on conflict (device_id) do update
     set last_feed_at = now(),
         last_seen_at = now(),
         updated_at   = now();

  return jsonb_build_object('ok', true, 'status', 'success',
                            'feed_event_id', v_event_id);
end;
$$;

-- Resolves the TODO(hardware) that used to sit in /api/feed/manual. A load
-- cell can only observe "food left the tray", so eaten = tray weight when the
-- dispense finished minus tray weight once the pet has had time to eat. The
-- firmware calls this SETTLE_DELAY_MS (default 30 min) after a good feed.
create or replace function public.device_report_consumption(
  p_device_id     text,
  p_secret        text,
  p_command_id    uuid,
  p_tray_weight_g numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.feeder_commands;
  v_eaten numeric;
begin
  perform public.assert_device(p_device_id, p_secret);

  select * into v_cmd
    from public.feeder_commands
   where id = p_command_id and device_id = p_device_id;

  if not found or v_cmd.status <> 'success'
     or v_cmd.feed_event_id is null or v_cmd.tray_after_g is null then
    raise exception 'no settled feed to attribute consumption to'
      using errcode = '22023';
  end if;

  v_eaten := greatest(0, v_cmd.tray_after_g - p_tray_weight_g);

  update public.feed_events
     set actual_eaten_g = v_eaten
   where id = v_cmd.feed_event_id;

  update public.device_status
     set last_seen_at = now(), updated_at = now()
   where device_id = p_device_id;

  return jsonb_build_object('ok', true, 'actual_eaten_g', v_eaten);
end;
$$;

-- feeder_readings has had no writer since 0001. This is it.
create or replace function public.device_report_reading(
  p_device_id        text,
  p_secret           text,
  p_tray_weight_g    numeric,
  p_tank_weight_g    numeric,
  p_uv_status        boolean default null,
  p_wifi_rssi        int     default null,
  p_firmware_version text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_device(p_device_id, p_secret);

  insert into public.feeder_readings (device_id, tray_weight_g, tank_weight_g)
  values (p_device_id, p_tray_weight_g, p_tank_weight_g);

  insert into public.device_status
    (device_id, uv_status, last_seen_at, wifi_rssi, firmware_version, updated_at)
  values
    (p_device_id, coalesce(p_uv_status, false), now(),
     p_wifi_rssi, p_firmware_version, now())
  on conflict (device_id) do update
     set uv_status        = coalesce(p_uv_status, device_status.uv_status),
         last_seen_at     = now(),
         wifi_rssi        = coalesce(p_wifi_rssi, device_status.wifi_rssi),
         firmware_version = coalesce(p_firmware_version,
                                     device_status.firmware_version),
         updated_at       = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- Called by /api/feed/manual. Deliberately takes no secret: the web app runs
-- on the public anon key, so a secret here would just be published to the
-- browser. The exposure is identical to the feed_events_insert_all policy
-- this migration removes — you can cause a feed, but you can no longer forge
-- history. See docs/HARDWARE.md, "What the device secret does and does not
-- protect".
create or replace function public.enqueue_feed_command(
  p_device_id text,
  p_target_g  numeric,
  p_meal_slot text,
  p_source    text default 'app',
  p_retry_of  uuid default null
)
returns public.feeder_commands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.feeder_commands;
begin
  perform public.expire_stale_commands();

  -- Idempotent against a double-tapped button / two open tabs, and what keeps
  -- feeder_commands_one_active_idx from raising 23505 on the common path.
  select * into v_cmd
    from public.feeder_commands
   where device_id = p_device_id and status in ('pending', 'running')
   order by created_at
   limit 1;

  if found then
    return v_cmd;
  end if;

  insert into public.feeder_commands
    (device_id, command, meal_slot, target_g, source, retry_of)
  values
    (p_device_id, 'feed', p_meal_slot, p_target_g,
     coalesce(p_source, 'app'), p_retry_of)
  returning * into v_cmd;

  return v_cmd;

exception
  -- Two simultaneous enqueues can both pass the check above; the partial
  -- unique index is the real guard. Losing that race is not an error — the
  -- caller wanted "a feed is queued", and one is.
  when unique_violation then
    select * into v_cmd
      from public.feeder_commands
     where device_id = p_device_id and status in ('pending', 'running')
     order by created_at
     limit 1;
    return v_cmd;
end;
$$;

-- Device status read path. Exists mainly for its side effect: calling it is
-- what expires a command when the device is offline and nothing is polling.
-- Returns raw timestamps plus the server clock — the online/offline judgement
-- is made once, in src/lib/device-health.ts, so it isn't implemented twice.
create or replace function public.device_health(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform public.expire_stale_commands();

  select jsonb_build_object(
    'device_id',        p_device_id,
    'server_time',      now(),
    'uv_status',        coalesce(s.uv_status, false),
    'last_seen_at',     s.last_seen_at,
    'last_feed_at',     s.last_feed_at,
    'firmware_version', s.firmware_version,
    'wifi_rssi',        s.wifi_rssi,
    'active_commands',  (select count(*) from public.feeder_commands c
                          where c.device_id = p_device_id
                            and c.status in ('pending', 'running'))
  ) into v
  from public.device_status s
  where s.device_id = p_device_id;

  -- A device that has never checked in has no device_status row at all.
  return coalesce(v, jsonb_build_object(
    'device_id', p_device_id,
    'server_time', now(),
    'uv_status', false,
    'last_seen_at', null,
    'last_feed_at', null,
    'firmware_version', null,
    'wifi_rssi', null,
    'active_commands', 0));
end;
$$;

-- ------------------------------------------------------------------ grants ---
-- Postgres grants EXECUTE on every new function to PUBLIC by default, so each
-- one must be explicitly locked down before anything is re-granted.
revoke all on function public.expire_stale_commands() from public, anon, authenticated;
revoke all on function public.assert_device(text, text) from public, anon, authenticated;
revoke all on function public.device_poll_command(text, text) from public, anon, authenticated;
revoke all on function public.device_report_result(text, text, uuid, boolean, numeric, numeric, text)
  from public, anon, authenticated;
revoke all on function public.device_report_consumption(text, text, uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.device_report_reading(text, text, numeric, numeric, boolean, int, text)
  from public, anon, authenticated;
revoke all on function public.enqueue_feed_command(text, numeric, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.device_health(text) from public, anon, authenticated;

-- expire_stale_commands() and assert_device() stay internal: they run inside
-- the SECURITY DEFINER functions above, which execute as the owner.
--
-- service_role is re-granted because the blanket `revoke ... from public`
-- strips it too, and without it these are uncallable from the SQL editor.
grant execute on function public.device_poll_command(text, text)
  to anon, service_role;
grant execute on function public.device_report_result(text, text, uuid, boolean, numeric, numeric, text)
  to anon, service_role;
grant execute on function public.device_report_consumption(text, text, uuid, numeric)
  to anon, service_role;
grant execute on function public.device_report_reading(text, text, numeric, numeric, boolean, int, text)
  to anon, service_role;
grant execute on function public.enqueue_feed_command(text, numeric, text, text, uuid)
  to anon, service_role;
grant execute on function public.device_health(text)
  to anon, service_role;

-- ---------------------------------------------------------------- realtime ---
-- Guarded rather than bare: `alter publication ... add table` errors if the
-- table is already a member, which would break a re-run of this migration.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'feeder_commands'
  ) then
    execute 'alter publication supabase_realtime add table public.feeder_commands';
  end if;
end;
$$;

-- PostgREST caches the schema; without this the new RPCs answer PGRST202
-- until the next connection recycle.
notify pgrst, 'reload schema';
