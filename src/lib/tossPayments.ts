import { ROUTES } from '../constants/routes'
import { supabase } from './supabase'
import type { Proposal } from '../types'

type TossPaymentAmount = {
    readonly currency: 'KRW'
    readonly value: number
}

type TossRequestPaymentInput = {
    readonly method: 'CARD'
    readonly amount: TossPaymentAmount
    readonly orderId: string
    readonly orderName: string
    readonly successUrl: string
    readonly failUrl: string
    readonly customerEmail?: string
    readonly customerName?: string
    readonly card: {
        readonly useEscrow: boolean
        readonly flowMode: 'DEFAULT'
        readonly useCardPoint: boolean
        readonly useAppCardOnly: boolean
    }
}

type TossPayment = {
    readonly requestPayment: (input: TossRequestPaymentInput) => Promise<void>
}

type TossPaymentsSdk = {
    readonly payment: (input: { readonly customerKey: string }) => TossPayment
}

type TossPaymentsFactory = {
    readonly ANONYMOUS: string
    (clientKey: string): TossPaymentsSdk
}

declare global {
    interface Window {
        TossPayments?: TossPaymentsFactory
    }
}

export type TossCustomer = {
    readonly id: string
    readonly email?: string
    readonly name?: string
}

type TossOrderResponse = {
    readonly orderId: string
    readonly orderName: string
    readonly amount: number
}

export type TossConfirmResponse = {
    readonly proposalId: string
    readonly workId?: string
}

type TossFailResponse = {
    readonly status: 'failed' | 'approved'
}

export class PaymentConfigurationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'PaymentConfigurationError'
    }
}

export class PaymentRequestError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'PaymentRequestError'
    }
}

let sdkPromise: Promise<TossPaymentsFactory> | null = null
const TOSS_SDK_LOAD_TIMEOUT_MS = 30_000

const assertConfiguredSupabase = () => {
    if (!supabase) {
        throw new PaymentConfigurationError('Supabase 환경변수가 없어 실제 결제를 시작할 수 없습니다.')
    }

    return supabase
}

const getClientKey = () => {
    const clientKey = import.meta.env.VITE_TOSS_PAYMENTS_CLIENT_KEY?.trim()
    if (!clientKey) {
        throw new PaymentConfigurationError('VITE_TOSS_PAYMENTS_CLIENT_KEY가 설정되어 있지 않습니다.')
    }

    return clientKey
}

const isTossOrderResponse = (value: unknown): value is TossOrderResponse => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<TossOrderResponse>
    return typeof candidate.orderId === 'string'
        && typeof candidate.orderName === 'string'
        && typeof candidate.amount === 'number'
}

const isTossConfirmResponse = (value: unknown): value is TossConfirmResponse => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<TossConfirmResponse>
    return typeof candidate.proposalId === 'string'
        && (candidate.workId === undefined || typeof candidate.workId === 'string')
}

const isTossFailResponse = (value: unknown): value is TossFailResponse => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<TossFailResponse>
    return candidate.status === 'failed' || candidate.status === 'approved'
}

const loadTossPayments = async (): Promise<TossPaymentsFactory> => {
    if (window.TossPayments) return window.TossPayments
    if (sdkPromise) return sdkPromise

    sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        let settled = false
        const timeoutId = window.setTimeout(() => {
            if (settled) return
            settled = true
            sdkPromise = null
            script.remove()
            reject(new PaymentRequestError('토스페이먼츠 SDK 로딩 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'))
        }, TOSS_SDK_LOAD_TIMEOUT_MS)

        const settle = (callback: () => void) => {
            if (settled) return
            settled = true
            window.clearTimeout(timeoutId)
            callback()
        }

        script.src = 'https://js.tosspayments.com/v2/standard'
        script.async = true
        script.onload = () => {
            settle(() => {
                if (window.TossPayments) {
                    resolve(window.TossPayments)
                    return
                }

                sdkPromise = null
                reject(new PaymentRequestError('토스페이먼츠 SDK를 불러오지 못했습니다.'))
            })
        }
        script.onerror = () => {
            settle(() => {
                sdkPromise = null
                reject(new PaymentRequestError('토스페이먼츠 SDK 로딩에 실패했습니다.'))
            })
        }
        document.head.append(script)
    })

    return sdkPromise
}

export async function startTossProposalPayment(proposal: Proposal, customer: TossCustomer): Promise<void> {
    const clientKey = getClientKey()
    const client = assertConfiguredSupabase()
    const { data, error } = await client.functions.invoke('toss-payment-order', {
        body: { proposalId: proposal.id },
    })

    if (error) {
        throw new PaymentRequestError(error.message || '결제 주문 생성에 실패했습니다.')
    }

    if (!isTossOrderResponse(data)) {
        throw new PaymentRequestError('결제 주문 응답 형식이 올바르지 않습니다.')
    }

    const tossPayments = await loadTossPayments()
    const payment = tossPayments(clientKey).payment({
        customerKey: customer.id || tossPayments.ANONYMOUS,
    })

    await payment.requestPayment({
        method: 'CARD',
        amount: {
            currency: 'KRW',
            value: data.amount,
        },
        orderId: data.orderId,
        orderName: data.orderName,
        successUrl: `${window.location.origin}${ROUTES.TOSS_PAYMENT_SUCCESS}`,
        failUrl: `${window.location.origin}${ROUTES.TOSS_PAYMENT_FAIL}`,
        customerEmail: customer.email,
        customerName: customer.name,
        card: {
            useEscrow: false,
            flowMode: 'DEFAULT',
            useCardPoint: false,
            useAppCardOnly: false,
        },
    })
}

export async function confirmTossProposalPayment(input: {
    readonly paymentKey: string
    readonly orderId: string
    readonly amount: number
}): Promise<TossConfirmResponse> {
    const client = assertConfiguredSupabase()
    const { data, error } = await client.functions.invoke('toss-payment-confirm', {
        body: input,
    })

    if (error) {
        throw new PaymentRequestError(error.message || '결제 승인에 실패했습니다.')
    }

    if (!isTossConfirmResponse(data)) {
        throw new PaymentRequestError('결제 승인 응답 형식이 올바르지 않습니다.')
    }

    return data
}

export async function reportTossProposalPaymentFailure(input: {
    readonly orderId: string
    readonly code?: string
    readonly message?: string
}): Promise<TossFailResponse> {
    const client = assertConfiguredSupabase()
    const { data, error } = await client.functions.invoke('toss-payment-fail', {
        body: input,
    })

    if (error) {
        throw new PaymentRequestError(error.message || '결제 실패 상태 저장에 실패했습니다.')
    }

    if (!isTossFailResponse(data)) {
        throw new PaymentRequestError('결제 실패 응답 형식이 올바르지 않습니다.')
    }

    return data
}
