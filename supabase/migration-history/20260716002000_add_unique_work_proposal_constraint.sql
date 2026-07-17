create unique index if not exists works_proposal_id_unique
on public.works (proposal_id)
where proposal_id is not null;
