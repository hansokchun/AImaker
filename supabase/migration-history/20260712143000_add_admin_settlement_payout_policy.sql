do $$
begin
  if to_regclass('public.admin_users') is not null
    and to_regclass('public.expert_payout_accounts') is not null
    and to_regclass('public.settlement_payouts') is not null then
    drop policy if exists "Admins can view payout accounts" on public.expert_payout_accounts;
    create policy "Admins can view payout accounts"
      on public.expert_payout_accounts for select
      using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

    drop policy if exists "Admins can view settlement payouts" on public.settlement_payouts;
    create policy "Admins can view settlement payouts"
      on public.settlement_payouts for select
      using (exists (select 1 from public.admin_users where admin_users.user_id = auth.uid()));

    drop policy if exists "Admins can update settlement payouts" on public.settlement_payouts;
  end if;
end $$;
