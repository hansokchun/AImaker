# Settlement and payout operations runbook (draft)

- Document version: `1.0.0-draft`
- Status: `pending G1 and G2 / real payout blocked`

## Authorization gate

No real settlement or payout is allowed until the current commercial/refund matrix is complete and G1 is passed. G2 must also contain a successful payout and reconciliation drill. This runbook supplies no fee, hold period, cutoff, limit, or bank instruction.

## Required controls

- Approved eligibility, fee, rounding, hold, and dispute rules: `[REQUIRED G1]`
- Initiator and independent verifier roles: `[REQUIRED APPROVAL]`
- Bank/provider account and access procedure: `[REQUIRED APPROVAL]`
- Payout limit/cutoff and exception authority: `[REQUIRED APPROVAL]`
- Immutable operation/idempotency key and bank/provider reference: `[REQUIRED]`

## Batch procedure

1. Freeze a batch identifier and list only approved, undisputed, non-refund, settlement-eligible operations.
2. Confirm stored fee/rate snapshots and exact gross, fee, refund, and net invariants against the signed matrix.
3. Confirm payout destination ownership and change controls without exposing raw account data in evidence.
4. Initiator records the proposed batch; independent verifier confirms count, total, eligibility, and destination-control evidence.
5. Execute only through the approved bank/provider procedure. Never mark paid before external success is evidenced.
6. Store the unique external reference and finalize the internal operation atomically/idempotently.
7. Reconcile every attempted item as succeeded, skipped, failed, or unknown. Unknown remains blocked for manual review.
8. Obtain end-of-batch sign-off and retain redacted evidence under the approved retention rule.

## Exceptions

- Timeout after submission: do not resubmit until provider/bank lookup resolves the reference.
- Duplicate click/retry: reuse the same operation key; a second money movement is prohibited.
- Invalid or changed destination: hold and require re-verification.
- Refund/dispute/hold appears: stop that item and reconcile before any payout.
- External success/internal failure: mark reconciliation required; do not claim completion.

## Stop rules

Stop the batch for missing independent verification, missing external reference, totals mismatch, unresolved timeout, unapproved policy value, destination ambiguity, or audit write failure.

## Evidence record

- Batch and operation IDs (non-secret): `[REQUIRED]`
- Initiator/verifier approvals: `[REQUIRED APPROVAL]`
- Counts and totals before/after: `[REQUIRED]`
- Redacted bank/provider references: `[REQUIRED]`
- Exceptions and reconciliation disposition: `[REQUIRED]`
