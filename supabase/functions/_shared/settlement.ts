export const getPlatformFeeRate = (): number => {
    const rawRate = Deno.env.get('PLATFORM_FEE_RATE')?.trim()
    if (!rawRate) throw new Error('PLATFORM_FEE_RATE is required')

    const rate = Number(rawRate)
    if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
        throw new Error('PLATFORM_FEE_RATE must be a number from 0 (inclusive) to 1 (exclusive)')
    }
    return rate
}

export const calculateSettlementAmounts = (totalPrice: number, platformFeeRate: number) => {
    const platformFee = Math.round(totalPrice * platformFeeRate)
    return { platformFee, expertPayout: totalPrice - platformFee }
}
