-- Simplify to a true single-tenant app: no Supabase Auth, no per-user device
-- claiming. Exactly one pet/device exists in the whole system.

-- Drop old auth-scoped policies before dropping their dependencies.
drop policy if exists "devices_select_own" on devices;
drop policy if exists "devices_insert_own" on devices;
drop policy if exists "devices_update_own" on devices;
drop policy if exists "pets_select_own" on pets;
drop policy if exists "pets_insert_own" on pets;
drop policy if exists "pets_update_own" on pets;
drop policy if exists "pets_delete_own" on pets;
drop policy if exists "feeder_readings_select_owned" on feeder_readings;
drop policy if exists "feed_events_select_owned" on feed_events;
drop policy if exists "feed_events_insert_owned" on feed_events;
drop policy if exists "device_status_select_owned" on device_status;

-- Drop FKs to devices before dropping the table.
alter table pets drop constraint if exists pets_device_id_fkey;
alter table feeder_readings drop constraint if exists feeder_readings_device_id_fkey;
alter table feed_events drop constraint if exists feed_events_device_id_fkey;
alter table device_status drop constraint if exists device_status_device_id_fkey;

drop function if exists owns_device(text);
drop table if exists devices;

-- No more per-user ownership: drop user_id, give species a default since
-- onboarding no longer collects it.
alter table pets drop column if exists user_id;
alter table pets alter column species set default 'ไม่ระบุ';

-- Open, single-tenant RLS: anyone with the anon key can read/write. This is
-- an accepted tradeoff for a personal single-device app with no user
-- accounts — see project notes.
create policy "pets_select_all" on pets for select using (true);
create policy "pets_insert_all" on pets for insert with check (true);
create policy "pets_update_all" on pets for update using (true);

create policy "feeder_readings_select_all" on feeder_readings for select using (true);

create policy "feed_events_select_all" on feed_events for select using (true);
create policy "feed_events_insert_all" on feed_events for insert with check (true);

create policy "device_status_select_all" on device_status for select using (true);
