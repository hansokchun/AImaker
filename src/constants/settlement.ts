export const DEFAULT_PLATFORM_FEE_RATE = 0

const readPlatformFeeRate = () => {
    const rawRate = import.meta.env.VITE_PLATFORM_FEE_RATE?.trim()
    if (!rawRate) return DEFAULT_PLATFORM_FEE_RATE

    const rate = Number(rawRate)
    return Number.isFinite(rate) && rate >= 0 && rate < 1 ? rate : DEFAULT_PLATFORM_FEE_RATE
}

export const PLATFORM_FEE_RATE = readPlatformFeeRate()

export const calculateSettlementAmounts = (totalPrice: number, platformFeeRate = PLATFORM_FEE_RATE) => {
    const platformFee = Math.round(totalPrice * platformFeeRate)

    return {
        platformFee,
        expertPayout: totalPrice - platformFee,
    }
}
