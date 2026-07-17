drop index if exists public.works_proposal_id_unique;
alter table public.works
  add constraint works_proposal_id_unique unique (proposal_id);
