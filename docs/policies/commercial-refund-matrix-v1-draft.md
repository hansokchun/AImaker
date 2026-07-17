# Commercial and refund decision matrix

- Document version: `1.0.0-draft`
- Status: `pending G1`
- Last reviewed: `2026-07-14`
- Runtime posture while pending: `payment activation blocked`

Values in historical specifications are not defaults for this matrix.

## Required commercial decisions

| Decision ID | Decision | Approved value | Approval state | Runtime behavior while unresolved |
| --- | --- | --- | --- | --- |
| COM-01 | Platform/maker fee rate and rounding rule | `[REQUIRED APPROVAL]` | pending | payment blocked |
| COM-02 | Buyer/service fee rate and rounding rule | `[REQUIRED APPROVAL]` | pending | payment blocked |
| COM-03 | Fee snapshot timing and immutable fields | `[REQUIRED APPROVAL]` | pending | payment blocked |
| COM-04 | Currency and supported payment methods | `[REQUIRED APPROVAL]` | pending | payment blocked |
| COM-05 | Settlement eligibility and hold conditions | `[REQUIRED APPROVAL]` | pending | settlement blocked |
| COM-06 | Payout execution and dual-control requirements | `[REQUIRED APPROVAL]` | pending | payout blocked |

## Required cancellation and refund decisions

| Decision ID | Trade state / event | Refundable amount and fee treatment | Required authority/evidence | Approval state | Runtime behavior while unresolved |
| --- | --- | --- | --- | --- | --- |
| REF-01 | Before provider approval | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | pending | no real payment |
| REF-02 | Provider approved, work not started | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | pending | manual review; no automatic amount |
| REF-03 | Work started, mutual cancellation | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | pending | manual review; no automatic amount |
| REF-04 | Dispute or unilateral cancellation | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | pending | refund and settlement blocked |
| REF-05 | Deliverable approved / settlement pending | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | pending | manual review; settlement blocked on conflict |
| REF-06 | Settled payout | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | pending | automatic refund blocked |
| REF-07 | Partial or unknown provider cancellation result | `[REQUIRED APPROVAL]` | provider evidence plus reconciliation | pending | manual review; never report full success |

## Non-negotiable technical invariants

These safety controls do not choose a commercial value:

- Provider-approved amount, stored order amount, currency, and owner must match exactly.
- A terminal approved/refunded state cannot regress to failed.
- Refund and settlement cannot both complete for the same funds.
- Each business operation and provider transfer reference is idempotent and unique.
- Partial, unknown, timed-out, duplicate, or out-of-order provider results enter reconciliation/manual review.
- Provider calls remain outside database transactions; durable intent and finalization surround the call.

## Activation rule

This matrix is incomplete while any `Approved value` or required authority/evidence cell contains `[REQUIRED APPROVAL]`, or any approval state is not approved. Incomplete means payment, automatic refund amounts, settlement, payout, and public launch remain blocked.
