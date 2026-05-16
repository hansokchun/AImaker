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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

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
  ai_tools jsonb not null default '[]'::jsonb,
  edit_tools jsonb not null default '[]'::jsonb,
  packages jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.expert_profiles enable row level security;

create policy "Users can view expert profiles"
  on public.expert_profiles for select
  using (true);

create policy "Users can insert own expert profile"
  on public.expert_profiles for insert
  with check (auth.uid() = user_id);

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
  status text not null default 'published' check (status in ('draft', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expert_products enable row level security;

create policy "Anyone can view published products"
  on public.expert_products for select
  using (status = 'published' or auth.uid() = expert_id);

create policy "Experts can insert own products"
  on public.expert_products for insert
  with check (auth.uid() = expert_id);

create policy "Experts can update own products"
  on public.expert_products for update
  using (auth.uid() = expert_id)
  with check (auth.uid() = expert_id);

create trigger set_expert_products_updated_at
  before update on public.expert_products
  for each row execute function public.set_updated_at();

-- 3. service_requests
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

create policy "Request participants can view requests"
  on public.service_requests for select
  using (auth.uid() = client_id or auth.uid() = expert_id);

create policy "Clients can insert own requests"
  on public.service_requests for insert
  with check (auth.uid() = client_id);

create policy "Clients can update own cancellable requests"
  on public.service_requests for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create trigger set_service_requests_updated_at
  before update on public.service_requests
  for each row execute function public.set_updated_at();

-- 4. proposals
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.service_requests(id) on delete cascade,
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
  expires_at timestamptz not null default (now() + interval '3 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proposals enable row level security;

create policy "Proposal participants can view proposals"
  on public.proposals for select
  using (auth.uid() = client_id or auth.uid() = expert_id);

create policy "Experts can insert proposal for own request"
  on public.proposals for insert
  with check (auth.uid() = expert_id);

create policy "Clients and experts can update proposals"
  on public.proposals for update
  using (auth.uid() = client_id or auth.uid() = expert_id)
  with check (auth.uid() = client_id or auth.uid() = expert_id);

create trigger set_proposals_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

-- 5. works
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.proposals(id) on delete cascade,
  request_id uuid references public.service_requests(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete cascade,
  expert_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  progress_type text not null default 'single' check (progress_type in ('single', 'milestone')),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'revision_requested', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.works enable row level security;

create policy "Work participants can view works"
  on public.works for select
  using (auth.uid() = client_id or auth.uid() = expert_id);

create policy "Accepted proposal participants can insert works"
  on public.works for insert
  with check (auth.uid() = client_id or auth.uid() = expert_id);

create policy "Work participants can update works"
  on public.works for update
  using (auth.uid() = client_id or auth.uid() = expert_id)
  with check (auth.uid() = client_id or auth.uid() = expert_id);

create trigger set_works_updated_at
  before update on public.works
  for each row execute function public.set_updated_at();

-- 6. work_steps
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

create policy "Work participants can view work steps"
  on public.work_steps for select
  using (
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

create trigger set_work_steps_updated_at
  before update on public.work_steps
  for each row execute function public.set_updated_at();

-- 7. deliverables
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

create policy "Work participants can view deliverables"
  on public.deliverables for select
  using (
    exists (
      select 1 from public.works
      where works.id = deliverables.work_id
      and (works.client_id = auth.uid() or works.expert_id = auth.uid())
    )
  );

create policy "Experts can insert deliverables"
  on public.deliverables for insert
  with check (auth.uid() = expert_id);

create policy "Work participants can update deliverables"
  on public.deliverables for update
  using (
    exists (
      select 1 from public.works
      where works.id = deliverables.work_id
      and (works.client_id = auth.uid() or works.expert_id = auth.uid())
    )
  );

create trigger set_deliverables_updated_at
  before update on public.deliverables
  for each row execute function public.set_updated_at();

-- 8. reviews
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references public.works(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete cascade,
  expert_id uuid references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, client_id)
);

alter table public.reviews enable row level security;

create policy "Public can read reviews"
  on public.reviews for select
  using (true);

create policy "Clients can review completed work"
  on public.reviews for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.works
      where works.id = reviews.work_id
      and works.client_id = auth.uid()
      and works.status = 'completed'
    )
  );

create trigger set_reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- 9. Storage buckets and policies
insert into storage.buckets (id, name, public)
values
  ('product-samples', 'product-samples', true),
  ('profile-images', 'profile-images', true),
  ('deliverable-files', 'deliverable-files', false)
on conflict (id) do nothing;

create policy "Public can read product samples"
  on storage.objects for select
  using (bucket_id = 'product-samples');

create policy "Experts can upload product samples"
  on storage.objects for insert
  with check (bucket_id = 'product-samples' and auth.role() = 'authenticated');

create policy "Public can read profile images"
  on storage.objects for select
  using (bucket_id = 'profile-images');

create policy "Users can upload profile images"
  on storage.objects for insert
  with check (bucket_id = 'profile-images' and auth.role() = 'authenticated');

create policy "Work participants can read deliverable files"
  on storage.objects for select
  using (bucket_id = 'deliverable-files' and auth.role() = 'authenticated');

create policy "Experts can upload deliverable files"
  on storage.objects for insert
  with check (bucket_id = 'deliverable-files' and auth.role() = 'authenticated');
