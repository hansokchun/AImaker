create table if not exists public.financial_operations (
  id uuid primary key default gen_random_uuid(),
  business_key text not null,
  operation_type text not null check (operation_type in (
    'order_create', 'payment_confirm', 'payment_failure', 'refund',
    'settlement_request', 'settlement_finalize', 'admin_transition', 'work_transition', 'automation'
  )),
  state text not null default 'prepared' check (state in (
    'prepared', 'provider_pending', 'provider_succeeded', 'completed',
    'retry_required', 'manual_review', 'failed'
  )),
  payment_order_id uuid references public.payment_orders(id) on delete restrict,
  work_id uuid references public.works(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  amount integer check (amount is null or amount >= 0),
  currency text check (currency is null or currency = 'KRW'),
  provider_reference text,
  provider_status text,
  failure_code text,
  failure_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_key)
);
create table if not exists public.financial_provider_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_key text not null,
  event_type text not null,
  payment_order_id uuid references public.payment_orders(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'manual_review', 'failed')),
  failure_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_key)
);
create table if not exists public.financial_reconciliation_outbox (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.financial_operations(id) on delete restrict,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'resolved', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  last_error text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operation_id)
);
alter table public.settlement_payouts add column if not exists transfer_key text;
alter table public.settlement_payouts add column if not exists provider_transfer_reference text;
create unique index if not exists settlement_payouts_transfer_key_unique
  on public.settlement_payouts (transfer_key) where transfer_key is not null;
create unique index if not exists settlement_payouts_provider_transfer_reference_unique
  on public.settlement_payouts (provider_transfer_reference) where provider_transfer_reference is not null;
create index if not exists financial_operations_state_created_idx
  on public.financial_operations (state, created_at);
create index if not exists financial_operations_payment_order_idx
  on public.financial_operations (payment_order_id);
create unique index if not exists financial_operations_one_confirmation_per_order
  on public.financial_operations (payment_order_id)
  where operation_type = 'payment_confirm';
create index if not exists financial_operations_work_idx
  on public.financial_operations (work_id);
create index if not exists financial_provider_inbox_order_idx
  on public.financial_provider_inbox (payment_order_id, received_at);
create index if not exists financial_reconciliation_pending_idx
  on public.financial_reconciliation_outbox (status, available_at) where status = 'pending';
alter table public.financial_operations enable row level security;
alter table public.financial_provider_inbox enable row level security;
alter table public.financial_reconciliation_outbox enable row level security;
revoke all on table public.financial_operations from anon, authenticated;
revoke all on table public.financial_provider_inbox from anon, authenticated;
revoke all on table public.financial_reconciliation_outbox from anon, authenticated;
grant select, insert, update on table public.financial_operations to service_role;
grant select, insert, update on table public.financial_provider_inbox to service_role;
grant select, insert, update on table public.financial_reconciliation_outbox to service_role;
create or replace function public.begin_payment_order(
  p_proposal_id uuid,
  p_client_id uuid,
  p_order_id text,
  p_order_name text,
  p_platform_fee_rate numeric
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  proposal_row public.proposals%rowtype;
  order_row public.payment_orders%rowtype;
  operation_row public.financial_operations%rowtype;
  fee integer;
begin
  if p_order_id = '' or p_order_name = '' or p_platform_fee_rate < 0 or p_platform_fee_rate >= 1 then
    raise exception 'invalid payment order input' using errcode = '22023';
  end if;

  select * into proposal_row from public.proposals
  where id = p_proposal_id order by id for update;
  if not found then raise exception 'proposal not found' using errcode = 'P0002'; end if;
  if proposal_row.client_id <> p_client_id
    or proposal_row.currency <> 'KRW'
    or proposal_row.total_price <= 0
    or proposal_row.payment_status <> 'unpaid'
    or proposal_row.status not in ('sent', 'revision_requested')
    or proposal_row.expires_at <= now() then
    raise exception 'proposal is not payable' using errcode = 'P0001';
  end if;

  select * into order_row from public.payment_orders
  where proposal_id = p_proposal_id and status in ('ready', 'approved')
  order by created_at desc, id for update limit 1;
  if found and order_row.status = 'approved' then
    raise exception 'proposal already paid' using errcode = 'P0001';
  end if;
  if found and order_row.amount = proposal_row.total_price and order_row.currency = proposal_row.currency then
    return jsonb_build_object('kind', 'existing', 'orderId', order_row.order_id,
      'orderName', order_row.order_name, 'amount', order_row.amount, 'currency', order_row.currency);
  end if;
  if found then
    update public.payment_orders set status = 'failed', failure_code = 'STALE_ORDER_AMOUNT',
      failure_message = 'Proposal amount changed before confirmation'
    where id = order_row.id and status = 'ready';
  end if;

  fee := round(proposal_row.total_price * p_platform_fee_rate);
  insert into public.payment_orders (
    order_id, proposal_id, client_id, amount, currency, order_name,
    platform_fee_rate, platform_fee, expert_payout, status
  ) values (
    p_order_id, proposal_row.id, proposal_row.client_id, proposal_row.total_price,
    proposal_row.currency, p_order_name, p_platform_fee_rate, fee,
    proposal_row.total_price - fee, 'ready'
  ) returning * into order_row;

  insert into public.financial_operations (
    business_key, operation_type, state, payment_order_id, actor_id, amount, currency, completed_at
  ) values (
    'order:' || proposal_row.id::text || ':' || p_order_id, 'order_create', 'completed',
    order_row.id, p_client_id, order_row.amount, order_row.currency, now()
  ) returning * into operation_row;

  return jsonb_build_object('kind', 'created', 'operationId', operation_row.id,
    'orderId', order_row.order_id, 'orderName', order_row.order_name,
    'amount', order_row.amount, 'currency', order_row.currency);
end;
$$;
create or replace function public.begin_payment_confirmation(
  p_order_id text,
  p_client_id uuid,
  p_payment_key text,
  p_amount integer,
  p_currency text,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.payment_orders%rowtype;
  proposal_row public.proposals%rowtype;
  operation_row public.financial_operations%rowtype;
  work_row public.works%rowtype;
begin
  if p_currency <> 'KRW' or p_amount <= 0 or p_payment_key = '' or p_business_key = '' then
    raise exception 'invalid confirmation input' using errcode = '22023';
  end if;
  select * into order_row from public.payment_orders
  where order_id = p_order_id order by id for update;
  if not found then raise exception 'payment order not found' using errcode = 'P0002'; end if;
  select * into proposal_row from public.proposals
  where id = order_row.proposal_id order by id for update;
  if order_row.client_id <> p_client_id or proposal_row.client_id <> p_client_id
    or order_row.amount <> p_amount or proposal_row.total_price <> p_amount
    or order_row.currency <> p_currency or proposal_row.currency <> p_currency then
    raise exception 'payment ownership or amount mismatch' using errcode = 'P0001';
  end if;
  if order_row.status = 'approved' then
    if order_row.payment_key is distinct from p_payment_key then
      raise exception 'payment key mismatch' using errcode = 'P0001';
    end if;
    select * into work_row from public.works where proposal_id = proposal_row.id order by id for update limit 1;
    if proposal_row.payment_status = 'paid' and found then
      return jsonb_build_object('kind', 'completed', 'orderId', order_row.order_id,
        'proposalId', proposal_row.id, 'workId', work_row.id);
    end if;
    select * into operation_row from public.financial_operations
    where payment_order_id = order_row.id and operation_type = 'payment_confirm'
    order by id for update limit 1;
    if found then
      if operation_row.provider_reference is distinct from p_payment_key then
        raise exception 'payment repair key mismatch' using errcode = 'P0001';
      end if;
      update public.financial_operations set state = 'provider_succeeded', updated_at = now()
      where id = operation_row.id;
    else
      insert into public.financial_operations (
        business_key, operation_type, state, payment_order_id, actor_id, amount,
        currency, provider_reference, provider_status, attempt_count
      ) values (
        p_business_key, 'payment_confirm', 'provider_succeeded', order_row.id, p_client_id,
        p_amount, p_currency, p_payment_key, 'DONE', 1
      ) returning * into operation_row;
    end if;
    return jsonb_build_object('kind', 'provider_succeeded', 'operationId', operation_row.id,
      'orderId', order_row.order_id, 'amount', order_row.amount, 'currency', order_row.currency);
  end if;
  if order_row.status <> 'ready' or proposal_row.payment_status <> 'unpaid'
    or proposal_row.status not in ('sent', 'revision_requested') then
    raise exception 'payment is not confirmable' using errcode = 'P0001';
  end if;

  insert into public.financial_operations (
    business_key, operation_type, state, payment_order_id, actor_id, amount,
    currency, provider_reference, attempt_count
  ) values (
    p_business_key, 'payment_confirm', 'provider_pending', order_row.id, p_client_id,
    p_amount, p_currency, p_payment_key, 1
  ) on conflict (business_key) do update
    set attempt_count = public.financial_operations.attempt_count + 1,
        updated_at = now()
  returning * into operation_row;

  if operation_row.payment_order_id <> order_row.id or operation_row.amount <> p_amount
    or operation_row.currency <> p_currency or operation_row.provider_reference <> p_payment_key then
    raise exception 'idempotency key reused with different confirmation' using errcode = 'P0001';
  end if;
  return jsonb_build_object('kind', operation_row.state, 'operationId', operation_row.id,
    'orderId', order_row.order_id, 'amount', order_row.amount, 'currency', order_row.currency);
end;
$$;
create or replace function public.finalize_payment_confirmation(
  p_operation_id uuid,
  p_provider_status text,
  p_payment_key text,
  p_order_id text,
  p_amount integer,
  p_currency text,
  p_approved_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  operation_row public.financial_operations%rowtype;
  order_row public.payment_orders%rowtype;
  proposal_row public.proposals%rowtype;
  work_row public.works%rowtype;
  affected_rows integer;
begin
  select * into operation_row from public.financial_operations
  where id = p_operation_id order by id for update;
  if not found or operation_row.operation_type <> 'payment_confirm' then
    raise exception 'confirmation operation not found' using errcode = 'P0002';
  end if;
  select * into order_row from public.payment_orders
  where id = operation_row.payment_order_id order by id for update;
  select * into proposal_row from public.proposals
  where id = order_row.proposal_id order by id for update;

  if p_provider_status <> 'DONE' or p_payment_key <> operation_row.provider_reference
    or p_order_id <> order_row.order_id or p_amount <> order_row.amount
    or p_currency <> order_row.currency or p_currency <> 'KRW' then
    update public.financial_operations set state = 'manual_review', provider_status = p_provider_status,
      failure_code = 'PROVIDER_CONFIRMATION_MISMATCH', failure_message = 'Provider response mismatched locked order'
    where id = operation_row.id;
    insert into public.financial_reconciliation_outbox (operation_id, reason)
      values (operation_row.id, 'provider_confirmation_mismatch') on conflict (operation_id) do nothing;
    return jsonb_build_object('kind', 'manual_review', 'operationId', operation_row.id);
  end if;
  if operation_row.state = 'completed' and order_row.status = 'approved' then
    select * into work_row from public.works where proposal_id = proposal_row.id order by id for update limit 1;
    if found and proposal_row.payment_status = 'paid' then
      return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
        'proposalId', proposal_row.id, 'workId', work_row.id);
    end if;
    update public.financial_operations set state = 'provider_succeeded', updated_at = now()
    where id = operation_row.id;
    operation_row.state := 'provider_succeeded';
  end if;
  if operation_row.state not in ('provider_pending', 'provider_succeeded', 'retry_required')
    or order_row.status not in ('ready', 'approved')
    or proposal_row.payment_status not in ('unpaid', 'paid') then
    raise exception 'terminal payment state cannot transition' using errcode = 'P0001';
  end if;

  update public.financial_operations set state = 'provider_succeeded', provider_status = p_provider_status,
    updated_at = now() where id = operation_row.id;
  update public.payment_orders set status = 'approved', payment_key = p_payment_key,
    approved_at = coalesce(p_approved_at, now()), failure_code = null, failure_message = null
  where id = order_row.id and status in ('ready', 'approved');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'payment order transition affected_rows mismatch'; end if;
  update public.proposals set status = 'accepted', payment_status = 'paid',
    platform_fee_rate = order_row.platform_fee_rate, paid_at = coalesce(p_approved_at, now())
  where id = proposal_row.id and payment_status in ('unpaid', 'paid');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'proposal transition affected_rows mismatch'; end if;

  insert into public.works (
    proposal_id, request_id, client_id, expert_id, title, progress_type, status,
    total_price, platform_fee, expert_payout, settlement_status, revision_limit, revision_used
  ) values (
    proposal_row.id, proposal_row.request_id, proposal_row.client_id, proposal_row.expert_id,
    proposal_row.title, proposal_row.progress_type, 'in_progress', proposal_row.total_price,
    order_row.platform_fee, order_row.expert_payout, 'held', proposal_row.revision_count, 0
  ) on conflict (proposal_id) do update set proposal_id = excluded.proposal_id
  returning * into work_row;

  insert into public.work_steps (work_id, step_order, title, description, status)
  select work_row.id, source.step_order, source.title, 'Payment confirmed work step',
    case when source.step_order = 1 then 'in_progress' else 'waiting' end
  from (
    select milestone.ordinality::integer as step_order, milestone.title
    from jsonb_array_elements_text(proposal_row.milestones) with ordinality as milestone(title, ordinality)
    where proposal_row.progress_type = 'milestone' and jsonb_array_length(proposal_row.milestones) > 0
    union all
    select 1, proposal_row.title
    where proposal_row.progress_type <> 'milestone' or jsonb_array_length(proposal_row.milestones) = 0
  ) source
  on conflict (work_id, step_order) do nothing;
  if proposal_row.request_id is not null then
    update public.service_requests set status = 'in_progress'
    where id = proposal_row.request_id and status in ('submitted', 'in_progress');
  end if;
  insert into public.notification_events (
    user_id, event_type, title, body, channels, status, related_type, related_id
  ) values
    (proposal_row.client_id, 'payment_completed', 'Payment completed', proposal_row.title,
      array['in_app']::text[], 'queued', 'work', work_row.id::text),
    (proposal_row.expert_id, 'workroom_created', 'Workroom created', proposal_row.title,
      array['in_app']::text[], 'queued', 'work', work_row.id::text);

  update public.financial_operations set state = 'completed', completed_at = now(), updated_at = now()
  where id = operation_row.id;
  update public.financial_reconciliation_outbox set status = 'resolved', resolved_at = now(),
    updated_at = now() where operation_id = operation_row.id and status in ('pending', 'processing');
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
    'proposalId', proposal_row.id, 'workId', work_row.id);
end;
$$;
create or replace function public.record_payment_failure(
  p_order_id text,
  p_client_id uuid,
  p_failure_code text,
  p_failure_message text,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.payment_orders%rowtype;
  operation_row public.financial_operations%rowtype;
  affected_rows integer;
begin
  select * into order_row from public.payment_orders where order_id = p_order_id order by id for update;
  if not found then raise exception 'payment order not found' using errcode = 'P0002'; end if;
  if order_row.client_id <> p_client_id then raise exception 'payment owner mismatch' using errcode = 'P0001'; end if;
  if order_row.status in ('approved', 'refunded') then
    return jsonb_build_object('kind', 'skipped', 'status', order_row.status);
  end if;
  insert into public.financial_operations (
    business_key, operation_type, state, payment_order_id, actor_id, amount, currency,
    failure_code, failure_message, completed_at
  ) values (
    p_business_key, 'payment_failure', 'completed', order_row.id, p_client_id,
    order_row.amount, order_row.currency, left(p_failure_code, 100), left(p_failure_message, 500), now()
  ) on conflict (business_key) do update set updated_at = now() returning * into operation_row;
  update public.payment_orders set status = 'failed', failure_code = left(p_failure_code, 100),
    failure_message = left(p_failure_message, 500)
  where id = order_row.id and status = 'ready';
  get diagnostics affected_rows = row_count;
  return jsonb_build_object('kind', case when affected_rows = 1 then 'completed' else 'skipped' end,
    'operationId', operation_row.id, 'affected_rows', affected_rows);
end;
$$;
create or replace function public.record_provider_event(
  p_provider text,
  p_provider_event_key text,
  p_event_type text,
  p_order_id text,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.payment_orders%rowtype;
  inbox_row public.financial_provider_inbox%rowtype;
begin
  select * into order_row from public.payment_orders where order_id = p_order_id order by id for update;
  if not found then raise exception 'payment order not found' using errcode = 'P0002'; end if;
  insert into public.financial_provider_inbox (
    provider, provider_event_key, event_type, payment_order_id, payload
  ) values (p_provider, p_provider_event_key, p_event_type, order_row.id, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, provider_event_key) do update set provider_event_key = excluded.provider_event_key
  returning * into inbox_row;
  if inbox_row.payment_order_id <> order_row.id then
    raise exception 'provider event key reused across payment orders' using errcode = 'P0001';
  end if;
  return jsonb_build_object('kind', case when inbox_row.status = 'received' then 'received' else 'duplicate' end,
    'inboxId', inbox_row.id, 'status', inbox_row.status, 'clientId', order_row.client_id,
    'amount', order_row.amount, 'currency', order_row.currency);
end;
$$;
create or replace function public.apply_provider_event_result(
  p_inbox_id uuid,
  p_status text,
  p_failure_message text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare affected_rows integer;
begin
  if p_status not in ('processed', 'ignored', 'manual_review', 'failed') then
    raise exception 'invalid inbox result' using errcode = '22023';
  end if;
  update public.financial_provider_inbox set status = p_status,
    failure_message = nullif(left(coalesce(p_failure_message, ''), 500), ''), processed_at = now()
  where id = p_inbox_id and status = 'received';
  get diagnostics affected_rows = row_count;
  return jsonb_build_object('kind', case when affected_rows = 1 then 'completed' else 'skipped' end,
    'affected_rows', affected_rows);
end;
$$;
create or replace function public.begin_payment_refund(
  p_work_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_policy_authorized boolean,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
  order_row public.payment_orders%rowtype;
  operation_row public.financial_operations%rowtype;
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_id) then
    raise exception 'admin required' using errcode = '42501';
  end if;
  select * into work_row from public.works where id = p_work_id order by id for update;
  if not found then raise exception 'work not found' using errcode = 'P0002'; end if;
  select * into order_row from public.payment_orders
  where proposal_id = work_row.proposal_id and status in ('approved', 'refunded')
  order by id for update limit 1;
  if not found then raise exception 'approved payment not found' using errcode = 'P0002'; end if;
  if work_row.settlement_status = 'settled' then raise exception 'settled work cannot be refunded' using errcode = 'P0001'; end if;
  if order_row.status = 'refunded' and work_row.refund_status = 'refunded' then
    select * into operation_row from public.financial_operations
    where operation_type = 'refund' and work_id = work_row.id and state = 'completed'
    order by completed_at desc nulls last, id limit 1;
    return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id, 'workId', work_row.id);
  end if;
  if work_row.refund_status <> 'fee_excluded_refund_pending' then
    raise exception 'work is not pending refund' using errcode = 'P0001';
  end if;
  insert into public.financial_operations (
    business_key, operation_type, state, payment_order_id, work_id, actor_id,
    amount, currency, provider_reference, failure_code, failure_message, attempt_count
  ) values (
    p_business_key, 'refund', case when p_policy_authorized then 'provider_pending' else 'manual_review' end,
    order_row.id, work_row.id, p_actor_id, order_row.amount, order_row.currency,
    order_row.payment_key, case when p_policy_authorized then null else 'G1_PENDING' end,
    case when p_policy_authorized then null else 'Commercial/refund matrix is not approved' end,
    case when p_policy_authorized then 1 else 0 end
  ) on conflict (business_key) do update set
    attempt_count = public.financial_operations.attempt_count + case when p_policy_authorized then 1 else 0 end,
    state = case
      when p_policy_authorized
        and public.financial_operations.state = 'manual_review'
        and public.financial_operations.failure_code = 'G1_PENDING' then 'provider_pending'
      else public.financial_operations.state
    end,
    failure_code = case when p_policy_authorized and public.financial_operations.failure_code = 'G1_PENDING' then null else public.financial_operations.failure_code end,
    failure_message = case when p_policy_authorized and public.financial_operations.failure_code = 'G1_PENDING' then null else public.financial_operations.failure_message end,
    updated_at = now()
  returning * into operation_row;
  if operation_row.work_id <> work_row.id then raise exception 'refund idempotency key reused' using errcode = 'P0001'; end if;
  if not p_policy_authorized then
    insert into public.financial_reconciliation_outbox (operation_id, reason)
      values (operation_row.id, 'refund_policy_gate_pending') on conflict (operation_id) do nothing;
  else
    update public.financial_reconciliation_outbox set status = 'resolved', resolved_at = now(),
      updated_at = now() where operation_id = operation_row.id
      and reason = 'refund_policy_gate_pending' and status in ('pending', 'processing');
  end if;
  return jsonb_build_object('kind', operation_row.state, 'operationId', operation_row.id,
    'paymentKey', order_row.payment_key, 'amount', order_row.amount,
    'currency', order_row.currency, 'reason', left(p_reason, 200));
end;
$$;
create or replace function public.finalize_payment_refund(
  p_operation_id uuid,
  p_provider_status text,
  p_cancelled_at timestamptz,
  p_reason text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  operation_row public.financial_operations%rowtype;
  order_row public.payment_orders%rowtype;
  work_row public.works%rowtype;
  affected_rows integer;
begin
  select * into operation_row from public.financial_operations where id = p_operation_id order by id for update;
  if not found or operation_row.operation_type <> 'refund' then raise exception 'refund operation not found'; end if;
  select * into order_row from public.payment_orders where id = operation_row.payment_order_id order by id for update;
  select * into work_row from public.works where id = operation_row.work_id order by id for update;
  if operation_row.state = 'completed' then return jsonb_build_object('kind', 'completed', 'workId', work_row.id); end if;
  if p_provider_status = 'PARTIAL_CANCELED' or p_provider_status <> 'CANCELED' then
    update public.financial_operations set state = 'manual_review', provider_status = p_provider_status,
      failure_code = 'REFUND_PROVIDER_STATE_UNKNOWN', failure_message = 'Partial or unknown cancellation requires review'
    where id = operation_row.id;
    insert into public.financial_reconciliation_outbox (operation_id, reason)
      values (operation_row.id, 'partial_or_unknown_refund') on conflict (operation_id) do nothing;
    return jsonb_build_object('kind', 'manual_review', 'operationId', operation_row.id);
  end if;
  if operation_row.state not in ('provider_pending', 'provider_succeeded', 'retry_required')
    or order_row.status <> 'approved' or work_row.refund_status <> 'fee_excluded_refund_pending' then
    raise exception 'terminal refund state cannot transition' using errcode = 'P0001';
  end if;
  update public.payment_orders set status = 'refunded', cancel_reason = left(p_reason, 200),
    cancelled_at = coalesce(p_cancelled_at, now()), failure_code = null, failure_message = null
  where id = order_row.id and status = 'approved';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'refund payment affected_rows mismatch'; end if;
  update public.proposals set payment_status = 'refunded', refunded_at = coalesce(p_cancelled_at, now())
  where id = order_row.proposal_id and payment_status = 'paid';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'refund proposal affected_rows mismatch'; end if;
  update public.works set settlement_status = 'refunded', refund_status = 'refunded',
    cancelled_at = coalesce(p_cancelled_at, now())
  where id = work_row.id and settlement_status <> 'settled' and refund_status = 'fee_excluded_refund_pending';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'refund work affected_rows mismatch'; end if;
  update public.financial_operations set state = 'completed', provider_status = p_provider_status,
    completed_at = now(), updated_at = now() where id = operation_row.id;
  update public.financial_reconciliation_outbox set status = 'resolved', resolved_at = now(),
    updated_at = now() where operation_id = operation_row.id and status in ('pending', 'processing');
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
    'workId', work_row.id, 'proposalId', order_row.proposal_id);
end;
$$;
create or replace function public.record_financial_reconciliation(
  p_operation_id uuid,
  p_reason text,
  p_failure_code text,
  p_failure_message text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare operation_row public.financial_operations%rowtype;
begin
  select * into operation_row from public.financial_operations
  where id = p_operation_id order by id for update;
  if not found then raise exception 'financial operation not found' using errcode = 'P0002'; end if;
  if operation_row.state = 'completed' then
    return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id);
  end if;
  update public.financial_operations set state = 'retry_required',
    failure_code = left(coalesce(p_failure_code, 'FINALIZE_FAILED'), 100),
    failure_message = left(coalesce(p_failure_message, 'Financial finalization failed'), 500),
    updated_at = now() where id = operation_row.id;
  insert into public.financial_reconciliation_outbox (operation_id, reason, last_error)
    values (operation_row.id, left(p_reason, 200), left(p_failure_message, 500))
    on conflict (operation_id) do update set reason = excluded.reason,
      last_error = excluded.last_error, status = 'pending', available_at = now(), updated_at = now();
  return jsonb_build_object('kind', 'retry_required', 'operationId', operation_row.id);
end;
$$;
create or replace function public.begin_settlement_request(
  p_work_id uuid,
  p_expert_id uuid,
  p_policy_authorized boolean,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
  account_row public.expert_payout_accounts%rowtype;
  payout_row public.settlement_payouts%rowtype;
  operation_row public.financial_operations%rowtype;
begin
  if not p_policy_authorized then raise exception 'payment policy approval required' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_expert_id and account_status = 'active' and withdrawn_at is null
  ) then raise exception 'active expert account required' using errcode = '42501'; end if;
  select * into work_row from public.works where id = p_work_id order by id for update;
  if not found or work_row.expert_id <> p_expert_id then raise exception 'settlement owner mismatch' using errcode = 'P0001'; end if;
  select * into account_row from public.expert_payout_accounts
  where expert_id = p_expert_id order by id for update limit 1;
  if not found then raise exception 'payout account required' using errcode = 'P0002'; end if;
  if work_row.settlement_requested_at is not null then
    select * into operation_row from public.financial_operations
    where business_key = p_business_key and operation_type = 'settlement_request'
    order by id for update;
    select * into payout_row from public.settlement_payouts where work_id = work_row.id order by id for update;
    if operation_row.id is null or payout_row.id is null or operation_row.work_id <> work_row.id
      or payout_row.expert_id <> p_expert_id or payout_row.amount <> work_row.expert_payout then
      raise exception 'settlement replay invariant mismatch' using errcode = 'P0001';
    end if;
    if operation_row.state = 'failed' and payout_row.status = 'failed' then
      update public.financial_operations set state = 'prepared', failure_code = null,
        failure_message = null, updated_at = now() where id = operation_row.id;
      update public.settlement_payouts set status = 'queued', failure_reason = null,
        processed_at = null, updated_at = now() where id = payout_row.id;
      operation_row.state := 'prepared';
    end if;
    return jsonb_build_object('kind', operation_row.state, 'operationId', operation_row.id,
      'workId', work_row.id, 'payoutId', payout_row.id, 'amount', payout_row.amount,
      'transferKey', payout_row.transfer_key);
  end if;
  if work_row.status <> 'completed' or work_row.settlement_status <> 'pending'
    or work_row.dispute_status = 'open' or work_row.settlement_hold_reason is not null
    or work_row.settlement_requested_at is not null
    or work_row.expert_payout <= 0 then
    raise exception 'work is not settlement ready' using errcode = 'P0001';
  end if;
  insert into public.financial_operations (
    business_key, operation_type, state, work_id, actor_id, amount, currency
  ) values (p_business_key, 'settlement_request', 'prepared', work_row.id, p_expert_id,
    work_row.expert_payout, 'KRW')
  on conflict (business_key) do update set updated_at = now() returning * into operation_row;
  insert into public.settlement_payouts (
    work_id, expert_id, payout_account_id, amount, status, requested_at, transfer_key,
    failure_reason, processed_at
  ) values (
    work_row.id, p_expert_id, account_row.id, work_row.expert_payout, 'queued', now(),
    'settlement:' || work_row.id::text, null, null
  ) on conflict (work_id) do update set
    payout_account_id = case when public.settlement_payouts.status in ('queued', 'failed') then excluded.payout_account_id else public.settlement_payouts.payout_account_id end,
    amount = case when public.settlement_payouts.status in ('queued', 'failed') then excluded.amount else public.settlement_payouts.amount end,
    status = case when public.settlement_payouts.status = 'failed' then 'queued' else public.settlement_payouts.status end,
    failure_reason = case when public.settlement_payouts.status = 'failed' then null else public.settlement_payouts.failure_reason end,
    updated_at = now()
  returning * into payout_row;
  if payout_row.expert_id <> p_expert_id or payout_row.amount <> work_row.expert_payout then
    raise exception 'settlement payout invariant mismatch' using errcode = 'P0001';
  end if;
  update public.works set settlement_requested_at = coalesce(settlement_requested_at, now())
  where id = work_row.id;
  return jsonb_build_object('kind', 'prepared', 'operationId', operation_row.id,
    'workId', work_row.id, 'payoutId', payout_row.id, 'amount', payout_row.amount,
    'transferKey', payout_row.transfer_key);
end;
$$;
create or replace function public.finalize_settlement_payout(
  p_operation_id uuid,
  p_payout_id uuid,
  p_payout_account_id uuid,
  p_amount integer,
  p_provider_status text,
  p_provider_transfer_reference text,
  p_policy_authorized boolean
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  operation_row public.financial_operations%rowtype;
  payout_row public.settlement_payouts%rowtype;
  work_row public.works%rowtype;
  account_row public.expert_payout_accounts%rowtype;
  affected_rows integer;
begin
  if not p_policy_authorized then raise exception 'payment policy approval required' using errcode = 'P0001'; end if;
  if p_amount <= 0 or nullif(trim(p_provider_transfer_reference), '') is null then
    raise exception 'provider payout evidence required' using errcode = '22023';
  end if;
  select * into operation_row from public.financial_operations where id = p_operation_id order by id for update;
  if not found or operation_row.operation_type <> 'settlement_request' then
    raise exception 'settlement operation not found' using errcode = 'P0002';
  end if;
  select * into payout_row from public.settlement_payouts where id = p_payout_id order by id for update;
  if not found then raise exception 'settlement payout not found' using errcode = 'P0002'; end if;
  select * into work_row from public.works where id = payout_row.work_id order by id for update;
  if not found then raise exception 'settlement work not found' using errcode = 'P0002'; end if;
  select * into account_row from public.expert_payout_accounts where id = payout_row.payout_account_id order by id for update;
  if not found or payout_row.payout_account_id is null then
    raise exception 'settlement payout account not found' using errcode = 'P0002';
  end if;
  if operation_row.work_id <> work_row.id or payout_row.payout_account_id <> p_payout_account_id
    or account_row.expert_id <> payout_row.expert_id or account_row.expert_id <> work_row.expert_id
    or operation_row.amount <> p_amount or payout_row.amount <> p_amount or work_row.expert_payout <> p_amount
    or work_row.settlement_requested_at is null then
    raise exception 'settlement payout invariant mismatch' using errcode = 'P0001';
  end if;
  if operation_row.state = 'completed' and payout_row.status = 'paid' then
    if payout_row.provider_transfer_reference <> p_provider_transfer_reference then
      raise exception 'settlement transfer reference mismatch' using errcode = 'P0001';
    end if;
    return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id, 'payoutId', payout_row.id);
  end if;
  if p_provider_status <> 'SUCCEEDED' then
    update public.financial_operations set state = case when p_provider_status in ('FAILED', 'REJECTED') then 'failed' else 'manual_review' end,
      provider_status = left(p_provider_status, 100), failure_code = 'PAYOUT_PROVIDER_NOT_SUCCEEDED',
      failure_message = 'Payout provider did not return a recognized success state', updated_at = now()
    where id = operation_row.id;
    update public.settlement_payouts set status = case when p_provider_status in ('FAILED', 'REJECTED') then 'failed' else 'processing' end,
      failure_reason = 'Payout provider did not return a recognized success state', updated_at = now()
    where id = payout_row.id;
    if p_provider_status not in ('FAILED', 'REJECTED') then
      insert into public.financial_reconciliation_outbox (operation_id, reason)
        values (operation_row.id, 'unknown_settlement_provider_status') on conflict (operation_id) do nothing;
    end if;
    return jsonb_build_object('kind', case when p_provider_status in ('FAILED', 'REJECTED') then 'failed' else 'manual_review' end,
      'operationId', operation_row.id, 'payoutId', payout_row.id);
  end if;
  if operation_row.state not in ('prepared', 'provider_pending', 'provider_succeeded', 'retry_required')
    or payout_row.status not in ('queued', 'processing') or work_row.settlement_status <> 'pending'
    or work_row.refund_status is not null or work_row.dispute_status = 'open'
    or work_row.settlement_hold_reason is not null then
    raise exception 'settlement payout is not finalizable' using errcode = 'P0001';
  end if;
  update public.settlement_payouts set status = 'paid', processed_at = now(),
    provider_transfer_reference = p_provider_transfer_reference, failure_reason = null, updated_at = now()
  where id = payout_row.id and status in ('queued', 'processing');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'settlement payout affected_rows mismatch'; end if;
  update public.works set settlement_status = 'settled', settlement_hold_reason = null,
    settlement_settled_at = now() where id = work_row.id and settlement_status = 'pending';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'settlement work affected_rows mismatch'; end if;
  update public.financial_operations set state = 'completed', provider_status = p_provider_status,
    provider_reference = p_provider_transfer_reference, completed_at = now(), updated_at = now()
  where id = operation_row.id;
  update public.financial_reconciliation_outbox set status = 'resolved', resolved_at = now(),
    updated_at = now() where operation_id = operation_row.id and status in ('pending', 'processing');
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
    'workId', work_row.id, 'payoutId', payout_row.id);
end;
$$;
create or replace function public.apply_admin_financial_transition(
  p_work_id uuid,
  p_admin_id uuid,
  p_action text,
  p_reason text,
  p_policy_authorized boolean,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
  payout_row public.settlement_payouts%rowtype;
  operation_row public.financial_operations%rowtype;
  affected_rows integer;
begin
  if not p_policy_authorized then raise exception 'payment policy approval required' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.admin_users where user_id = p_admin_id) then
    raise exception 'admin required' using errcode = '42501';
  end if;
  select * into work_row from public.works where id = p_work_id order by id for update;
  if not found then raise exception 'work not found' using errcode = 'P0002'; end if;
  select * into payout_row from public.settlement_payouts where work_id = p_work_id order by id for update;
  insert into public.financial_operations (
    business_key, operation_type, state, work_id, actor_id, amount, currency, metadata
  ) values (p_business_key, 'admin_transition', 'prepared', work_row.id, p_admin_id,
    work_row.expert_payout, 'KRW', jsonb_build_object('action', p_action, 'reason', p_reason))
  on conflict (business_key) do update set updated_at = now() returning * into operation_row;
  if operation_row.state = 'completed' then return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id); end if;

  if p_action = 'mark_settlement_pending' then
    if work_row.settlement_status in ('settled', 'refunded') then raise exception 'terminal settlement cannot reopen'; end if;
    update public.works set settlement_status = 'pending', settlement_hold_reason = null where id = work_row.id;
  elsif p_action = 'mark_settlement_settled' then
    raise exception 'provider payout evidence required; use finalize_settlement_payout' using errcode = 'P0001';
  elsif p_action = 'hold_settlement' then
    if work_row.settlement_status in ('settled', 'refunded') then raise exception 'terminal settlement cannot be held'; end if;
    update public.works set settlement_status = 'pending', settlement_hold_reason = left(p_reason, 500) where id = work_row.id;
  elsif p_action in ('cancel_trade', 'mark_refund_pending') then
    if work_row.settlement_status = 'settled' or work_row.refund_status = 'refunded' then
      raise exception 'terminal money state cannot enter refund pending';
    end if;
    update public.works set status = case when p_action = 'cancel_trade' then 'cancelled' else status end,
      refund_status = 'fee_excluded_refund_pending', cancellation_reason = case when p_action = 'cancel_trade' then 'mutual_after_start' else cancellation_reason end,
      cancelled_at = case when p_action = 'cancel_trade' then now() else cancelled_at end
    where id = work_row.id;
  else
    raise exception 'unsupported financial admin action' using errcode = '22023';
  end if;
  insert into public.admin_actions (admin_id, target_type, target_id, action_type, reason)
  values (p_admin_id, 'work', p_work_id::text, p_action, p_reason);
  update public.financial_operations set state = 'completed', completed_at = now(), updated_at = now()
  where id = operation_row.id;
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id, 'workId', work_row.id);
end;
$$;
create or replace function public.apply_work_cancellation(
  p_work_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_accept boolean,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
  operation_row public.financial_operations%rowtype;
begin
  select * into work_row from public.works where id = p_work_id order by id for update;
  if not found or p_actor_id not in (work_row.client_id, work_row.expert_id) then
    raise exception 'work participant required' using errcode = '42501';
  end if;
  select * into operation_row from public.financial_operations
  where business_key = p_business_key and operation_type = 'work_transition'
    and work_id = work_row.id and actor_id = p_actor_id
  order by id for update;
  if found and operation_row.state = 'completed' then
    if operation_row.metadata ->> 'action' <> 'cancellation'
      or (operation_row.metadata ->> 'accept')::boolean <> p_accept then
      raise exception 'cancellation idempotency key reused' using errcode = 'P0001';
    end if;
    return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id, 'workId', work_row.id);
  end if;
  if work_row.status in ('completed', 'cancelled') or work_row.dispute_status = 'open' then
    raise exception 'work cannot be cancelled' using errcode = 'P0001';
  end if;
  insert into public.financial_operations (
    business_key, operation_type, state, work_id, actor_id, amount, currency, metadata
  ) values (p_business_key, 'work_transition', 'prepared', work_row.id, p_actor_id,
    work_row.total_price, 'KRW', jsonb_build_object('action', 'cancellation', 'accept', p_accept))
  on conflict (business_key) do update set updated_at = now() returning * into operation_row;
  if operation_row.state = 'completed' then return jsonb_build_object('kind', 'completed', 'workId', work_row.id); end if;
  if p_accept then
    if work_row.cancellation_requested_by is null or work_row.cancellation_requested_by = p_actor_id then
      raise exception 'opposing cancellation request required' using errcode = 'P0001';
    end if;
    update public.works set status = 'cancelled', refund_status = 'fee_excluded_refund_pending',
      cancellation_requested_by = null, cancellation_requested_at = null, cancelled_at = now()
    where id = work_row.id and status not in ('completed', 'cancelled');
  else
    if nullif(trim(p_reason), '') is null or work_row.cancellation_requested_by is not null then
      raise exception 'new cancellation reason required' using errcode = 'P0001';
    end if;
    update public.works set cancellation_reason = case
        when work_row.status = 'in_progress' then 'before_start'
        else 'mutual_after_start'
      end,
      cancellation_requested_by = p_actor_id, cancellation_requested_at = now()
    where id = work_row.id and cancellation_requested_by is null;
  end if;
  if not found then raise exception 'cancellation affected_rows mismatch'; end if;
  update public.financial_operations set state = 'completed', completed_at = now(), updated_at = now()
  where id = operation_row.id;
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id, 'workId', work_row.id);
end;
$$;
create or replace function public.apply_deliverable_review(
  p_work_id uuid,
  p_deliverable_id uuid,
  p_client_id uuid,
  p_approved boolean,
  p_business_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  work_row public.works%rowtype;
  deliverable_row public.deliverables%rowtype;
  operation_row public.financial_operations%rowtype;
  next_status text;
begin
  select * into work_row from public.works where id = p_work_id order by id for update;
  if not found or work_row.client_id <> p_client_id then
    raise exception 'work is not reviewable' using errcode = 'P0001';
  end if;
  select * into operation_row from public.financial_operations
  where business_key = p_business_key and operation_type = 'work_transition'
    and work_id = work_row.id and actor_id = p_client_id
  order by id for update;
  if found and operation_row.state = 'completed' then
    if operation_row.metadata ->> 'action' <> 'deliverable_review'
      or (operation_row.metadata ->> 'approved')::boolean <> p_approved then
      raise exception 'review idempotency key reused' using errcode = 'P0001';
    end if;
    return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
      'workId', work_row.id, 'deliverableId', p_deliverable_id);
  end if;
  if work_row.status <> 'submitted' or work_row.dispute_status = 'open'
    or work_row.cancellation_requested_at is not null then
    raise exception 'work is not reviewable' using errcode = 'P0001';
  end if;
  select * into deliverable_row from public.deliverables
  where id = p_deliverable_id and work_id = p_work_id order by id for update;
  if not found or deliverable_row.status <> 'submitted' then raise exception 'deliverable is not reviewable'; end if;
  if not p_approved and work_row.revision_limit > 0 and work_row.revision_used >= work_row.revision_limit then
    raise exception 'revision limit exceeded' using errcode = 'P0001';
  end if;
  insert into public.financial_operations (
    business_key, operation_type, state, work_id, actor_id, amount, currency, metadata
  ) values (p_business_key, 'work_transition', 'prepared', work_row.id, p_client_id,
    work_row.total_price, 'KRW', jsonb_build_object('action', 'deliverable_review', 'approved', p_approved))
  on conflict (business_key) do update set updated_at = now() returning * into operation_row;
  if operation_row.state = 'completed' then return jsonb_build_object('kind', 'completed', 'workId', work_row.id); end if;
  next_status := case when p_approved then 'approved' else 'revision_requested' end;
  update public.deliverables set status = next_status where id = deliverable_row.id and status = 'submitted';
  if not found then raise exception 'deliverable affected_rows mismatch'; end if;
  if deliverable_row.step_id is not null then
    update public.work_steps set status = next_status where id = deliverable_row.step_id and work_id = work_row.id;
    if not found then raise exception 'work step affected_rows mismatch'; end if;
  end if;
  if p_approved then
    update public.works set status = 'completed', settlement_status = 'pending', completed_at = now()
    where id = work_row.id and status = 'submitted' and settlement_status = 'held';
  else
    update public.works set status = 'revision_requested', revision_used = revision_used + 1
    where id = work_row.id and status = 'submitted';
  end if;
  if not found then raise exception 'work review affected_rows mismatch'; end if;
  if p_approved and work_row.request_id is not null then
    update public.service_requests set status = 'completed' where id = work_row.request_id;
  end if;
  update public.financial_operations set state = 'completed', completed_at = now(), updated_at = now()
  where id = operation_row.id;
  return jsonb_build_object('kind', 'completed', 'operationId', operation_row.id,
    'workId', work_row.id, 'deliverableId', deliverable_row.id);
end;
$$;
create or replace function public.claim_due_trade_automation(
  p_auto_cancel_before timestamptz,
  p_auto_confirm_before timestamptz,
  p_batch_size integer,
  p_run_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate record;
  run_operation public.financial_operations%rowtype;
  attempted integer := 0;
  succeeded integer := 0;
  skipped integer := 0;
  failed integer := 0;
  auto_cancelled integer := 0;
  auto_confirmed integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 100 then raise exception 'invalid batch size'; end if;
  insert into public.financial_operations (business_key, operation_type, state, metadata)
  values (p_run_key, 'automation', 'prepared', jsonb_build_object('batchSize', p_batch_size))
  on conflict (business_key) do nothing returning * into run_operation;
  if run_operation.id is null then
    select * into run_operation from public.financial_operations
    where business_key = p_run_key and operation_type = 'automation'
    order by id for update;
    if not found then raise exception 'automation operation not found' using errcode = 'P0002'; end if;
    return jsonb_build_object(
      'attempted', coalesce((run_operation.metadata ->> 'attempted')::integer, 0),
      'succeeded', coalesce((run_operation.metadata ->> 'succeeded')::integer, 0),
      'skipped', coalesce((run_operation.metadata ->> 'skipped')::integer, 0),
      'failed', coalesce((run_operation.metadata ->> 'failed')::integer, 0),
      'autoCancelled', coalesce((run_operation.metadata ->> 'autoCancelled')::integer, 0),
      'autoConfirmed', coalesce((run_operation.metadata ->> 'autoConfirmed')::integer, 0),
      'duplicate', true
    );
  end if;

  for candidate in
    select id, request_id from public.works
    where cancellation_requested_at <= p_auto_cancel_before
      and cancellation_requested_by is not null and status not in ('completed', 'cancelled')
      and dispute_status is distinct from 'open'
    order by id for update skip locked limit p_batch_size
  loop
    attempted := attempted + 1;
    begin
      update public.works set status = 'cancelled', refund_status = 'fee_excluded_refund_pending',
        cancellation_reason = coalesce(cancellation_reason, 'mutual_after_start'),
        cancellation_requested_by = null, cancellation_requested_at = null, cancelled_at = now()
      where id = candidate.id and status not in ('completed', 'cancelled');
      if found then
        if candidate.request_id is not null then update public.service_requests set status = 'completed' where id = candidate.request_id; end if;
        succeeded := succeeded + 1; auto_cancelled := auto_cancelled + 1;
      else skipped := skipped + 1;
      end if;
    exception when others then failed := failed + 1;
    end;
  end loop;

  for candidate in
    select d.id as deliverable_id, d.step_id, w.id as work_id, w.request_id
    from public.deliverables d join public.works w on w.id = d.work_id
    where d.status = 'submitted' and d.submitted_at <= p_auto_confirm_before
      and w.status = 'submitted' and w.settlement_status = 'held'
      and w.dispute_status is distinct from 'open' and w.cancellation_requested_at is null
    order by w.id, d.id for update of w, d skip locked limit p_batch_size
  loop
    attempted := attempted + 1;
    begin
      update public.deliverables set status = 'approved' where id = candidate.deliverable_id and status = 'submitted';
      if not found then skipped := skipped + 1; continue; end if;
      if candidate.step_id is not null then update public.work_steps set status = 'approved' where id = candidate.step_id and work_id = candidate.work_id; end if;
      update public.works set status = 'completed', settlement_status = 'pending', completed_at = now()
      where id = candidate.work_id and status = 'submitted' and settlement_status = 'held';
      if not found then raise exception 'automation work expected state changed'; end if;
      if candidate.request_id is not null then update public.service_requests set status = 'completed' where id = candidate.request_id; end if;
      succeeded := succeeded + 1; auto_confirmed := auto_confirmed + 1;
    exception when others then failed := failed + 1;
    end;
  end loop;

  if attempted <> succeeded + skipped + failed then raise exception 'automation count conservation failed'; end if;
  update public.financial_operations set state = case when failed > 0 then 'retry_required' else 'completed' end,
    completed_at = case when failed = 0 then now() else null end,
    metadata = metadata || jsonb_build_object('attempted', attempted, 'succeeded', succeeded,
      'skipped', skipped, 'failed', failed, 'autoCancelled', auto_cancelled, 'autoConfirmed', auto_confirmed),
    updated_at = now() where id = run_operation.id;
  return jsonb_build_object('attempted', attempted, 'succeeded', succeeded, 'skipped', skipped,
    'failed', failed, 'autoCancelled', auto_cancelled, 'autoConfirmed', auto_confirmed);
end;
$$;
revoke execute on function public.begin_payment_order(uuid, uuid, text, text, numeric) from public, anon, authenticated;
revoke execute on function public.begin_payment_confirmation(text, uuid, text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.finalize_payment_confirmation(uuid, text, text, text, integer, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.record_payment_failure(text, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.record_provider_event(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.apply_provider_event_result(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.begin_payment_refund(uuid, uuid, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.finalize_payment_refund(uuid, text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.record_financial_reconciliation(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.begin_settlement_request(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.finalize_settlement_payout(uuid, uuid, uuid, integer, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.apply_admin_financial_transition(uuid, uuid, text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.apply_work_cancellation(uuid, uuid, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.apply_deliverable_review(uuid, uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.claim_due_trade_automation(timestamptz, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.begin_payment_order(uuid, uuid, text, text, numeric) to service_role;
grant execute on function public.begin_payment_confirmation(text, uuid, text, integer, text, text) to service_role;
grant execute on function public.finalize_payment_confirmation(uuid, text, text, text, integer, text, timestamptz) to service_role;
grant execute on function public.record_payment_failure(text, uuid, text, text, text) to service_role;
grant execute on function public.record_provider_event(text, text, text, text, jsonb) to service_role;
grant execute on function public.apply_provider_event_result(uuid, text, text) to service_role;
grant execute on function public.begin_payment_refund(uuid, uuid, text, boolean, text) to service_role;
grant execute on function public.finalize_payment_refund(uuid, text, timestamptz, text) to service_role;
grant execute on function public.record_financial_reconciliation(uuid, text, text, text) to service_role;
grant execute on function public.begin_settlement_request(uuid, uuid, boolean, text) to service_role;
grant execute on function public.finalize_settlement_payout(uuid, uuid, uuid, integer, text, text, boolean) to service_role;
grant execute on function public.apply_admin_financial_transition(uuid, uuid, text, text, boolean, text) to service_role;
grant execute on function public.apply_work_cancellation(uuid, uuid, text, boolean, text) to service_role;
grant execute on function public.apply_deliverable_review(uuid, uuid, uuid, boolean, text) to service_role;
grant execute on function public.claim_due_trade_automation(timestamptz, timestamptz, integer, text) to service_role;
