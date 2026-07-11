# Payment Integration Remaining Tasks

Last updated: 2026-07-12

## Done

- Toss Payments test checkout creates a paid workroom.
- Platform fee is currently 0.
- Work deliverable approval moves the trade to settlement pending.
- Seven-day no-response auto purchase confirmation is implemented.
- Cancellation is now request-based: request, counterpart accept, or 24-hour no-response auto cancel.
- Open disputes block approval, revision request, cancellation, auto confirmation, and settlement request.
- Expert settlement withdrawal request is implemented.
- Admin can mark settlement pending, settled, refunded, disputed, resolved, or held.
- Supabase production database migration was applied.
- Supabase payment Edge Functions were deployed: order, confirm, cancel, fail, and webhook.
- Toss refund execution is restricted to refund-pending, non-settled workrooms.
- Admin settlement completion now requires confirmation and is disabled for refund/dispute/non-pending workrooms.
- Vercel production environment variables were added.
- Vercel production deployment was completed.

## Remaining Plan

1. Live test scenarios with `benet9818` as client and `benet9827` as expert.
   - Pay with Toss test payment.
   - Submit deliverable as expert.
   - Approve deliverable as client.
   - Request settlement as expert.
   - Test cancellation request and counterpart acceptance.
   - Test dispute-open blocking from admin.
   - Test Toss refund execution later when ready.

2. Production operations policy before real launch.
   - Who can mark settlement settled.
   - How actual payouts are sent outside the app.
   - When settlement hold is used.
   - Whether automatic 7-day confirmation should run by scheduled backend job instead of only when the workroom is loaded.

3. Scheduled backend job for automatic rules.
   - Current automatic purchase confirmation and 24-hour cancellation are checked when workroom data loads.
   - A scheduled function would make those rules run even if no one opens the workroom.

## Operations Checklist Before Real Launch

- Treat `정산 완료 처리` as a bookkeeping action after the actual payout is finished outside the app.
- Do not mark settlement settled while refund, dispute, or settlement hold review is active.
- Keep `admin_users` limited to operators who are allowed to execute refunds or settlement state changes.
- Rehearse one full no-refund order and one cancellation/refund order in Toss test mode before switching to live keys.
- Decide whether payouts are handled manually by bank transfer first, then automate payout exports later.

## Latest Deployment

- Production URL: `https://aiconnect-one.vercel.app`
- Supabase project ref: `vtosyfoymmpjklbeufkm`
- Applied migrations:
  - `20260711102000_add_work_cancellation_settlement_fields.sql`
  - `20260712093000_add_toss_payment_cancel_fields.sql`
