drop policy if exists "Users can insert own notification events" on public.notification_events;
drop policy if exists "Work participants can insert notification events" on public.notification_events;

drop policy if exists "Authenticated users can upload product samples" on storage.objects;
drop policy if exists "Users can upload own product samples" on storage.objects;
create policy "Users can upload own product samples"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-samples'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Authenticated users can replace product samples" on storage.objects;
drop policy if exists "Users can replace own product samples" on storage.objects;
create policy "Users can replace own product samples"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-samples'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'product-samples'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Authenticated users can select product samples for upsert" on storage.objects;
drop policy if exists "Users can select own product samples for upsert" on storage.objects;
create policy "Users can select own product samples for upsert"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'product-samples'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
