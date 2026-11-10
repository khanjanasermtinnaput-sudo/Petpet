-- Badminton shuttle launcher: command queue + telemetry.
--
-- A separate project that merely shares this Supabase database and the Vercel
-- domain with PetPet. It has NOTHING to do with pet feeding and deliberately
-- shares no table or function with it: its own device registry, its own secret
-- check, its own tables. Dropping every launcher_* object removes it cleanly.
--
-- Flow: the web app enqueues a command, the machine polls Supabase directly
-- with a per-device secret, runs it, and reports back.
--
-- Safety model — the database is NOT the safety layer. A launcher throws
-- objects at speed, so the interlocks (physical arm switch, shuttle-present
-- sensor, motor over-temp, "stop if WiFi drops") live in firmware. What the
-- database adds: range checks, one live command per machine, a heartbeat
-- deadline so a silent machine is declared dead, and a stop flag the machine
-- sees on every progress report.

-- ---------------------------------------------------------- launcher_devices ---
-- Holds the per-machine secret. Deny-all: it can never live on a readable,
-- realtime-published table or the secret would be broadcast to every browser.
create table if not exists launcher_devices (
  device_id text primary key,
  label text not null default '',
  -- sha256 hex of a 256-bit random provisioning token (see
  -- scripts/provision-launcher.mjs). Not bcrypt: it is checked on every poll
  -- and the secret is never guessable. sha256()/convert_to() are pg_catalog
  -- builtins, so no pgcrypto and no search_path games.
  secret_hash text not null,
  created_at timestamptz not null default now()
);

alter table launcher_devices enable row level security;
-- No policies: RLS with zero policies denies everything. The revoke is
-- belt-and-braces against Supabase's default grants on new public tables.
revoke all on table launcher_devices from anon, authenticated;

create or replace function public.assert_launcher_device(p_device_id text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_device_id is null or p_secret is null
     or not exists (
       select 1 from public.launcher_devices
        where device_id = p_device_id
          and secret_hash = encode(sha256(convert_to(p_secret, 'utf8')), 'hex')
     )
  then
    -- SQLSTATE class 28 => PostgREST answers 403, distinguishable from a
    -- transport failure by HTTP status alone.
    raise exception 'unauthorized device' using errcode = '28000';
  end if;
end;
$$;

-- ------------------------------------------------------- launcher_commands ---
create table if not exists launcher_commands (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  command text not null default 'launch' check (command in ('launch')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'failed')),

  -- Drill parameters, fixed at enqueue time. Ranges mirror the validation in
  -- src/lib/launcher-commands.ts and must stay in sync with firmware limits.
  speed_pct int not null check (speed_pct between 10 and 100),
  pitch_deg numeric not null check (pitch_deg between -10 and 60),
  yaw_deg numeric not null check (yaw_deg between -45 and 45),
  -- Floor is the mechanical feed cycle, not a taste setting: faster than this
  -- and the next shuttle is loaded before the previous one has left.
  interval_ms int not null check (interval_ms between 800 and 10000),
  shuttle_count int not null check (shuttle_count between 1 and 100),

  launched_count int not null default 0 check (launched_count >= 0),
  -- Set by request_launcher_stop() while running; the machine reads it from
  -- the reply to device_report_launcher_progress().
  stop_requested boolean not null default false,
  -- Machine-readable: timeout_pickup / timeout_execute / aborted / not_armed /
  -- no_shuttles / jam / motor_fault / over_temp / device_error.
  error text,
  attempts int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  executed_at timestamptz,
  finished_at timestamptz
);

create index if not exists launcher_commands_pending_idx
  on launcher_commands (device_id, created_at)
  where status = 'pending';

create index if not exists launcher_commands_active_idx
  on launcher_commands (status, created_at)
  where status in ('pending', 'running');

create index if not exists launcher_commands_device_created_idx
  on launcher_commands (device_id, created_at desc);

-- One live command per machine, enforced structurally (double-tap, two tabs).
create unique index if not exists launcher_commands_one_active_idx
  on launcher_commands (device_id)
  where status in ('pending', 'running');

alter table launcher_commands enable row level security;

-- anon SELECT because Realtime evaluates postgres_changes under the
-- subscriber's role; without it the dashboard never receives updates. No
-- secret lives in this row (that is launcher_devices, which is deny-all).
drop policy if exists "launcher_commands_select_all" on launcher_commands;
create policy "launcher_commands_select_all" on launcher_commands for select using (true);

revoke all on table launcher_commands from anon, authenticated;
grant select on table launcher_commands to anon, authenticated;

-- ---------------------------------------------------------- launcher_status ---
-- Telemetry the launcher dashboard shows live.
create table if not exists launcher_status (
  device_id text primary key,
  state text not null default 'idle'
    check (state in ('idle', 'armed', 'launching', 'error')),
  shuttles_left int check (shuttles_left is null or shuttles_left >= 0),
  battery_pct int check (battery_pct is null or battery_pct between 0 and 100),
  motor_temp_c numeric,
  firmware_version text,
  wifi_rssi int,
  last_error text,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table launcher_status enable row level security;
drop policy if exists "launcher_status_select_all" on launcher_status;
create policy "launcher_status_select_all" on launcher_status for select using (true);

revoke all on table launcher_status from anon, authenticated;
grant select on table launcher_status to anon, authenticated;

-- --------------------------------------------------------------- functions ---

-- Lazy expiry (no pg_cron): runs whenever the machine polls or anyone checks
-- health, so a command times out the next time anyone looks.
-- A running launch is declared dead when the machine has been silent for 30s.
-- The machine reports progress after every shuttle and the slowest interval
-- is 10s, so 30s is three missed reports. Heartbeat-based rather than a fixed
-- run time because drill length varies from one shuttle to a hundred.
create or replace function public.expire_stale_launcher_commands()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.launcher_commands
     set status = 'failed',
         error = case when status = 'pending' then 'timeout_pickup'
                      else 'timeout_execute' end,
         updated_at = now(),
         finished_at = now()
   where (status = 'pending' and created_at < now() - interval '60 seconds')
      or (status = 'running' and updated_at < now() - interval '30 seconds');
$$;

create or replace function public.device_poll_launcher_command(
  p_device_id text,
  p_secret    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.launcher_commands;
begin
  perform public.assert_launcher_device(p_device_id, p_secret);
  perform public.expire_stale_launcher_commands();

  -- Coarse (10s) heartbeat so an idle 1 Hz poll does not broadcast a
  -- realtime update every second.
  insert into public.launcher_status (device_id, last_seen_at, updated_at)
  values (p_device_id, now(), now())
  on conflict (device_id) do update
     set last_seen_at = now(),
         updated_at   = now()
   where launcher_status.last_seen_at is null
      or launcher_status.last_seen_at < now() - interval '10 seconds';

  select * into v_cmd
    from public.launcher_commands
   where device_id = p_device_id and status = 'pending'
   order by created_at
   limit 1
   for update skip locked;

  if not found then
    return null;
  end if;

  update public.launcher_commands
     set status = 'running',
         executed_at = now(),
         updated_at = now(),
         attempts = attempts + 1
   where id = v_cmd.id;

  return jsonb_build_object(
    'id', v_cmd.id,
    'command', v_cmd.command,
    'speed_pct', v_cmd.speed_pct,
    'pitch_deg', v_cmd.pitch_deg,
    'yaw_deg', v_cmd.yaw_deg,
    'interval_ms', v_cmd.interval_ms,
    'shuttle_count', v_cmd.shuttle_count
  );
end;
$$;

-- Called after every shuttle. Doubles as the heartbeat that keeps the command
-- alive and as the channel the stop request comes back on.
create or replace function public.device_report_launcher_progress(
  p_device_id      text,
  p_secret         text,
  p_command_id     uuid,
  p_launched_count int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.launcher_commands;
begin
  perform public.assert_launcher_device(p_device_id, p_secret);

  select * into v_cmd
    from public.launcher_commands
   where id = p_command_id and device_id = p_device_id
   for update;

  if not found then
    raise exception 'unknown command for this device' using errcode = '22023';
  end if;

  -- Anything not running (expired while the machine was offline, or already
  -- finished) tells the machine to stop: it must never keep firing for a
  -- command the server has given up on.
  if v_cmd.status <> 'running' then
    return jsonb_build_object('ok', true, 'stop', true, 'status', v_cmd.status);
  end if;

  update public.launcher_commands
     set launched_count = least(greatest(p_launched_count, launched_count),
                                shuttle_count),
         updated_at = now()
   where id = v_cmd.id;

  update public.launcher_status
     set last_seen_at = now(), updated_at = now()
   where device_id = p_device_id;

  return jsonb_build_object('ok', true, 'stop', v_cmd.stop_requested,
                            'status', 'running');
end;
$$;

create or replace function public.device_report_launcher_result(
  p_device_id      text,
  p_secret         text,
  p_command_id     uuid,
  p_success        boolean,
  p_launched_count int  default null,
  p_error          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.launcher_commands;
begin
  perform public.assert_launcher_device(p_device_id, p_secret);

  select * into v_cmd
    from public.launcher_commands
   where id = p_command_id and device_id = p_device_id
   for update;

  if not found then
    raise exception 'unknown command for this device' using errcode = '22023';
  end if;

  -- Idempotent: a report retried after a dropped connection is a no-op.
  if v_cmd.status <> 'running' then
    return jsonb_build_object('ok', true, 'status', v_cmd.status, 'duplicate', true);
  end if;

  update public.launcher_commands
     set status = case when p_success and not stop_requested then 'success'
                       else 'failed' end,
         -- A requested stop is reported as 'aborted' even if the machine says
         -- it finished cleanly, so history shows the drill was cut short.
         error = case when p_success and not stop_requested then null
                      when stop_requested and (p_error is null) then 'aborted'
                      else coalesce(p_error, 'device_error') end,
         launched_count = least(coalesce(p_launched_count, launched_count),
                                shuttle_count),
         updated_at = now(),
         finished_at = now()
   where id = v_cmd.id;

  update public.launcher_status
     set last_seen_at = now(), updated_at = now()
   where device_id = p_device_id;

  return jsonb_build_object('ok', true,
    'status', case when p_success and not v_cmd.stop_requested
                   then 'success' else 'failed' end);
end;
$$;

create or replace function public.device_report_launcher_state(
  p_device_id        text,
  p_secret           text,
  p_state            text,
  p_shuttles_left    int     default null,
  p_battery_pct      int     default null,
  p_motor_temp_c     numeric default null,
  p_wifi_rssi        int     default null,
  p_firmware_version text    default null,
  p_last_error       text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_launcher_device(p_device_id, p_secret);

  insert into public.launcher_status
    (device_id, state, shuttles_left, battery_pct, motor_temp_c, wifi_rssi,
     firmware_version, last_error, last_seen_at, updated_at)
  values
    (p_device_id, p_state, p_shuttles_left, p_battery_pct, p_motor_temp_c,
     p_wifi_rssi, p_firmware_version, p_last_error, now(), now())
  on conflict (device_id) do update
     set state            = excluded.state,
         shuttles_left    = coalesce(excluded.shuttles_left, launcher_status.shuttles_left),
         battery_pct      = coalesce(excluded.battery_pct, launcher_status.battery_pct),
         motor_temp_c     = coalesce(excluded.motor_temp_c, launcher_status.motor_temp_c),
         wifi_rssi        = coalesce(excluded.wifi_rssi, launcher_status.wifi_rssi),
         firmware_version = coalesce(excluded.firmware_version, launcher_status.firmware_version),
         -- Clearing is deliberate: a state report with no error means the
         -- machine recovered, so the old error must not linger.
         last_error       = excluded.last_error,
         last_seen_at     = now(),
         updated_at       = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- Called by /api/launcher/command. Takes no secret (the web app runs on the
-- public anon key): anyone who can guess a device_id can queue a launch. For a
-- machine that throws objects this is worth closing before it is ever pointed
-- at a person — see docs/LAUNCHER.md, "Security".
create or replace function public.enqueue_launcher_command(
  p_device_id     text,
  p_speed_pct     int,
  p_pitch_deg     numeric,
  p_yaw_deg       numeric,
  p_interval_ms   int,
  p_shuttle_count int
)
returns public.launcher_commands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.launcher_commands;
begin
  if not exists (select 1 from public.launcher_devices where device_id = p_device_id) then
    raise exception 'unknown device' using errcode = '22023';
  end if;

  perform public.expire_stale_launcher_commands();

  select * into v_cmd
    from public.launcher_commands
   where device_id = p_device_id and status in ('pending', 'running')
   order by created_at
   limit 1;

  if found then
    return v_cmd;
  end if;

  insert into public.launcher_commands
    (device_id, speed_pct, pitch_deg, yaw_deg, interval_ms, shuttle_count)
  values
    (p_device_id, p_speed_pct, p_pitch_deg, p_yaw_deg, p_interval_ms, p_shuttle_count)
  returning * into v_cmd;

  return v_cmd;

exception
  when unique_violation then
    select * into v_cmd
      from public.launcher_commands
     where device_id = p_device_id and status in ('pending', 'running')
     order by created_at
     limit 1;
    return v_cmd;
end;
$$;

-- Stop is the one operation that is safe to leave unauthenticated: it can only
-- make the machine do less. A pending command is cancelled outright; a running
-- one gets stop_requested, which the machine sees on its next progress report.
create or replace function public.request_launcher_stop(p_device_id text)
returns public.launcher_commands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.launcher_commands;
begin
  perform public.expire_stale_launcher_commands();

  update public.launcher_commands
     set status = 'failed', error = 'aborted',
         stop_requested = true, updated_at = now(), finished_at = now()
   where device_id = p_device_id and status = 'pending'
   returning * into v_cmd;
  if found then
    return v_cmd;
  end if;

  update public.launcher_commands
     set stop_requested = true, updated_at = now()
   where device_id = p_device_id and status = 'running'
   returning * into v_cmd;

  -- null when there was nothing to stop.
  return v_cmd;
end;
$$;

create or replace function public.launcher_health(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.launcher_status;
  v_exists boolean;
  v_active int;
begin
  perform public.expire_stale_launcher_commands();

  select exists (select 1 from public.launcher_devices where device_id = p_device_id)
    into v_exists;

  if not v_exists then
    return jsonb_build_object('device_id', p_device_id, 'exists', false,
      'server_time', now(), 'last_seen_at', null, 'state', null,
      'shuttles_left', null, 'battery_pct', null, 'motor_temp_c', null,
      'firmware_version', null, 'wifi_rssi', null, 'last_error', null,
      'active_commands', 0);
  end if;

  select count(*) into v_active
    from public.launcher_commands c
   where c.device_id = p_device_id and c.status in ('pending', 'running');

  select * into s from public.launcher_status where device_id = p_device_id;

  return jsonb_build_object(
    'device_id', p_device_id,
    'exists', true,
    'server_time', now(),
    'last_seen_at', s.last_seen_at,
    'state', s.state,
    'shuttles_left', s.shuttles_left,
    'battery_pct', s.battery_pct,
    'motor_temp_c', s.motor_temp_c,
    'firmware_version', s.firmware_version,
    'wifi_rssi', s.wifi_rssi,
    'last_error', s.last_error,
    'active_commands', v_active
  );
end;
$$;

-- ------------------------------------------------------------------ grants ---
revoke all on function public.assert_launcher_device(text, text) from public, anon, authenticated;
revoke all on function public.expire_stale_launcher_commands() from public, anon, authenticated;
revoke all on function public.device_poll_launcher_command(text, text) from public, anon, authenticated;
revoke all on function public.device_report_launcher_progress(text, text, uuid, int) from public, anon, authenticated;
revoke all on function public.device_report_launcher_result(text, text, uuid, boolean, int, text) from public, anon, authenticated;
revoke all on function public.device_report_launcher_state(text, text, text, int, int, numeric, int, text, text) from public, anon, authenticated;
revoke all on function public.enqueue_launcher_command(text, int, numeric, numeric, int, int) from public, anon, authenticated;
revoke all on function public.request_launcher_stop(text) from public, anon, authenticated;
revoke all on function public.launcher_health(text) from public, anon, authenticated;

grant execute on function public.device_poll_launcher_command(text, text) to anon, service_role;
grant execute on function public.device_report_launcher_progress(text, text, uuid, int) to anon, service_role;
grant execute on function public.device_report_launcher_result(text, text, uuid, boolean, int, text) to anon, service_role;
grant execute on function public.device_report_launcher_state(text, text, text, int, int, numeric, int, text, text) to anon, service_role;
grant execute on function public.enqueue_launcher_command(text, int, numeric, numeric, int, int) to anon, service_role;
grant execute on function public.request_launcher_stop(text) to anon, service_role;
grant execute on function public.launcher_health(text) to anon, service_role;

-- ---------------------------------------------------------------- realtime ---
do $$
declare
  t text;
begin
  foreach t in array array['launcher_commands', 'launcher_status'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
