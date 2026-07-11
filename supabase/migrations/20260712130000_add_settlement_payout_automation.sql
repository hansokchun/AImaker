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

alter table public.expert_payout_accounts enable row level security;
alter table public.settlement_payouts enable row level security;

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

drop policy if exists "Experts can view own settlement payouts" on public.settlement_payouts;
create policy "Experts can view own settlement payouts"
  on public.settlement_payouts for select
  using (auth.uid() = expert_id);

drop trigger if exists set_expert_payout_accounts_updated_at on public.expert_payout_accounts;
create trigger set_expert_payout_accounts_updated_at
  before update on public.expert_payout_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists set_settlement_payouts_updated_at on public.settlement_payouts;
create trigger set_settlement_payouts_updated_at
  before update on public.settlement_payouts
  for each row execute function public.set_updated_at();
