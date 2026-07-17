# Incident response runbook (draft)

- Document version: `1.0.0-draft`
- Status: `pending G2 / owner and objectives unapproved`

## Required operating values

- Incident commander/on-call route: `[REQUIRED APPROVAL]`
- Security escalation route: `[REQUIRED APPROVAL]`
- Finance/payment escalation route: `[REQUIRED APPROVAL]`
- User/support communication owner: `[REQUIRED APPROVAL]`
- Severity criteria and response objectives: `[REQUIRED APPROVAL]`

No contact, identity, severity target, RTO, or RPO is implied by this draft.

## Triage

1. Open an incident record and use a non-secret correlation identifier.
2. Identify affected users, trades, operations, environments, and versions without copying secrets or unnecessary personal data.
3. Block the smallest unsafe surface. For financial uncertainty, stop payment/refund/settlement/payout and preserve the reconciliation state.
4. For an account withdrawal/session event, keep access blocked even if global revocation needs recovery.
5. Preserve append-only logs and provider references. Do not edit history to make states agree.
6. Assign the required owners before any reopen or replay decision.

## Investigation checklist

- Frontend console/network and API status: `[REQUIRED EVIDENCE]`
- Edge/runtime correlation and idempotency records: `[REQUIRED EVIDENCE]`
- Database expected/actual states and affected rows: `[REQUIRED EVIDENCE]`
- Provider result and reconciliation status: `[REQUIRED EVIDENCE]`
- Authorization/session impact: `[REQUIRED EVIDENCE]`
- Secret exposure assessment and rotation decision: `[REQUIRED EVIDENCE]`

## Recovery and communication

Use the rollback or reconciliation runbook for the specific action. Replay only a durably identified, idempotent operation. Record user/operator communications only after the responsible owner approves their content.

## Stop rules

Keep the affected feature closed if the owner, actual provider result, authorization boundary, audit trail, data integrity, or reconciliation result is unknown. Missing response objectives or contacts blocks G2 and public launch.

## Closure evidence

- Root cause and contributing conditions: `[REQUIRED]`
- Exact recovery commands/actions and results: `[REQUIRED]`
- Residual risk and follow-up owner: `[REQUIRED APPROVAL]`
- Reconciliation and user-impact closure: `[REQUIRED]`
- Closure approval: `[REQUIRED APPROVAL]`
