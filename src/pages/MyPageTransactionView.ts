import type { Consultation, ServiceRequestData } from '../types'

export type WorkStatusTone = 'consultation' | 'payment' | 'work' | 'done' | 'stopped' | 'neutral'

export type UnifiedWorkStopReason = 'cancelled-request' | 'cancelled-work' | 'cancelled-proposal'

export type UnifiedWorkItem =
    | {
        readonly kind: 'product'
        readonly id: string | number
        readonly createdTime: number
        readonly request: ServiceRequestData
        readonly stoppedReason?: UnifiedWorkStopReason
    }
    | {
        readonly kind: 'consultation'
        readonly id: string
        readonly createdTime: number
        readonly consultation: Consultation
    }

export const sortUnifiedWorkItems = (items: readonly UnifiedWorkItem[]): UnifiedWorkItem[] =>
    [...items].sort((first, second) => second.createdTime - first.createdTime)

export const formatTransactionDate = (value?: number | string | null): string => {
    if (!value) return '-'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
}

export const formatTransactionDateTime = (value?: number | string | null): string => {
    if (!value) return '-'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'

    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${formatTransactionDate(value)} ${hours}:${minutes}`
}

export const getTransactionNumber = (item: UnifiedWorkItem): string => {
    const date = new Date(item.createdTime)
    const year = Number.isNaN(date.getTime()) ? '0000' : String(date.getFullYear())
    const month = Number.isNaN(date.getTime()) ? '00' : String(date.getMonth() + 1).padStart(2, '0')
    const day = Number.isNaN(date.getTime()) ? '00' : String(date.getDate()).padStart(2, '0')
    const rawId = String(item.id).replace(/[^a-zA-Z0-9]/g, '').slice(-3).toUpperCase().padStart(3, '0')
    return `TR-${year}-${month}${day}-${rawId}`
}
