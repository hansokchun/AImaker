-- AIConnect Supabase schema
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
create policy "Users can delete own profile"
  on public.profiles for delete
  using ((select auth.uid()) = id);

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
create policy "Experts can insert proposal for submitted request"
  on public.proposals for insert
  with check (
    auth.uid() = expert_id
    and (
      exists (
        select 1 from public.service_requests
        where service_requests.id = proposals.request_id
        and service_requests.client_id = proposals.client_id
        and service_requests.status in ('submitted', 'pending')
        and service_requests.expert_id = proposals.expert_id
      )
      or exists (
        select 1 from public.consultations
        where consultations.id = proposals.consultation_id
        and consultations.client_id = proposals.client_id
        and consultations.expert_id = proposals.expert_id
        and consultations.status in ('open', 'proposal_sent')
      )
    )
  );

drop policy if exists "Clients and experts can update proposals" on public.proposals;
drop policy if exists "Clients can update received proposals" on public.proposals;
create policy "Clients can update received proposals"
  on public.proposals for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

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
  status text not null default 'ready' check (status in ('ready', 'approved', 'failed')),
  failure_code text,
  failure_message text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_orders add column if not exists payment_key text;
alter table public.payment_orders add column if not exists platform_fee_rate numeric(5,4) not null default 0;
alter table public.payment_orders add column if not exists platform_fee integer not null default 0;
alter table public.payment_orders add column if not exists expert_payout integer not null default 0;
alter table public.payment_orders add column if not exists failure_code text;
alter table public.payment_orders add column if not exists failure_message text;
alter table public.payment_orders add column if not exists approved_at timestamptz;

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
  cancellation_reason text check (cancellation_reason in ('before_start', 'mutual_after_start')),
  cancelled_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
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
alter table public.works add column if not exists cancellation_reason text;
alter table public.works add column if not exists cancelled_at timestamptz;

alter table public.works enable row level security;

drop policy if exists "Work participants can view works" on public.works;
create policy "Work participants can view works"
  on public.works for select
  using (auth.uid() = client_id or auth.uid() = expert_id);

drop policy if exists "Accepted proposal participants can insert works" on public.works;
create policy "Accepted proposal participants can insert works"
  on public.works for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.proposals
      where proposals.id = works.proposal_id
      and proposals.request_id = works.request_id
      and proposals.client_id = works.client_id
      and proposals.expert_id = works.expert_id
      and proposals.status = 'accepted'
      and proposals.payment_status = 'paid'
    )
  );

drop policy if exists "Work participants can update works" on public.works;
create policy "Work participants can update works"
  on public.works for update
  using (auth.uid() = client_id or auth.uid() = expert_id)
  with check (auth.uid() = client_id or auth.uid() = expert_id);

drop trigger if exists set_works_updated_at on public.works;
create trigger set_works_updated_at
  before update on public.works
  for each row execute function public.set_updated_at();

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
create policy "Work participants can insert work steps"
  on public.work_steps for insert
  with check (
    exists (
      select 1 from public.works
      where works.id = work_steps.work_id
      and (works.client_id = auth.uid() or works.expert_id = auth.uid())
    )
  );

create policy "Work participants can update work steps"
  on public.work_steps for update
  using (
    exists (
      select 1 from public.works
      where works.id = work_steps.work_id
      and (works.client_id = auth.uid() or works.expert_id = auth.uid())
    )
  );

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
create policy "Experts can insert deliverables"
  on public.deliverables for insert
  with check (
    deliverables.expert_id = auth.uid()
    and exists (
      select 1 from public.works
      where works.id = deliverables.work_id
      and works.expert_id = auth.uid()
    )
  );

drop policy if exists "Work participants can update deliverables" on public.deliverables;
create policy "Work participants can update deliverables"
  on public.deliverables for update
  using (
    exists (
      select 1 from public.works
      where works.id = deliverables.work_id
      and (works.client_id = auth.uid() or works.expert_id = auth.uid())
    )
  );

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
  action_type text not null check (action_type in ('note', 'warn', 'restrict', 'release_restriction', 'hide_product', 'restore_product', 'feature_product', 'unfeature_product', 'move_product_up', 'move_product_down', 'resolve_report', 'dismiss_report', 'hide_review', 'restore_review', 'mark_settlement_pending', 'mark_settlement_settled', 'mark_refund_pending', 'open_dispute', 'resolve_dispute', 'close_consultation', 'cancel_trade')),
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_actions enable row level security;

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
create policy "Admins can update works"
  on public.works for update
  using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

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
create policy "Experts can upload product samples"
  on storage.objects for insert
  with check (bucket_id = 'product-samples' and auth.role() = 'authenticated');

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
