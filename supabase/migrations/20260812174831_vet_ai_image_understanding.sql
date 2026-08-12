-- Private, browser-session-owned image references for VET AI chat messages.
-- Images are compressed to <= 1 MiB in the browser and validated again by
-- the chat route before being uploaded through the authenticated Storage API.

alter table public.chat_messages
  add column if not exists image_path text,
  add column if not exists image_mime_type text;

alter table public.chat_messages
  drop constraint if exists chat_messages_image_reference_check;
alter table public.chat_messages
  add constraint chat_messages_image_reference_check check (
    (image_path is null and image_mime_type is null)
    or (
      role = 'user'
      and image_path is not null
      and image_mime_type in ('image/jpeg', 'image/png', 'image/webp')
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vet-chat-images',
  'vet-chat-images',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vet_chat_images_insert_own" on storage.objects;
create policy "vet_chat_images_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vet-chat-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.chat_conversations c
    where c.id::text = (storage.foldername(name))[2]
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists "vet_chat_images_select_own" on storage.objects;
create policy "vet_chat_images_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'vet-chat-images'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.chat_conversations c
    where c.id::text = (storage.foldername(name))[2]
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists "vet_chat_images_delete_own" on storage.objects;
create policy "vet_chat_images_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'vet-chat-images'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1
    from public.chat_conversations c
    where c.id::text = (storage.foldername(name))[2]
      and c.user_id = (select auth.uid())
  )
);

notify pgrst, 'reload schema';
