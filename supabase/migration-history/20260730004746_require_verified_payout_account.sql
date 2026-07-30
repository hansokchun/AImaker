create or replace function public.require_verified_settlement_payout_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payout_account_id is null or not exists (
    select 1
    from public.expert_payout_accounts account
    where account.id = new.payout_account_id
      and account.expert_id = new.expert_id
      and account.verified_at is not null
  ) then
    raise exception 'verified payout account required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists require_verified_settlement_payout_account on public.settlement_payouts;
create trigger require_verified_settlement_payout_account
  before insert or update of payout_account_id, expert_id
  on public.settlement_payouts
  for each row execute function public.require_verified_settlement_payout_account();

revoke execute on function public.require_verified_settlement_payout_account() from public, anon, authenticated;
