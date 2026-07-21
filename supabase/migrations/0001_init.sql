-- Petpet: smart pet feeder schema (1 device / 1 pet MVP, per-user device ownership)

create table if not exists devices (
  device_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  claimed_at timestamptz not null default now()
);

create table if not exists pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null references devices (device_id) on delete cascade,
  name text not null,
  species text not null,
  age_years int not null default 0,
  age_months int not null default 0,
  weight_kg numeric not null,
  daily_target_g int not null default 80,
  created_at timestamptz not null default now()
);

create table if not exists feeder_readings (
  id uuid primary key default gen_random_uuid(),
  device_id text not null references devices (device_id) on delete cascade,
  tray_weight_g numeric not null,
  tank_weight_g numeric not null,
  recorded_at timestamptz not null default now()
);

create table if not exists feed_events (
  id uuid primary key default gen_random_uuid(),
  device_id text not null references devices (device_id) on delete cascade,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner')),
  target_g numeric not null,
  actual_eaten_g numeric not null default 0,
  ts timestamptz not null default now()
);

create table if not exists device_status (
  device_id text primary key references devices (device_id) on delete cascade,
  uv_status boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists feeder_readings_device_recorded_idx
  on feeder_readings (device_id, recorded_at desc);

create index if not exists feed_events_device_ts_idx
  on feed_events (device_id, ts desc);

-- Ownership helper used by RLS on hardware-facing tables.
create or replace function owns_device(d text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from devices where device_id = d and user_id = auth.uid()
  );
$$;

alter table devices enable row level security;
alter table pets enable row level security;
alter table feeder_readings enable row level security;
alter table feed_events enable row level security;
alter table device_status enable row level security;

create policy "devices_select_own" on devices
  for select using (user_id = auth.uid());
create policy "devices_insert_own" on devices
  for insert with check (user_id = auth.uid());
create policy "devices_update_own" on devices
  for update using (user_id = auth.uid());

create policy "pets_select_own" on pets
  for select using (user_id = auth.uid());
create policy "pets_insert_own" on pets
  for insert with check (user_id = auth.uid());
create policy "pets_update_own" on pets
  for update using (user_id = auth.uid());
create policy "pets_delete_own" on pets
  for delete using (user_id = auth.uid());

-- Hardware writes (feeder_readings, device_status) go through the service-role
-- key and bypass RLS entirely; the app only ever reads these tables.
create policy "feeder_readings_select_owned" on feeder_readings
  for select using (owns_device(device_id));

-- feed_events also accepts inserts from the authenticated app user for the
-- manual-feed action; hardware-logged completions use the service-role key.
create policy "feed_events_select_owned" on feed_events
  for select using (owns_device(device_id));
create policy "feed_events_insert_owned" on feed_events
  for insert with check (owns_device(device_id));

create policy "device_status_select_owned" on device_status
  for select using (owns_device(device_id));

-- Realtime: tray/tank weight and UV status drive the live dashboard.
alter publication supabase_realtime add table feeder_readings;
alter publication supabase_realtime add table device_status;
