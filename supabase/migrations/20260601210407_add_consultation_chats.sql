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

alter table public.proposals add column if not exists consultation_id uuid references public.consultations(id) on delete cascade;

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
        and (
          service_requests.expert_id is null
          or service_requests.expert_id = proposals.expert_id
        )
      )
      or exists (
        select 1 from public.consultations
        where consultations.id = proposals.consultation_id
        and consultations.client_id = proposals.client_id
        and consultations.expert_id = proposals.expert_id
        and consultations.status in ('open', 'proposal_sent')
      )
    )
  );;
