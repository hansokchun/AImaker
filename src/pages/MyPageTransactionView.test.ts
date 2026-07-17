import { describe, expect, it } from 'vitest'
import type { ServiceRequestData } from '../types'
import {
    formatTransactionDate,
    formatTransactionDateTime,
    getTransactionNumber,
    sortUnifiedWorkItems,
} from './MyPageTransactionView'

const request: ServiceRequestData = {
    id: 'request-characterization-01',
    title: 'Transaction test request',
    description: 'Checks pure transaction presentation helpers.',
    budget: '50000',
    deadline: '2026-06-10',
    categories: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    status: 'pending',
}

describe('MyPageTransactionView', () => {
    it('formats valid transaction dates and rejects missing or malformed values', () => {
        expect(formatTransactionDate('2026-06-01T10:05:00.000Z')).toBe('2026.06.01')
        expect(formatTransactionDate('not-a-date')).toBe('-')
        expect(formatTransactionDate(null)).toBe('-')
    })

    it('formats a transaction date and time from the same local date value', () => {
        const value = '2026-06-01T10:05:00.000Z'
        const date = new Date(value)
        const expected = `${formatTransactionDate(value)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

        expect(formatTransactionDateTime(value)).toBe(expected)
    })

    it('derives the stable product-order label characterized by MyPage', () => {
        expect(getTransactionNumber({
            kind: 'product',
            id: request.id,
            createdTime: Date.parse(request.createdAt),
            request,
        })).toBe('TR-2026-0601-N01')
    })

    it('orders transaction view items by newest creation time without mutating the input', () => {
        const older = {
            kind: 'product' as const,
            id: 'older',
            createdTime: 1,
            request,
        }
        const newer = {
            kind: 'product' as const,
            id: 'newer',
            createdTime: 2,
            request,
        }

        expect(sortUnifiedWorkItems([older, newer]).map((item) => item.id)).toEqual(['newer', 'older'])
        expect([older, newer].map((item) => item.id)).toEqual(['older', 'newer'])
    })
})
