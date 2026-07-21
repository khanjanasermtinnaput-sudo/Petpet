create table if not exists feeding_schedule (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner')),
  time_of_day time not null,
  target_g numeric not null,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  updated_at timestamptz not null default now(),
  unique (device_id, meal_slot)
);

alter table feeding_schedule enable row level security;

create policy "feeding_schedule_select_all" on feeding_schedule for select using (true);
create policy "feeding_schedule_insert_all" on feeding_schedule for insert with check (true);
create policy "feeding_schedule_update_all" on feeding_schedule for update using (true);
