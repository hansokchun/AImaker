# Rollback and forward-fix runbook (draft)

- Document version: `1.0.0-draft`
- Status: `pending G2 / not rehearsed`

## Principle

Do not assume a database down-migration is safe. First block affected traffic and money movement, preserve evidence, then choose an approved frontend/Edge rollback or an additive database forward-fix based on the exact compatibility window.

## Required decision record

- Incident/change reference: `[REQUIRED]`
- Exact deployed and prior versions: `[REQUIRED]`
- Impacted data and operations: `[REQUIRED]`
- Decision owner and verifiable approval: `[REQUIRED APPROVAL]`
- Chosen action and reason: `[REQUIRED]`
- Data backup/restore evidence: `[REQUIRED EVIDENCE]`

## Procedure

1. Disable the affected route, job, or provider operation through the pre-approved kill mechanism. Do not improvise a destructive database command.
2. Capture redacted request IDs, operation IDs, schema/function/frontend versions, and affected-row counts.
3. Stop automation/replay that could duplicate financial work.
4. Assess compatibility of the prior frontend and Edge versions with the current database.
5. If compatible and approved, execute the recorded application/Function rollback command: `[REQUIRED AT EXECUTION]`.
6. If the database changed, use an reviewed additive forward-fix unless an exact down path was independently tested and approved.
7. Replay only idempotent operations with reconciliation evidence.
8. Verify UI/API/database states, immutable audit continuity, and payment/payout totals before reopening.

## Stop rules

Do not reopen when ownership is unknown, evidence is incomplete, a rollback command/version was not rehearsed, checksums differ, reconciliation is nonzero, a provider result is unknown, or session/authorization behavior is stale.

## Evidence record

- Timeline and decision: `[REQUIRED]`
- Commands, exit codes, and version transitions: `[REQUIRED]`
- Before/after checksums and row counts: `[REQUIRED]`
- Financial reconciliation and unresolved queue: `[REQUIRED]`
- Reopen approval: `[REQUIRED APPROVAL]`
