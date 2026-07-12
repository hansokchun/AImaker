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
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification preference" on public.notification_preferences;
create policy "Users can insert own notification preference"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification preference" on public.notification_preferences;
create policy "Users can update own notification preference"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

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
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification events" on public.notification_events;
create policy "Users can insert own notification events"
  on public.notification_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Work participants can insert notification events" on public.notification_events;
create policy "Work participants can insert notification events"
  on public.notification_events for insert
  with check (
    auth.role() = 'authenticated'
    and related_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (
      (
        related_type in ('work', 'settlement')
        and exists (
          select 1 from public.works
          where works.id = related_id::uuid
          and auth.uid() in (works.client_id, works.expert_id)
          and user_id in (works.client_id, works.expert_id)
        )
      )
      or (
        related_type = 'deliverable'
        and exists (
          select 1 from public.deliverables
          join public.works on works.id = deliverables.work_id
          where deliverables.id = related_id::uuid
          and auth.uid() in (works.client_id, works.expert_id)
          and user_id in (works.client_id, works.expert_id)
        )
      )
    )
  );
