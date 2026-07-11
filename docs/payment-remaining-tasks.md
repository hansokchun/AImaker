# Payment Integration Remaining Tasks

Last updated: 2026-07-12

## Done

- Toss Payments test checkout creates a paid workroom.
- Platform fee is currently 0.
- Work deliverable approval moves the trade to settlement pending.
- Seven-day no-response auto purchase confirmation is implemented.
- Cancellation is request-based: request, counterpart accept, or 24-hour no-response auto cancel.
- Open disputes block approval, revision request, cancellation, auto confirmation, and settlement request.
- Experts can register a payout account in My Page > expert settlement management.
- Expert settlement requests create an automatic payout queue tied to the saved payout account.
- Admin can mark settlement pending, settled, refunded, disputed, resolved, or held.
- Supabase production database migration was applied for the previous payment/cancel fields.
- Supabase payment Edge Functions were deployed: order, confirm, cancel, fail, and webhook.
- Toss refund execution is restricted to refund-pending, non-settled workrooms.
- Admin settlement completion requires confirmation and is disabled for refund/dispute/non-pending workrooms.
- Vercel production environment variables were added.
- Vercel production deployment was completed.
- A scheduled Edge Function source was added for seven-day auto purchase confirmation and 24-hour cancellation handling.

## Remaining Plan

1. Live test scenarios with `benet9818` as client and `benet9827` as expert.
   - Pay with Toss test payment.
   - Submit deliverable as expert.
   - Approve deliverable as client.
   - Request settlement as expert.
   - Confirm the settlement payout row is queued.
   - Test cancellation request and counterpart acceptance.
   - Test dispute-open blocking from admin.
   - Test Toss refund execution later when ready.

2. Production payout provider connection before real launch.
   - Choose and contract a payout/remittance provider for automated bank transfers.
   - Connect the provider API to process queued `settlement_payouts`.
   - Mark `settlement_payouts.status = paid` only after the provider confirms the transfer.
   - Store bank account data securely or replace raw account fields with provider-issued account tokens.

3. Scheduled backend job activation.
   - Set `TRADE_AUTOMATION_SECRET` in Supabase secrets.
   - Add a cron job that POSTs to the function with the `x-automation-secret` header.

## Operations Checklist Before Real Launch

- Experts press `정산 신청`, not `정산 완료`.
- Treat `정산 완료 처리` as a system bookkeeping action after the automatic payout provider confirms the transfer.
- Do not mark settlement settled while refund, dispute, or settlement hold review is active.
- Keep `admin_users` limited to operators who are allowed to execute refunds or settlement state changes.
- Rehearse one full no-refund order and one cancellation/refund order in Toss test mode before switching to live keys.
- Before live launch, connect an actual payout provider or keep the payout queue disabled from real money movement.

## Latest Deployment

- Production URL: `https://aiconnect-one.vercel.app`
- Supabase project ref: `vtosyfoymmpjklbeufkm`
- Applied migrations:
  - `20260711102000_add_work_cancellation_settlement_fields.sql`
  - `20260712093000_add_toss_payment_cancel_fields.sql`
  - `20260712130000_add_settlement_payout_automation.sql`
- Deployed Edge Functions:
  - `trade-automation-runner`
