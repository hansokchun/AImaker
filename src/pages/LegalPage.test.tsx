import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LegalPage from './LegalPage'

describe('LegalPage', () => {
    it('renders the terms policy with payment and auto-confirmation guidance', () => {
        render(<LegalPage variant="terms" />)

        expect(screen.getByRole('heading', { name: '이용약관' })).toBeInTheDocument()
        expect(screen.getByText(/토스페이먼츠 결제를 완료하면 작업방이 생성됩니다/)).toBeInTheDocument()
        expect(screen.getByText(/7일 동안 의뢰자 응답이 없으면 8일째 자동 구매확정/)).toBeInTheDocument()
    })

    it('renders the privacy policy with notification and withdrawal guidance', () => {
        render(<LegalPage variant="privacy" />)

        expect(screen.getByRole('heading', { name: '개인정보 처리방침' })).toBeInTheDocument()
        expect(screen.getByText(/카카오 알림톡 또는 SMS 발송/)).toBeInTheDocument()
        expect(screen.getByText(/공개 상품은 숨김 처리되고 프로필은 거래 기록 식별에 필요한 최소 정보만 남긴 제한 상태/)).toBeInTheDocument()
    })
})
