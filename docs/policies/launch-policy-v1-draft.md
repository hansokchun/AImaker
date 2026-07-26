# Closed-beta launch policy

- Document version: `1.0.0-draft`
- Status: `pending G1`
- Decision date: `2026-07-14`
- Replaces for current use: launch/payment statements in `FinalSpec.md`, `PolicyPlan.md`, and `PaymentSettlementPlan.md`

## Approved default

긱온 remains a closed beta. No real user, real payment, public launch, or production release is authorized until the applicable Stage 1 and Stage 2 acceptance criteria and external gates have passed.

## Allowed while pending

- Local and disposable-environment development with synthetic identities and data.
- Static and executable quality, permission, migration, payment-failure, and recovery tests.
- Provider sandbox work only after the separate credential authorization required by the execution plan.
- Reversible drafts and policy-independent safety changes.

## Blocked while pending

- Inviting or onboarding real users.
- Taking, refunding, settling, or transferring real money.
- Enabling a production payment path or live provider key.
- Public launch, production deployment, or live database mutation under this document.
- Irreversible deletion of an account or its data.

## Exit conditions

This policy does not approve its own exit. Moving beyond closed beta requires:

1. G1 signed against the exact current commercial/refund and retention/legal matrix versions.
2. G2 signed against current runtime evidence.
3. A separate explicit production-release authorization outside the remediation plan.

Any missing, stale, ambiguous, or conflicting approval keeps the service closed.
