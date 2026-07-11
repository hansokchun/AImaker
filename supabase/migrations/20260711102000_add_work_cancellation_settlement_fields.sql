alter table public.works
  add column if not exists cancellation_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists settlement_requested_at timestamptz,
  add column if not exists settlement_settled_at timestamptz,
  add column if not exists settlement_hold_reason text;

alter table public.works
  drop constraint if exists works_cancellation_reason_check;

alter table public.works
  add constraint works_cancellation_reason_check
  check (cancellation_reason in ('before_start', 'mutual_after_start'));

alter table if exists public.admin_actions
  drop constraint if exists admin_actions_action_type_check;

alter table if exists public.admin_actions
  add constraint admin_actions_action_type_check
  check (
    action_type in (
      'note',
      'warn',
      'restrict',
      'release_restriction',
      'hide_product',
      'restore_product',
      'feature_product',
      'unfeature_product',
      'move_product_up',
      'move_product_down',
      'resolve_report',
      'dismiss_report',
      'hide_review',
      'restore_review',
      'mark_settlement_pending',
      'mark_settlement_settled',
      'hold_settlement',
      'mark_refund_pending',
      'open_dispute',
      'resolve_dispute',
      'close_consultation',
      'cancel_trade'
    )
  );
