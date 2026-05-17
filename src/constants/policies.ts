export const PROPOSAL_VALID_DAYS = 3

export const EXTERNAL_CONTACT_WARNING =
    '외부 연락처는 입력할 수 없습니다. 안전한 거래를 위해 플랫폼 안에서 소통해주세요.'

export const PRIVATE_CONTACT_PROHIBITED_NOTICE =
    '안전한 거래 기록을 위해 연락은 플랫폼 안에서 진행됩니다.'

export const REQUIRED_STANDARD_PACKAGE = 'standard'

const EXTERNAL_CONTACT_PATTERNS = [
    /\b[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+\b/i,
    /\b(?:010|011|016|017|018|019)[-\s.]?\d{3,4}[-\s.]?\d{4}\b/,
    /\b(?:kakao|kakaotalk|openchat|discord|telegram)\b/i,
    /(?:카카오|카톡|오픈채팅|디스코드|텔레그램)/,
]

export function hasExternalContact(text: string): boolean {
    return EXTERNAL_CONTACT_PATTERNS.some((pattern) => pattern.test(text))
}

export function hasExternalContactInFields(fields: string[]): boolean {
    return fields.some((field) => hasExternalContact(field))
}
