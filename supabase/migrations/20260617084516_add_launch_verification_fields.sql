alter table public.expert_profiles
  add column if not exists contact_available_time text,
  add column if not exists average_response_time text;

alter table public.expert_products
  add column if not exists tax_invoice_available boolean not null default false;

alter table public.works
  add column if not exists revision_limit integer not null default 0,
  add column if not exists revision_used integer not null default 0,
  add column if not exists refund_status text,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz;
;
