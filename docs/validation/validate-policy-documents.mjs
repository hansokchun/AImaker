import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const args = process.argv.slice(2)

const option = (name, fallback) => {
    const index = args.indexOf(name)
    if (index === -1) return fallback
    if (!args[index + 1]) throw new Error(`${name} requires a path`)
    return args[index + 1]
}

const indexPath = resolve(root, option('--index', 'docs/current-document-index.md'))
const approvalPath = resolve(root, option('--approval', 'docs/approvals/commercial-legal-retention-signoff.md'))
const errors = []

const read = (path, label) => {
    if (!existsSync(path)) {
        errors.push(`${label}: missing file ${path}`)
        return ''
    }
    return readFileSync(path, 'utf8')
}

const requireText = (content, expected, label) => {
    if (!content.includes(expected)) errors.push(`${label}: missing ${JSON.stringify(expected)}`)
}

const requireCompleteTableRows = (content, firstColumn, requiredColumns, rowIds, label) => {
    const rows = content.split('\n')
        .filter((line) => line.trim().startsWith('|'))
        .map((line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim()))
    const header = rows.find((row) => row[0] === firstColumn && requiredColumns.every((column) => row.includes(column)))
    if (!header) {
        errors.push(`${label}: missing or malformed table header ${firstColumn}`)
        return
    }

    for (const rowId of rowIds) {
        const matches = rows.filter((row) => row[0] === rowId)
        if (matches.length !== 1) {
            errors.push(`${label}: expected exactly one ${rowId} row, found ${matches.length}`)
            continue
        }
        const row = matches[0]
        if (row.length !== header.length) errors.push(`${label}: ${rowId} has ${row.length} cells; expected ${header.length}`)
        for (const column of requiredColumns) {
            const cell = row[header.indexOf(column)]
            if (!cell) errors.push(`${label}: ${rowId} ${column} cell is blank`)
        }
    }
}

const sha256 = (content) => createHash('sha256').update(content).digest('hex')

const currentDocuments = [
    ['launch', 'docs/policies/launch-policy-v1-draft.md', '1.0.0-draft'],
    ['commercial/refund', 'docs/policies/commercial-refund-matrix-v1-draft.md', '1.0.0-draft'],
    ['retention/legal', 'docs/policies/retention-legal-matrix-v1-draft.md', '1.0.0-draft'],
    ['decision log', 'docs/decisions/policy-decision-log.md', '1.0.0-draft'],
    ['deploy runbook', 'runbooks/deploy.md', '1.0.0-draft'],
    ['rollback runbook', 'runbooks/rollback.md', '1.0.0-draft'],
    ['incident runbook', 'runbooks/incident.md', '1.0.0-draft'],
    ['settlement runbook', 'runbooks/settlement.md', '1.0.0-draft'],
    ['reconciliation runbook', 'runbooks/reconciliation.md', '1.0.0-draft'],
]

const indexContent = read(indexPath, 'index')
for (const match of indexContent.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1]
    if (/^(?:https?:|#)/.test(target)) continue
    const linked = resolve(dirname(indexPath), target.split('#')[0])
    if (!existsSync(linked)) errors.push(`index: broken link ${target}`)
}

for (const [label, relativePath, version] of currentDocuments) {
    const content = read(resolve(root, relativePath), label)
    requireText(indexContent, relativePath.startsWith('docs/') ? relativePath.replace('docs/', '') : `../${relativePath}`, `index/${label}`)
    requireText(indexContent, `\`${version}\``, `index/${label}`)
    requireText(content, `Document version: \`${version}\``, label)
}

for (const legacy of ['FinalSpec.md', 'PolicyPlan.md', 'PaymentSettlementPlan.md', 'payment-remaining-tasks.md']) {
    requireText(indexContent, legacy, 'index/legacy')
}
requireText(indexContent, 'superseded', 'index/legacy classification')

const launch = read(resolve(root, 'docs/policies/launch-policy-v1-draft.md'), 'launch')
requireText(launch, 'closed beta', 'launch')
requireText(launch, 'No real user, real payment, public launch, or production release is authorized', 'launch')

const commercialPath = resolve(root, 'docs/policies/commercial-refund-matrix-v1-draft.md')
const commercial = read(commercialPath, 'commercial/refund')
requireCompleteTableRows(
    commercial,
    'Decision ID',
    ['Decision', 'Approved value', 'Approval state', 'Runtime behavior while unresolved'],
    ['COM-01', 'COM-02', 'COM-03', 'COM-04', 'COM-05', 'COM-06'],
    'commercial matrix',
)
requireCompleteTableRows(
    commercial,
    'Decision ID',
    ['Trade state / event', 'Refundable amount and fee treatment', 'Required authority/evidence', 'Approval state', 'Runtime behavior while unresolved'],
    ['REF-01', 'REF-02', 'REF-03', 'REF-04', 'REF-05', 'REF-06', 'REF-07'],
    'refund matrix',
)
requireText(commercial, 'payment activation blocked', 'commercial/refund')

const retentionPath = resolve(root, 'docs/policies/retention-legal-matrix-v1-draft.md')
const retention = read(retentionPath, 'retention/legal')
requireCompleteTableRows(
    retention,
    'Data class',
    ['Purpose / legal basis', 'Retention trigger', 'Retention period', 'Legal hold / unresolved-case exception', 'Deletion or anonymization method', 'Approval state'],
    ['Identity and profile', 'Authentication/session records', 'Orders, payments, refunds', 'Settlements and payout evidence', 'Disputes, reports, and support', 'Security and immutable audit logs', 'Notification and preference data', 'Uploaded samples and deliverables'],
    'retention matrix',
)
requireCompleteTableRows(
    retention,
    'Decision ID',
    ['Publication requirement', 'Approved text/version/evidence', 'Approval state'],
    ['LEG-01', 'LEG-02', 'LEG-03', 'LEG-04', 'LEG-05'],
    'legal publication matrix',
)
requireText(retention, 'Block account access immediately', 'withdrawal policy')
requireText(retention, 'Attempt global session revocation', 'withdrawal policy')
requireText(retention, 'Preserve legally relevant financial', 'withdrawal policy')
requireText(retention, 'Do not physically delete', 'withdrawal policy')

const approval = read(approvalPath, 'G1')
const statusMatch = approval.match(/- Gate status: `([^`]+)`/)
if (!statusMatch) errors.push('G1: missing gate status')
const status = statusMatch?.[1]
if (status !== 'pending' && status !== 'passed') errors.push(`G1: invalid gate status ${JSON.stringify(status)}`)
requireText(approval, 'Gate schema version: `1.0.0`', 'G1')

const requiredRoles = ['Product Owner', 'Finance Owner', 'Legal/Privacy Owner']
for (const role of requiredRoles) {
    const rows = approval.split('\n').filter((line) => line.startsWith(`| ${role} |`))
    if (rows.length !== 1) errors.push(`G1: expected exactly one ${role} row, found ${rows.length}`)
}

const expectedApprovalDocuments = [
    ['docs/policies/launch-policy-v1-draft.md', '1.0.0-draft', launch],
    ['docs/policies/commercial-refund-matrix-v1-draft.md', '1.0.0-draft', commercial],
    ['docs/policies/retention-legal-matrix-v1-draft.md', '1.0.0-draft', retention],
]
for (const [path, version] of expectedApprovalDocuments) {
    const row = approval.split('\n').find((line) => line.startsWith(`| \`${path}\` |`))
    if (!row) {
        errors.push(`G1: missing exact document row ${path}`)
    } else if (!row.includes(`| \`${version}\` |`)) {
        errors.push(`G1: stale or malformed version for ${path}`)
    }
}

if (status === 'pending') {
    requireText(approval, 'payment activation and real-money processing', 'G1 pending blockers')
    requireText(approval, 'irreversible account/data deletion', 'G1 pending blockers')
    requireText(approval, 'public launch and production release', 'G1 pending blockers')
} else if (status === 'passed') {
    if (commercial.includes('[REQUIRED APPROVAL]')) errors.push('G1 passed but commercial/refund matrix has unresolved cells')
    if (retention.includes('[REQUIRED APPROVAL]')) errors.push('G1 passed but retention/legal matrix has unresolved cells')

    const unchecked = approval.split('\n').filter((line) => line.startsWith('- [ ]'))
    if (unchecked.length > 0) errors.push(`G1 passed but ${unchecked.length} completeness checks are unchecked`)

    for (const role of requiredRoles) {
        const row = approval.split('\n').find((line) => line.startsWith(`| ${role} |`)) ?? ''
        if (/\[(?:REQUIRED|REQUIRED APPROVAL)\]/.test(row) || !row.endsWith('| approved |')) {
            errors.push(`G1 passed but ${role} approval is incomplete`)
        }
    }

    for (const [path, , content] of expectedApprovalDocuments) {
        const row = approval.split('\n').find((line) => line.startsWith(`| \`${path}\` |`)) ?? ''
        if (!row.includes(`| \`${sha256(content)}\` |`)) errors.push(`G1 passed but content hash is missing or stale for ${path}`)
    }
}

const git = spawnSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
const worktree = git.status === 0 ? (git.stdout.trim() ? 'dirty' : 'clean') : 'unknown'

if (errors.length > 0) {
    console.error(`POLICY VALIDATION FAIL (${errors.length} issue${errors.length === 1 ? '' : 's'}; gate=${status ?? 'unknown'}; worktree=${worktree})`)
    for (const error of errors) console.error(`- ${error}`)
    console.error('Fail-closed result: payment, public launch, and irreversible deletion remain blocked.')
    process.exit(1)
}

console.log(`POLICY VALIDATION PASS (gate=${status}; worktree=${worktree})`)
if (status === 'pending') {
    console.log('Fail-closed result: documentation is structurally valid, but payment, public launch, and irreversible deletion remain blocked.')
} else {
    console.log('G1 structure is complete. This command does not authenticate signatures or authorize production release.')
}
