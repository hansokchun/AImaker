alter table public.works
  add column if not exists dispute_reason text check (dispute_reason in ('scope_mismatch', 'missing_deliverable', 'quality_issue', 'late_delivery', 'other')),
  add column if not exists dispute_details text,
  add column if not exists dispute_opened_by uuid references public.profiles(id) on delete set null,
  add column if not exists dispute_opened_at timestamptz;

create or replace function public.open_work_dispute(
  p_work_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_details text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
begin
  if p_reason not in ('scope_mismatch', 'missing_deliverable', 'quality_issue', 'late_delivery', 'other') then
    raise exception 'invalid dispute reason' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_details, ''))) < 10 or length(trim(p_details)) > 1000 then
    raise exception 'invalid dispute details' using errcode = '22023';
  end if;
  select * into work_row from public.works where id = p_work_id for update;
  if not found then raise exception 'work not found' using errcode = 'P0002'; end if;
  if p_actor_id not in (work_row.client_id, work_row.expert_id) then raise exception 'work participant required' using errcode = '42501'; end if;
  if work_row.dispute_status = 'open' then raise exception 'dispute already open' using errcode = 'P0001'; end if;
  if work_row.settlement_status in ('settled', 'refunded') then raise exception 'terminal settlement cannot enter dispute' using errcode = 'P0001'; end if;
  update public.works set dispute_status = 'open', dispute_reason = p_reason, dispute_details = trim(p_details),
    dispute_opened_by = p_actor_id, dispute_opened_at = now(), settlement_hold_reason = '분쟁 접수로 정산 보류'
  where id = p_work_id;
  return jsonb_build_object('workId', p_work_id, 'operationId', gen_random_uuid());
end;
$$;

revoke execute on function public.open_work_dispute(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.open_work_dispute(uuid, uuid, text, text) to service_role;
