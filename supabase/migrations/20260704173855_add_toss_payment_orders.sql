create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  order_name text not null,
  payment_key text,
  status text not null default 'ready' check (status in ('ready', 'approved', 'failed')),
  failure_code text,
  failure_message text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_orders add column if not exists payment_key text;
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
  for each row execute function public.set_updated_at();;
