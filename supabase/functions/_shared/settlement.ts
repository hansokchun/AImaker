export const DEFAULT_PLATFORM_FEE_RATE = 0.12

export const getPlatformFeeRate = () => {
    const rawRate = Deno.env.get('PLATFORM_FEE_RATE')?.trim()
    if (!rawRate) return DEFAULT_PLATFORM_FEE_RATE

    const rate = Number(rawRate)
    if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
        throw new Error('PLATFORM_FEE_RATE는 0 이상 1 미만의 숫자여야 합니다.')
    }

    return rate
}

export const calculateSettlementAmounts = (totalPrice: number, platformFeeRate: number) => {
    const platformFee = Math.round(totalPrice * platformFeeRate)

    return {
        platformFee,
        expertPayout: totalPrice - platformFee,
    }
}
