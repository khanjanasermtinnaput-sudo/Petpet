-- Add explicit UV relay commands to the existing feeder command queue.

alter table public.feeder_commands
  drop constraint if exists feeder_commands_command_check;

alter table public.feeder_commands
  add constraint feeder_commands_command_check
  check (command in ('feed', 'uv_on', 'uv_off'));

create or replace function public.device_poll_command(
  p_device_id text,
  p_secret text,
  p_uv_status boolean default null
)
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

  insert into public.device_status (device_id, uv_status, last_seen_at, updated_at)
  values (p_device_id, coalesce(p_uv_status, false), now(), now())
  on conflict (device_id) do update
     set uv_status = coalesce(p_uv_status, device_status.uv_status),
         last_seen_at = now(),
         updated_at = now()
   where device_status.last_seen_at is null
      or device_status.last_seen_at < now() - interval '10 seconds'
      or p_uv_status is not null and device_status.uv_status is distinct from p_uv_status;

  select * into v_cmd
    from public.feeder_commands
   where device_id = p_device_id and status = 'pending'
   order by created_at
   limit 1
   for update skip locked;

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

create or replace function public.enqueue_uv_command(
  p_device_id text,
  p_uv_on boolean
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

  select * into v_cmd
    from public.feeder_commands
   where device_id = p_device_id and status in ('pending', 'running')
   order by created_at
   limit 1;

  if found then
    raise exception 'device has an active command' using errcode = '55000';
  end if;

  insert into public.feeder_commands
    (device_id, command, meal_slot, target_g, source)
  values
    (p_device_id, case when p_uv_on then 'uv_on' else 'uv_off' end,
     'breakfast', 0, 'app')
  returning * into v_cmd;

  return v_cmd;
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

  select * into v_cmd
    from public.feeder_commands
   where id = p_command_id and device_id = p_device_id
   for update;

  if not found then
    raise exception 'unknown command for this device' using errcode = '22023';
  end if;

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

  if v_cmd.command in ('uv_on', 'uv_off') then
    update public.feeder_commands
       set status = 'success',
           error = null,
           updated_at = now(),
           finished_at = now()
     where id = v_cmd.id;

    insert into public.device_status (device_id, uv_status, last_seen_at, updated_at)
    values (p_device_id, v_cmd.command = 'uv_on', now(), now())
    on conflict (device_id) do update
       set uv_status = excluded.uv_status,
           last_seen_at = now(),
           updated_at = now();

    return jsonb_build_object('ok', true, 'status', 'success', 'uv_status', v_cmd.command = 'uv_on');
  end if;

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
         updated_at = now();

  return jsonb_build_object('ok', true, 'status', 'success', 'feed_event_id', v_event_id);
end;
$$;

revoke all on function public.enqueue_uv_command(text, boolean) from public, anon, authenticated;
grant execute on function public.enqueue_uv_command(text, boolean) to anon, service_role;

revoke all on function public.device_poll_command(text, text, boolean) from public, anon, authenticated;
grant execute on function public.device_poll_command(text, text, boolean) to anon, service_role;

revoke all on function public.device_report_result(text, text, uuid, boolean, numeric, numeric, text)
  from public, anon, authenticated;
grant execute on function public.device_report_result(text, text, uuid, boolean, numeric, numeric, text)
  to anon, service_role;

notify pgrst, 'reload schema';
