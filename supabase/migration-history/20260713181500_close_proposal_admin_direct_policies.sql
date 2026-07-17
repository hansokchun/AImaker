drop policy if exists "Admins can update works" on public.works;
drop policy if exists "Admins can update settlement payouts" on public.settlement_payouts;
drop policy if exists "Experts can insert proposal for own request" on public.proposals;
drop policy if exists "Experts can insert proposal for submitted request" on public.proposals;
drop policy if exists "Clients and experts can update proposals" on public.proposals;
drop policy if exists "Clients can update received proposals" on public.proposals;
drop policy if exists "Clients can update unpaid proposal decisions" on public.proposals;
drop policy if exists "Experts can update own unpaid proposals" on public.proposals;
