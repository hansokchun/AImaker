alter table public.deliverables
  add column if not exists file_name text,
  add column if not exists file_size bigint check (file_size is null or file_size > 0),
  add column if not exists file_sha256 text check (file_sha256 is null or file_sha256 ~ '^[a-f0-9]{64}$');

create or replace function public.guard_deliverable_authenticated_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_role <> 'authenticated' or public.is_admin(auth.uid()) then return new; end if;
  if new.work_id is distinct from old.work_id or new.step_id is distinct from old.step_id
    or new.expert_id is distinct from old.expert_id or new.description is distinct from old.description
    or new.external_url is distinct from old.external_url or new.file_url is distinct from old.file_url
    or new.file_name is distinct from old.file_name or new.file_size is distinct from old.file_size
    or new.file_sha256 is distinct from old.file_sha256 or new.submitted_at is distinct from old.submitted_at
    or new.created_at is distinct from old.created_at then
    raise exception 'deliverable evidence cannot be changed after submission';
  end if;
  if new.status in ('approved', 'revision_requested') and old.status = 'submitted'
    and exists (select 1 from public.works where works.id = old.work_id and works.client_id = auth.uid()) then return new; end if;
  raise exception 'deliverable status transition is not allowed';
end;
$$;
