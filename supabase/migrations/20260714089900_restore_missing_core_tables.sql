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
create table if not exists public.work_messages (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references public.works(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  body text not null,
  attachment_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.work_messages enable row level security;
alter table public.reviews
  add column if not exists status text not null default 'published'
  check (status in ('published', 'hidden'));
