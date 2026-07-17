const isNonEmpty = (name: string): boolean => (Deno.env.get(name)?.trim().length ?? 0) > 0

export const isPaymentPolicyActive = (): boolean => {
    if (Deno.env.get('PAYMENT_POLICY_APPROVED') !== 'true') return false
    if (!isNonEmpty('PAYMENT_POLICY_VERSION') || !isNonEmpty('PAYMENT_POLICY_APPROVAL_HASH')) return false

    const rawRate = Deno.env.get('PLATFORM_FEE_RATE')?.trim()
    if (!rawRate) return false
    const rate = Number(rawRate)
    return Number.isFinite(rate) && rate >= 0 && rate < 1
}

export const paymentPolicyUnavailableResponse = (): Response =>
    jsonResponse({ message: 'Payment and settlement policy approval is required.' }, { status: 503 })
import { jsonResponse } from './cors.ts'
