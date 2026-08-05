-- Pet profiles replace account login. One physical feeder can serve several
-- profiles; every schedule and completed feed is attributed to the selected pet.

alter table pets enable row level security;
drop policy if exists "pets_update_authenticated" on pets;
drop policy if exists "pets_update_all" on pets;
create policy "pets_update_all" on pets for update using (true) with check (true);

alter table feeding_schedule add column if not exists pet_id uuid;
alter table feeder_commands add column if not exists pet_id uuid;
alter table feed_events add column if not exists pet_id uuid;

-- The previous product had one pet per device. Preserve all legacy records by
-- assigning them to that device's first profile before making attribution required.
update feeding_schedule s
   set pet_id = p.id
  from lateral (
    select id from pets where device_id = s.device_id order by created_at limit 1
  ) p
 where s.pet_id is null;

update feeder_commands c
   set pet_id = p.id
  from lateral (
    select id from pets where device_id = c.device_id order by created_at limit 1
  ) p
 where c.pet_id is null;

update feed_events e
   set pet_id = p.id
  from lateral (
    select id from pets where device_id = e.device_id order by created_at limit 1
  ) p
 where e.pet_id is null;

alter table feeding_schedule alter column pet_id set not null;
alter table feeder_commands alter column pet_id set not null;
alter table feed_events alter column pet_id set not null;

alter table feeding_schedule drop constraint if exists feeding_schedule_device_id_meal_slot_key;
alter table feeding_schedule add constraint feeding_schedule_pet_id_meal_slot_key unique (pet_id, meal_slot);
create index if not exists feed_events_pet_ts_idx on feed_events (pet_id, ts desc);
create index if not exists feeder_commands_pet_created_idx on feeder_commands (pet_id, created_at desc);

-- Existing firmware calls device_report_result with the same signature. It
-- carries the pet id stored on the queued command into the immutable feed event.
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
  v_late boolean := false;
begin
  perform public.assert_device(p_device_id, p_secret);

  select * into v_cmd
    from public.feeder_commands
   where id = p_command_id and device_id = p_device_id
   for update;
  if not found then
    raise exception 'unknown command for this device' using errcode = '22023';
  end if;

  v_late := v_cmd.status = 'failed'
        and v_cmd.error like 'timeout%'
        and p_success
        and v_cmd.feed_event_id is null;
  if v_cmd.status <> 'running' and not v_late then
    return jsonb_build_object('ok', true, 'status', v_cmd.status,
                              'feed_event_id', v_cmd.feed_event_id,
                              'duplicate', true);
  end if;

  if not p_success then
    update public.feeder_commands
       set status = 'failed', error = coalesce(p_error, 'device_error'),
           dispensed_g = p_dispensed_g, tray_after_g = p_tray_weight_g,
           updated_at = now(), finished_at = now()
     where id = v_cmd.id;
    return jsonb_build_object('ok', true, 'status', 'failed');
  end if;

  insert into public.feed_events (device_id, pet_id, meal_slot, target_g, actual_eaten_g)
  values (p_device_id, v_cmd.pet_id, v_cmd.meal_slot, v_cmd.target_g, 0)
  returning id into v_event_id;

  update public.feeder_commands
     set status = 'success', dispensed_g = coalesce(p_dispensed_g, v_cmd.target_g),
         tray_after_g = p_tray_weight_g, feed_event_id = v_event_id,
         error = case when v_late then 'recovered_late_report' else null end,
         updated_at = now(), finished_at = now()
   where id = v_cmd.id;

  insert into public.device_status (device_id, last_feed_at, last_seen_at, updated_at)
  values (p_device_id, now(), now(), now())
  on conflict (device_id) do update
     set last_feed_at = now(), last_seen_at = now(), updated_at = now();

  return jsonb_build_object('ok', true, 'status', 'success',
                            'feed_event_id', v_event_id, 'late', v_late);
end;
$$;

drop function if exists public.enqueue_feed_command(text, numeric, text, text, uuid);
create function public.enqueue_feed_command(
  p_device_id text,
  p_pet_id uuid,
  p_target_g numeric,
  p_meal_slot text,
  p_source text default 'app',
  p_retry_of uuid default null
)
returns public.feeder_commands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cmd public.feeder_commands;
  v_recent int;
begin
  perform public.expire_stale_commands();

  select * into v_cmd from public.feeder_commands
   where device_id = p_device_id and status in ('pending', 'running')
   order by created_at limit 1;
  if found then return v_cmd; end if;

  select count(*) into v_recent from public.feeder_commands
   where device_id = p_device_id and created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'feed rate limit reached for this device' using errcode = '54000';
  end if;

  insert into public.feeder_commands
    (device_id, pet_id, command, meal_slot, target_g, source, retry_of)
  values
    (p_device_id, p_pet_id, 'feed', p_meal_slot, p_target_g, coalesce(p_source, 'app'), p_retry_of)
  returning * into v_cmd;
  return v_cmd;
exception when unique_violation then
  select * into v_cmd from public.feeder_commands
   where device_id = p_device_id and status in ('pending', 'running')
   order by created_at limit 1;
  return v_cmd;
end;
$$;

revoke all on function public.enqueue_feed_command(text, uuid, numeric, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_feed_command(text, uuid, numeric, text, text, uuid)
  to anon, service_role;

notify pgrst, 'reload schema';