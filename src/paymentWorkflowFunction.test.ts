import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const paymentWorkflowSource = readFileSync(
    join(process.cwd(), 'supabase', 'functions', '_shared', 'payment-workflow.ts'),
    'utf8',
)

describe('payment workflow shared Edge Function helper', () => {
    it('queues payment and workroom notifications after approved payment repair', () => {
        expect(paymentWorkflowSource).toMatch(/const queuePaymentNotifications = async/)
        expect(paymentWorkflowSource).toMatch(/event_type: 'payment_completed'/)
        expect(paymentWorkflowSource).toMatch(/event_type: 'workroom_created'/)
        expect(paymentWorkflowSource).toMatch(/from\('notification_events'\)\.insert\(events\)/)
        expect(paymentWorkflowSource).toMatch(/payment_notification_queue_failed/)
        expect(paymentWorkflowSource).toMatch(/detail: \{ proposalId: proposal\.id, error: error\.message \}/)
        expect(paymentWorkflowSource).toMatch(/await queuePaymentNotifications\(client, proposal, workResult\.workId\)/)
    })
})
