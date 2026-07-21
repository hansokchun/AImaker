alter table public.works
  add column if not exists delivery_due_at timestamptz,
  add column if not exists first_submitted_at timestamptz;

create or replace function public.set_work_delivery_deadline()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  proposal_days integer;
begin
  if new.delivery_due_at is null then
    select delivery_days into proposal_days from public.proposals where id = new.proposal_id;
    if proposal_days is not null and proposal_days > 0 then
      new.delivery_due_at := coalesce(new.started_at, now()) + make_interval(days => proposal_days);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists set_work_delivery_deadline on public.works;
create trigger set_work_delivery_deadline before insert on public.works
for each row execute function public.set_work_delivery_deadline();

create or replace function public.record_first_work_submission()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.works set first_submitted_at = coalesce(first_submitted_at, new.submitted_at) where id = new.work_id;
  return new;
end;
$$;

drop trigger if exists record_first_work_submission on public.deliverables;
create trigger record_first_work_submission after insert on public.deliverables
for each row execute function public.record_first_work_submission();

create index if not exists works_delivery_due_at_idx on public.works (delivery_due_at) where first_submitted_at is null;
