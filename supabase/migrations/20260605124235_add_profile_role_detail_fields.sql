alter table public.profiles
  add column if not exists interests text[] not null default '{}',
  add column if not exists request_purposes text[] not null default '{}';

alter table public.expert_profiles
  add column if not exists sample_links jsonb not null default '[]'::jsonb;;
