import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const sourceRoot = resolve(import.meta.dirname, '../..')

const copyIntoFixture = (fixtureRoot, relativePath) => {
    const destination = join(fixtureRoot, relativePath)
    mkdirSync(resolve(destination, '..'), { recursive: true })
    cpSync(join(sourceRoot, relativePath), destination, { recursive: true })
}

test('pending G1 rejects blank required commercial, refund, and retention matrix cells', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'aiconnect-policy-validation-'))

    try {
        for (const path of [
            'FinalSpec.md',
            'PolicyPlan.md',
            'PaymentSettlementPlan.md',
            'docs/approvals/commercial-legal-retention-signoff.md',
            'docs/current-document-index.md',
            'docs/decisions/policy-decision-log.md',
            'docs/payment-remaining-tasks.md',
            'docs/policies/commercial-refund-matrix-v1-draft.md',
            'docs/policies/launch-policy-v1-draft.md',
            'docs/policies/retention-legal-matrix-v1-draft.md',
            'docs/validation/validate-policy-documents.mjs',
            'runbooks/deploy.md',
            'runbooks/incident.md',
            'runbooks/reconciliation.md',
            'runbooks/rollback.md',
            'runbooks/settlement.md',
            'src/pages/LegalPage.tsx',
        ]) copyIntoFixture(fixtureRoot, path)

        const commercialPath = join(fixtureRoot, 'docs/policies/commercial-refund-matrix-v1-draft.md')
        const commercial = readFileSync(commercialPath, 'utf8')
            .replace('| COM-01 | Platform/maker fee rate and rounding rule | `[REQUIRED APPROVAL]` |', '| COM-01 | Platform/maker fee rate and rounding rule |  |')
            .replace('| REF-01 | Before provider approval | `[REQUIRED APPROVAL]` |', '| REF-01 | Before provider approval |  |')
        writeFileSync(commercialPath, commercial)

        const retentionPath = join(fixtureRoot, 'docs/policies/retention-legal-matrix-v1-draft.md')
        const retention = readFileSync(retentionPath, 'utf8')
            .replace('| Identity and profile | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` |', '| Identity and profile | `[REQUIRED APPROVAL]` | `[REQUIRED APPROVAL]` |  |')
        writeFileSync(retentionPath, retention)

        const result = spawnSync(process.execPath, ['docs/validation/validate-policy-documents.mjs'], {
            cwd: fixtureRoot,
            encoding: 'utf8',
        })

        assert.equal(
            result.status,
            1,
            `blank required cells incorrectly passed validation\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
        )
        assert.match(result.stderr, /COM-01.*Approved value.*blank/)
        assert.match(result.stderr, /REF-01.*Refundable amount and fee treatment.*blank/)
        assert.match(result.stderr, /Identity and profile.*Retention period.*blank/)
        assert.match(result.stderr, /gate=pending/)
        assert.match(result.stderr, /payment, public launch, and irreversible deletion remain blocked/)
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true })
    }
})
