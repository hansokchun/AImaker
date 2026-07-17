create unique index if not exists notification_events_settlement_paid_unique_idx
  on public.notification_events (event_type, related_type, related_id)
  where event_type = 'settlement_paid' and related_type = 'settlement';
