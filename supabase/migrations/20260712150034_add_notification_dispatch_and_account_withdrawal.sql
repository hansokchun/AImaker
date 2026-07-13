create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone_number text not null default '',
  kakao_alimtalk_enabled boolean not null default false,
  sms_fallback_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Users can view own notification preference" on public.notification_preferences;
create policy "Users can view own notification preference"
  on public.notification_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own notification preference" on public.notification_preferences;
create policy "Users can insert own notification preference"
  on public.notification_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own notification preference" on public.notification_preferences;
create policy "Users can update own notification preference"
  on public.notification_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in (
    'payment_completed',
    'workroom_created',
    'deliverable_submitted',
    'revision_requested',
    'settlement_available',
    'settlement_requested',
    'settlement_paid'
  )),
  title text not null,
  body text not null,
  channels text[] not null default array['in_app']::text[],
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  related_type text check (related_type is null or related_type in ('proposal', 'work', 'deliverable', 'settlement')),
  related_id text,
  provider text,
  failure_reason text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notification_events enable row level security;

create index if not exists notification_events_user_created_idx
  on public.notification_events (user_id, created_at desc);

drop policy if exists "Users can view own notification events" on public.notification_events;
create policy "Users can view own notification events"
  on public.notification_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own notification events" on public.notification_events;
drop policy if exists "Work participants can insert notification events" on public.notification_events;

create table if not exists public.operation_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  target_type text not null,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.operation_logs enable row level security;

create index if not exists operation_logs_created_idx
  on public.operation_logs (created_at desc);

create index if not exists notification_events_dispatch_idx
  on public.notification_events (status, created_at)
  where status = 'queued';

drop policy if exists "Admins can view operation logs" on public.operation_logs;
create policy "Admins can view operation logs"
  on public.operation_logs for select
  to authenticated
  using (exists (select 1 from public.admin_users where admin_users.user_id = (select auth.uid())));

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
