# Policy decision log

- Document version: `1.0.0-draft`
- Last reviewed: `2026-07-14`

This log records decisions supplied by the product owner during remediation. It does not supply commercial or legal values.

| Date | Decision | State | Consequence |
| --- | --- | --- | --- |
| 2026-07-14 | Operate as closed beta until Stages 1 and 2 pass. | approved default | no real users, real payments, or public launch |
| 2026-07-14 | Payments fail closed until the fee/refund matrix is genuinely signed. | approved default | historical fee/refund values are non-operative |
| 2026-07-14 | Withdrawal immediately blocks access and revokes sessions while legally relevant financial records are retained. | approved default | account access ends without destructive record deletion |
| 2026-07-14 | A deletion job must be reversible and may not become irreversible before an approved retention matrix. | approved default | irreversible deletion remains blocked |

## Unresolved decisions

- Every value marked `[REQUIRED APPROVAL]` in the current commercial/refund matrix.
- Every legal basis, retention period, legal clause, and publication item marked `[REQUIRED APPROVAL]` in the current retention/legal matrix.
- Named approver identities, contacts, signatures, and approval timestamps.
- Runtime recovery objectives, alert ownership, and release authorization.
