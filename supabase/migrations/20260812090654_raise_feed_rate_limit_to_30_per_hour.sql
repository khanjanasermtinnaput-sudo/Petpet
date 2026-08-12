-- Allow enough controlled Feed Now attempts for servo/load-cell calibration
-- while retaining a device-wide safety ceiling against unintended loops.
create or replace function public.enqueue_feed_command(
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

  if not exists (
    select 1
      from public.pets p
     where p.id = p_pet_id
       and p.device_id = p_device_id
  ) then
    raise exception 'unknown pet for this device' using errcode = '22023';
  end if;

  select * into v_cmd
    from public.feeder_commands
   where device_id = p_device_id
     and status in ('pending', 'running')
   order by created_at
   limit 1;
  if found then return v_cmd; end if;

  select count(*) into v_recent
    from public.feeder_commands
   where device_id = p_device_id
     and created_at > now() - interval '1 hour';
  if v_recent >= 30 then
    raise exception 'feed rate limit reached for this device' using errcode = '54000';
  end if;

  insert into public.feeder_commands
    (device_id, pet_id, command, meal_slot, target_g, source, retry_of)
  values
    (p_device_id, p_pet_id, 'feed', p_meal_slot, p_target_g,
     coalesce(p_source, 'app'), p_retry_of)
  returning * into v_cmd;
  return v_cmd;
exception when unique_violation then
  select * into v_cmd
    from public.feeder_commands
   where device_id = p_device_id
     and status in ('pending', 'running')
   order by created_at
   limit 1;
  return v_cmd;
end;
$$;

revoke all on function public.enqueue_feed_command(text, uuid, numeric, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_feed_command(text, uuid, numeric, text, text, uuid)
  to anon, service_role;

notify pgrst, 'reload schema';
