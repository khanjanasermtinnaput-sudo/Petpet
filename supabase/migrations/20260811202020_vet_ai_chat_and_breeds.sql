-- Add optional breed data and persistent, authenticated VET AI conversations.
-- Pet profiles remain browser-selected; VET AI ownership is an anonymous
-- Supabase Auth session scoped to that browser.

alter table public.pets add column if not exists breed text;

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  client_message_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists chat_conversations_user_updated_idx
  on public.chat_conversations (user_id, updated_at desc);
create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at asc);
create unique index if not exists chat_messages_conversation_client_message_idx
  on public.chat_messages (conversation_id, client_message_id)
  where client_message_id is not null;

create or replace function public.touch_chat_conversation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.chat_conversations
     set updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_conversation on public.chat_messages;
create trigger chat_messages_touch_conversation
after insert on public.chat_messages
for each row execute function public.touch_chat_conversation_updated_at();

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat_conversations_select_own" on public.chat_conversations;
create policy "chat_conversations_select_own" on public.chat_conversations
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "chat_conversations_insert_own" on public.chat_conversations;
create policy "chat_conversations_insert_own" on public.chat_conversations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "chat_conversations_update_own" on public.chat_conversations;
create policy "chat_conversations_update_own" on public.chat_conversations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "chat_conversations_delete_own" on public.chat_conversations;
create policy "chat_conversations_delete_own" on public.chat_conversations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "chat_messages_select_owned_conversation" on public.chat_messages;
create policy "chat_messages_select_owned_conversation" on public.chat_messages
  for select to authenticated
  using (exists (
    select 1 from public.chat_conversations c
     where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

drop policy if exists "chat_messages_insert_owned_conversation" on public.chat_messages;
create policy "chat_messages_insert_owned_conversation" on public.chat_messages
  for insert to authenticated
  with check (exists (
    select 1 from public.chat_conversations c
     where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

drop policy if exists "chat_messages_update_owned_conversation" on public.chat_messages;
create policy "chat_messages_update_owned_conversation" on public.chat_messages
  for update to authenticated
  using (exists (
    select 1 from public.chat_conversations c
     where c.id = conversation_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.chat_conversations c
     where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

drop policy if exists "chat_messages_delete_owned_conversation" on public.chat_messages;
create policy "chat_messages_delete_owned_conversation" on public.chat_messages
  for delete to authenticated
  using (exists (
    select 1 from public.chat_conversations c
     where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.chat_conversations to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;

notify pgrst, 'reload schema';
