import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const readWorkflowFile = (fileName: string): string =>
    readFileSync(join(process.cwd(), 'supabase', 'functions', 'trade-workflow', fileName), 'utf8')

const indexSource = readWorkflowFile('index.ts')
const workHandlersSource = readWorkflowFile('work-handlers.ts')
const adminHandlersSource = readWorkflowFile('admin-handlers.ts')
const validationSource = readWorkflowFile('validation.ts')
const proposalHandlersSource = readWorkflowFile('proposal-handlers.ts')
const notificationsSource = readWorkflowFile('notifications.ts')
const financialMigrationSource = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '20260714081201_add_atomic_financial_contracts.sql'),
    'utf8',
)

describe('trade-workflow Edge Function', () => {
    it('keeps the public entrypoint as a thin authenticated dispatcher', () => {
        expect(indexSource).toMatch(/const user = await requireUser\(request\)/)
        expect(indexSource).toMatch(/from\('profiles'\)[\s\S]*select\('account_status, withdrawn_at'\)[\s\S]*eq\('id', user\.id\)/)
        expect(indexSource).toMatch(/!isRecord\(profile\)[\s\S]*profile\.account_status !== 'active'[\s\S]*profile\.withdrawn_at !== null/)
        expect(indexSource.indexOf('createServiceClient()')).toBeGreaterThan(indexSource.indexOf('profile.withdrawn_at !== null'))
        expect(indexSource.indexOf(".from('profiles')")).toBeLessThan(indexSource.indexOf('switch (body.type)'))
        expect(indexSource).toMatch(/if \(!isWorkflowRequest\(body\)\)/)
        expect(indexSource).toMatch(/case 'request_settlement_withdrawal':/)
        expect(indexSource.split('\n').length).toBeLessThan(80)
    })

    it('rejects withdrawn administrators before service-role moderation', () => {
        expect(adminHandlersSource).toMatch(/from\('profiles'\)[\s\S]*eq\('account_status', 'active'\)[\s\S]*is\('withdrawn_at', null\)/)
        expect(adminHandlersSource).toMatch(/if \(!isRecord\(profile\)\) return responseError\([^,]+, 403\)/)
    })

    it('proves work steps belong to the same work before service-role mutations', () => {
        expect(workHandlersSource).toMatch(/from\('work_steps'\)\.select\('id'\)\.eq\('id', stepId\)\.eq\('work_id', workId\)/)
        expect(workHandlersSource).toMatch(/update\(\{ status: 'submitted' \}\)\.eq\('id', payload\.stepId\)\.eq\('work_id', payload\.workId\)/)
        expect(workHandlersSource).toMatch(/executeFinancialRpc\(client, 'apply_deliverable_review'/)
        expect(financialMigrationSource).toMatch(/where id = deliverable_row\.step_id and work_id = work_row\.id/i)
    })

    it('recreates frozen-work guards that RLS cannot enforce for service-role calls', () => {
        expect(workHandlersSource).toMatch(/work\.dispute_status === 'open'/)
        expect(workHandlersSource).toMatch(/hasOpenCancellation\(work\)/)
        expect(workHandlersSource).toMatch(/const frozen = assertNotFrozen\(work, '제출물을 등록'\)/)
        expect(workHandlersSource).toMatch(/const frozen = assertNotFrozen\(work, approved \? '결과물을 승인' : '수정 요청'\)/)
    })

    it('preserves delivered-work completion and unlimited revision semantics', () => {
        expect(financialMigrationSource).toMatch(/work_row\.revision_limit > 0 and work_row\.revision_used >= work_row\.revision_limit/i)
        expect(financialMigrationSource).toMatch(/update public\.service_requests set status = 'completed' where id = work_row\.request_id/i)
    })

    it('rejects incomplete deliverable submissions at the boundary', () => {
        expect(validationSource).toMatch(/stringValue\(value, 'description'\)/)
        expect(validationSource).toMatch(/const externalUrl = stringValue\(value, 'externalUrl'\)/)
        expect(validationSource).toMatch(/&& externalUrl/)
        expect(validationSource).toMatch(/value\.retentionConfirmed === true/)
    })

    it('keeps proposal revision requests client-only before service-role updates', () => {
        expect(proposalHandlersSource).toMatch(/status === 'revision_requested' && data\.client_id !== userId/)
        expect(proposalHandlersSource).toMatch(/status === 'cancelled' && data\.client_id !== userId && data\.expert_id !== userId/)
    })

    it('queues user notifications inside the server workflow', () => {
        expect(workHandlersSource).toMatch(/queueTradeNotification\(client, work\.client_id, 'deliverable_submitted'/)
        expect(workHandlersSource).toMatch(/approved \? 'settlement_available' : 'revision_requested'/)
        expect(workHandlersSource).toMatch(/queueTradeNotification\(client, userId, 'settlement_requested'/)
        expect(notificationsSource).toMatch(/from\('notification_events'\)\.insert/)
        expect(notificationsSource).toMatch(/from\('notification_preferences'\)/)
        expect(notificationsSource).toMatch(/notification_queue_failed/)
        expect(notificationsSource).toMatch(/detail: \{ eventType: type, error: error\.message \}/)
        expect(notificationsSource).not.toMatch(/details:/)
    })
})
