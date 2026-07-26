# 긱온 current document index

- Index version: `1.0.0-draft`
- Effective status: `draft / closed beta only`
- Last reviewed: `2026-07-14`
- Approval gate: [G1 commercial, legal, and retention sign-off](approvals/commercial-legal-retention-signoff.md) (`pending`)

This file is the only index of current policy and operations documents. A document being listed as current does not make it approved. Where G1 is pending, the stricter fail-closed rule applies.

## Current policy sources

| Area | Current document | Version | Approval status |
| --- | --- | --- | --- |
| Launch boundary | [Closed-beta launch policy](policies/launch-policy-v1-draft.md) | `1.0.0-draft` | pending G1 |
| Fees, refunds, and payment activation | [Commercial and refund decision matrix](policies/commercial-refund-matrix-v1-draft.md) | `1.0.0-draft` | pending G1 |
| Retention, withdrawal, and legal review | [Retention and legal decision matrix](policies/retention-legal-matrix-v1-draft.md) | `1.0.0-draft` | pending G1 |
| Decision history | [Policy decision log](decisions/policy-decision-log.md) | `1.0.0-draft` | records approved defaults only |

## Current operations drafts

These are executable drafts, not proof that a deployment, rollback, incident response, settlement, or reconciliation has been rehearsed.

| Area | Current document | Version | Approval status |
| --- | --- | --- | --- |
| Deployment | [Deployment runbook](../runbooks/deploy.md) | `1.0.0-draft` | pending G2 |
| Rollback and forward-fix | [Rollback runbook](../runbooks/rollback.md) | `1.0.0-draft` | pending G2 |
| Incident response | [Incident runbook](../runbooks/incident.md) | `1.0.0-draft` | pending G2 |
| Settlement operations | [Settlement runbook](../runbooks/settlement.md) | `1.0.0-draft` | pending G1 and G2 |
| Payment and payout reconciliation | [Reconciliation runbook](../runbooks/reconciliation.md) | `1.0.0-draft` | pending G1 and G2 |

## Superseded or historical sources

The files below are retained as history. They are **superseded for launch, commercial, refund, retention, and legal decisions** and must not be used as executable policy.

| Historical source | Classification | Reason |
| --- | --- | --- |
| [FinalSpec.md](../FinalSpec.md) | superseded / historical | Contains mutually inconsistent launch-payment decisions and an unapproved 12% fee. |
| [PolicyPlan.md](../PolicyPlan.md) | superseded / historical | Contains unapproved fee and refund statements. |
| [PaymentSettlementPlan.md](../PaymentSettlementPlan.md) | superseded / historical | Records exploratory fee values and later payment deferral; not an approved matrix. |
| [Payment integration remaining tasks](payment-remaining-tasks.md) | operational history / not current policy | Contains deployment and runtime claims that the audit did not verify. |
| [User-facing legal draft](../src/pages/LegalPage.tsx) | product draft / not approved legal source | The screen identifies itself as a draft requiring final legal and business information. |

## Fail-closed precedence

Until G1 is genuinely signed by all required roles:

1. The service remains closed beta with no real users or real-money transactions.
2. Payment activation is blocked. No historical percentage or refund statement is a valid fallback.
3. Withdrawal blocks access and requires global session revocation while legally relevant financial records are retained.
4. Irreversible deletion is blocked. A reversible deletion job may not run until the retention matrix is approved.
5. Public launch is blocked.

## Validation

Run from the repository root:

```text
node docs/validation/validate-policy-documents.mjs
```

The command validates current links, exact versions, required decision cells, fixed G1 roles, and fail-closed status. It never changes an approval state.
