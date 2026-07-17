insert into auth.users (
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'client@synthetic.invalid', '2026-01-01T00:00:00Z', '{"provider":"test","providers":[]}', '{"synthetic":true,"fixtureRole":"client"}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'expert@synthetic.invalid', '2026-01-01T00:00:00Z', '{"provider":"test","providers":[]}', '{"synthetic":true,"fixtureRole":"expert"}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'admin@synthetic.invalid', '2026-01-01T00:00:00Z', '{"provider":"test","providers":[]}', '{"synthetic":true,"fixtureRole":"admin"}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'restricted@synthetic.invalid', '2026-01-01T00:00:00Z', '{"provider":"test","providers":[]}', '{"synthetic":true,"fixtureRole":"restricted"}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'other@synthetic.invalid', '2026-01-01T00:00:00Z', '{"provider":"test","providers":[]}', '{"synthetic":true,"fixtureRole":"other"}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'withdrawal@synthetic.invalid', '2026-01-01T00:00:00Z', '{"provider":"test","providers":[]}', '{"synthetic":true,"fixtureRole":"withdrawal"}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
on conflict (id) do update set
  aud = excluded.aud,
  role = excluded.role,
  email = excluded.email,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at;

insert into public.profiles (id, email, display_name, name, is_expert, account_status, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'client@synthetic.invalid', 'Synthetic Client', 'Synthetic Client', false, 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', 'expert@synthetic.invalid', 'Synthetic Expert', 'Synthetic Expert', true, 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', 'admin@synthetic.invalid', 'Synthetic Admin', 'Synthetic Admin', false, 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000004', 'restricted@synthetic.invalid', 'Synthetic Restricted', 'Synthetic Restricted', false, 'restricted', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000005', 'other@synthetic.invalid', 'Synthetic Other', 'Synthetic Other', false, 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('10000000-0000-4000-8000-000000000006', 'withdrawal@synthetic.invalid', 'Synthetic Withdrawal', 'Synthetic Withdrawal', false, 'active', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  name = excluded.name,
  is_expert = excluded.is_expert,
  account_status = excluded.account_status;

insert into public.admin_users (user_id, role, created_at)
values ('10000000-0000-4000-8000-000000000003', 'admin', '2026-01-01T00:00:00Z')
on conflict (user_id) do update set role = excluded.role;

insert into public.expert_profiles (user_id, name, one_liner, updated_at)
values ('10000000-0000-4000-8000-000000000002', 'Synthetic Expert', 'Synthetic local fixture', '2026-01-01T00:00:00Z')
on conflict (user_id) do update set
  name = excluded.name,
  one_liner = excluded.one_liner;
