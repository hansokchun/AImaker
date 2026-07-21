create index if not exists works_dispute_opened_by_idx
  on public.works (dispute_opened_by)
  where dispute_opened_by is not null;
