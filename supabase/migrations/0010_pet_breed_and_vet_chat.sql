-- Store the selected breed and persist each AI-vet conversation per pet/user.

alter table public.pets add column if not exists breed text not null default '';

create table if not exists public.vet_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);

create index if not exists vet_chat_messages_pet_created_idx
  on public.vet_chat_messages (pet_id, created_at asc);

alter table public.vet_chat_messages enable row level security;

drop policy if exists "vet_chat_messages_select_own" on public.vet_chat_messages;
create policy "vet_chat_messages_select_own"
  on public.vet_chat_messages for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "vet_chat_messages_insert_own" on public.vet_chat_messages;
create policy "vet_chat_messages_insert_own"
  on public.vet_chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()));

grant select, insert on public.vet_chat_messages to authenticated;

notify pgrst, 'reload schema';
