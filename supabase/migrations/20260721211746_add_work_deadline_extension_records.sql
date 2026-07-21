alter table public.works
  add column if not exists initial_delivery_due_at timestamptz,
  add column if not exists deadline_extension_count integer not null default 0 check (deadline_extension_count >= 0),
  add column if not exists delivery_delay_seconds bigint not null default 0 check (delivery_delay_seconds >= 0);

update public.works
set initial_delivery_due_at = delivery_due_at
where initial_delivery_due_at is null and delivery_due_at is not null;

create table if not exists public.work_deadline_extensions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  previous_due_at timestamptz not null,
  proposed_due_at timestamptz not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  responded_by uuid references public.profiles(id) on delete restrict,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (proposed_due_at > previous_due_at),
  check ((status = 'pending' and responded_by is null and responded_at is null)
    or (status in ('accepted', 'rejected') and responded_by is not null and responded_at is not null))
);

create unique index if not exists work_deadline_extensions_one_pending_idx
  on public.work_deadline_extensions (work_id) where status = 'pending';
create index if not exists work_deadline_extensions_work_created_idx
  on public.work_deadline_extensions (work_id, created_at desc);
create index if not exists work_deadline_extensions_requester_idx
  on public.work_deadline_extensions (requester_id);
create index if not exists work_deadline_extensions_responder_idx
  on public.work_deadline_extensions (responded_by) where responded_by is not null;

alter table public.work_deadline_extensions enable row level security;
revoke all on table public.work_deadline_extensions from anon, authenticated;
grant select on table public.work_deadline_extensions to authenticated;

drop policy if exists work_deadline_extensions_participant_select on public.work_deadline_extensions;
create policy work_deadline_extensions_participant_select
on public.work_deadline_extensions for select to authenticated
using (exists (
  select 1 from public.works
  where works.id = work_deadline_extensions.work_id
    and ((select auth.uid()) = works.client_id or (select auth.uid()) = works.expert_id)
));

create or replace function public.capture_work_delivery_timing()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.initial_delivery_due_at is null and new.delivery_due_at is not null then
    new.initial_delivery_due_at := new.delivery_due_at;
  end if;
  if new.first_submitted_at is not null and new.delivery_due_at is not null then
    new.delivery_delay_seconds := greatest(0, extract(epoch from (new.first_submitted_at - new.delivery_due_at))::bigint);
  end if;
  return new;
end;
$$;

drop trigger if exists capture_work_delivery_timing on public.works;
create trigger capture_work_delivery_timing
before insert or update of delivery_due_at, first_submitted_at on public.works
for each row execute function public.capture_work_delivery_timing();

create or replace function public.respond_work_deadline_extension(
  p_extension_id uuid,
  p_responder_id uuid,
  p_accepted boolean
)
returns uuid language plpgsql set search_path = public as $$
declare
  extension_row public.work_deadline_extensions%rowtype;
begin
  select * into extension_row from public.work_deadline_extensions
  where id = p_extension_id for update;
  if not found or extension_row.status <> 'pending' then
    raise exception 'deadline extension is not pending';
  end if;
  if extension_row.requester_id = p_responder_id then
    raise exception 'requester cannot respond to own extension';
  end if;
  update public.work_deadline_extensions
  set status = case when p_accepted then 'accepted' else 'rejected' end,
      responded_by = p_responder_id,
      responded_at = now()
  where id = p_extension_id;
  if p_accepted then
    update public.works
    set delivery_due_at = extension_row.proposed_due_at,
        deadline_extension_count = deadline_extension_count + 1
    where id = extension_row.work_id;
  end if;
  return extension_row.work_id;
end;
$$;

revoke all on function public.respond_work_deadline_extension(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_work_deadline_extension(uuid, uuid, boolean) to service_role;
