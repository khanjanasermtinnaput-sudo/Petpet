-- Keep onboarding inserts public, but require a signed-in Supabase user to
-- update the existing single-tenant pet profile from Settings.
drop policy if exists "pets_update_all" on pets;

create policy "pets_update_authenticated" on pets
  for update
  to authenticated
  using (true)
  with check (true);
