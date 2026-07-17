export type TossPaymentStatus =
    | 'READY'
    | 'IN_PROGRESS'
    | 'WAITING_FOR_DEPOSIT'
    | 'DONE'
    | 'CANCELED'
    | 'PARTIAL_CANCELED'
    | 'EXPIRED'
    | 'ABORTED'

export type TossPayment = {
    readonly paymentKey: string
    readonly orderId: string
    readonly orderName?: string
    readonly status: TossPaymentStatus
    readonly totalAmount: number
    readonly approvedAt?: string
    readonly canceledAt?: string
}

export class TossApiError extends Error {
    readonly status: number

    constructor(message: string, status: number) {
        super(message)
        this.name = 'TossApiError'
        this.status = status
    }
}

const tossAuthorization = (secretKey: string): string => `Basic ${btoa(`${secretKey}:`)}`

const tossPaymentStatuses = new Set<TossPaymentStatus>([
    'READY', 'IN_PROGRESS', 'WAITING_FOR_DEPOSIT', 'DONE', 'CANCELED',
    'PARTIAL_CANCELED', 'EXPIRED', 'ABORTED',
])

const isTossPayment = (value: unknown): value is TossPayment => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<TossPayment>
    return typeof candidate.paymentKey === 'string'
        && typeof candidate.orderId === 'string'
        && typeof candidate.status === 'string'
        && tossPaymentStatuses.has(candidate.status as TossPaymentStatus)
        && typeof candidate.totalAmount === 'number'
}

export async function confirmTossPayment(input: {
    readonly secretKey: string
    readonly paymentKey: string
    readonly orderId: string
    readonly amount: number
}): Promise<TossPayment> {
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: {
            Authorization: tossAuthorization(input.secretKey),
            'Content-Type': 'application/json',
            'Idempotency-Key': input.orderId,
        },
        body: JSON.stringify({
            paymentKey: input.paymentKey,
            orderId: input.orderId,
            amount: input.amount,
        }),
    })
    const payload: unknown = await response.json()

    if (!response.ok) {
        throw new TossApiError('토스페이먼츠 결제 승인 요청이 실패했습니다.', response.status)
    }

    if (!isTossPayment(payload)) {
        throw new TossApiError('토스페이먼츠 결제 승인 응답이 올바르지 않습니다.', 502)
    }

    return payload
}

export async function getTossPaymentByOrderId(input: {
    readonly secretKey: string
    readonly orderId: string
}): Promise<TossPayment> {
    const response = await fetch(`https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(input.orderId)}`, {
        headers: {
            Authorization: tossAuthorization(input.secretKey),
        },
    })
    const payload: unknown = await response.json()

    if (!response.ok) {
        throw new TossApiError('토스페이먼츠 결제 조회 요청이 실패했습니다.', response.status)
    }

    if (!isTossPayment(payload)) {
        throw new TossApiError('토스페이먼츠 결제 조회 응답이 올바르지 않습니다.', 502)
    }

    return payload
}

export async function cancelTossPayment(input: {
    readonly secretKey: string
    readonly paymentKey: string
    readonly cancelReason: string
    readonly idempotencyKey: string
}): Promise<TossPayment> {
    const response = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(input.paymentKey)}/cancel`, {
        method: 'POST',
        headers: {
            Authorization: tossAuthorization(input.secretKey),
            'Content-Type': 'application/json',
            'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify({
            cancelReason: input.cancelReason,
        }),
    })
    const payload: unknown = await response.json()

    if (!response.ok) {
        throw new TossApiError('토스페이먼츠 결제 취소 요청에 실패했습니다.', response.status)
    }

    if (!isTossPayment(payload)) {
        throw new TossApiError('토스페이먼츠 결제 취소 응답이 올바르지 않습니다.', 502)
    }

    return payload
}
