import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { executeFinancialRpc, requiredString } from '../_shared/financial-contracts.ts'
import { isPaymentPolicyActive } from '../_shared/payment-policy.ts'
import { createServiceClient, getRequiredEnv } from '../_shared/supabase.ts'
import { getTossPaymentByOrderId, TossApiError } from '../_shared/toss.ts'

type TossWebhookPayload = { readonly eventType: 'PAYMENT_STATUS_CHANGED'; readonly data: { readonly orderId: string } }
const isWebhookPayload = (value: unknown): value is TossWebhookPayload => typeof value === 'object' && value !== null
    && 'eventType' in value && value.eventType === 'PAYMENT_STATUS_CHANGED'
    && 'data' in value && typeof value.data === 'object' && value.data !== null
    && 'orderId' in value.data && typeof value.data.orderId === 'string'
    && value.data.orderId.length > 0 && value.data.orderId.length <= 128
    && /^[A-Za-z0-9_-]+$/.test(value.data.orderId)

const eventKeyFor = (orderId: string, paymentKey: string, status: string): string =>
    `verified:${orderId}:${paymentKey}:${status}`

export async function handlePaymentWebhook(request: Request): Promise<Response> {
    const options = handleOptions(request)
    if (options) return options
    let client: ReturnType<typeof createServiceClient> | null = null
    let inboxId: string | null = null
    let operationId: string | null = null
    try {
        const payload: unknown = await request.json()
        if (!isWebhookPayload(payload)) return jsonResponse({ message: 'Invalid or unsupported webhook payload.' }, { status: 400 })
        client = createServiceClient()
        const { data: localOrder } = await client.from('payment_orders').select('id')
            .eq('order_id', payload.data.orderId).maybeSingle()
        if (!localOrder) return jsonResponse({ message: 'Unknown payment order.' }, { status: 404 })
        const payment = await getTossPaymentByOrderId({
            secretKey: getRequiredEnv('TOSS_PAYMENTS_SECRET_KEY'),
            orderId: payload.data.orderId,
        })
        if (payment.orderId !== payload.data.orderId) return jsonResponse({ message: 'Provider order mismatch.' }, { status: 409 })
        const eventKey = eventKeyFor(payment.orderId, payment.paymentKey, payment.status)
        const inbox = await executeFinancialRpc(client, 'record_provider_event', {
            p_provider: 'toss',
            p_provider_event_key: eventKey,
            p_event_type: payload.eventType,
            p_order_id: payment.orderId,
            p_payload: {
                orderId: payment.orderId,
                paymentKey: payment.paymentKey,
                status: payment.status,
                totalAmount: payment.totalAmount,
                approvedAt: payment.approvedAt ?? null,
                canceledAt: payment.canceledAt ?? null,
            },
        })
        inboxId = requiredString(inbox, 'inboxId')
        if (inbox.kind === 'duplicate' && inbox.status !== 'received') return jsonResponse({ received: true })

        if (payment.status === 'DONE' && isPaymentPolicyActive()) {
            const begun = await executeFinancialRpc(client, 'begin_payment_confirmation', {
                p_order_id: payment.orderId,
                p_client_id: requiredString(inbox, 'clientId'),
                p_payment_key: payment.paymentKey,
                p_amount: payment.totalAmount,
                p_currency: 'KRW',
                p_business_key: `confirm:${payment.orderId}:${payment.paymentKey}`,
            })
            if (begun.kind !== 'completed') {
                operationId = requiredString(begun, 'operationId')
                await executeFinancialRpc(client, 'finalize_payment_confirmation', {
                    p_operation_id: operationId,
                    p_provider_status: payment.status,
                    p_payment_key: payment.paymentKey,
                    p_order_id: payment.orderId,
                    p_amount: payment.totalAmount,
                    p_currency: 'KRW',
                    p_approved_at: payment.approvedAt ?? null,
                })
            }
            await executeFinancialRpc(client, 'apply_provider_event_result', {
                p_inbox_id: inboxId, p_status: 'processed', p_failure_message: null,
            })
        } else if (payment.status === 'DONE' || payment.status === 'CANCELED' || payment.status === 'PARTIAL_CANCELED') {
            await executeFinancialRpc(client, 'apply_provider_event_result', {
                p_inbox_id: inboxId,
                p_status: 'manual_review',
                p_failure_message: payment.status === 'DONE' ? 'G1 policy approval is pending' : 'Cancellation requires payment reconciliation',
            })
        } else if (payment.status === 'EXPIRED' || payment.status === 'ABORTED') {
            await executeFinancialRpc(client, 'record_payment_failure', {
                p_order_id: payment.orderId,
                p_client_id: requiredString(inbox, 'clientId'),
                p_failure_code: payment.status,
                p_failure_message: 'Verified terminal provider status',
                p_business_key: `provider-failure:${eventKey}`,
            })
            await executeFinancialRpc(client, 'apply_provider_event_result', {
                p_inbox_id: inboxId, p_status: 'processed', p_failure_message: null,
            })
        } else {
            await executeFinancialRpc(client, 'apply_provider_event_result', {
                p_inbox_id: inboxId, p_status: 'ignored', p_failure_message: `Non-terminal provider status: ${payment.status}`,
            })
        }
        return jsonResponse({ received: true })
    } catch (error) {
        if (operationId && client) {
            try {
                await executeFinancialRpc(client, 'record_financial_reconciliation', {
                    p_operation_id: operationId,
                    p_reason: 'webhook_payment_finalize_failed',
                    p_failure_code: 'DB_FINALIZE_FAILED',
                    p_failure_message: 'Verified provider payment requires reconciliation',
                })
            } catch {
                return jsonResponse({ message: 'Webhook reconciliation could not be recorded.' }, { status: 500 })
            }
        } else if (inboxId && client) {
            try {
                await executeFinancialRpc(client, 'apply_provider_event_result', {
                    p_inbox_id: inboxId,
                    p_status: 'manual_review',
                    p_failure_message: 'Verified provider event could not be finalized',
                })
            } catch {
                return jsonResponse({ message: 'Webhook reconciliation could not be recorded.' }, { status: 500 })
            }
        }
        return error instanceof TossApiError
            ? jsonResponse({ message: 'Webhook provider verification failed.' }, { status: 502 })
            : jsonResponse({ message: 'Webhook could not be processed.' }, { status: 500 })
    }
}

if (import.meta.main) Deno.serve(handlePaymentWebhook)
