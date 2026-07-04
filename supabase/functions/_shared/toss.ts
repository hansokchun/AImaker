export type TossPaymentStatus = 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'EXPIRED' | 'ABORTED'

export type TossPayment = {
    readonly paymentKey: string
    readonly orderId: string
    readonly orderName?: string
    readonly status: TossPaymentStatus
    readonly totalAmount: number
    readonly approvedAt?: string
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

const isTossPayment = (value: unknown): value is TossPayment => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<TossPayment>
    return typeof candidate.paymentKey === 'string'
        && typeof candidate.orderId === 'string'
        && typeof candidate.status === 'string'
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
    const response = await fetch(`https://api.tosspayments.com/v1/payments/orders/${input.orderId}`, {
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
