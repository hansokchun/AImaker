import { describe, expect, it } from 'vitest'
import { validateMarketplaceMessage } from './tradeSafety'

describe('trade safety message validation', () => {
    it('blocks contact information and off-platform deal attempts', () => {
        expect(validateMarketplaceMessage('카톡으로 이야기해요. 010-1234-5678입니다.')).toEqual({
            allowed: false,
            message: '연락처나 외부 결제 유도 문구가 포함되어 있어 메시지를 보낼 수 없습니다.',
        })
        expect(validateMarketplaceMessage('수수료 아까우니 계좌이체로 따로 거래해요.')).toEqual({
            allowed: false,
            message: '연락처나 외부 결제 유도 문구가 포함되어 있어 메시지를 보낼 수 없습니다.',
        })
        expect(validateMarketplaceMessage('open.kakao.com/o/testroom 으로 오세요.')).toEqual({
            allowed: false,
            message: '연락처나 외부 결제 유도 문구가 포함되어 있어 메시지를 보낼 수 없습니다.',
        })
    })

    it('allows ordinary work references and portfolio links', () => {
        expect(validateMarketplaceMessage('참고자료는 https://drive.google.com/file/d/sample 에 올려두었습니다.')).toEqual({
            allowed: true,
        })
        expect(validateMarketplaceMessage('피그마 시안과 노션 기획서를 확인해주세요.')).toEqual({
            allowed: true,
        })
    })
})
