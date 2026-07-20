-- ilpick Supabase schema
-- Based on SupabasePlan.md. This file is intended for Supabase SQL editor execution.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where admin_users.user_id = $1);
$$;

-- 1. profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  name text,
  avatar_url text,
  is_expert boolean not null default false,
  expert_intro text,
  ai_tools text[] not null default '{}',
  sample_links text[] not null default '{}',
  interests text[] not null default '{}',
  request_purposes text[] not null default '{}',
  account_status text not null default 'active' check (account_status in ('active', 'restricted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists interests text[] not null default '{}',
  add column if not exists request_purposes text[] not null default '{}',
  add column if not exists account_status text not null default 'active';

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can delete own profile" on public.profiles;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Compatibility table for the current frontend storage helpers.
create table if not exists public.expert_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  image_url text,
  profession text,
  name text,
  one_liner text,
  greeting text,
  activities jsonb not null default '[]'::jsonb,
  awards jsonb not null default '[]'::jsonb,
  sample_links jsonb not null default '[]'::jsonb,
  ai_tools jsonb not null default '[]'::jsonb,
  edit_tools jsonb not null default '[]'::jsonb,
  packages jsonb not null default '{}'::jsonb,
  contact_available_time text,
  average_response_time text,
  updated_at timestamptz not null default now()
);

alter table public.expert_profiles
  add column if not exists sample_links jsonb not null default '[]'::jsonb,
  add column if not exists contact_available_time text,
  add column if not exists average_response_time text;

alter table public.expert_profiles enable row level security;

drop policy if exists "Users can view expert profiles" on public.expert_profiles;
create policy "Users can view expert profiles"
  on public.expert_profiles for select
  using (true);

drop policy if exists "Users can insert own expert profile" on public.expert_profiles;
create policy "Users can insert own expert profile"
  on public.expert_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own expert profile" on public.expert_profiles;
create policy "Users can update own expert profile"
  on public.expert_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.expert_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid not null unique references public.profiles(id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  account_holder text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expert_payout_accounts enable row level security;

drop policy if exists "Experts can view own payout account" on public.expert_payout_accounts;
create policy "Experts can view own payout account"
  on public.expert_payout_accounts for select
  using (auth.uid() = expert_id);

drop policy if exists "Experts can upsert own payout account" on public.expert_payout_accounts;
create policy "Experts can upsert own payout account"
  on public.expert_payout_accounts for insert
  with check (auth.uid() = expert_id);

drop policy if exists "Experts can update own payout account" on public.expert_payout_accounts;
create policy "Experts can update own payout account"
  on public.expert_payout_accounts for update
  using (auth.uid() = expert_id)
  with check (auth.uid() = expert_id);

drop trigger if exists set_expert_payout_accounts_updated_at on public.expert_payout_accounts;
create trigger set_expert_payout_accounts_updated_at
  before update on public.expert_payout_accounts
  for each row execute function public.set_updated_at();

-- 2. expert_products
create table if not exists public.expert_products (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  category text not null check (category in ('ai-video-shortform', 'ai-image-character', 'ai-development-automation')),
  summary text not null,
  description text not null,
  ai_tools text[] not null default '{}',
  sample_links text[] not null default '{}',
  sample_file_urls text[] not null default '{}',
  starting_price integer not null check (starting_price >= 0),
  currency text not null default 'KRW',
  delivery_days integer not null check (delivery_days > 0),
  revision_count integer not null default 0 check (revision_count >= 0),
  packages jsonb not null,
  tax_invoice_available boolean not null default false,
  is_featured boolean not null default false,
  display_order integer not null default 0,
  status text not null default 'published' check (status in ('draft', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expert_products
  add column if not exists tax_invoice_available boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists display_order integer not null default 0;

alter table public.expert_products enable row level security;

drop policy if exists "Anyone can view published products" on public.expert_products;
create policy "Anyone can view published products"
  on public.expert_products for select
  using (status = 'published' or auth.uid() = expert_id);

drop policy if exists "Experts can insert own products" on public.expert_products;
create policy "Experts can insert own products"
  on public.expert_products for insert
  with check (
    auth.uid() = expert_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.account_status = 'active'
    )
  );

drop policy if exists "Experts can update own products" on public.expert_products;
create policy "Experts can update own products"
  on public.expert_products for update
  using (auth.uid() = expert_id)
  with check (
    auth.uid() = expert_id
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.account_status = 'active'
    )
  );

drop trigger if exists set_expert_products_updated_at on public.expert_products;
create trigger set_expert_products_updated_at
  before update on public.expert_products
  for each row execute function public.set_updated_at();

-- 3. consultations
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete cascade,
  expert_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.expert_products(id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open', 'proposal_sent', 'closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consultations enable row level security;

drop policy if exists "Consultation participants can view consultations" on public.consultations;
create policy "Consultation participants can view consultations"
  on public.consultations for select
  using (auth.uid() = client_id or auth.uid() = expert_id);

drop policy if exists "Clients can insert own consultations" on public.consultations;
create policy "Clients can insert own consultations"
  on public.consultations for insert
  with check (auth.uid() = client_id);

drop policy if exists "Consultation participants can update consultations" on public.consultations;
create policy "Consultation participants can update consultations"
  on public.consultations for update
  using (auth.uid() = client_id or auth.uid() = expert_id)
  with check (auth.uid() = client_id or auth.uid() = expert_id);

drop trigger if exists set_consultations_updated_at on public.consultations;
create trigger set_consultations_updated_at
  before update on public.consultations
  for each row execute function public.set_updated_at();

create table if not exists public.consultation_messages (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid references public.consultations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  attachment_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.consultation_messages enable row level security;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'consultation_messages'
    ) then
    alter publication supabase_realtime add table public.consultation_messages;
  end if;
end $$;

drop policy if exists "Consultation participants can view messages" on public.consultation_messages;
create policy "Consultation participants can view messages"
  on public.consultation_messages for select
  using (
    exists (
      select 1 from public.consultations
      where consultations.id = consultation_messages.consultation_id
      and (consultations.client_id = auth.uid() or consultations.expert_id = auth.uid())
    )
  );

drop policy if exists "Consultation participants can insert messages" on public.consultation_messages;
create policy "Consultation participants can insert messages"
  on public.consultation_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.consultations
      where consultations.id = consultation_messages.consultation_id
      and (consultations.client_id = auth.uid() or consultations.expert_id = auth.uid())
    )
  );

-- 4. service_requests
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete cascade,
  expert_id uuid references public.profiles(id) on delete set null,
  product_id uuid references public.expert_products(id) on delete set null,
  selected_package text,
  desired_result text,
  purpose text,
  reference_text text,
  reference_links text[] not null default '{}',
  deadline date,
  progress_type text not null default 'single' check (progress_type in ('single', 'milestone')),
  checklist jsonb not null default '{}'::jsonb,
  additional_request text,
  title text,
  description text,
  budget integer,
  categories text[] not null default '{}',
  orderer_email text,
  status text not null default 'submitted' check (status in ('submitted', 'proposal_sent', 'cancelled', 'pending', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_requests enable row level security;

drop policy if exists "Request participants can view requests" on public.service_requests;
create policy "Request participants can view requests"
  on public.service_requests for select
  using (auth.uid() = client_id or auth.uid() = expert_id);

drop policy if exists "Authenticated users can view submitted requests" on public.service_requests;

drop policy if exists "Clients can insert own requests" on public.service_requests;
create policy "Clients can insert own requests"
  on public.service_requests for insert
  with check (auth.uid() = client_id);

drop policy if exists "Clients can update own cancellable requests" on public.service_requests;
drop policy if exists "Clients can update own request status" on public.service_requests;
create policy "Clients can update own request status"
  on public.service_requests for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

drop trigger if exists set_service_requests_updated_at on public.service_requests;
create trigger set_service_requests_updated_at
  before update on public.service_requests
  for each row execute function public.set_updated_at();

-- 5. proposals
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.service_requests(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete cascade,
  expert_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  scope text not null,
  deliverables text[] not null default '{}',
  total_price integer not null check (total_price >= 0),
  currency text not null default 'KRW',
  delivery_days integer not null check (delivery_days > 0),
  revision_count integer not null default 0 check (revision_count >= 0),
  progress_type text not null default 'single' check (progress_type in ('single', 'milestone')),
  milestones jsonb not null default '[]'::jsonb,
  commercial_use_allowed boolean not null default false,
  source_file_included boolean not null default false,
  status text not null default 'sent' check (status in ('sent', 'revision_requested', 'accepted', 'cancelled', 'expired')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  platform_fee_rate numeric(5,4) not null default 0,
  paid_at timestamptz,
  refunded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '3 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proposals add column if not exists payment_status text not null default 'unpaid';
alter table public.proposals add column if not exists platform_fee_rate numeric(5,4) not null default 0;
alter table public.proposals add column if not exists paid_at timestamptz;
alter table public.proposals add column if not exists refunded_at timestamptz;
alter table public.proposals add column if not exists consultation_id uuid references public.consultations(id) on delete cascade;

alter table public.proposals enable row level security;

drop policy if exists "Proposal participants can view proposals" on public.proposals;
create policy "Proposal participants can view proposals"
  on public.proposals for select
  using (auth.uid() = client_id or auth.uid() = expert_id);

drop policy if exists "Experts can insert proposal for own request" on public.proposals;
drop policy if exists "Experts can insert proposal for submitted request" on public.proposals;

drop policy if exists "Clients and experts can update proposals" on public.proposals;
drop policy if exists "Clients can update received proposals" on public.proposals;

drop trigger if exists set_proposals_updated_at on public.proposals;
create trigger set_proposals_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

-- 6. payment_orders
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  order_name text not null,
  platform_fee_rate numeric(5,4) not null default 0,
  platform_fee integer not null default 0 check (platform_fee >= 0),
  expert_payout integer not null default 0 check (expert_payout >= 0),
  payment_key text,
  status text not null default 'ready' check (status in ('ready', 'approved', 'failed', 'refunded')),
  failure_code text,
  failure_message text,
  approved_at timestamptz,
  cancel_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_orders drop constraint if exists payment_orders_status_check;
alter table public.payment_orders
  add constraint payment_orders_status_check check (status in ('ready', 'approved', 'failed', 'refunded'));
alter table public.payment_orders add column if not exists payment_key text;
alter table public.payment_orders add column if not exists platform_fee_rate numeric(5,4) not null default 0;
alter table public.payment_orders add column if not exists platform_fee integer not null default 0;
alter table public.payment_orders add column if not exists expert_payout integer not null default 0;
alter table public.payment_orders add column if not exists failure_code text;
alter table public.payment_orders add column if not exists failure_message text;
alter table public.payment_orders add column if not exists approved_at timestamptz;
alter table public.payment_orders add column if not exists cancel_reason text;
alter table public.payment_orders add column if not exists cancelled_at timestamptz;

alter table public.payment_orders enable row level security;

drop policy if exists "Clients can view own payment orders" on public.payment_orders;
create policy "Clients can view own payment orders"
  on public.payment_orders for select
  using (auth.uid() = client_id);

drop trigger if exists set_payment_orders_updated_at on public.payment_orders;
create trigger set_payment_orders_updated_at
  before update on public.payment_orders
  for each row execute function public.set_updated_at();

-- 7. works
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade,
  request_id uuid references public.service_requests(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete cascade,
  expert_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  progress_type text not null default 'single' check (progress_type in ('single', 'milestone')),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'revision_requested', 'completed', 'cancelled')),
  total_price integer not null default 0 check (total_price >= 0),
  platform_fee integer not null default 0 check (platform_fee >= 0),
  expert_payout integer not null default 0 check (expert_payout >= 0),
  settlement_status text not null default 'held' check (settlement_status in ('held', 'pending', 'settled', 'refunded')),
  revision_limit integer not null default 0 check (revision_limit >= 0),
  revision_used integer not null default 0 check (revision_used >= 0),
  refund_status text check (refund_status in ('fee_excluded_refund_pending', 'refunded')),
  dispute_status text check (dispute_status in ('open', 'resolved')),
  dispute_reason text check (dispute_reason in ('scope_mismatch', 'missing_deliverable', 'quality_issue', 'late_delivery', 'other')),
  dispute_details text,
  dispute_opened_by uuid references public.profiles(id) on delete set null,
  dispute_opened_at timestamptz,
  cancellation_reason text check (cancellation_reason in ('before_start', 'mutual_after_start')),
  cancellation_requested_by uuid references public.profiles(id) on delete set null,
  cancellation_requested_at timestamptz,
  cancelled_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  settlement_requested_at timestamptz,
  settlement_settled_at timestamptz,
  settlement_hold_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.works add column if not exists total_price integer not null default 0;
alter table public.works add column if not exists platform_fee integer not null default 0;
alter table public.works add column if not exists expert_payout integer not null default 0;
alter table public.works add column if not exists settlement_status text not null default 'held';
alter table public.works add column if not exists revision_limit integer not null default 0;
alter table public.works add column if not exists revision_used integer not null default 0;
alter table public.works add column if not exists refund_status text;
alter table public.works add column if not exists dispute_status text;
alter table public.works add column if not exists dispute_reason text;
alter table public.works add column if not exists dispute_details text;
alter table public.works add column if not exists dispute_opened_by uuid references public.profiles(id) on delete set null;
alter table public.works add column if not exists dispute_opened_at timestamptz;
alter table public.works add column if not exists cancellation_reason text;
alter table public.works add column if not exists cancellation_requested_by uuid references public.profiles(id) on delete set null;
alter table public.works add column if not exists cancellation_requested_at timestamptz;
alter table public.works add column if not exists cancelled_at timestamptz;
alter table public.works add column if not exists completed_at timestamptz;
alter table public.works add column if not exists settlement_requested_at timestamptz;
alter table public.works add column if not exists settlement_settled_at timestamptz;
alter table public.works add column if not exists settlement_hold_reason text;

alter table public.works enable row level security;

drop policy if exists "Work participants can view works" on public.works;
create policy "Work participants can view works"
  on public.works for select
  using (auth.uid() = client_id or auth.uid() = expert_id);

drop policy if exists "Accepted proposal participants can insert works" on public.works;

drop policy if exists "Work participants can update works" on public.works;
create policy "Work participants can update works"
  on public.works for update
  using (auth.uid() = client_id or auth.uid() = expert_id)
  with check (auth.uid() = client_id or auth.uid() = expert_id);

drop trigger if exists set_works_updated_at on public.works;
create trigger set_works_updated_at
  before update on public.works
  for each row execute function public.set_updated_at();

create table if not exists public.settlement_payouts (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null unique references public.works(id) on delete cascade,
  expert_id uuid not null references public.profiles(id) on delete cascade,
  payout_account_id uuid references public.expert_payout_accounts(id) on delete set null,
  amount integer not null check (amount >= 0),
  status text not null default 'queued' check (status in ('queued', 'processing', 'paid', 'failed')),
  failure_reason text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settlement_payouts enable row level security;

drop policy if exists "Experts can view own settlement payouts" on public.settlement_payouts;
create policy "Experts can view own settlement payouts"
  on public.settlement_payouts for select
  using (auth.uid() = expert_id);

drop trigger if exists set_settlement_payouts_updated_at on public.settlement_payouts;
create trigger set_settlement_payouts_updated_at
  before update on public.settlement_payouts
  for each row execute function public.set_updated_at();

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

create index if not exists notification_events_dispatch_idx
  on public.notification_events (status, created_at)
  where status = 'queued';

drop policy if exists "Users can view own notification events" on public.notification_events;
create policy "Users can view own notification events"
  on public.notification_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification events" on public.notification_events;
drop policy if exists "Work participants can insert notification events" on public.notification_events;

-- 7. work_steps
create table if not exists public.work_steps (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references public.works(id) on delete cascade,
  step_order integer not null,
  title text not null,
  description text,
  status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'submitted', 'revision_requested', 'approved')),
  submitted_at timestamptz,
  approved_at timestamptz,
  revision_requested_at timestamptz,
  revision_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, step_order)
);

alter table public.work_steps enable row level security;

drop policy if exists "Work participants can view work steps" on public.work_steps;
create policy "Work participants can view work steps"
  on public.work_steps for select
  using (
    exists (
      select 1 from public.works
      where works.id = work_steps.work_id
      and (works.client_id = auth.uid() or works.expert_id = auth.uid())
    )
  );

drop policy if exists "Work participants can update work steps" on public.work_steps;
drop policy if exists "Work participants can insert work steps" on public.work_steps;

drop trigger if exists set_work_steps_updated_at on public.work_steps;
create trigger set_work_steps_updated_at
  before update on public.work_steps
  for each row execute function public.set_updated_at();

-- 8. deliverables
create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references public.works(id) on delete cascade,
  step_id uuid references public.work_steps(id) on delete set null,
  expert_id uuid references public.profiles(id) on delete cascade,
  description text not null,
  external_url text,
  file_url text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'revision_requested')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deliverables enable row level security;

drop policy if exists "Work participants can view deliverables" on public.deliverables;
create policy "Work participants can view deliverables"
  on public.deliverables for select
  using (
    exists (
      select 1 from public.works
      where works.id = deliverables.work_id
      and (works.client_id = auth.uid() or works.expert_id = auth.uid())
    )
  );

drop policy if exists "Experts can insert deliverables" on public.deliverables;
drop policy if exists "Work participants can update deliverables" on public.deliverables;

drop trigger if exists set_deliverables_updated_at on public.deliverables;
create trigger set_deliverables_updated_at
  before update on public.deliverables
  for each row execute function public.set_updated_at();

-- 9. work_messages
create table if not exists public.work_messages (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references public.works(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  attachment_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.work_messages enable row level security;

drop policy if exists "Work participants can view messages" on public.work_messages;
create policy "Work participants can view messages"
  on public.work_messages for select
  using (
    exists (
      select 1 from public.works
      where works.id = work_messages.work_id
      and (works.client_id = auth.uid() or works.expert_id = auth.uid())
    )
  );

drop policy if exists "Work participants can insert messages" on public.work_messages;
create policy "Work participants can insert messages"
  on public.work_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.works
      where works.id = work_messages.work_id
      and (works.client_id = auth.uid() or works.expert_id = auth.uid())
    )
  );

-- 10. reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references public.works(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete cascade,
  expert_id uuid references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  content text not null,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, client_id)
);

alter table public.reviews add column if not exists status text not null default 'published';

alter table public.reviews enable row level security;

drop policy if exists "Public can read reviews" on public.reviews;
create policy "Public can read reviews"
  on public.reviews for select
  using (status = 'published' or public.is_admin(auth.uid()));

drop policy if exists "Clients can review completed work" on public.reviews;
create policy "Clients can review completed work"
  on public.reviews for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.works
      where works.id = reviews.work_id
      and works.client_id = auth.uid()
      and works.expert_id = reviews.expert_id
      and works.status = 'completed'
    )
  );

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create table if not exists public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'owner')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Users can view own admin role" on public.admin_users;
create policy "Users can view own admin role"
  on public.admin_users for select
  using (auth.uid() = user_id);

create table if not exists public.admin_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('user', 'product', 'consultation', 'work', 'review')),
  target_id text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.admin_reports enable row level security;

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('user', 'product', 'trade', 'consultation', 'work', 'review', 'report')),
  target_id text not null,
  action_type text not null check (action_type in ('note', 'warn', 'restrict', 'release_restriction', 'hide_product', 'restore_product', 'feature_product', 'unfeature_product', 'move_product_up', 'move_product_down', 'resolve_report', 'dismiss_report', 'hide_review', 'restore_review', 'mark_settlement_pending', 'mark_settlement_settled', 'hold_settlement', 'mark_refund_pending', 'execute_toss_refund', 'open_dispute', 'resolve_dispute', 'close_consultation', 'cancel_trade')),
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;

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

drop policy if exists "Admins can view operation logs" on public.operation_logs;
create policy "Admins can view operation logs"
  on public.operation_logs for select
  to authenticated
  using (exists (select 1 from public.admin_users where admin_users.user_id = (select auth.uid())));

drop policy if exists "Admins can view admin actions" on public.admin_actions;
create policy "Admins can view admin actions"
  on public.admin_actions for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can insert admin actions" on public.admin_actions;
create policy "Admins can insert admin actions"
  on public.admin_actions for insert
  with check (
    admin_id = auth.uid()
    and exists (select 1 from public.admin_users where admin_users.user_id = auth.uid())
  );

drop policy if exists "Admins can view reports" on public.admin_reports;
create policy "Admins can view reports"
  on public.admin_reports for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Authenticated users can create reports" on public.admin_reports;
create policy "Authenticated users can create reports"
  on public.admin_reports for insert
  with check (
    reporter_id = auth.uid()
    and status = 'pending'
  );

drop policy if exists "Admins can update reports" on public.admin_reports;
create policy "Admins can update reports"
  on public.admin_reports for update
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view profiles" on public.profiles;
create policy "Admins can view profiles"
  on public.profiles for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view payout accounts" on public.expert_payout_accounts;
create policy "Admins can view payout accounts"
  on public.expert_payout_accounts for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view settlement payouts" on public.settlement_payouts;
create policy "Admins can view settlement payouts"
  on public.settlement_payouts for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can update settlement payouts" on public.settlement_payouts;

drop policy if exists "Admins can view products" on public.expert_products;
create policy "Admins can view products"
  on public.expert_products for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can update products" on public.expert_products;
create policy "Admins can update products"
  on public.expert_products for update
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view consultations" on public.consultations;
create policy "Admins can view consultations"
  on public.consultations for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can update consultations" on public.consultations;
create policy "Admins can update consultations"
  on public.consultations for update
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view consultation messages" on public.consultation_messages;
create policy "Admins can view consultation messages"
  on public.consultation_messages for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view service requests" on public.service_requests;
create policy "Admins can view service requests"
  on public.service_requests for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view proposals" on public.proposals;
create policy "Admins can view proposals"
  on public.proposals for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view works" on public.works;
create policy "Admins can view works"
  on public.works for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can update works" on public.works;

drop policy if exists "Admins can view work steps" on public.work_steps;
create policy "Admins can view work steps"
  on public.work_steps for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view deliverables" on public.deliverables;
create policy "Admins can view deliverables"
  on public.deliverables for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view work messages" on public.work_messages;
create policy "Admins can view work messages"
  on public.work_messages for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can view reviews" on public.reviews;
create policy "Admins can view reviews"
  on public.reviews for select
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

drop policy if exists "Admins can update reviews" on public.reviews;
create policy "Admins can update reviews"
  on public.reviews for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into storage.buckets (id, name, public)
values
  ('product-samples', 'product-samples', true),
  ('profile-images', 'profile-images', true),
  ('deliverable-files', 'deliverable-files', false)
on conflict (id) do nothing;

drop policy if exists "Public can read product samples" on storage.objects;
create policy "Public can read product samples"
  on storage.objects for select
  using (bucket_id = 'product-samples');

drop policy if exists "Experts can upload product samples" on storage.objects;
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

drop policy if exists "Public can read profile images" on storage.objects;
create policy "Public can read profile images"
  on storage.objects for select
  using (bucket_id = 'profile-images');

drop policy if exists "Users can upload profile images" on storage.objects;
create policy "Users can upload profile images"
  on storage.objects for insert
  with check (bucket_id = 'profile-images' and auth.role() = 'authenticated');

drop policy if exists "Work participants can read deliverable files" on storage.objects;
create policy "Work participants can read deliverable files"
  on storage.objects for select
  using (
    bucket_id = 'deliverable-files'
    and exists (
      select 1 from public.works
      where works.id::text = (storage.foldername(name))[1]
      and (works.client_id = auth.uid() or works.expert_id = auth.uid())
    )
  );

drop policy if exists "Experts can upload deliverable files" on storage.objects;
create policy "Experts can upload deliverable files"
  on storage.objects for insert
  with check (
    bucket_id = 'deliverable-files'
    and exists (
      select 1 from public.works
      where works.id::text = (storage.foldername(name))[1]
      and works.expert_id = auth.uid()
    )
  );

create unique index if not exists payment_orders_one_active_per_proposal
  on public.payment_orders (proposal_id)
  where status in ('ready', 'approved');

create unique index if not exists payment_orders_payment_key_unique
  on public.payment_orders (payment_key)
  where payment_key is not null;

create unique index if not exists works_one_work_per_proposal
  on public.works (proposal_id)
  where proposal_id is not null;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create or replace function public.schedule_trade_automation_cron(
  function_url text,
  automation_secret text,
  cron_schedule text default '0 * * * *'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if current_role in ('anon', 'authenticated') and (auth.uid() is null or not public.is_admin(auth.uid())) then
    raise exception 'only admins can schedule trade automation';
  end if;

  if length(trim(function_url)) = 0 or length(trim(automation_secret)) = 0 or length(trim(cron_schedule)) = 0 then
    raise exception 'function_url, automation_secret, and cron_schedule are required';
  end if;

  begin
    perform cron.unschedule('trade-automation-runner-hourly');
  exception
    when others then
      null;
  end;

  perform cron.schedule(
    'trade-automation-runner-hourly',
    cron_schedule,
    format(
      'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-automation-secret'', %L), body := ''{}''::jsonb);',
      function_url,
      automation_secret
    )
  );
end;
$$;

revoke all on function public.schedule_trade_automation_cron(text, text, text) from public;
revoke all on function public.schedule_trade_automation_cron(text, text, text) from anon;
revoke all on function public.schedule_trade_automation_cron(text, text, text) from authenticated;
grant execute on function public.schedule_trade_automation_cron(text, text, text) to service_role;

create or replace function public.schedule_notification_dispatcher_cron(
  function_url text,
  automation_secret text,
  cron_schedule text default '*/5 * * * *'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if current_role in ('anon', 'authenticated') and (auth.uid() is null or not public.is_admin(auth.uid())) then
    raise exception 'only admins can schedule notification dispatcher';
  end if;

  if length(trim(function_url)) = 0 or length(trim(automation_secret)) = 0 or length(trim(cron_schedule)) = 0 then
    raise exception 'function_url, automation_secret, and cron_schedule are required';
  end if;

  begin
    perform cron.unschedule('notification-dispatcher-runner');
  exception
    when others then
      null;
  end;

  perform cron.schedule(
    'notification-dispatcher-runner',
    cron_schedule,
    format(
      'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-automation-secret'', %L), body := ''{}''::jsonb);',
      function_url,
      automation_secret
    )
  );
end;
$$;

revoke all on function public.schedule_notification_dispatcher_cron(text, text, text) from public;
revoke all on function public.schedule_notification_dispatcher_cron(text, text, text) from anon;
revoke all on function public.schedule_notification_dispatcher_cron(text, text, text) from authenticated;
grant execute on function public.schedule_notification_dispatcher_cron(text, text, text) to service_role;

create or replace function public.guard_proposal_authenticated_update()
returns trigger
language plpgsql
as $$
begin
  if current_role <> 'authenticated' then
    return new;
  end if;

  if auth.uid() = old.client_id then
    if new.request_id is distinct from old.request_id
      or new.consultation_id is distinct from old.consultation_id
      or new.client_id is distinct from old.client_id
      or new.expert_id is distinct from old.expert_id
      or new.title is distinct from old.title
      or new.scope is distinct from old.scope
      or new.deliverables is distinct from old.deliverables
      or new.total_price is distinct from old.total_price
      or new.currency is distinct from old.currency
      or new.delivery_days is distinct from old.delivery_days
      or new.revision_count is distinct from old.revision_count
      or new.progress_type is distinct from old.progress_type
      or new.milestones is distinct from old.milestones
      or new.commercial_use_allowed is distinct from old.commercial_use_allowed
      or new.source_file_included is distinct from old.source_file_included
      or new.payment_status is distinct from old.payment_status
      or new.platform_fee_rate is distinct from old.platform_fee_rate
      or new.paid_at is distinct from old.paid_at
      or new.refunded_at is distinct from old.refunded_at
      or new.expires_at is distinct from old.expires_at
    then
      raise exception 'clients may only request revision or cancel unpaid proposals';
    end if;

    if old.payment_status <> 'unpaid' or new.status not in ('revision_requested', 'cancelled') then
      raise exception 'clients may only request revision or cancel unpaid proposals';
    end if;

    return new;
  end if;

  if auth.uid() = old.expert_id then
    if new.request_id is distinct from old.request_id
      or new.consultation_id is distinct from old.consultation_id
      or new.client_id is distinct from old.client_id
      or new.expert_id is distinct from old.expert_id
      or new.payment_status is distinct from old.payment_status
      or new.platform_fee_rate is distinct from old.platform_fee_rate
      or new.paid_at is distinct from old.paid_at
      or new.refunded_at is distinct from old.refunded_at
    then
      raise exception 'experts may not change proposal ownership or payment fields';
    end if;

    if old.payment_status <> 'unpaid' or new.payment_status <> 'unpaid' or new.status not in ('sent', 'cancelled') then
      raise exception 'experts may only edit unpaid draft/sent proposals';
    end if;

    return new;
  end if;

  raise exception 'proposal update is not allowed for this user';
end;
$$;

drop trigger if exists guard_proposal_authenticated_update on public.proposals;
create trigger guard_proposal_authenticated_update
  before update on public.proposals
  for each row execute function public.guard_proposal_authenticated_update();

drop policy if exists "Clients can update received proposals" on public.proposals;
drop policy if exists "Clients can update unpaid proposal decisions" on public.proposals;

drop policy if exists "Experts can update own unpaid proposals" on public.proposals;

create or replace function public.guard_work_authenticated_update()
returns trigger
language plpgsql
as $$
begin
  if current_role <> 'authenticated' then
    return new;
  end if;

  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if auth.uid() <> old.client_id and auth.uid() <> old.expert_id then
    raise exception 'work update is not allowed for this user';
  end if;

  if new.proposal_id is distinct from old.proposal_id
    or new.request_id is distinct from old.request_id
    or new.client_id is distinct from old.client_id
    or new.expert_id is distinct from old.expert_id
    or new.title is distinct from old.title
    or new.progress_type is distinct from old.progress_type
    or new.total_price is distinct from old.total_price
    or new.platform_fee is distinct from old.platform_fee
    or new.expert_payout is distinct from old.expert_payout
    or new.started_at is distinct from old.started_at
    or new.dispute_status is distinct from old.dispute_status
    or new.revision_limit is distinct from old.revision_limit
    or new.settlement_settled_at is distinct from old.settlement_settled_at
    or new.settlement_hold_reason is distinct from old.settlement_hold_reason
  then
    raise exception 'work ownership, money, dispute, and settlement result fields are server-managed';
  end if;

  if new.refund_status is distinct from old.refund_status
    and not (
      old.status not in ('completed', 'cancelled')
      and old.dispute_status is distinct from 'open'
      and old.cancellation_requested_by is not null
      and old.cancellation_requested_by <> auth.uid()
      and new.status = 'cancelled'
      and new.refund_status = 'fee_excluded_refund_pending'
      and new.cancellation_requested_by is null
      and new.cancellation_requested_at is null
      and new.cancelled_at is not null
    )
  then
    raise exception 'work refund fields are server-managed';
  end if;

  if new.status is not distinct from old.status
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not distinct from old.cancellation_reason
    and new.cancellation_requested_by is not distinct from old.cancellation_requested_by
    and new.cancellation_requested_at is not distinct from old.cancellation_requested_at
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if auth.uid() = old.expert_id
    and new.status = 'submitted'
    and old.dispute_status is distinct from 'open'
    and old.cancellation_requested_by is null
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not distinct from old.cancellation_reason
    and new.cancellation_requested_by is not distinct from old.cancellation_requested_by
    and new.cancellation_requested_at is not distinct from old.cancellation_requested_at
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if auth.uid() = old.expert_id
    and old.status = 'completed'
    and old.settlement_status = 'pending'
    and old.dispute_status is distinct from 'open'
    and old.settlement_hold_reason is null
    and new.status is not distinct from old.status
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not null
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not distinct from old.cancellation_reason
    and new.cancellation_requested_by is not distinct from old.cancellation_requested_by
    and new.cancellation_requested_at is not distinct from old.cancellation_requested_at
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if old.status not in ('completed', 'cancelled')
    and old.dispute_status is distinct from 'open'
    and old.cancellation_requested_by is null
    and new.status is not distinct from old.status
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not null
    and new.cancellation_requested_by = auth.uid()
    and new.cancellation_requested_at is not null
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if old.status not in ('completed', 'cancelled')
    and old.dispute_status is distinct from 'open'
    and old.cancellation_requested_by is not null
    and old.cancellation_requested_by <> auth.uid()
    and new.status = 'cancelled'
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status = 'fee_excluded_refund_pending'
    and new.cancellation_reason is not null
    and new.cancellation_requested_by is null
    and new.cancellation_requested_at is null
    and new.cancelled_at is not null
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if auth.uid() = old.client_id
    and old.status = 'submitted'
    and old.dispute_status is distinct from 'open'
    and old.cancellation_requested_by is null
    and new.status = 'completed'
    and new.settlement_status = 'pending'
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not distinct from old.cancellation_reason
    and new.cancellation_requested_by is null
    and new.cancellation_requested_at is null
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not null
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if auth.uid() = old.client_id
    and old.status = 'submitted'
    and old.dispute_status is distinct from 'open'
    and old.cancellation_requested_by is null
    and new.status = 'revision_requested'
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not distinct from old.cancellation_reason
    and new.cancellation_requested_by is not distinct from old.cancellation_requested_by
    and new.cancellation_requested_at is not distinct from old.cancellation_requested_at
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used = old.revision_used + 1
  then
    return new;
  end if;

  raise exception 'work update is not allowed for this participant action';
end;
$$;

drop trigger if exists guard_work_authenticated_update on public.works;
create trigger guard_work_authenticated_update
  before update on public.works
  for each row execute function public.guard_work_authenticated_update();

drop policy if exists "Accepted proposal participants can insert works" on public.works;
drop policy if exists "Work participants can update works" on public.works;
drop policy if exists "Work participants can update own work state" on public.works;

create or replace function public.guard_work_step_authenticated_update()
returns trigger
language plpgsql
as $$
begin
  if current_role <> 'authenticated' or public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.work_id is distinct from old.work_id
    or new.step_order is distinct from old.step_order
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.submitted_at is distinct from old.submitted_at
    or new.approved_at is distinct from old.approved_at
    or new.revision_requested_at is distinct from old.revision_requested_at
    or new.revision_message is distinct from old.revision_message
    or new.created_at is distinct from old.created_at
  then
    raise exception 'work step review updates may only change status';
  end if;

  if new.status = 'submitted'
    and old.status in ('waiting', 'in_progress', 'revision_requested')
    and exists (
      select 1 from public.works
      where works.id = old.work_id
      and works.expert_id = auth.uid()
    )
  then
    return new;
  end if;

  if new.status in ('approved', 'revision_requested')
    and old.status = 'submitted'
    and exists (
      select 1 from public.works
      where works.id = old.work_id
      and works.client_id = auth.uid()
    )
  then
    return new;
  end if;

  raise exception 'work step status transition is not allowed';
end;
$$;

drop trigger if exists guard_work_step_authenticated_update on public.work_steps;
create trigger guard_work_step_authenticated_update
  before update on public.work_steps
  for each row execute function public.guard_work_step_authenticated_update();

drop policy if exists "Work participants can update work steps" on public.work_steps;
drop policy if exists "Experts can submit own work steps" on public.work_steps;
drop policy if exists "Clients can review work steps" on public.work_steps;

create or replace function public.guard_deliverable_authenticated_update()
returns trigger
language plpgsql
as $$
begin
  if current_role <> 'authenticated' or public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.work_id is distinct from old.work_id
    or new.step_id is distinct from old.step_id
    or new.expert_id is distinct from old.expert_id
    or new.description is distinct from old.description
    or new.external_url is distinct from old.external_url
    or new.file_url is distinct from old.file_url
    or new.submitted_at is distinct from old.submitted_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'deliverable review updates may only change status';
  end if;

  if new.status in ('approved', 'revision_requested')
    and old.status = 'submitted'
    and exists (
      select 1 from public.works
      where works.id = old.work_id
      and works.client_id = auth.uid()
    )
  then
    return new;
  end if;

  raise exception 'deliverable status transition is not allowed';
end;
$$;

drop trigger if exists guard_deliverable_authenticated_update on public.deliverables;
create trigger guard_deliverable_authenticated_update
  before update on public.deliverables
  for each row execute function public.guard_deliverable_authenticated_update();

drop policy if exists "Work participants can update deliverables" on public.deliverables;
drop policy if exists "Clients can review deliverables" on public.deliverables;

drop policy if exists "Experts can insert settlement payouts" on public.settlement_payouts;
drop policy if exists "Experts can retry own settlement payouts" on public.settlement_payouts;

alter table public.profiles add column if not exists withdrawn_at timestamptz;

create or replace function public.guard_profile_user_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_role = 'authenticated' and (
    new.id is distinct from old.id
    or new.account_status is distinct from old.account_status
    or new.withdrawn_at is distinct from old.withdrawn_at
  ) then raise exception 'account status and withdrawal fields are server-managed'; end if;
  return new;
end; $$;
drop trigger if exists guard_profile_user_mutation on public.profiles;
create trigger guard_profile_user_mutation before update on public.profiles
for each row execute function public.guard_profile_user_mutation();

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert to authenticated
with check ((select auth.uid()) = id and account_status = 'active' and withdrawn_at is null);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated
using ((select auth.uid()) = id and account_status = 'active' and withdrawn_at is null)
with check ((select auth.uid()) = id and account_status = 'active' and withdrawn_at is null);
revoke update on public.profiles from authenticated;
grant update (id, email, display_name, name, avatar_url, is_expert, expert_intro, ai_tools, sample_links, interests, request_purposes, updated_at)
on public.profiles to authenticated;

update storage.buckets set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'profile-images';

drop policy if exists "Users can upload profile images" on storage.objects;
drop policy if exists "Public can read profile images" on storage.objects;
create policy "Public can read profile images" on storage.objects for select
using (bucket_id = 'profile-images');
create policy "Users can upload own profile images" on storage.objects for insert to authenticated with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp')
  and coalesce((metadata->>'size')::bigint, 0) between 1 and 5242880
);
drop policy if exists "Users can replace own profile images" on storage.objects;
create policy "Users can replace own profile images" on storage.objects for update to authenticated
using (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null))
with check (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null) and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp') and metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp') and coalesce((metadata->>'size')::bigint, 0) between 1 and 5242880);
drop policy if exists "Users can select own profile images for upsert" on storage.objects;
create policy "Users can select own profile images for upsert" on storage.objects for select to authenticated
using (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Users can delete own profile images" on storage.objects;
create policy "Users can delete own profile images" on storage.objects for delete to authenticated
using (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));

drop policy if exists "Clients can insert own consultations" on public.consultations;
drop policy if exists "Consultation participants can update consultations" on public.consultations;
drop policy if exists "Consultation participants can insert messages" on public.consultation_messages;
drop policy if exists "Admins can update consultations" on public.consultations;
drop policy if exists "Admins can insert admin actions" on public.admin_actions;
drop policy if exists "Admins can update reports" on public.admin_reports;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Admins can update products" on public.expert_products;
drop policy if exists "Admins can update reviews" on public.reviews;
revoke insert on public.admin_actions from authenticated;
revoke update on public.admin_reports from authenticated;
revoke update on public.reviews from authenticated;

drop policy if exists "Experts can view own payout account" on public.expert_payout_accounts;
create policy "Experts can view own payout account" on public.expert_payout_accounts for select to authenticated
using ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Experts can upsert own payout account" on public.expert_payout_accounts;
create policy "Experts can upsert own payout account" on public.expert_payout_accounts for insert to authenticated
with check ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Experts can update own payout account" on public.expert_payout_accounts;
create policy "Experts can update own payout account" on public.expert_payout_accounts for update to authenticated
using ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null))
with check ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Experts can view own settlement payouts" on public.settlement_payouts;
create policy "Experts can view own settlement payouts" on public.settlement_payouts for select to authenticated
using ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));

create or replace function public.is_active_admin(check_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users a join public.profiles p on p.id = a.user_id
    where a.user_id = check_user_id and p.account_status = 'active' and p.withdrawn_at is null
  );
$$;
revoke all on function public.is_active_admin(uuid) from public, anon;
grant execute on function public.is_active_admin(uuid) to authenticated;

drop policy if exists "Admins can view operation logs" on public.operation_logs;
create policy "Admins can view operation logs" on public.operation_logs for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view admin actions" on public.admin_actions;
create policy "Admins can view admin actions" on public.admin_actions for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view reports" on public.admin_reports;
create policy "Admins can view reports" on public.admin_reports for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view profiles" on public.profiles;
create policy "Admins can view profiles" on public.profiles for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view payout accounts" on public.expert_payout_accounts;
create policy "Admins can view payout accounts" on public.expert_payout_accounts for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view settlement payouts" on public.settlement_payouts;
create policy "Admins can view settlement payouts" on public.settlement_payouts for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view products" on public.expert_products;
create policy "Admins can view products" on public.expert_products for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view consultations" on public.consultations;
create policy "Admins can view consultations" on public.consultations for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view consultation messages" on public.consultation_messages;
create policy "Admins can view consultation messages" on public.consultation_messages for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view service requests" on public.service_requests;
create policy "Admins can view service requests" on public.service_requests for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view proposals" on public.proposals;
create policy "Admins can view proposals" on public.proposals for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view works" on public.works;
create policy "Admins can view works" on public.works for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view work steps" on public.work_steps;
create policy "Admins can view work steps" on public.work_steps for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view deliverables" on public.deliverables;
create policy "Admins can view deliverables" on public.deliverables for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view work messages" on public.work_messages;
create policy "Admins can view work messages" on public.work_messages for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view reviews" on public.reviews;
create policy "Admins can view reviews" on public.reviews for select to authenticated using ((select public.is_active_admin((select auth.uid()))));

drop policy if exists "Public can read reviews" on public.reviews;
create policy "Public can read reviews" on public.reviews for select
using (status = 'published');

drop policy if exists "Work participants can view messages" on public.work_messages;
create policy "Work participants can view messages" on public.work_messages for select to authenticated using (
  exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id = work_messages.work_id and (select auth.uid()) in (works.client_id, works.expert_id))
);
drop policy if exists "Work participants can insert messages" on public.work_messages;
create policy "Work participants can insert messages" on public.work_messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id = work_messages.work_id and (select auth.uid()) in (works.client_id, works.expert_id))
);

create or replace function public.guard_inactive_authenticated_mutation()
returns trigger language plpgsql set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
begin
  if actor_id is not null and not exists (
    select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null
  ) then raise exception 'active account required'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists guard_inactive_authenticated_mutation on public.expert_profiles;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.expert_profiles for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.expert_products;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.expert_products for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.expert_payout_accounts;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.expert_payout_accounts for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.notification_preferences;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.notification_preferences for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.service_requests;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.service_requests for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.admin_reports;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.admin_reports for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.reviews;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.reviews for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.work_messages;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.work_messages for each row execute function public.guard_inactive_authenticated_mutation();

drop policy if exists "Users can upload own product samples" on storage.objects;
create policy "Users can upload own product samples" on storage.objects for insert to authenticated with check (
  bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
);
drop policy if exists "Users can replace own product samples" on storage.objects;
create policy "Users can replace own product samples" on storage.objects for update to authenticated
using (bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null))
with check (bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Users can select own product samples for upsert" on storage.objects;
create policy "Users can select own product samples for upsert" on storage.objects for select to authenticated
using (bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Work participants can read deliverable files" on storage.objects;
create policy "Work participants can read deliverable files" on storage.objects for select to authenticated using (
  bucket_id = 'deliverable-files'
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id::text = (storage.foldername(name))[1] and (select auth.uid()) in (works.client_id, works.expert_id))
);
drop policy if exists "Experts can upload deliverable files" on storage.objects;
create policy "Experts can upload deliverable files" on storage.objects for insert to authenticated with check (
  bucket_id = 'deliverable-files'
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id::text = (storage.foldername(name))[1] and works.expert_id = (select auth.uid()))
);

drop policy if exists "Consultation participants can view consultations" on public.consultations;
create policy "Consultation participants can view consultations" on public.consultations for select to authenticated
using (
  (select auth.uid()) in (client_id, expert_id)
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
);
drop policy if exists "Consultation participants can view messages" on public.consultation_messages;
create policy "Consultation participants can view messages" on public.consultation_messages for select to authenticated
using (
  exists (
    select 1 from public.consultations c join public.profiles p on p.id = (select auth.uid())
    where c.id = consultation_messages.consultation_id
      and (select auth.uid()) in (c.client_id, c.expert_id)
      and p.account_status = 'active' and p.withdrawn_at is null
  )
);

create or replace function public.create_consultation(expert_user_id uuid, product_row_id uuid, consultation_title text, initial_message text default null)
returns public.consultations language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); created_consultation public.consultations;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  if actor_id = expert_user_id then raise exception 'self consultation is not allowed'; end if;
  if length(trim(consultation_title)) = 0 then raise exception 'consultation title is required'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null) then raise exception 'active client account required'; end if;
  if not exists (select 1 from public.profiles where id = expert_user_id and is_expert and account_status = 'active' and withdrawn_at is null) then raise exception 'active expert account required'; end if;
  if product_row_id is not null and not exists (select 1 from public.expert_products where id = product_row_id and expert_id = expert_user_id and status = 'published') then raise exception 'published expert product required'; end if;
  insert into public.consultations (client_id, expert_id, product_id, title, status)
  values (actor_id, expert_user_id, product_row_id, trim(consultation_title), 'open') returning * into created_consultation;
  if nullif(trim(coalesce(initial_message, '')), '') is not null then
    insert into public.consultation_messages (consultation_id, sender_id, body, attachment_urls)
    values (created_consultation.id, actor_id, trim(initial_message), '{}');
  end if;
  return created_consultation;
end; $$;

create or replace function public.append_consultation_message(consultation_row_id uuid, message_body text, message_attachment_urls text[] default '{}')
returns public.consultation_messages language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); current_consultation public.consultations; created_message public.consultation_messages;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  if nullif(trim(message_body), '') is null then raise exception 'message body is required'; end if;
  select * into current_consultation from public.consultations where id = consultation_row_id for update;
  if not found or current_consultation.status = 'closed' or actor_id not in (current_consultation.client_id, current_consultation.expert_id)
    or not exists (select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null)
  then raise exception 'open active-participant consultation required'; end if;
  insert into public.consultation_messages (consultation_id, sender_id, body, attachment_urls)
  values (consultation_row_id, actor_id, trim(message_body), coalesce(message_attachment_urls, '{}')) returning * into created_message;
  update public.consultations set last_message_at = created_message.created_at where id = consultation_row_id;
  return created_message;
end; $$;

create or replace function public.transition_consultation(consultation_row_id uuid, next_status text)
returns public.consultations language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); current_consultation public.consultations;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null) then raise exception 'active participant account required'; end if;
  select * into current_consultation from public.consultations where id = consultation_row_id for update;
  if not found or actor_id not in (current_consultation.client_id, current_consultation.expert_id) then raise exception 'consultation participant required'; end if;
  if next_status = 'proposal_sent' then
    if actor_id <> current_consultation.expert_id or current_consultation.status <> 'open' then raise exception 'only the expert can send a proposal from an open consultation'; end if;
  elsif next_status = 'closed' then
    if current_consultation.status not in ('open', 'proposal_sent') then raise exception 'consultation cannot be closed from its current state'; end if;
  else raise exception 'unsupported consultation transition'; end if;
  update public.consultations set status = next_status, last_message_at = now() where id = consultation_row_id returning * into current_consultation;
  return current_consultation;
end; $$;

revoke all on function public.create_consultation(uuid, uuid, text, text) from public, anon;
revoke all on function public.append_consultation_message(uuid, text, text[]) from public, anon;
revoke all on function public.transition_consultation(uuid, text) from public, anon;
grant execute on function public.create_consultation(uuid, uuid, text, text) to authenticated;
grant execute on function public.append_consultation_message(uuid, text, text[]) to authenticated;
grant execute on function public.transition_consultation(uuid, text) to authenticated;

create or replace function public.apply_admin_moderation_action(admin_user_id uuid, target_type_value text, target_id_value text, action_type_value text, reason_value text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_product public.expert_products; adjacent_product public.expert_products; affected_count integer := 0;
begin
  if not exists (select 1 from public.admin_users a join public.profiles p on p.id = a.user_id where a.user_id = admin_user_id and p.account_status = 'active' and p.withdrawn_at is null) then raise exception 'active admin role required'; end if;
  if nullif(trim(reason_value), '') is null then raise exception 'admin action reason required'; end if;
  if target_type_value = 'user' and action_type_value = 'restrict' then
    update public.profiles set account_status = 'restricted' where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'user' and action_type_value = 'release_restriction' then
    update public.profiles set account_status = 'active' where id = target_id_value::uuid and withdrawn_at is null; get diagnostics affected_count = row_count;
  elsif target_type_value = 'product' and action_type_value in ('hide_product', 'restore_product') then
    update public.expert_products set status = case when action_type_value = 'hide_product' then 'hidden' else 'published' end where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'product' and action_type_value in ('feature_product', 'unfeature_product') then
    update public.expert_products set is_featured = action_type_value = 'feature_product' where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'product' and action_type_value in ('move_product_up', 'move_product_down') then
    select * into target_product from public.expert_products where id = target_id_value::uuid for update;
    if not found then raise exception 'target product not found'; end if;
    if action_type_value = 'move_product_up' then select * into adjacent_product from public.expert_products where expert_id = target_product.expert_id and display_order < target_product.display_order order by display_order desc limit 1 for update;
    else select * into adjacent_product from public.expert_products where expert_id = target_product.expert_id and display_order > target_product.display_order order by display_order asc limit 1 for update; end if;
    if found then update public.expert_products set display_order = adjacent_product.display_order where id = target_product.id; update public.expert_products set display_order = target_product.display_order where id = adjacent_product.id; affected_count := 1; end if;
  elsif target_type_value = 'consultation' and action_type_value = 'close_consultation' then
    update public.consultations set status = 'closed' where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'review' and action_type_value in ('hide_review', 'restore_review') then
    update public.reviews set status = case when action_type_value = 'hide_review' then 'hidden' else 'published' end where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'report' and action_type_value in ('resolve_report', 'dismiss_report') then
    update public.admin_reports set status = case when action_type_value = 'resolve_report' then 'resolved' else 'dismissed' end, resolved_at = now(), resolved_by = admin_user_id where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'work' and action_type_value in ('open_dispute', 'resolve_dispute') then
    update public.works set dispute_status = case when action_type_value = 'open_dispute' then 'open' else 'resolved' end where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif action_type_value in ('note', 'warn') then affected_count := 1;
  else raise exception 'unsupported non-financial admin action'; end if;
  if affected_count = 0 then raise exception 'admin action target not found or transition denied'; end if;
  insert into public.admin_actions (admin_id, target_type, target_id, action_type, reason)
  values (admin_user_id, target_type_value, target_id_value, action_type_value, trim(reason_value));
end; $$;
revoke all on function public.apply_admin_moderation_action(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_admin_moderation_action(uuid, text, text, text, text) to service_role;

create or replace function public.withdraw_account(requested_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if requested_user_id is null then raise exception 'user ID is required'; end if;
  update public.profiles set account_status = 'restricted', withdrawn_at = coalesce(withdrawn_at, now()), email = null,
    display_name = '탈퇴한 사용자', name = '탈퇴한 사용자', avatar_url = null, expert_intro = null,
    ai_tools = '{}', sample_links = '{}', interests = '{}', request_purposes = '{}' where id = requested_user_id;
  if not found then raise exception 'profile not found'; end if;
  update public.expert_profiles set image_url = null, profession = '', name = '탈퇴한 사용자', one_liner = '', greeting = '', activities = '[]', awards = '[]', sample_links = '[]', ai_tools = '[]', edit_tools = '[]', packages = '{}', contact_available_time = null, average_response_time = null where user_id = requested_user_id;
  update public.expert_payout_accounts set bank_name = '', account_number = '', account_holder = '', verified_at = null where expert_id = requested_user_id;
  update public.expert_products set status = 'hidden', is_featured = false, display_order = 0 where expert_id = requested_user_id;
  update public.notification_preferences set phone_number = '', kakao_alimtalk_enabled = false, sms_fallback_enabled = false where user_id = requested_user_id;
  insert into public.operation_logs (actor_id, event_type, target_type, target_id, detail)
  values (requested_user_id, 'account_withdrawal_access_blocked', 'user', requested_user_id::text, '{"physicalDeletion":false}');
end; $$;

create or replace function public.record_withdrawal_session_revocation(requested_user_id uuid, revocation_succeeded boolean, detail_text text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = requested_user_id and account_status = 'restricted' and withdrawn_at is not null) then raise exception 'withdrawal access block required'; end if;
  insert into public.operation_logs (actor_id, event_type, target_type, target_id, detail)
  values (requested_user_id, case when revocation_succeeded then 'account_withdrawal_sessions_revoked' else 'account_withdrawal_session_recovery_required' end, 'user', requested_user_id::text, jsonb_build_object('succeeded', revocation_succeeded, 'detail', detail_text));
end; $$;
revoke all on function public.withdraw_account(uuid) from public, anon, authenticated;
revoke all on function public.record_withdrawal_session_revocation(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.withdraw_account(uuid) to service_role;
grant execute on function public.record_withdrawal_session_revocation(uuid, boolean, text) to service_role;

create table if not exists public.financial_operations (
  id uuid primary key default gen_random_uuid(),
  business_key text not null,
  operation_type text not null check (operation_type in (
    'order_create', 'payment_confirm', 'payment_failure', 'refund',
    'settlement_request', 'settlement_finalize', 'admin_transition', 'work_transition', 'automation'
  )),
  state text not null default 'prepared' check (state in (
    'prepared', 'provider_pending', 'provider_succeeded', 'completed',
    'retry_required', 'manual_review', 'failed'
  )),
  payment_order_id uuid references public.payment_orders(id) on delete restrict,
  work_id uuid references public.works(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  amount integer check (amount is null or amount >= 0),
  currency text check (currency is null or currency = 'KRW'),
  provider_reference text,
  provider_status text,
  failure_code text,
  failure_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_key)
);

create table if not exists public.financial_provider_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_key text not null,
  event_type text not null,
  payment_order_id uuid references public.payment_orders(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'manual_review', 'failed')),
  failure_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_key)
);

create table if not exists public.financial_reconciliation_outbox (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.financial_operations(id) on delete restrict,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'resolved', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  last_error text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operation_id)
);

alter table public.settlement_payouts add column if not exists transfer_key text;
alter table public.settlement_payouts add column if not exists provider_transfer_reference text;
create unique index if not exists settlement_payouts_transfer_key_unique
  on public.settlement_payouts (transfer_key) where transfer_key is not null;
create unique index if not exists settlement_payouts_provider_transfer_reference_unique
  on public.settlement_payouts (provider_transfer_reference) where provider_transfer_reference is not null;
create index if not exists financial_operations_state_created_idx
  on public.financial_operations (state, created_at);
create index if not exists financial_operations_payment_order_idx
  on public.financial_operations (payment_order_id);
create unique index if not exists financial_operations_one_confirmation_per_order
  on public.financial_operations (payment_order_id)
  where operation_type = 'payment_confirm';
create index if not exists financial_operations_work_idx
  on public.financial_operations (work_id);
create index if not exists financial_provider_inbox_order_idx
  on public.financial_provider_inbox (payment_order_id, received_at);
create index if not exists financial_reconciliation_pending_idx
  on public.financial_reconciliation_outbox (status, available_at) where status = 'pending';

alter table public.financial_operations enable row level security;
alter table public.financial_provider_inbox enable row level security;
alter table public.financial_reconciliation_outbox enable row level security;
revoke all on table public.financial_operations from anon, authenticated;
revoke all on table public.financial_provider_inbox from anon, authenticated;
revoke all on table public.financial_reconciliation_outbox from anon, authenticated;
grant select, insert, update on table public.financial_operations to service_role;
grant select, insert, update on table public.financial_provider_inbox to service_role;
grant select, insert, update on table public.financial_reconciliation_outbox to service_role;

create or replace function public.begin_payment_order(
  p_proposal_id uuid,
  p_client_id uuid,
  p_order_id text,
  p_order_name text,
  p_platform_fee_rate numeric
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  proposal_row public.proposals%rowtype;
  order_row public.payment_orders%rowtype;
  operation_row public.financial_operations%rowtype;
  fee integer;
begin
  if p_order_id = '' or p_order_name = '' or p_platform_fee_rate < 0 or p_platform_fee_rate >= 1 then
    raise exception 'invalid payment order input' using errcode = '22023';
  end if;

  select * into proposal_row from public.proposals
  where id = p_proposal_id order by id for update;
  if not found then raise exception 'proposal not found' using errcode = 'P0002'; end if;
  if proposal_row.client_id <> p_client_id
    or proposal_row.currency <> 'KRW'
    or proposal_row.total_price <= 0
    or proposal_row.payment_status <> 'unpaid'
    or proposal_row.status not in ('sent', 'revision_requested')
    or proposal_row.expires_at <= now() then
    raise exception 'proposal is not payable' using errcode = 'P0001';
  end if;

  select * into order_row from public.payment_orders
  where proposal_id = p_proposal_id and status in ('ready', 'approved')
  order by created_at desc, id for update limit 1;
  if found and order_row.status = 'approved' then
    raise exception 'proposal already paid' using errcode = 'P0001';
  end if;
  if found and order_row.amount = proposal_row.total_price and order_row.currency = proposal_row.currency then
    return jsonb_build_object('kind', 'existing', 'orderId', order_row.order_id,
      'orderName', order_row.order_name, 'amount', order_row.amount, 'currency', order_row.currency);
  end if;
  if found then
    update public.payment_orders set status = 'failed', failure_code = 'STALE_ORDER_AMOUNT',
      failure_message = 'Proposal amount changed before confirmation'
    where id = order_row.id and status = 'ready';
  end if;

  fee := round(proposal_row.total_price * p_platform_fee_rate);
  insert into public.payment_orders (
    order_id, proposal_id, client_id, amount, currency, order_name,
    platform_fee_rate, platform_fee, expert_payout, status
  ) values (
    p_order_id, proposal_row.id, proposal_row.client_id, proposal_row.total_price,
    proposal_row.currency, p_order_name, p_platform_fee_rate, fee,
    proposal_row.total_price - fee, 'ready'
  ) returning * into order_row;

  insert into public.financial_operations (
    business_key, operation_type, state, payment_order_id, actor_id, amount, currency, completed_at
  ) values (
    'order:' || proposal_row.id::text || ':' || p_order_id, 'order_create', 'completed',
    order_row.id, p_client_id, order_row.amount, order_row.currency, now()
  ) returning * into operation_row;

  return jsonb_build_object('kind', 'created', 'operationId', operation_row.id,
    'orderId', order_row.order_id, 'orderName', order_row.order_name,
    'amount', order_row.amount, 'currency', order_row.currency);
end;
$$;

create or replace function public.begin_payment_confirmation(
  p_order_id text,
  p_client_id uuid,
  p_payment_key text,
  p_amount integer,
  p_currency text,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.payment_orders%rowtype;
  proposal_row public.proposals%rowtype;
  operation_row public.financial_operations%rowtype;
  work_row public.works%rowtype;
begin
  if p_currency <> 'KRW' or p_amount <= 0 or p_payment_key = '' or p_business_key = '' then
    raise exception 'invalid confirmation input' using errcode = '22023';
  end if;
  select * into order_row from public.payment_orders
  where order_id = p_order_id order by id for update;
  if not found then raise exception 'payment order not found' using errcode = 'P0002'; end if;
  select * into proposal_row from public.proposals
  where id = order_row.proposal_id order by id for update;
  if order_row.client_id <> p_client_id or proposal_row.client_id <> p_client_id
    or order_row.amount <> p_amount or proposal_row.total_price <> p_amount
    or order_row.currency <> p_currency or proposal_row.currency <> p_currency then
    raise exception 'payment ownership or amount mismatch' using errcode = 'P0001';
  end if;
  if order_row.status = 'approved' then
    if order_row.payment_key is distinct from p_payment_key then
      raise exception 'payment key mismatch' using errcode = 'P0001';
    end if;
    select * into work_row from public.works where proposal_id = proposal_row.id order by id for update limit 1;
    if proposal_row.payment_status = 'paid' and found then
      return jsonb_build_object('kind', 'completed', 'orderId', order_row.order_id,
        'proposalId', proposal_row.id, 'workId', work_row.id);
    end if;
    select * into operation_row from public.financial_operations
    where payment_order_id = order_row.id and operation_type = 'payment_confirm'
    order by id for update limit 1;
    if found then
      if operation_row.provider_reference is distinct from p_payment_key then
        raise exception 'payment repair key mismatch' using errcode = 'P0001';
      end if;
      update public.financial_operations set state = 'provider_succeeded', updated_at = now()
      where id = operation_row.id;
    else
      insert into public.financial_operations (
        business_key, operation_type, state, payment_order_id, actor_id, amount,
        currency, provider_reference, provider_status, attempt_count
      ) values (
        p_business_key, 'payment_confirm', 'provider_succeeded', order_row.id, p_client_id,
        p_amount, p_currency, p_payment_key, 'DONE', 1
      ) returning * into operation_row;
    end if;
    return jsonb_build_object('kind', 'provider_succeeded', 'operationId', operation_row.id,
      'orderId', order_row.order_id, 'amount', order_row.amount, 'currency', order_row.currency);
  end if;
  if order_row.status <> 'ready' or proposal_row.payment_status <> 'unpaid'
    or proposal_row.status not in ('sent', 'revision_requested') then
    raise exception 'payment is not confirmable' using errcode = 'P0001';
  end if;

  insert into public.financial_operations (
    business_key, operation_type, state, payment_order_id, actor_id, amount,
    currency, provider_reference, attempt_count
  ) values (
    p_business_key, 'payment_confirm', 'provider_pending', order_row.id, p_client_id,
    p_amount, p_currency, p_payment_key, 1
  ) on conflict (business_key) do update
    set attempt_count = public.financial_operations.attempt_count + 1,
        updated_at = now()
  returning * into operation_row;

  if operation_row.payment_order_id <> order_row.id or operation_row.amount <> p_amount
    or operation_row.currency <> p_currency or operation_row.provider_reference <> p_payment_key then
    raise exception 'idempotency key reused with different confirmation' using errcode = 'P0001';
  end if;
  return jsonb_build_object('kind', operation_row.state, 'operationId', operation_row.id,
    'orderId', order_row.order_id, 'amount', order_row.amount, 'currency', order_row.currency);
end;
$$;

create or replace function public.finalize_payment_confirmation(
  p_operation_id uuid,
  p_provider_status text,
  p_payment_key text,
  p_order_id text,
  p_amount integer,
  p_currency text,
  p_approved_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  operation_row public.financial_operations%rowtype;
  order_row public.payment_orders%rowtype;
  proposal_row public.proposals%rowtype;
  work_row public.works%rowtype;
  affected_rows integer;
begin
  select * into operation_row from public.financial_operations
  where id = p_operation_id order by id for update;
  if not found or operation_row.operation_type <> 'payment_confirm' then
    raise exception 'confirmation operation not found' using errcode = 'P0002';
  end if;
  select * into order_row from public.payment_orders
  where id = operation_row.payment_order_id order by id for update;
  select * into proposal_row from public.proposals
  where id = order_row.proposal_id order by id for update;

  if p_provider_status <> 'DONE' or p_payment_key <> operation_row.provider_reference
    or p_order_id <> order_row.order_id or p_amount <> order_row.amount
    or p_currency <> order_row.currency or p_currency <> 'KRW' then
    update public.financial_operations set state = 'manual_review', provider_status = p_provider_status,
      failure_code = 'PROVIDER_CONFIRMATION_MISMATCH', failure_message = 'Provider response mismatched locked order'
    where id = operation_row.id;
    insert into public.financial_reconciliation_outbox (operation_id, reason)
      values (operation_row.id, 'provider_confirmation_mismatch') on conflict (operation_id) do nothing;
    return jsonb_build_object('kind', 'manual_review', 'operationId', operation_row.id);
  end if;
  if operation_row.state = 'completed' and order_row.status = 'approved' then
    select * into work_row from public.works where proposal_id = proposal_row.id order by id for update limit 1;
    if found and proposal_row.payment_status = 'paid' then
      return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
        'proposalId', proposal_row.id, 'workId', work_row.id);
    end if;
    update public.financial_operations set state = 'provider_succeeded', updated_at = now()
    where id = operation_row.id;
    operation_row.state := 'provider_succeeded';
  end if;
  if operation_row.state not in ('provider_pending', 'provider_succeeded', 'retry_required')
    or order_row.status not in ('ready', 'approved')
    or proposal_row.payment_status not in ('unpaid', 'paid') then
    raise exception 'terminal payment state cannot transition' using errcode = 'P0001';
  end if;

  update public.financial_operations set state = 'provider_succeeded', provider_status = p_provider_status,
    updated_at = now() where id = operation_row.id;
  update public.payment_orders set status = 'approved', payment_key = p_payment_key,
    approved_at = coalesce(p_approved_at, now()), failure_code = null, failure_message = null
  where id = order_row.id and status in ('ready', 'approved');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'payment order transition affected_rows mismatch'; end if;
  update public.proposals set status = 'accepted', payment_status = 'paid',
    platform_fee_rate = order_row.platform_fee_rate, paid_at = coalesce(p_approved_at, now())
  where id = proposal_row.id and payment_status in ('unpaid', 'paid');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'proposal transition affected_rows mismatch'; end if;

  insert into public.works (
    proposal_id, request_id, client_id, expert_id, title, progress_type, status,
    total_price, platform_fee, expert_payout, settlement_status, revision_limit, revision_used
  ) values (
    proposal_row.id, proposal_row.request_id, proposal_row.client_id, proposal_row.expert_id,
    proposal_row.title, proposal_row.progress_type, 'in_progress', proposal_row.total_price,
    order_row.platform_fee, order_row.expert_payout, 'held', proposal_row.revision_count, 0
  ) on conflict (proposal_id) do update set proposal_id = excluded.proposal_id
  returning * into work_row;

  insert into public.work_steps (work_id, step_order, title, description, status)
  select work_row.id, source.step_order, source.title, 'Payment confirmed work step',
    case when source.step_order = 1 then 'in_progress' else 'waiting' end
  from (
    select milestone.ordinality::integer as step_order, milestone.title
    from jsonb_array_elements_text(proposal_row.milestones) with ordinality as milestone(title, ordinality)
    where proposal_row.progress_type = 'milestone' and jsonb_array_length(proposal_row.milestones) > 0
    union all
    select 1, proposal_row.title
    where proposal_row.progress_type <> 'milestone' or jsonb_array_length(proposal_row.milestones) = 0
  ) source
  on conflict (work_id, step_order) do nothing;
  if proposal_row.request_id is not null then
    update public.service_requests set status = 'in_progress'
    where id = proposal_row.request_id and status in ('submitted', 'in_progress');
  end if;
  insert into public.notification_events (
    user_id, event_type, title, body, channels, status, related_type, related_id
  ) values
    (proposal_row.client_id, 'payment_completed', 'Payment completed', proposal_row.title,
      array['in_app']::text[], 'queued', 'work', work_row.id::text),
    (proposal_row.expert_id, 'workroom_created', 'Workroom created', proposal_row.title,
      array['in_app']::text[], 'queued', 'work', work_row.id::text);

  update public.financial_operations set state = 'completed', completed_at = now(), updated_at = now()
  where id = operation_row.id;
  update public.financial_reconciliation_outbox set status = 'resolved', resolved_at = now(),
    updated_at = now() where operation_id = operation_row.id and status in ('pending', 'processing');
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
    'proposalId', proposal_row.id, 'workId', work_row.id);
end;
$$;

create or replace function public.record_payment_failure(
  p_order_id text,
  p_client_id uuid,
  p_failure_code text,
  p_failure_message text,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.payment_orders%rowtype;
  operation_row public.financial_operations%rowtype;
  affected_rows integer;
begin
  select * into order_row from public.payment_orders where order_id = p_order_id order by id for update;
  if not found then raise exception 'payment order not found' using errcode = 'P0002'; end if;
  if order_row.client_id <> p_client_id then raise exception 'payment owner mismatch' using errcode = 'P0001'; end if;
  if order_row.status in ('approved', 'refunded') then
    return jsonb_build_object('kind', 'skipped', 'status', order_row.status);
  end if;
  insert into public.financial_operations (
    business_key, operation_type, state, payment_order_id, actor_id, amount, currency,
    failure_code, failure_message, completed_at
  ) values (
    p_business_key, 'payment_failure', 'completed', order_row.id, p_client_id,
    order_row.amount, order_row.currency, left(p_failure_code, 100), left(p_failure_message, 500), now()
  ) on conflict (business_key) do update set updated_at = now() returning * into operation_row;
  update public.payment_orders set status = 'failed', failure_code = left(p_failure_code, 100),
    failure_message = left(p_failure_message, 500)
  where id = order_row.id and status = 'ready';
  get diagnostics affected_rows = row_count;
  return jsonb_build_object('kind', case when affected_rows = 1 then 'completed' else 'skipped' end,
    'operationId', operation_row.id, 'affected_rows', affected_rows);
end;
$$;

create or replace function public.record_provider_event(
  p_provider text,
  p_provider_event_key text,
  p_event_type text,
  p_order_id text,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.payment_orders%rowtype;
  inbox_row public.financial_provider_inbox%rowtype;
begin
  select * into order_row from public.payment_orders where order_id = p_order_id order by id for update;
  if not found then raise exception 'payment order not found' using errcode = 'P0002'; end if;
  insert into public.financial_provider_inbox (
    provider, provider_event_key, event_type, payment_order_id, payload
  ) values (p_provider, p_provider_event_key, p_event_type, order_row.id, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, provider_event_key) do update set provider_event_key = excluded.provider_event_key
  returning * into inbox_row;
  if inbox_row.payment_order_id <> order_row.id then
    raise exception 'provider event key reused across payment orders' using errcode = 'P0001';
  end if;
  return jsonb_build_object('kind', case when inbox_row.status = 'received' then 'received' else 'duplicate' end,
    'inboxId', inbox_row.id, 'status', inbox_row.status, 'clientId', order_row.client_id,
    'amount', order_row.amount, 'currency', order_row.currency);
end;
$$;

create or replace function public.apply_provider_event_result(
  p_inbox_id uuid,
  p_status text,
  p_failure_message text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare affected_rows integer;
begin
  if p_status not in ('processed', 'ignored', 'manual_review', 'failed') then
    raise exception 'invalid inbox result' using errcode = '22023';
  end if;
  update public.financial_provider_inbox set status = p_status,
    failure_message = nullif(left(coalesce(p_failure_message, ''), 500), ''), processed_at = now()
  where id = p_inbox_id and status = 'received';
  get diagnostics affected_rows = row_count;
  return jsonb_build_object('kind', case when affected_rows = 1 then 'completed' else 'skipped' end,
    'affected_rows', affected_rows);
end;
$$;

create or replace function public.begin_payment_refund(
  p_work_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_policy_authorized boolean,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
  order_row public.payment_orders%rowtype;
  operation_row public.financial_operations%rowtype;
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_id) then
    raise exception 'admin required' using errcode = '42501';
  end if;
  select * into work_row from public.works where id = p_work_id order by id for update;
  if not found then raise exception 'work not found' using errcode = 'P0002'; end if;
  select * into order_row from public.payment_orders
  where proposal_id = work_row.proposal_id and status in ('approved', 'refunded')
  order by id for update limit 1;
  if not found then raise exception 'approved payment not found' using errcode = 'P0002'; end if;
  if work_row.settlement_status = 'settled' then raise exception 'settled work cannot be refunded' using errcode = 'P0001'; end if;
  if order_row.status = 'refunded' and work_row.refund_status = 'refunded' then
    select * into operation_row from public.financial_operations
    where operation_type = 'refund' and work_id = work_row.id and state = 'completed'
    order by completed_at desc nulls last, id limit 1;
    return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id, 'workId', work_row.id);
  end if;
  if work_row.refund_status <> 'fee_excluded_refund_pending' then
    raise exception 'work is not pending refund' using errcode = 'P0001';
  end if;
  insert into public.financial_operations (
    business_key, operation_type, state, payment_order_id, work_id, actor_id,
    amount, currency, provider_reference, failure_code, failure_message, attempt_count
  ) values (
    p_business_key, 'refund', case when p_policy_authorized then 'provider_pending' else 'manual_review' end,
    order_row.id, work_row.id, p_actor_id, order_row.amount, order_row.currency,
    order_row.payment_key, case when p_policy_authorized then null else 'G1_PENDING' end,
    case when p_policy_authorized then null else 'Commercial/refund matrix is not approved' end,
    case when p_policy_authorized then 1 else 0 end
  ) on conflict (business_key) do update set
    attempt_count = public.financial_operations.attempt_count + case when p_policy_authorized then 1 else 0 end,
    state = case
      when p_policy_authorized
        and public.financial_operations.state = 'manual_review'
        and public.financial_operations.failure_code = 'G1_PENDING' then 'provider_pending'
      else public.financial_operations.state
    end,
    failure_code = case when p_policy_authorized and public.financial_operations.failure_code = 'G1_PENDING' then null else public.financial_operations.failure_code end,
    failure_message = case when p_policy_authorized and public.financial_operations.failure_code = 'G1_PENDING' then null else public.financial_operations.failure_message end,
    updated_at = now()
  returning * into operation_row;
  if operation_row.work_id <> work_row.id then raise exception 'refund idempotency key reused' using errcode = 'P0001'; end if;
  if not p_policy_authorized then
    insert into public.financial_reconciliation_outbox (operation_id, reason)
      values (operation_row.id, 'refund_policy_gate_pending') on conflict (operation_id) do nothing;
  else
    update public.financial_reconciliation_outbox set status = 'resolved', resolved_at = now(),
      updated_at = now() where operation_id = operation_row.id
      and reason = 'refund_policy_gate_pending' and status in ('pending', 'processing');
  end if;
  return jsonb_build_object('kind', operation_row.state, 'operationId', operation_row.id,
    'paymentKey', order_row.payment_key, 'amount', order_row.amount,
    'currency', order_row.currency, 'reason', left(p_reason, 200));
end;
$$;

create or replace function public.finalize_payment_refund(
  p_operation_id uuid,
  p_provider_status text,
  p_cancelled_at timestamptz,
  p_reason text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  operation_row public.financial_operations%rowtype;
  order_row public.payment_orders%rowtype;
  work_row public.works%rowtype;
  affected_rows integer;
begin
  select * into operation_row from public.financial_operations where id = p_operation_id order by id for update;
  if not found or operation_row.operation_type <> 'refund' then raise exception 'refund operation not found'; end if;
  select * into order_row from public.payment_orders where id = operation_row.payment_order_id order by id for update;
  select * into work_row from public.works where id = operation_row.work_id order by id for update;
  if operation_row.state = 'completed' then return jsonb_build_object('kind', 'completed', 'workId', work_row.id); end if;
  if p_provider_status = 'PARTIAL_CANCELED' or p_provider_status <> 'CANCELED' then
    update public.financial_operations set state = 'manual_review', provider_status = p_provider_status,
      failure_code = 'REFUND_PROVIDER_STATE_UNKNOWN', failure_message = 'Partial or unknown cancellation requires review'
    where id = operation_row.id;
    insert into public.financial_reconciliation_outbox (operation_id, reason)
      values (operation_row.id, 'partial_or_unknown_refund') on conflict (operation_id) do nothing;
    return jsonb_build_object('kind', 'manual_review', 'operationId', operation_row.id);
  end if;
  if operation_row.state not in ('provider_pending', 'provider_succeeded', 'retry_required')
    or order_row.status <> 'approved' or work_row.refund_status <> 'fee_excluded_refund_pending' then
    raise exception 'terminal refund state cannot transition' using errcode = 'P0001';
  end if;
  update public.payment_orders set status = 'refunded', cancel_reason = left(p_reason, 200),
    cancelled_at = coalesce(p_cancelled_at, now()), failure_code = null, failure_message = null
  where id = order_row.id and status = 'approved';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'refund payment affected_rows mismatch'; end if;
  update public.proposals set payment_status = 'refunded', refunded_at = coalesce(p_cancelled_at, now())
  where id = order_row.proposal_id and payment_status = 'paid';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'refund proposal affected_rows mismatch'; end if;
  update public.works set settlement_status = 'refunded', refund_status = 'refunded',
    cancelled_at = coalesce(p_cancelled_at, now())
  where id = work_row.id and settlement_status <> 'settled' and refund_status = 'fee_excluded_refund_pending';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'refund work affected_rows mismatch'; end if;
  update public.financial_operations set state = 'completed', provider_status = p_provider_status,
    completed_at = now(), updated_at = now() where id = operation_row.id;
  update public.financial_reconciliation_outbox set status = 'resolved', resolved_at = now(),
    updated_at = now() where operation_id = operation_row.id and status in ('pending', 'processing');
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
    'workId', work_row.id, 'proposalId', order_row.proposal_id);
end;
$$;

create or replace function public.record_financial_reconciliation(
  p_operation_id uuid,
  p_reason text,
  p_failure_code text,
  p_failure_message text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare operation_row public.financial_operations%rowtype;
begin
  select * into operation_row from public.financial_operations
  where id = p_operation_id order by id for update;
  if not found then raise exception 'financial operation not found' using errcode = 'P0002'; end if;
  if operation_row.state = 'completed' then
    return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id);
  end if;
  update public.financial_operations set state = 'retry_required',
    failure_code = left(coalesce(p_failure_code, 'FINALIZE_FAILED'), 100),
    failure_message = left(coalesce(p_failure_message, 'Financial finalization failed'), 500),
    updated_at = now() where id = operation_row.id;
  insert into public.financial_reconciliation_outbox (operation_id, reason, last_error)
    values (operation_row.id, left(p_reason, 200), left(p_failure_message, 500))
    on conflict (operation_id) do update set reason = excluded.reason,
      last_error = excluded.last_error, status = 'pending', available_at = now(), updated_at = now();
  return jsonb_build_object('kind', 'retry_required', 'operationId', operation_row.id);
end;
$$;

create or replace function public.begin_settlement_request(
  p_work_id uuid,
  p_expert_id uuid,
  p_policy_authorized boolean,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
  account_row public.expert_payout_accounts%rowtype;
  payout_row public.settlement_payouts%rowtype;
  operation_row public.financial_operations%rowtype;
begin
  if not p_policy_authorized then raise exception 'payment policy approval required' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_expert_id and account_status = 'active' and withdrawn_at is null
  ) then raise exception 'active expert account required' using errcode = '42501'; end if;
  select * into work_row from public.works where id = p_work_id order by id for update;
  if not found or work_row.expert_id <> p_expert_id then raise exception 'settlement owner mismatch' using errcode = 'P0001'; end if;
  select * into account_row from public.expert_payout_accounts
  where expert_id = p_expert_id order by id for update limit 1;
  if not found then raise exception 'payout account required' using errcode = 'P0002'; end if;
  if work_row.settlement_requested_at is not null then
    select * into operation_row from public.financial_operations
    where business_key = p_business_key and operation_type = 'settlement_request'
    order by id for update;
    select * into payout_row from public.settlement_payouts where work_id = work_row.id order by id for update;
    if operation_row.id is null or payout_row.id is null or operation_row.work_id <> work_row.id
      or payout_row.expert_id <> p_expert_id or payout_row.amount <> work_row.expert_payout then
      raise exception 'settlement replay invariant mismatch' using errcode = 'P0001';
    end if;
    if operation_row.state = 'failed' and payout_row.status = 'failed' then
      update public.financial_operations set state = 'prepared', failure_code = null,
        failure_message = null, updated_at = now() where id = operation_row.id;
      update public.settlement_payouts set status = 'queued', failure_reason = null,
        processed_at = null, updated_at = now() where id = payout_row.id;
      operation_row.state := 'prepared';
    end if;
    return jsonb_build_object('kind', operation_row.state, 'operationId', operation_row.id,
      'workId', work_row.id, 'payoutId', payout_row.id, 'amount', payout_row.amount,
      'transferKey', payout_row.transfer_key);
  end if;
  if work_row.status <> 'completed' or work_row.settlement_status <> 'pending'
    or work_row.dispute_status = 'open' or work_row.settlement_hold_reason is not null
    or work_row.settlement_requested_at is not null
    or work_row.expert_payout <= 0 then
    raise exception 'work is not settlement ready' using errcode = 'P0001';
  end if;
  insert into public.financial_operations (
    business_key, operation_type, state, work_id, actor_id, amount, currency
  ) values (p_business_key, 'settlement_request', 'prepared', work_row.id, p_expert_id,
    work_row.expert_payout, 'KRW')
  on conflict (business_key) do update set updated_at = now() returning * into operation_row;
  insert into public.settlement_payouts (
    work_id, expert_id, payout_account_id, amount, status, requested_at, transfer_key,
    failure_reason, processed_at
  ) values (
    work_row.id, p_expert_id, account_row.id, work_row.expert_payout, 'queued', now(),
    'settlement:' || work_row.id::text, null, null
  ) on conflict (work_id) do update set
    payout_account_id = case when public.settlement_payouts.status in ('queued', 'failed') then excluded.payout_account_id else public.settlement_payouts.payout_account_id end,
    amount = case when public.settlement_payouts.status in ('queued', 'failed') then excluded.amount else public.settlement_payouts.amount end,
    status = case when public.settlement_payouts.status = 'failed' then 'queued' else public.settlement_payouts.status end,
    failure_reason = case when public.settlement_payouts.status = 'failed' then null else public.settlement_payouts.failure_reason end,
    updated_at = now()
  returning * into payout_row;
  if payout_row.expert_id <> p_expert_id or payout_row.amount <> work_row.expert_payout then
    raise exception 'settlement payout invariant mismatch' using errcode = 'P0001';
  end if;
  update public.works set settlement_requested_at = coalesce(settlement_requested_at, now())
  where id = work_row.id;
  return jsonb_build_object('kind', 'prepared', 'operationId', operation_row.id,
    'workId', work_row.id, 'payoutId', payout_row.id, 'amount', payout_row.amount,
    'transferKey', payout_row.transfer_key);
end;
$$;

create or replace function public.finalize_settlement_payout(
  p_operation_id uuid,
  p_payout_id uuid,
  p_payout_account_id uuid,
  p_amount integer,
  p_provider_status text,
  p_provider_transfer_reference text,
  p_policy_authorized boolean
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  operation_row public.financial_operations%rowtype;
  payout_row public.settlement_payouts%rowtype;
  work_row public.works%rowtype;
  account_row public.expert_payout_accounts%rowtype;
  affected_rows integer;
begin
  if not p_policy_authorized then raise exception 'payment policy approval required' using errcode = 'P0001'; end if;
  if p_amount <= 0 or nullif(trim(p_provider_transfer_reference), '') is null then
    raise exception 'provider payout evidence required' using errcode = '22023';
  end if;
  select * into operation_row from public.financial_operations where id = p_operation_id order by id for update;
  if not found or operation_row.operation_type <> 'settlement_request' then
    raise exception 'settlement operation not found' using errcode = 'P0002';
  end if;
  select * into payout_row from public.settlement_payouts where id = p_payout_id order by id for update;
  if not found then raise exception 'settlement payout not found' using errcode = 'P0002'; end if;
  select * into work_row from public.works where id = payout_row.work_id order by id for update;
  if not found then raise exception 'settlement work not found' using errcode = 'P0002'; end if;
  select * into account_row from public.expert_payout_accounts where id = payout_row.payout_account_id order by id for update;
  if not found or payout_row.payout_account_id is null then
    raise exception 'settlement payout account not found' using errcode = 'P0002';
  end if;
  if operation_row.work_id <> work_row.id or payout_row.payout_account_id <> p_payout_account_id
    or account_row.expert_id <> payout_row.expert_id or account_row.expert_id <> work_row.expert_id
    or operation_row.amount <> p_amount or payout_row.amount <> p_amount or work_row.expert_payout <> p_amount
    or work_row.settlement_requested_at is null then
    raise exception 'settlement payout invariant mismatch' using errcode = 'P0001';
  end if;
  if operation_row.state = 'completed' and payout_row.status = 'paid' then
    if payout_row.provider_transfer_reference <> p_provider_transfer_reference then
      raise exception 'settlement transfer reference mismatch' using errcode = 'P0001';
    end if;
    return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id, 'payoutId', payout_row.id);
  end if;
  if p_provider_status <> 'SUCCEEDED' then
    update public.financial_operations set state = case when p_provider_status in ('FAILED', 'REJECTED') then 'failed' else 'manual_review' end,
      provider_status = left(p_provider_status, 100), failure_code = 'PAYOUT_PROVIDER_NOT_SUCCEEDED',
      failure_message = 'Payout provider did not return a recognized success state', updated_at = now()
    where id = operation_row.id;
    update public.settlement_payouts set status = case when p_provider_status in ('FAILED', 'REJECTED') then 'failed' else 'processing' end,
      failure_reason = 'Payout provider did not return a recognized success state', updated_at = now()
    where id = payout_row.id;
    if p_provider_status not in ('FAILED', 'REJECTED') then
      insert into public.financial_reconciliation_outbox (operation_id, reason)
        values (operation_row.id, 'unknown_settlement_provider_status') on conflict (operation_id) do nothing;
    end if;
    return jsonb_build_object('kind', case when p_provider_status in ('FAILED', 'REJECTED') then 'failed' else 'manual_review' end,
      'operationId', operation_row.id, 'payoutId', payout_row.id);
  end if;
  if operation_row.state not in ('prepared', 'provider_pending', 'provider_succeeded', 'retry_required')
    or payout_row.status not in ('queued', 'processing') or work_row.settlement_status <> 'pending'
    or work_row.refund_status is not null or work_row.dispute_status = 'open'
    or work_row.settlement_hold_reason is not null then
    raise exception 'settlement payout is not finalizable' using errcode = 'P0001';
  end if;
  update public.settlement_payouts set status = 'paid', processed_at = now(),
    provider_transfer_reference = p_provider_transfer_reference, failure_reason = null, updated_at = now()
  where id = payout_row.id and status in ('queued', 'processing');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'settlement payout affected_rows mismatch'; end if;
  update public.works set settlement_status = 'settled', settlement_hold_reason = null,
    settlement_settled_at = now() where id = work_row.id and settlement_status = 'pending';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'settlement work affected_rows mismatch'; end if;
  update public.financial_operations set state = 'completed', provider_status = p_provider_status,
    provider_reference = p_provider_transfer_reference, completed_at = now(), updated_at = now()
  where id = operation_row.id;
  update public.financial_reconciliation_outbox set status = 'resolved', resolved_at = now(),
    updated_at = now() where operation_id = operation_row.id and status in ('pending', 'processing');
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
    'workId', work_row.id, 'payoutId', payout_row.id);
end;
$$;

create or replace function public.apply_admin_financial_transition(
  p_work_id uuid,
  p_admin_id uuid,
  p_action text,
  p_reason text,
  p_policy_authorized boolean,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
  payout_row public.settlement_payouts%rowtype;
  operation_row public.financial_operations%rowtype;
  affected_rows integer;
begin
  if not p_policy_authorized then raise exception 'payment policy approval required' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.admin_users where user_id = p_admin_id) then
    raise exception 'admin required' using errcode = '42501';
  end if;
  select * into work_row from public.works where id = p_work_id order by id for update;
  if not found then raise exception 'work not found' using errcode = 'P0002'; end if;
  select * into payout_row from public.settlement_payouts where work_id = p_work_id order by id for update;
  insert into public.financial_operations (
    business_key, operation_type, state, work_id, actor_id, amount, currency, metadata
  ) values (p_business_key, 'admin_transition', 'prepared', work_row.id, p_admin_id,
    work_row.expert_payout, 'KRW', jsonb_build_object('action', p_action, 'reason', p_reason))
  on conflict (business_key) do update set updated_at = now() returning * into operation_row;
  if operation_row.state = 'completed' then return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id); end if;

  if p_action = 'mark_settlement_pending' then
    if work_row.settlement_status in ('settled', 'refunded') then raise exception 'terminal settlement cannot reopen'; end if;
    update public.works set settlement_status = 'pending', settlement_hold_reason = null where id = work_row.id;
  elsif p_action = 'mark_settlement_settled' then
    raise exception 'provider payout evidence required; use finalize_settlement_payout' using errcode = 'P0001';
  elsif p_action = 'hold_settlement' then
    if work_row.settlement_status in ('settled', 'refunded') then raise exception 'terminal settlement cannot be held'; end if;
    update public.works set settlement_status = 'pending', settlement_hold_reason = left(p_reason, 500) where id = work_row.id;
  elsif p_action in ('cancel_trade', 'mark_refund_pending') then
    if work_row.settlement_status = 'settled' or work_row.refund_status = 'refunded' then
      raise exception 'terminal money state cannot enter refund pending';
    end if;
    update public.works set status = case when p_action = 'cancel_trade' then 'cancelled' else status end,
      refund_status = 'fee_excluded_refund_pending', cancellation_reason = case when p_action = 'cancel_trade' then 'mutual_after_start' else cancellation_reason end,
      cancelled_at = case when p_action = 'cancel_trade' then now() else cancelled_at end
    where id = work_row.id;
  else
    raise exception 'unsupported financial admin action' using errcode = '22023';
  end if;
  insert into public.admin_actions (admin_id, target_type, target_id, action_type, reason)
  values (p_admin_id, 'work', p_work_id::text, p_action, p_reason);
  update public.financial_operations set state = 'completed', completed_at = now(), updated_at = now()
  where id = operation_row.id;
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id, 'workId', work_row.id);
end;
$$;

create or replace function public.apply_work_cancellation(
  p_work_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_accept boolean,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
  operation_row public.financial_operations%rowtype;
begin
  select * into work_row from public.works where id = p_work_id order by id for update;
  if not found or p_actor_id not in (work_row.client_id, work_row.expert_id) then
    raise exception 'work participant required' using errcode = '42501';
  end if;
  select * into operation_row from public.financial_operations
  where business_key = p_business_key and operation_type = 'work_transition'
    and work_id = work_row.id and actor_id = p_actor_id
  order by id for update;
  if found and operation_row.state = 'completed' then
    if operation_row.metadata ->> 'action' <> 'cancellation'
      or (operation_row.metadata ->> 'accept')::boolean <> p_accept then
      raise exception 'cancellation idempotency key reused' using errcode = 'P0001';
    end if;
    return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id, 'workId', work_row.id);
  end if;
  if work_row.status in ('completed', 'cancelled') or work_row.dispute_status = 'open' then
    raise exception 'work cannot be cancelled' using errcode = 'P0001';
  end if;
  insert into public.financial_operations (
    business_key, operation_type, state, work_id, actor_id, amount, currency, metadata
  ) values (p_business_key, 'work_transition', 'prepared', work_row.id, p_actor_id,
    work_row.total_price, 'KRW', jsonb_build_object('action', 'cancellation', 'accept', p_accept))
  on conflict (business_key) do update set updated_at = now() returning * into operation_row;
  if operation_row.state = 'completed' then return jsonb_build_object('kind', 'completed', 'workId', work_row.id); end if;
  if p_accept then
    if work_row.cancellation_requested_by is null or work_row.cancellation_requested_by = p_actor_id then
      raise exception 'opposing cancellation request required' using errcode = 'P0001';
    end if;
    update public.works set status = 'cancelled', refund_status = 'fee_excluded_refund_pending',
      cancellation_requested_by = null, cancellation_requested_at = null, cancelled_at = now()
    where id = work_row.id and status not in ('completed', 'cancelled');
  else
    if nullif(trim(p_reason), '') is null or work_row.cancellation_requested_by is not null then
      raise exception 'new cancellation reason required' using errcode = 'P0001';
    end if;
    update public.works set cancellation_reason = case
        when work_row.status = 'in_progress' then 'before_start'
        else 'mutual_after_start'
      end,
      cancellation_requested_by = p_actor_id, cancellation_requested_at = now()
    where id = work_row.id and cancellation_requested_by is null;
  end if;
  if not found then raise exception 'cancellation affected_rows mismatch'; end if;
  update public.financial_operations set state = 'completed', completed_at = now(), updated_at = now()
  where id = operation_row.id;
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id, 'workId', work_row.id);
end;
$$;

create or replace function public.apply_deliverable_review(
  p_work_id uuid,
  p_deliverable_id uuid,
  p_client_id uuid,
  p_approved boolean,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
  deliverable_row public.deliverables%rowtype;
  operation_row public.financial_operations%rowtype;
  next_status text;
begin
  select * into work_row from public.works where id = p_work_id order by id for update;
  if not found or work_row.client_id <> p_client_id then
    raise exception 'work is not reviewable' using errcode = 'P0001';
  end if;
  select * into operation_row from public.financial_operations
  where business_key = p_business_key and operation_type = 'work_transition'
    and work_id = work_row.id and actor_id = p_client_id
  order by id for update;
  if found and operation_row.state = 'completed' then
    if operation_row.metadata ->> 'action' <> 'deliverable_review'
      or (operation_row.metadata ->> 'approved')::boolean <> p_approved then
      raise exception 'review idempotency key reused' using errcode = 'P0001';
    end if;
    return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
      'workId', work_row.id, 'deliverableId', p_deliverable_id);
  end if;
  if work_row.status <> 'submitted' or work_row.dispute_status = 'open'
    or work_row.cancellation_requested_at is not null then
    raise exception 'work is not reviewable' using errcode = 'P0001';
  end if;
  select * into deliverable_row from public.deliverables
  where id = p_deliverable_id and work_id = p_work_id order by id for update;
  if not found or deliverable_row.status <> 'submitted' then raise exception 'deliverable is not reviewable'; end if;
  if not p_approved and work_row.revision_limit > 0 and work_row.revision_used >= work_row.revision_limit then
    raise exception 'revision limit exceeded' using errcode = 'P0001';
  end if;
  insert into public.financial_operations (
    business_key, operation_type, state, work_id, actor_id, amount, currency, metadata
  ) values (p_business_key, 'work_transition', 'prepared', work_row.id, p_client_id,
    work_row.total_price, 'KRW', jsonb_build_object('action', 'deliverable_review', 'approved', p_approved))
  on conflict (business_key) do update set updated_at = now() returning * into operation_row;
  if operation_row.state = 'completed' then return jsonb_build_object('kind', 'completed', 'workId', work_row.id); end if;
  next_status := case when p_approved then 'approved' else 'revision_requested' end;
  update public.deliverables set status = next_status where id = deliverable_row.id and status = 'submitted';
  if not found then raise exception 'deliverable affected_rows mismatch'; end if;
  if deliverable_row.step_id is not null then
    update public.work_steps set status = next_status where id = deliverable_row.step_id and work_id = work_row.id;
    if not found then raise exception 'work step affected_rows mismatch'; end if;
  end if;
  if p_approved then
    update public.works set status = 'completed', settlement_status = 'pending', completed_at = now()
    where id = work_row.id and status = 'submitted' and settlement_status = 'held';
  else
    update public.works set status = 'revision_requested', revision_used = revision_used + 1
    where id = work_row.id and status = 'submitted';
  end if;
  if not found then raise exception 'work review affected_rows mismatch'; end if;
  if p_approved and work_row.request_id is not null then
    update public.service_requests set status = 'completed' where id = work_row.request_id;
  end if;
  update public.financial_operations set state = 'completed', completed_at = now(), updated_at = now()
  where id = operation_row.id;
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
    'workId', work_row.id, 'deliverableId', deliverable_row.id);
end;
$$;

create or replace function public.claim_due_trade_automation(
  p_auto_cancel_before timestamptz,
  p_auto_confirm_before timestamptz,
  p_batch_size integer,
  p_run_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate record;
  run_operation public.financial_operations%rowtype;
  attempted integer := 0;
  succeeded integer := 0;
  skipped integer := 0;
  failed integer := 0;
  auto_cancelled integer := 0;
  auto_confirmed integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 100 then raise exception 'invalid batch size'; end if;
  insert into public.financial_operations (business_key, operation_type, state, metadata)
  values (p_run_key, 'automation', 'prepared', jsonb_build_object('batchSize', p_batch_size))
  on conflict (business_key) do nothing returning * into run_operation;
  if run_operation.id is null then
    select * into run_operation from public.financial_operations
    where business_key = p_run_key and operation_type = 'automation'
    order by id for update;
    if not found then raise exception 'automation operation not found' using errcode = 'P0002'; end if;
    return jsonb_build_object(
      'attempted', coalesce((run_operation.metadata ->> 'attempted')::integer, 0),
      'succeeded', coalesce((run_operation.metadata ->> 'succeeded')::integer, 0),
      'skipped', coalesce((run_operation.metadata ->> 'skipped')::integer, 0),
      'failed', coalesce((run_operation.metadata ->> 'failed')::integer, 0),
      'autoCancelled', coalesce((run_operation.metadata ->> 'autoCancelled')::integer, 0),
      'autoConfirmed', coalesce((run_operation.metadata ->> 'autoConfirmed')::integer, 0),
      'duplicate', true
    );
  end if;

  for candidate in
    select id, request_id from public.works
    where cancellation_requested_at <= p_auto_cancel_before
      and cancellation_requested_by is not null and status not in ('completed', 'cancelled')
      and dispute_status is distinct from 'open'
    order by id for update skip locked limit p_batch_size
  loop
    attempted := attempted + 1;
    begin
      update public.works set status = 'cancelled', refund_status = 'fee_excluded_refund_pending',
        cancellation_reason = coalesce(cancellation_reason, 'mutual_after_start'),
        cancellation_requested_by = null, cancellation_requested_at = null, cancelled_at = now()
      where id = candidate.id and status not in ('completed', 'cancelled');
      if found then
        if candidate.request_id is not null then update public.service_requests set status = 'completed' where id = candidate.request_id; end if;
        succeeded := succeeded + 1; auto_cancelled := auto_cancelled + 1;
      else skipped := skipped + 1;
      end if;
    exception when others then failed := failed + 1;
    end;
  end loop;

  for candidate in
    select d.id as deliverable_id, d.step_id, w.id as work_id, w.request_id
    from public.deliverables d join public.works w on w.id = d.work_id
    where d.status = 'submitted' and d.submitted_at <= p_auto_confirm_before
      and w.status = 'submitted' and w.settlement_status = 'held'
      and w.dispute_status is distinct from 'open' and w.cancellation_requested_at is null
    order by w.id, d.id for update of w, d skip locked limit p_batch_size
  loop
    attempted := attempted + 1;
    begin
      update public.deliverables set status = 'approved' where id = candidate.deliverable_id and status = 'submitted';
      if not found then skipped := skipped + 1; continue; end if;
      if candidate.step_id is not null then update public.work_steps set status = 'approved' where id = candidate.step_id and work_id = candidate.work_id; end if;
      update public.works set status = 'completed', settlement_status = 'pending', completed_at = now()
      where id = candidate.work_id and status = 'submitted' and settlement_status = 'held';
      if not found then raise exception 'automation work expected state changed'; end if;
      if candidate.request_id is not null then update public.service_requests set status = 'completed' where id = candidate.request_id; end if;
      succeeded := succeeded + 1; auto_confirmed := auto_confirmed + 1;
    exception when others then failed := failed + 1;
    end;
  end loop;

  if attempted <> succeeded + skipped + failed then raise exception 'automation count conservation failed'; end if;
  update public.financial_operations set state = case when failed > 0 then 'retry_required' else 'completed' end,
    completed_at = case when failed = 0 then now() else null end,
    metadata = metadata || jsonb_build_object('attempted', attempted, 'succeeded', succeeded,
      'skipped', skipped, 'failed', failed, 'autoCancelled', auto_cancelled, 'autoConfirmed', auto_confirmed),
    updated_at = now() where id = run_operation.id;
  return jsonb_build_object('attempted', attempted, 'succeeded', succeeded, 'skipped', skipped,
    'failed', failed, 'autoCancelled', auto_cancelled, 'autoConfirmed', auto_confirmed);
end;
$$;

revoke execute on function public.begin_payment_order(uuid, uuid, text, text, numeric) from public, anon, authenticated;
revoke execute on function public.begin_payment_confirmation(text, uuid, text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.finalize_payment_confirmation(uuid, text, text, text, integer, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.record_payment_failure(text, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.record_provider_event(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.apply_provider_event_result(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.begin_payment_refund(uuid, uuid, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.finalize_payment_refund(uuid, text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.record_financial_reconciliation(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.begin_settlement_request(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.finalize_settlement_payout(uuid, uuid, uuid, integer, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.apply_admin_financial_transition(uuid, uuid, text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.apply_work_cancellation(uuid, uuid, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.apply_deliverable_review(uuid, uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.claim_due_trade_automation(timestamptz, timestamptz, integer, text) from public, anon, authenticated;

grant execute on function public.begin_payment_order(uuid, uuid, text, text, numeric) to service_role;
grant execute on function public.begin_payment_confirmation(text, uuid, text, integer, text, text) to service_role;
grant execute on function public.finalize_payment_confirmation(uuid, text, text, text, integer, text, timestamptz) to service_role;
grant execute on function public.record_payment_failure(text, uuid, text, text, text) to service_role;
grant execute on function public.record_provider_event(text, text, text, text, jsonb) to service_role;
grant execute on function public.apply_provider_event_result(uuid, text, text) to service_role;
grant execute on function public.begin_payment_refund(uuid, uuid, text, boolean, text) to service_role;
grant execute on function public.finalize_payment_refund(uuid, text, timestamptz, text) to service_role;
grant execute on function public.record_financial_reconciliation(uuid, text, text, text) to service_role;
grant execute on function public.begin_settlement_request(uuid, uuid, boolean, text) to service_role;
grant execute on function public.finalize_settlement_payout(uuid, uuid, uuid, integer, text, text, boolean) to service_role;
grant execute on function public.apply_admin_financial_transition(uuid, uuid, text, text, boolean, text) to service_role;
grant execute on function public.apply_work_cancellation(uuid, uuid, text, boolean, text) to service_role;
grant execute on function public.apply_deliverable_review(uuid, uuid, uuid, boolean, text) to service_role;
grant execute on function public.claim_due_trade_automation(timestamptz, timestamptz, integer, text) to service_role;

+alter table public.profiles add column if not exists withdrawn_at timestamptz;
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists interests text[] not null default '{}';
alter table public.profiles add column if not exists request_purposes text[] not null default '{}';
create or replace function public.guard_profile_user_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_role = 'authenticated' and (
    new.id is distinct from old.id
    or new.account_status is distinct from old.account_status
    or new.withdrawn_at is distinct from old.withdrawn_at
  ) then raise exception 'account status and withdrawal fields are server-managed'; end if;
  return new;
end; $$;
drop trigger if exists guard_profile_user_mutation on public.profiles;
create trigger guard_profile_user_mutation before update on public.profiles
for each row execute function public.guard_profile_user_mutation();
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert to authenticated
with check ((select auth.uid()) = id and account_status = 'active' and withdrawn_at is null);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated
using ((select auth.uid()) = id and account_status = 'active' and withdrawn_at is null)
with check ((select auth.uid()) = id and account_status = 'active' and withdrawn_at is null);
revoke update on public.profiles from authenticated;
grant update (id, email, display_name, name, avatar_url, is_expert, expert_intro, ai_tools, sample_links, interests, request_purposes, updated_at)
on public.profiles to authenticated;
update storage.buckets set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'profile-images';
drop policy if exists "Users can upload profile images" on storage.objects;
drop policy if exists "Public can read profile images" on storage.objects;
create policy "Public can read profile images" on storage.objects for select
using (bucket_id = 'profile-images');
create policy "Users can upload own profile images" on storage.objects for insert to authenticated with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp')
  and coalesce((metadata->>'size')::bigint, 0) between 1 and 5242880
);
drop policy if exists "Users can replace own profile images" on storage.objects;
create policy "Users can replace own profile images" on storage.objects for update to authenticated
using (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null))
with check (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null) and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp') and metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp') and coalesce((metadata->>'size')::bigint, 0) between 1 and 5242880);
drop policy if exists "Users can select own profile images for upsert" on storage.objects;
create policy "Users can select own profile images for upsert" on storage.objects for select to authenticated
using (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Users can delete own profile images" on storage.objects;
create policy "Users can delete own profile images" on storage.objects for delete to authenticated
using (bucket_id = 'profile-images' and owner_id = (select auth.uid())::text and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Clients can insert own consultations" on public.consultations;
drop policy if exists "Consultation participants can update consultations" on public.consultations;
drop policy if exists "Consultation participants can insert messages" on public.consultation_messages;
drop policy if exists "Admins can update consultations" on public.consultations;
drop policy if exists "Admins can insert admin actions" on public.admin_actions;
drop policy if exists "Admins can update reports" on public.admin_reports;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Admins can update products" on public.expert_products;
drop policy if exists "Admins can update reviews" on public.reviews;
revoke insert on public.admin_actions from authenticated;
revoke update on public.admin_reports from authenticated;
revoke update on public.reviews from authenticated;
drop policy if exists "Experts can view own payout account" on public.expert_payout_accounts;
create policy "Experts can view own payout account" on public.expert_payout_accounts for select to authenticated
using ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Experts can upsert own payout account" on public.expert_payout_accounts;
create policy "Experts can upsert own payout account" on public.expert_payout_accounts for insert to authenticated
with check ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Experts can update own payout account" on public.expert_payout_accounts;
create policy "Experts can update own payout account" on public.expert_payout_accounts for update to authenticated
using ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null))
with check ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Experts can view own settlement payouts" on public.settlement_payouts;
create policy "Experts can view own settlement payouts" on public.settlement_payouts for select to authenticated
using ((select auth.uid()) = expert_id and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
create or replace function public.is_active_admin(check_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users a join public.profiles p on p.id = a.user_id
    where a.user_id = check_user_id and p.account_status = 'active' and p.withdrawn_at is null
  );
$$;
revoke all on function public.is_active_admin(uuid) from public, anon;
grant execute on function public.is_active_admin(uuid) to authenticated;
drop policy if exists "Admins can view operation logs" on public.operation_logs;
create policy "Admins can view operation logs" on public.operation_logs for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view admin actions" on public.admin_actions;
create policy "Admins can view admin actions" on public.admin_actions for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view reports" on public.admin_reports;
create policy "Admins can view reports" on public.admin_reports for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view profiles" on public.profiles;
create policy "Admins can view profiles" on public.profiles for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view payout accounts" on public.expert_payout_accounts;
create policy "Admins can view payout accounts" on public.expert_payout_accounts for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view settlement payouts" on public.settlement_payouts;
create policy "Admins can view settlement payouts" on public.settlement_payouts for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view products" on public.expert_products;
create policy "Admins can view products" on public.expert_products for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view consultations" on public.consultations;
create policy "Admins can view consultations" on public.consultations for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view consultation messages" on public.consultation_messages;
create policy "Admins can view consultation messages" on public.consultation_messages for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view service requests" on public.service_requests;
create policy "Admins can view service requests" on public.service_requests for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view proposals" on public.proposals;
create policy "Admins can view proposals" on public.proposals for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view works" on public.works;
create policy "Admins can view works" on public.works for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view work steps" on public.work_steps;
create policy "Admins can view work steps" on public.work_steps for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view deliverables" on public.deliverables;
create policy "Admins can view deliverables" on public.deliverables for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view work messages" on public.work_messages;
create policy "Admins can view work messages" on public.work_messages for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Admins can view reviews" on public.reviews;
create policy "Admins can view reviews" on public.reviews for select to authenticated using ((select public.is_active_admin((select auth.uid()))));
drop policy if exists "Public can read reviews" on public.reviews;
create policy "Public can read reviews" on public.reviews for select
using (status = 'published');
drop policy if exists "Work participants can view messages" on public.work_messages;
create policy "Work participants can view messages" on public.work_messages for select to authenticated using (
  exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id = work_messages.work_id and (select auth.uid()) in (works.client_id, works.expert_id))
);
drop policy if exists "Work participants can insert messages" on public.work_messages;
create policy "Work participants can insert messages" on public.work_messages for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id = work_messages.work_id and (select auth.uid()) in (works.client_id, works.expert_id))
);
create or replace function public.guard_inactive_authenticated_mutation()
returns trigger language plpgsql set search_path = '' as $$
declare actor_id uuid := (select auth.uid());
begin
  if actor_id is not null and not exists (
    select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null
  ) then raise exception 'active account required'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists guard_inactive_authenticated_mutation on public.expert_profiles;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.expert_profiles for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.expert_products;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.expert_products for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.expert_payout_accounts;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.expert_payout_accounts for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.notification_preferences;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.notification_preferences for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.service_requests;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.service_requests for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.admin_reports;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.admin_reports for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.reviews;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.reviews for each row execute function public.guard_inactive_authenticated_mutation();
drop trigger if exists guard_inactive_authenticated_mutation on public.work_messages;
create trigger guard_inactive_authenticated_mutation before insert or update or delete on public.work_messages for each row execute function public.guard_inactive_authenticated_mutation();
drop policy if exists "Users can upload own product samples" on storage.objects;
create policy "Users can upload own product samples" on storage.objects for insert to authenticated with check (
  bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
);
drop policy if exists "Users can replace own product samples" on storage.objects;
create policy "Users can replace own product samples" on storage.objects for update to authenticated
using (bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null))
with check (bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Users can select own product samples for upsert" on storage.objects;
create policy "Users can select own product samples for upsert" on storage.objects for select to authenticated
using (bucket_id = 'product-samples' and (storage.foldername(name))[1] = (select auth.uid())::text and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null));
drop policy if exists "Work participants can read deliverable files" on storage.objects;
create policy "Work participants can read deliverable files" on storage.objects for select to authenticated using (
  bucket_id = 'deliverable-files'
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id::text = (storage.foldername(name))[1] and (select auth.uid()) in (works.client_id, works.expert_id))
);
drop policy if exists "Experts can upload deliverable files" on storage.objects;
create policy "Experts can upload deliverable files" on storage.objects for insert to authenticated with check (
  bucket_id = 'deliverable-files'
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
  and exists (select 1 from public.works where works.id::text = (storage.foldername(name))[1] and works.expert_id = (select auth.uid()))
);
drop policy if exists "Consultation participants can view consultations" on public.consultations;
create policy "Consultation participants can view consultations" on public.consultations for select to authenticated
using (
  (select auth.uid()) in (client_id, expert_id)
  and exists (select 1 from public.profiles where id = (select auth.uid()) and account_status = 'active' and withdrawn_at is null)
);
drop policy if exists "Consultation participants can view messages" on public.consultation_messages;
create policy "Consultation participants can view messages" on public.consultation_messages for select to authenticated
using (
  exists (
    select 1 from public.consultations c join public.profiles p on p.id = (select auth.uid())
    where c.id = consultation_messages.consultation_id
      and (select auth.uid()) in (c.client_id, c.expert_id)
      and p.account_status = 'active' and p.withdrawn_at is null
  )
);
create or replace function public.create_consultation(expert_user_id uuid, product_row_id uuid, consultation_title text, initial_message text default null)
returns public.consultations language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); created_consultation public.consultations;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  if actor_id = expert_user_id then raise exception 'self consultation is not allowed'; end if;
  if length(trim(consultation_title)) = 0 then raise exception 'consultation title is required'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null) then raise exception 'active client account required'; end if;
  if not exists (select 1 from public.profiles where id = expert_user_id and is_expert and account_status = 'active' and withdrawn_at is null) then raise exception 'active expert account required'; end if;
  if product_row_id is not null and not exists (select 1 from public.expert_products where id = product_row_id and expert_id = expert_user_id and status = 'published') then raise exception 'published expert product required'; end if;
  insert into public.consultations (client_id, expert_id, product_id, title, status)
  values (actor_id, expert_user_id, product_row_id, trim(consultation_title), 'open') returning * into created_consultation;
  if nullif(trim(coalesce(initial_message, '')), '') is not null then
    insert into public.consultation_messages (consultation_id, sender_id, body, attachment_urls)
    values (created_consultation.id, actor_id, trim(initial_message), '{}');
  end if;
  return created_consultation;
end; $$;
create or replace function public.append_consultation_message(consultation_row_id uuid, message_body text, message_attachment_urls text[] default '{}')
returns public.consultation_messages language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); current_consultation public.consultations; created_message public.consultation_messages;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  if nullif(trim(message_body), '') is null then raise exception 'message body is required'; end if;
  select * into current_consultation from public.consultations where id = consultation_row_id for update;
  if not found or current_consultation.status = 'closed' or actor_id not in (current_consultation.client_id, current_consultation.expert_id)
    or not exists (select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null)
  then raise exception 'open active-participant consultation required'; end if;
  insert into public.consultation_messages (consultation_id, sender_id, body, attachment_urls)
  values (consultation_row_id, actor_id, trim(message_body), coalesce(message_attachment_urls, '{}')) returning * into created_message;
  update public.consultations set last_message_at = created_message.created_at where id = consultation_row_id;
  return created_message;
end; $$;
create or replace function public.transition_consultation(consultation_row_id uuid, next_status text)
returns public.consultations language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := (select auth.uid()); current_consultation public.consultations;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and account_status = 'active' and withdrawn_at is null) then raise exception 'active participant account required'; end if;
  select * into current_consultation from public.consultations where id = consultation_row_id for update;
  if not found or actor_id not in (current_consultation.client_id, current_consultation.expert_id) then raise exception 'consultation participant required'; end if;
  if next_status = 'proposal_sent' then
    if actor_id <> current_consultation.expert_id or current_consultation.status <> 'open' then raise exception 'only the expert can send a proposal from an open consultation'; end if;
  elsif next_status = 'closed' then
    if current_consultation.status not in ('open', 'proposal_sent') then raise exception 'consultation cannot be closed from its current state'; end if;
  else raise exception 'unsupported consultation transition'; end if;
  update public.consultations set status = next_status, last_message_at = now() where id = consultation_row_id returning * into current_consultation;
  return current_consultation;
end; $$;
revoke all on function public.create_consultation(uuid, uuid, text, text) from public, anon;
revoke all on function public.append_consultation_message(uuid, text, text[]) from public, anon;
revoke all on function public.transition_consultation(uuid, text) from public, anon;
grant execute on function public.create_consultation(uuid, uuid, text, text) to authenticated;
grant execute on function public.append_consultation_message(uuid, text, text[]) to authenticated;
grant execute on function public.transition_consultation(uuid, text) to authenticated;
create or replace function public.apply_admin_moderation_action(admin_user_id uuid, target_type_value text, target_id_value text, action_type_value text, reason_value text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_product public.expert_products; adjacent_product public.expert_products; affected_count integer := 0;
begin
  if not exists (select 1 from public.admin_users a join public.profiles p on p.id = a.user_id where a.user_id = admin_user_id and p.account_status = 'active' and p.withdrawn_at is null) then raise exception 'active admin role required'; end if;
  if nullif(trim(reason_value), '') is null then raise exception 'admin action reason required'; end if;
  if target_type_value = 'user' and action_type_value = 'restrict' then
    update public.profiles set account_status = 'restricted' where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'user' and action_type_value = 'release_restriction' then
    update public.profiles set account_status = 'active' where id = target_id_value::uuid and withdrawn_at is null; get diagnostics affected_count = row_count;
  elsif target_type_value = 'product' and action_type_value in ('hide_product', 'restore_product') then
    update public.expert_products set status = case when action_type_value = 'hide_product' then 'hidden' else 'published' end where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'product' and action_type_value in ('feature_product', 'unfeature_product') then
    update public.expert_products set is_featured = action_type_value = 'feature_product' where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'product' and action_type_value in ('move_product_up', 'move_product_down') then
    select * into target_product from public.expert_products where id = target_id_value::uuid for update;
    if not found then raise exception 'target product not found'; end if;
    if action_type_value = 'move_product_up' then select * into adjacent_product from public.expert_products where expert_id = target_product.expert_id and display_order < target_product.display_order order by display_order desc limit 1 for update;
    else select * into adjacent_product from public.expert_products where expert_id = target_product.expert_id and display_order > target_product.display_order order by display_order asc limit 1 for update; end if;
    if found then update public.expert_products set display_order = adjacent_product.display_order where id = target_product.id; update public.expert_products set display_order = target_product.display_order where id = adjacent_product.id; affected_count := 1; end if;
  elsif target_type_value = 'consultation' and action_type_value = 'close_consultation' then
    update public.consultations set status = 'closed' where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'review' and action_type_value in ('hide_review', 'restore_review') then
    update public.reviews set status = case when action_type_value = 'hide_review' then 'hidden' else 'published' end where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'report' and action_type_value in ('resolve_report', 'dismiss_report') then
    update public.admin_reports set status = case when action_type_value = 'resolve_report' then 'resolved' else 'dismissed' end, resolved_at = now(), resolved_by = admin_user_id where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif target_type_value = 'work' and action_type_value in ('open_dispute', 'resolve_dispute') then
    update public.works set dispute_status = case when action_type_value = 'open_dispute' then 'open' else 'resolved' end where id = target_id_value::uuid; get diagnostics affected_count = row_count;
  elsif action_type_value in ('note', 'warn') then affected_count := 1;
  else raise exception 'unsupported non-financial admin action'; end if;
  if affected_count = 0 then raise exception 'admin action target not found or transition denied'; end if;
  insert into public.admin_actions (admin_id, target_type, target_id, action_type, reason)
  values (admin_user_id, target_type_value, target_id_value, action_type_value, trim(reason_value));
end; $$;
revoke all on function public.apply_admin_moderation_action(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_admin_moderation_action(uuid, text, text, text, text) to service_role;
create or replace function public.withdraw_account(requested_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if requested_user_id is null then raise exception 'user ID is required'; end if;
  update public.profiles set account_status = 'restricted', withdrawn_at = coalesce(withdrawn_at, now()), email = null,
    display_name = '탈퇴한 사용자', name = '탈퇴한 사용자', avatar_url = null, expert_intro = null,
    ai_tools = '{}', sample_links = '{}', interests = '{}', request_purposes = '{}' where id = requested_user_id;
  if not found then raise exception 'profile not found'; end if;
  update public.expert_profiles set image_url = null, profession = '', name = '탈퇴한 사용자', one_liner = '', greeting = '', activities = '[]', awards = '[]', sample_links = '[]', ai_tools = '[]', edit_tools = '[]', packages = '{}', contact_available_time = null, average_response_time = null where user_id = requested_user_id;
  update public.expert_payout_accounts set bank_name = '', account_number = '', account_holder = '', verified_at = null where expert_id = requested_user_id;
  update public.expert_products set status = 'hidden', is_featured = false, display_order = 0 where expert_id = requested_user_id;
  update public.notification_preferences set phone_number = '', kakao_alimtalk_enabled = false, sms_fallback_enabled = false where user_id = requested_user_id;
  insert into public.operation_logs (actor_id, event_type, target_type, target_id, detail)
  values (requested_user_id, 'account_withdrawal_access_blocked', 'user', requested_user_id::text, '{"physicalDeletion":false}');
end; $$;
create or replace function public.record_withdrawal_session_revocation(requested_user_id uuid, revocation_succeeded boolean, detail_text text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = requested_user_id and account_status = 'restricted' and withdrawn_at is not null) then raise exception 'withdrawal access block required'; end if;
  insert into public.operation_logs (actor_id, event_type, target_type, target_id, detail)
  values (requested_user_id, case when revocation_succeeded then 'account_withdrawal_sessions_revoked' else 'account_withdrawal_session_recovery_required' end, 'user', requested_user_id::text, jsonb_build_object('succeeded', revocation_succeeded, 'detail', detail_text));
end; $$;
revoke all on function public.withdraw_account(uuid) from public, anon, authenticated;
revoke all on function public.record_withdrawal_session_revocation(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.withdraw_account(uuid) to service_role;
grant execute on function public.record_withdrawal_session_revocation(uuid, boolean, text) to service_role;
