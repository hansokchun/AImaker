drop policy if exists "Users can upload own profile images" on storage.objects;

create policy "Users can upload own profile images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and account_status = 'active'
        and withdrawn_at is null
    )
  );
