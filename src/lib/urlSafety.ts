export const SAFE_EXTERNAL_URL_MESSAGE = 'http:// 또는 https://로 시작하는 제출물 링크만 등록할 수 있습니다.'

export const normalizeSafeExternalUrl = (value?: string | null): string | null => {
    const trimmed = value?.trim()
    if (!trimmed) return null

    try {
        const url = new URL(trimmed)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
    } catch (error: unknown) {
        if (!(error instanceof TypeError)) throw error
        return null
    }
}
