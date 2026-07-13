create unique index if not exists payment_orders_one_active_per_proposal
  on public.payment_orders (proposal_id)
  where status in ('ready', 'approved');

create unique index if not exists payment_orders_payment_key_unique
  on public.payment_orders (payment_key)
  where payment_key is not null;

create unique index if not exists works_one_work_per_proposal
  on public.works (proposal_id)
  where proposal_id is not null;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create or replace function public.schedule_trade_automation_cron(
  function_url text,
  automation_secret text,
  cron_schedule text default '0 * * * *'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if current_role in ('anon', 'authenticated') and (auth.uid() is null or not public.is_admin(auth.uid())) then
    raise exception 'only admins can schedule trade automation';
  end if;

  if length(trim(function_url)) = 0 or length(trim(automation_secret)) = 0 or length(trim(cron_schedule)) = 0 then
    raise exception 'function_url, automation_secret, and cron_schedule are required';
  end if;

  begin
    perform cron.unschedule('trade-automation-runner-hourly');
  exception
    when others then
      null;
  end;

  perform cron.schedule(
    'trade-automation-runner-hourly',
    cron_schedule,
    format(
      'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-automation-secret'', %L), body := ''{}''::jsonb);',
      function_url,
      automation_secret
    )
  );
end;
$$;

revoke all on function public.schedule_trade_automation_cron(text, text, text) from public;
revoke all on function public.schedule_trade_automation_cron(text, text, text) from anon;
revoke all on function public.schedule_trade_automation_cron(text, text, text) from authenticated;
grant execute on function public.schedule_trade_automation_cron(text, text, text) to service_role;

create or replace function public.guard_proposal_authenticated_update()
returns trigger
language plpgsql
as $$
begin
  if current_role <> 'authenticated' then
    return new;
  end if;

  if auth.uid() = old.client_id then
    if new.request_id is distinct from old.request_id
      or new.consultation_id is distinct from old.consultation_id
      or new.client_id is distinct from old.client_id
      or new.expert_id is distinct from old.expert_id
      or new.title is distinct from old.title
      or new.scope is distinct from old.scope
      or new.deliverables is distinct from old.deliverables
      or new.total_price is distinct from old.total_price
      or new.currency is distinct from old.currency
      or new.delivery_days is distinct from old.delivery_days
      or new.revision_count is distinct from old.revision_count
      or new.progress_type is distinct from old.progress_type
      or new.milestones is distinct from old.milestones
      or new.commercial_use_allowed is distinct from old.commercial_use_allowed
      or new.source_file_included is distinct from old.source_file_included
      or new.payment_status is distinct from old.payment_status
      or new.platform_fee_rate is distinct from old.platform_fee_rate
      or new.paid_at is distinct from old.paid_at
      or new.refunded_at is distinct from old.refunded_at
      or new.expires_at is distinct from old.expires_at
    then
      raise exception 'clients may only request revision or cancel unpaid proposals';
    end if;

    if old.payment_status <> 'unpaid' or new.status not in ('revision_requested', 'cancelled') then
      raise exception 'clients may only request revision or cancel unpaid proposals';
    end if;

    return new;
  end if;

  if auth.uid() = old.expert_id then
    if new.request_id is distinct from old.request_id
      or new.consultation_id is distinct from old.consultation_id
      or new.client_id is distinct from old.client_id
      or new.expert_id is distinct from old.expert_id
      or new.payment_status is distinct from old.payment_status
      or new.platform_fee_rate is distinct from old.platform_fee_rate
      or new.paid_at is distinct from old.paid_at
      or new.refunded_at is distinct from old.refunded_at
    then
      raise exception 'experts may not change proposal ownership or payment fields';
    end if;

    if old.payment_status <> 'unpaid' or new.payment_status <> 'unpaid' or new.status not in ('sent', 'cancelled') then
      raise exception 'experts may only edit unpaid draft/sent proposals';
    end if;

    return new;
  end if;

  raise exception 'proposal update is not allowed for this user';
end;
$$;

drop trigger if exists guard_proposal_authenticated_update on public.proposals;
create trigger guard_proposal_authenticated_update
  before update on public.proposals
  for each row execute function public.guard_proposal_authenticated_update();

drop policy if exists "Clients can update received proposals" on public.proposals;
drop policy if exists "Clients can update unpaid proposal decisions" on public.proposals;

drop policy if exists "Experts can update own unpaid proposals" on public.proposals;

create or replace function public.guard_work_authenticated_update()
returns trigger
language plpgsql
as $$
begin
  if current_role <> 'authenticated' then
    return new;
  end if;

  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if auth.uid() <> old.client_id and auth.uid() <> old.expert_id then
    raise exception 'work update is not allowed for this user';
  end if;

  if new.proposal_id is distinct from old.proposal_id
    or new.request_id is distinct from old.request_id
    or new.client_id is distinct from old.client_id
    or new.expert_id is distinct from old.expert_id
    or new.title is distinct from old.title
    or new.progress_type is distinct from old.progress_type
    or new.total_price is distinct from old.total_price
    or new.platform_fee is distinct from old.platform_fee
    or new.expert_payout is distinct from old.expert_payout
    or new.started_at is distinct from old.started_at
    or new.dispute_status is distinct from old.dispute_status
    or new.revision_limit is distinct from old.revision_limit
    or new.settlement_settled_at is distinct from old.settlement_settled_at
    or new.settlement_hold_reason is distinct from old.settlement_hold_reason
  then
    raise exception 'work ownership, money, dispute, and settlement result fields are server-managed';
  end if;

  if new.refund_status is distinct from old.refund_status
    and not (
      old.status not in ('completed', 'cancelled')
      and old.dispute_status is distinct from 'open'
      and old.cancellation_requested_by is not null
      and old.cancellation_requested_by <> auth.uid()
      and new.status = 'cancelled'
      and new.refund_status = 'fee_excluded_refund_pending'
      and new.cancellation_requested_by is null
      and new.cancellation_requested_at is null
      and new.cancelled_at is not null
    )
  then
    raise exception 'work refund fields are server-managed';
  end if;

  if new.status is not distinct from old.status
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not distinct from old.cancellation_reason
    and new.cancellation_requested_by is not distinct from old.cancellation_requested_by
    and new.cancellation_requested_at is not distinct from old.cancellation_requested_at
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if auth.uid() = old.expert_id
    and new.status = 'submitted'
    and old.dispute_status is distinct from 'open'
    and old.cancellation_requested_by is null
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not distinct from old.cancellation_reason
    and new.cancellation_requested_by is not distinct from old.cancellation_requested_by
    and new.cancellation_requested_at is not distinct from old.cancellation_requested_at
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if auth.uid() = old.expert_id
    and old.status = 'completed'
    and old.settlement_status = 'pending'
    and old.dispute_status is distinct from 'open'
    and old.settlement_hold_reason is null
    and new.status is not distinct from old.status
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not null
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not distinct from old.cancellation_reason
    and new.cancellation_requested_by is not distinct from old.cancellation_requested_by
    and new.cancellation_requested_at is not distinct from old.cancellation_requested_at
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if old.status not in ('completed', 'cancelled')
    and old.dispute_status is distinct from 'open'
    and old.cancellation_requested_by is null
    and new.status is not distinct from old.status
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not null
    and new.cancellation_requested_by = auth.uid()
    and new.cancellation_requested_at is not null
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if old.status not in ('completed', 'cancelled')
    and old.dispute_status is distinct from 'open'
    and old.cancellation_requested_by is not null
    and old.cancellation_requested_by <> auth.uid()
    and new.status = 'cancelled'
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status = 'fee_excluded_refund_pending'
    and new.cancellation_reason is not null
    and new.cancellation_requested_by is null
    and new.cancellation_requested_at is null
    and new.cancelled_at is not null
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if auth.uid() = old.client_id
    and old.status = 'submitted'
    and old.dispute_status is distinct from 'open'
    and old.cancellation_requested_by is null
    and new.status = 'completed'
    and new.settlement_status = 'pending'
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not distinct from old.cancellation_reason
    and new.cancellation_requested_by is null
    and new.cancellation_requested_at is null
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not null
    and new.revision_used is not distinct from old.revision_used
  then
    return new;
  end if;

  if auth.uid() = old.client_id
    and old.status = 'submitted'
    and old.dispute_status is distinct from 'open'
    and old.cancellation_requested_by is null
    and new.status = 'revision_requested'
    and new.settlement_status is not distinct from old.settlement_status
    and new.settlement_requested_at is not distinct from old.settlement_requested_at
    and new.refund_status is not distinct from old.refund_status
    and new.cancellation_reason is not distinct from old.cancellation_reason
    and new.cancellation_requested_by is not distinct from old.cancellation_requested_by
    and new.cancellation_requested_at is not distinct from old.cancellation_requested_at
    and new.cancelled_at is not distinct from old.cancelled_at
    and new.completed_at is not distinct from old.completed_at
    and new.revision_used = old.revision_used + 1
  then
    return new;
  end if;

  raise exception 'work update is not allowed for this participant action';
end;
$$;

drop trigger if exists guard_work_authenticated_update on public.works;
create trigger guard_work_authenticated_update
  before update on public.works
  for each row execute function public.guard_work_authenticated_update();

drop policy if exists "Accepted proposal participants can insert works" on public.works;
drop policy if exists "Work participants can update works" on public.works;
drop policy if exists "Work participants can update own work state" on public.works;

create or replace function public.guard_work_step_authenticated_update()
returns trigger
language plpgsql
as $$
begin
  if current_role <> 'authenticated' or public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.work_id is distinct from old.work_id
    or new.step_order is distinct from old.step_order
    or new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.submitted_at is distinct from old.submitted_at
    or new.approved_at is distinct from old.approved_at
    or new.revision_requested_at is distinct from old.revision_requested_at
    or new.revision_message is distinct from old.revision_message
    or new.created_at is distinct from old.created_at
  then
    raise exception 'work step review updates may only change status';
  end if;

  if new.status = 'submitted'
    and old.status in ('waiting', 'in_progress', 'revision_requested')
    and exists (
      select 1 from public.works
      where works.id = old.work_id
      and works.expert_id = auth.uid()
    )
  then
    return new;
  end if;

  if new.status in ('approved', 'revision_requested')
    and old.status = 'submitted'
    and exists (
      select 1 from public.works
      where works.id = old.work_id
      and works.client_id = auth.uid()
    )
  then
    return new;
  end if;

  raise exception 'work step status transition is not allowed';
end;
$$;

drop trigger if exists guard_work_step_authenticated_update on public.work_steps;
create trigger guard_work_step_authenticated_update
  before update on public.work_steps
  for each row execute function public.guard_work_step_authenticated_update();

drop policy if exists "Work participants can update work steps" on public.work_steps;
drop policy if exists "Experts can submit own work steps" on public.work_steps;
drop policy if exists "Clients can review work steps" on public.work_steps;

create or replace function public.guard_deliverable_authenticated_update()
returns trigger
language plpgsql
as $$
begin
  if current_role <> 'authenticated' or public.is_admin(auth.uid()) then
    return new;
  end if;

  if new.work_id is distinct from old.work_id
    or new.step_id is distinct from old.step_id
    or new.expert_id is distinct from old.expert_id
    or new.description is distinct from old.description
    or new.external_url is distinct from old.external_url
    or new.file_url is distinct from old.file_url
    or new.submitted_at is distinct from old.submitted_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'deliverable review updates may only change status';
  end if;

  if new.status in ('approved', 'revision_requested')
    and old.status = 'submitted'
    and exists (
      select 1 from public.works
      where works.id = old.work_id
      and works.client_id = auth.uid()
    )
  then
    return new;
  end if;

  raise exception 'deliverable status transition is not allowed';
end;
$$;

drop trigger if exists guard_deliverable_authenticated_update on public.deliverables;
create trigger guard_deliverable_authenticated_update
  before update on public.deliverables
  for each row execute function public.guard_deliverable_authenticated_update();

drop policy if exists "Work participants can update deliverables" on public.deliverables;
drop policy if exists "Clients can review deliverables" on public.deliverables;

drop policy if exists "Experts can insert settlement payouts" on public.settlement_payouts;
drop policy if exists "Experts can retry own settlement payouts" on public.settlement_payouts;
