-- Make the database-owned health RPC distinguish a registered, offline feeder
-- from an unknown device id. The public API never reads devices directly;
-- this SECURITY DEFINER function only returns the non-sensitive boolean.
create or replace function public.device_health(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.device_status;
  v_active int;
  v_exists boolean;
begin
  perform public.expire_stale_commands();

  select exists (
    select 1 from public.devices where device_id = p_device_id
  ) into v_exists;

  if not v_exists then
    return jsonb_build_object(
      'device_id', p_device_id,
      'exists', false,
      'server_time', now(),
      'last_seen_at', null,
      'last_feed_at', null,
      'firmware_version', null,
      'wifi_rssi', null,
      'uv_status', false,
      'active_commands', 0
    );
  end if;

  select count(*) into v_active
    from public.feeder_commands c
   where c.device_id = p_device_id
     and c.status in ('pending', 'running');

  select * into s
    from public.device_status
   where device_id = p_device_id;

  return jsonb_build_object(
    'device_id', p_device_id,
    'exists', true,
    'server_time', now(),
    'uv_status', coalesce(s.uv_status, false),
    'last_seen_at', s.last_seen_at,
    'last_feed_at', s.last_feed_at,
    'firmware_version', s.firmware_version,
    'wifi_rssi', s.wifi_rssi,
    'active_commands', v_active
  );
end;
$$;

revoke all on function public.device_health(text) from public, anon, authenticated;
grant execute on function public.device_health(text) to anon, service_role;

notify pgrst, 'reload schema';