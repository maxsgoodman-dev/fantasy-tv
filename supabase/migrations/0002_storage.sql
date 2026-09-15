-- Public media bucket for show art, contestant photos, and user avatars.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Anyone can read (bucket is public; this policy is what actually allows it).
create policy "media_public_read" on storage.objects for select
  using (bucket_id = 'media');

-- Admins can write/update/delete under shows/ and contestants/.
create policy "media_admin_insert" on storage.objects for insert
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('shows', 'contestants')
    and fantasy_tv.is_admin()
  );

create policy "media_admin_update" on storage.objects for update
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('shows', 'contestants')
    and fantasy_tv.is_admin()
  );

create policy "media_admin_delete" on storage.objects for delete
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('shows', 'contestants')
    and fantasy_tv.is_admin()
  );

-- Any signed-in user can write/update their own avatar, under avatars/{their user id}/.
create policy "media_own_avatar_insert" on storage.objects for insert
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "media_own_avatar_update" on storage.objects for update
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
