# G1 commercial, legal, and retention sign-off

- Gate ID: `G1`
- Gate schema version: `1.0.0`
- Gate status: `pending`
- Last evaluated: `2026-07-14`

## Exact documents under review

| Document | Required version | Approved content hash |
| --- | --- | --- |
| `docs/policies/launch-policy-v1-draft.md` | `1.0.0-draft` | `[REQUIRED AT SIGN-OFF]` |
| `docs/policies/commercial-refund-matrix-v1-draft.md` | `1.0.0-draft` | `[REQUIRED AT SIGN-OFF]` |
| `docs/policies/retention-legal-matrix-v1-draft.md` | `1.0.0-draft` | `[REQUIRED AT SIGN-OFF]` |

## Required approvals

| Role | Approver identity | Signature / verifiable approval reference | Signed timestamp | Decision |
| --- | --- | --- | --- | --- |
| Product Owner | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED]` | pending |
| Finance Owner | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED]` | pending |
| Legal/Privacy Owner | `[REQUIRED]` | `[REQUIRED]` | `[REQUIRED]` | pending |

## Required completeness checks

- [ ] Every commercial fee, rounding, snapshot, currency, settlement, and payout decision is approved.
- [ ] Every refund/cancellation state has an approved amount/fee rule and required authority/evidence.
- [ ] Every data class has an approved purpose/legal basis, trigger, period, exception, and disposition method.
- [ ] Final terms/privacy/business disclosures have versioned legal approval evidence.
- [ ] The content hashes above match the exact reviewed documents.
- [ ] All three fixed roles signed this exact gate version without placeholders.

## Fail-closed result

Because the gate status is `pending`, the following remain blocked:

- payment activation and real-money processing;
- automatic refund amounts, settlement, and payout;
- irreversible account/data deletion;
- public launch and production release.

Changing the heading or this prose does not pass G1. The gate may become `passed` only when the document matrices contain no unresolved approval cells, the exact reviewed hashes are recorded, every checklist item is checked, and all three fixed roles have genuine identity, signature/reference, timestamp, and approved decision values.
