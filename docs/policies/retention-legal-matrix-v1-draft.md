# Retention and legal decision matrix

- Document version: `1.0.0-draft`
- Status: `pending G1`
- Last reviewed: `2026-07-14`
- Runtime posture while pending: `access block and preservation; irreversible deletion blocked`

This matrix defines decision slots only. It is not legal advice and does not invent a legal basis, clause, or period.

## Withdrawal behavior approved as a default

On a valid withdrawal request:

1. Block account access immediately through a transactional server boundary.
2. Attempt global session revocation and record the outcome for recovery.
3. Anonymize or hide user-facing profile data using a reversible, auditable process.
4. Preserve legally relevant financial, refund, dispute, payout, and audit records.
5. Do not physically delete auth, profile, financial, or audit records.
6. Do not run an irreversible deletion job before this matrix is approved and the record is eligible under that approved matrix.

## Required retention decisions

| Data class | Purpose / legal basis | Retention trigger | Retention period | Legal hold / unresolved-case exception | Deletion or anonymization method | Approval state |
| --- | --- | --- | --- | --- | --- | --- |
| Identity and profile | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | reversible anonymization pending approval | pending |
| Authentication/session records | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | session revoke; final method pending | pending |
| Orders, payments, refunds | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | preserve unresolved financial cases | `[REQUIRED APPROVAL]` | pending |
| Settlements and payout evidence | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | preserve unresolved payouts/disputes | `[REQUIRED APPROVAL]` | pending |
| Disputes, reports, and support | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | preserve active legal hold | `[REQUIRED APPROVAL]` | pending |
| Security and immutable audit logs | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | preserve active investigation/legal hold | `[REQUIRED APPROVAL]` | pending |
| Notification and preference data | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | pending |
| Uploaded samples and deliverables | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | preserve active trade/dispute/legal hold | `[REQUIRED APPROVAL]` | pending |

## Required legal publication decisions

| Decision ID | Publication requirement | Approved text/version/evidence | Approval state |
| --- | --- | --- | --- |
| LEG-01 | Terms of service | `[REQUIRED APPROVAL]` | pending |
| LEG-02 | Privacy notice and processing inventory | `[REQUIRED APPROVAL]` | pending |
| LEG-03 | Business/operator and support information | `[REQUIRED APPROVAL]` | pending |
| LEG-04 | Processor, notification, and transfer disclosures | `[REQUIRED APPROVAL]` | pending |
| LEG-05 | Consent/version evidence and effective date | `[REQUIRED APPROVAL]` | pending |

## Deletion release rule

The irreversible deletion job remains disabled unless every applicable row is approved, all legal holds and unresolved financial cases are checked, the exact document version is signed in G1, and a separate operational release authorizes the job. Missing or stale information fails closed.
