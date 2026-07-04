import { describe, expect, it } from 'vitest'
import { DEFAULT_PLATFORM_FEE_RATE, PLATFORM_FEE_RATE, calculateSettlementAmounts } from './settlement'

describe('settlement configuration', () => {
    it('calculates platform fee and expert payout from the configured default rate', () => {
        const settlement = calculateSettlementAmounts(100_000)

        expect(DEFAULT_PLATFORM_FEE_RATE).toBe(0)
        expect(PLATFORM_FEE_RATE).toBe(0)
        expect(settlement).toEqual({
            platformFee: 0,
            expertPayout: 100_000,
        })
    })

    it('supports a custom platform fee rate for future fee changes', () => {
        expect(calculateSettlementAmounts(33_333, 0.15)).toEqual({
            platformFee: 5_000,
            expertPayout: 28_333,
        })
    })
})
