alter table public.payment_orders drop constraint if exists payment_orders_status_check;

alter table public.payment_orders
  add constraint payment_orders_status_check check (status in ('ready', 'approved', 'failed', 'refunded'));

alter table public.payment_orders add column if not exists cancel_reason text;
alter table public.payment_orders add column if not exists cancelled_at timestamptz;

alter table public.admin_actions drop constraint if exists admin_actions_action_type_check;

alter table public.admin_actions
  add constraint admin_actions_action_type_check check (
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
      'execute_toss_refund',
      'open_dispute',
      'resolve_dispute',
      'close_consultation',
      'cancel_trade'
    )
  );
