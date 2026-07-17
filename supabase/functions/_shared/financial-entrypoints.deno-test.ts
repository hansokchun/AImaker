import { handlePaymentConfirm } from '../toss-payment-confirm/index.ts'
import { handlePaymentFail } from '../toss-payment-fail/index.ts'
import { handlePaymentOrder } from '../toss-payment-order/index.ts'
import { handlePaymentWebhook } from '../toss-payment-webhook/index.ts'
import { handlePaymentCancel } from '../toss-payment-cancel/index.ts'

const assertEquals = (actual: unknown, expected: unknown): void => {
    if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`)
}

Deno.test('payment order fails closed when G1 policy approval is absent', async () => {
    Deno.env.delete('PAYMENT_POLICY_APPROVED')
    const givenRequest = new Request('http://localhost/toss-payment-order', {
        method: 'POST',
        body: JSON.stringify({ proposalId: '00000000-0000-0000-0000-000000000001' }),
    })
    const whenResponse = await handlePaymentOrder(givenRequest)
    assertEquals(whenResponse.status, 503)
    assertEquals(whenResponse.headers.get('Access-Control-Allow-Origin'), '*')
    const thenBody: unknown = await whenResponse.json()
    if (typeof thenBody !== 'object' || thenBody === null || !('message' in thenBody)) {
        throw new Error('Expected a fail-closed JSON response')
    }
})

Deno.test('payment confirmation fails closed before contacting provider', async () => {
    Deno.env.delete('PAYMENT_POLICY_APPROVED')
    const givenRequest = new Request('http://localhost/toss-payment-confirm', {
        method: 'POST',
        body: JSON.stringify({ paymentKey: 'payment-key', orderId: 'order-id', amount: 1000 }),
    })
    const whenResponse = await handlePaymentConfirm(givenRequest)
    assertEquals(whenResponse.status, 503)
})

Deno.test('payment confirmation requires explicit policy version, approval hash, and fee rate', async () => {
    Deno.env.set('PAYMENT_POLICY_APPROVED', 'true')
    Deno.env.delete('PAYMENT_POLICY_VERSION')
    Deno.env.delete('PAYMENT_POLICY_APPROVAL_HASH')
    Deno.env.delete('PLATFORM_FEE_RATE')
    const givenRequest = new Request('http://localhost/toss-payment-confirm', {
        method: 'POST',
        body: JSON.stringify({ paymentKey: 'payment-key', orderId: 'order-id', amount: 1000 }),
    })
    const whenResponse = await handlePaymentConfirm(givenRequest)
    assertEquals(whenResponse.status, 503)
})

Deno.test('payment failure rejects malformed boundary input', async () => {
    const givenRequest = new Request('http://localhost/toss-payment-fail', {
        method: 'POST',
        body: JSON.stringify({ orderId: '' }),
    })
    const whenResponse = await handlePaymentFail(givenRequest)
    assertEquals(whenResponse.status, 400)
})

Deno.test('payment webhook rejects an unverifiable payload', async () => {
    const givenRequest = new Request('http://localhost/toss-payment-webhook', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'PAYMENT_STATUS_CHANGED', data: {} }),
    })
    const whenResponse = await handlePaymentWebhook(givenRequest)
    assertEquals(whenResponse.status, 400)
})

Deno.test('payment order answers CORS preflight without database access', async () => {
    const givenRequest = new Request('http://localhost/toss-payment-order', { method: 'OPTIONS' })
    const whenResponse = await handlePaymentOrder(givenRequest)
    assertEquals(whenResponse.status, 200)
    assertEquals(whenResponse.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')
})

Deno.test('payment cancellation answers CORS preflight without authentication', async () => {
    const whenResponse = await handlePaymentCancel(new Request('http://localhost/toss-payment-cancel', { method: 'OPTIONS' }))
    assertEquals(whenResponse.status, 200)
})
