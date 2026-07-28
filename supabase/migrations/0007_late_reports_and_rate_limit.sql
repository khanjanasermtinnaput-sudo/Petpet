-- Two integration fixes found while tracing the full website -> device -> website
-- round trip. Neither changes the architecture; both close a gap where the
-- database and physical reality could disagree.

-- 1. Accept a late success report.
--
-- expire_stale_commands() fails a 'running' command after 120s. But the food
-- is dispensed *before* the report is sent, so a network outage that outlives
-- that window produced a command marked failed/timeout_execute even though the
-- meal physically happened — and device_report_result() then refused the report
-- as a duplicate, so no feed_events row was ever written. The meal vanished
-- from history and from the low-eating baseline.
--
-- A *successful* report on a command that failed only by timeout, and that has
-- no feed_event yet, is now recorded. Anything terminal for another reason
-- (already succeeded, failed with a device error) still short-circuits, so the
-- idempotency guarantee the firmware's retry loop depends on is unchanged.
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
       set status = 'failed',
           error = coalesce(p_error, 'device_error'),
           dispensed_g = p_dispensed_g,
           tray_after_g = p_tray_weight_g,
           updated_at = now(),
           finished_at = now()
     where id = v_cmd.id;

    return jsonb_build_object('ok', true, 'status', 'failed');
  end if;

  insert into public.feed_events (device_id, meal_slot, target_g, actual_eaten_g)
  values (p_device_id, v_cmd.meal_slot, v_cmd.target_g, 0)
  returning id into v_event_id;

  update public.feeder_commands
     set status = 'success',
         dispensed_g = coalesce(p_dispensed_g, v_cmd.target_g),
         tray_after_g = p_tray_weight_g,
         feed_event_id = v_event_id,
         -- Kept as a breadcrumb rather than cleared: this row was declared a
         -- timeout and then contradicted by the hardware, which is worth being
         -- able to find later.
         error = case when v_late then 'recovered_late_report' else null end,
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
                            'feed_event_id', v_event_id, 'late', v_late);
end;
$$;

-- 2. Rate limit enqueue.
--
-- enqueue_feed_command takes no secret by design (the web app runs on the
-- public anon key, so a secret there would just be published to the browser).
-- The partial unique index already stops a second *concurrent* command, but
-- nothing stopped a script from queueing one, waiting for it to finish, and
-- repeating — which for a pet feeder means overfeeding an animal.
--
-- Ten per device per hour leaves room for three scheduled meals plus retries
-- and manual top-ups, and turns unbounded abuse into a bounded nuisance. It is
-- not a substitute for authentication; see docs/HARDWARE.md.
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
  v_recent int;
begin
  perform public.expire_stale_commands();

  select * into v_cmd
    from public.feeder_commands
   where device_id = p_device_id and status in ('pending', 'running')
   order by created_at
   limit 1;

  if found then
    return v_cmd;
  end if;

  select count(*) into v_recent
    from public.feeder_commands
   where device_id = p_device_id
     and created_at > now() - interval '1 hour';

  if v_recent >= 10 then
    -- SQLSTATE 54000 (program_limit_exceeded) so the API layer can tell this
    -- apart from a malformed request or a database fault.
    raise exception 'feed rate limit reached for this device'
      using errcode = '54000';
  end if;

  insert into public.feeder_commands
    (device_id, command, meal_slot, target_g, source, retry_of)
  values
    (p_device_id, 'feed', p_meal_slot, p_target_g,
     coalesce(p_source, 'app'), p_retry_of)
  returning * into v_cmd;

  return v_cmd;

exception
  when unique_violation then
    select * into v_cmd
      from public.feeder_commands
     where device_id = p_device_id and status in ('pending', 'running')
     order by created_at
     limit 1;
    return v_cmd;
end;
$$;

revoke all on function public.device_report_result(text, text, uuid, boolean, numeric, numeric, text)
  from public, anon, authenticated;
grant execute on function public.device_report_result(text, text, uuid, boolean, numeric, numeric, text)
  to anon, service_role;

revoke all on function public.enqueue_feed_command(text, numeric, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_feed_command(text, numeric, text, text, uuid)
  to anon, service_role;

notify pgrst, 'reload schema';
