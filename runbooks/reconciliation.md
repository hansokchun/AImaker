# Payment, refund, settlement, and payout reconciliation runbook (draft)

- Document version: `1.0.0-draft`
- Status: `pending G1 and G2 / provider and bank evidence not verified`

## Scope

Reconcile internal durable operations against provider/bank outcomes. Never infer external success solely from an HTTP timeout, UI message, internal status, or operator assertion.

## Required inputs

- Reconciliation window/cutoff: `[REQUIRED APPROVAL]`
- Internal operation, order, trade, refund, settlement, and payout records: `[REQUIRED EVIDENCE]`
- Provider/bank transaction export or query result: `[REQUIRED EVIDENCE]`
- Approved fee/refund/retention versions: `[REQUIRED G1]`
- Reviewer and escalation route: `[REQUIRED APPROVAL]`

## Invariants

- One internal business key maps to no more than one successful external money movement of its kind.
- Provider-approved amount and currency match the immutable internal snapshot.
- Refund and settlement/payout do not both consume the same funds.
- `attempted = succeeded + skipped + failed`, with unknown tracked separately until resolved.
- Every terminal transition has a correlation/idempotency key and immutable audit evidence.

## Procedure

1. Export redacted internal records and external results for the identical approved window.
2. Join by provider reference and operation/idempotency key; never join only by amount or user.
3. Classify exact match, internal-only, external-only, amount/currency mismatch, duplicate, out-of-order, timeout/unknown, and audit gap.
4. Stop automatic action for all non-match classes.
5. Resolve through provider lookup and the approved idempotent finalization or compensation path.
6. Re-run until every row is exact match or has an approved manual-review owner and disposition.
7. Record counts, totals, differences, reviewer, and evidence hash.

## Stop rules

Do not close or reopen payment/payout when a difference is nonzero, a provider result is unavailable, the same reference appears twice, an audit record is missing, the applicable policy version is stale, or the reviewer is absent.

## Evidence record

| Metric | Value |
| --- | --- |
| Window and policy versions | `[REQUIRED]` |
| Internal count/total | `[REQUIRED]` |
| External count/total | `[REQUIRED]` |
| Exact matches | `[REQUIRED]` |
| Unknown/mismatch/duplicate counts and totals | `[REQUIRED]` |
| Reviewer and approval reference | `[REQUIRED APPROVAL]` |
| Final evidence hash | `[REQUIRED]` |
