-- Fix: device_health() reported active_commands = 0 for any feeder with no
-- device_status row yet.
--
-- 0005 built the whole payload with a single `select jsonb_build_object(...)
-- into v ... from device_status where device_id = $1`, then fell back to a
-- literal object when that found nothing. But device_status only gains a row
-- once the device first polls, so for a feeder that has never checked in the
-- fallback fired — and it hardcoded active_commands to 0 even with commands
-- sitting in the queue. The count had nothing to do with device_status in the
-- first place.
--
-- Now the command count is computed on its own, and the device_status columns
-- are read into a record whose fields are simply NULL when the row is absent.
-- No fallback branch to keep in sync.
create or replace function public.device_health(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.device_status;
  v_active int;
begin
  perform public.expire_stale_commands();

  select count(*) into v_active
    from public.feeder_commands c
   where c.device_id = p_device_id
     and c.status in ('pending', 'running');

  -- Not found leaves every field of s NULL, which is exactly what the payload
  -- should report for a feeder that has never connected.
  select * into s
    from public.device_status
   where device_id = p_device_id;

  return jsonb_build_object(
    'device_id',        p_device_id,
    'server_time',      now(),
    'uv_status',        coalesce(s.uv_status, false),
    'last_seen_at',     s.last_seen_at,
    'last_feed_at',     s.last_feed_at,
    'firmware_version', s.firmware_version,
    'wifi_rssi',        s.wifi_rssi,
    'active_commands',  v_active
  );
end;
$$;

-- create or replace preserves grants, but be explicit rather than rely on it.
revoke all on function public.device_health(text) from public, anon, authenticated;
grant execute on function public.device_health(text) to anon, service_role;

notify pgrst, 'reload schema';
