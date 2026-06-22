export type MarketplaceMessageValidation =
    | { allowed: true }
    | { allowed: false; message: string };

export const MARKETPLACE_MESSAGE_BLOCKED_MESSAGE =
    '연락처나 외부 결제 유도 문구가 포함되어 있어 메시지를 보낼 수 없습니다.';

const blockedPatterns = [
    /\b010[-.\s]?\d{3,4}[-.\s]?\d{4}\b/,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /open\.kakao\.com/i,
    /\bt\.me\//i,
    /카\s*톡|카카오\s*톡|오픈\s*채팅|kakao/i,
    /텔레그램|telegram|디스코드|discord|인스타|instagram|라인|line/i,
    /계좌|입금|무통장|송금|계좌\s*이체|밖에서\s*결제|외부\s*결제|따로\s*거래|직거래/i,
    /토스|paypal|페이팔/i,
];

export function validateMarketplaceMessage(body: string): MarketplaceMessageValidation {
    const normalizedBody = body.trim();
    if (!normalizedBody) return { allowed: true };

    const blocked = blockedPatterns.some((pattern) => pattern.test(normalizedBody));
    if (blocked) {
        return {
            allowed: false,
            message: MARKETPLACE_MESSAGE_BLOCKED_MESSAGE,
        };
    }

    return { allowed: true };
}
