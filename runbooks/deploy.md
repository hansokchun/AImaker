# Deployment runbook (draft)

- Document version: `1.0.0-draft`
- Status: `pending G2 / execution blocked`
- Applies to: frontend, Supabase migrations, and Edge Functions

## Authorization gate

Stop before any deployment unless G1 and G2 are genuinely passed and a separate production-release authorization identifies the exact commit, environment, migration set, function set, approvers, and change window. This draft is not authorization.

## Required inputs

- Release commit: `[REQUIRED AT EXECUTION]`
- Target environment/project reference: `[REQUIRED AT EXECUTION]`
- Change window and release owner: `[REQUIRED APPROVAL]`
- Migration compatibility and forward-fix evidence: `[REQUIRED EVIDENCE]`
- Frontend, Edge, database, browser, and provider evidence links: `[REQUIRED EVIDENCE]`
- G1/G2 sign-off links and exact versions: `[REQUIRED EVIDENCE]`
- Rollback/forward-fix decision owner: `[REQUIRED APPROVAL]`

## Preflight commands

Run from a clean checkout and record commands, exit codes, commit, tool versions, and artifact hashes:

```text
git status --short
npm.cmd run typecheck
npm.cmd run lint -- --max-warnings 0
npm.cmd run test
npm.cmd run build
```

Run the project-pinned Supabase reset/migration and Edge inventory checks defined by the Stage 2 tooling. Do not substitute a live project for the disposable environment. Record the exact command only after that tooling exists.

## Deployment order

The release owner must record the compatibility-tested order for the exact change. Defaulting to an unreviewed order is prohibited.

1. Freeze the approved commit and evidence bundle.
2. Confirm additive/backward-compatible database behavior in a disposable environment.
3. Record the approved database, Edge Function, and frontend ordering: `[REQUIRED AT EXECUTION]`.
4. Execute only the approved commands; capture redacted output and deployed versions.
5. Run the approved post-deploy health and synthetic smoke checks.
6. Compare financial/reconciliation invariants before opening traffic.

## Stop rules

Stop, keep traffic/payment closed, and enter rollback/forward-fix assessment if any gate is stale, the worktree/commit differs, a command is missing or fails, schema/function/frontend versions diverge, smoke produces an unexpected state, or financial/reconciliation checks do not balance.

## Evidence record

- Approval and version links: `[REQUIRED]`
- Commands and exit codes: `[REQUIRED]`
- Deployed version identifiers: `[REQUIRED]`
- Post-deploy UI/API/database results: `[REQUIRED]`
- Reconciliation result: `[REQUIRED]`
- Cleanup or rollback disposition: `[REQUIRED]`
