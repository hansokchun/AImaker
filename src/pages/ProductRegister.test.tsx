import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductRegister from './ProductRegister'
import type { ExpertProduct } from '../types'

const saveExpertProduct = vi.fn(async (_product: ExpertProduct) => undefined)

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        session: { user: { id: 'expert-user-01', email: 'expert@example.com' } },
        user: { id: 'expert-user-01', email: 'expert@example.com' },
        loading: false,
    }),
}))

vi.mock('../lib/storage', () => ({
    saveExpertProduct: (product: ExpertProduct) => saveExpertProduct(product),
}))

function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{location.pathname}</span>
}

describe('ProductRegister', () => {
    beforeEach(() => {
        saveExpertProduct.mockClear()
    })

    it('publishes a product with category, packages, sample links, and small attached references', async () => {
        render(
            <MemoryRouter initialEntries={['/products/new']}>
                <Routes>
                    <Route path="/products/new" element={<><ProductRegister /><LocationProbe /></>} />
                    <Route path="/expert/:id" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: 'AI 숏폼 영상 패키지' } })
        fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: 'ai-video-shortform' } })
        fireEvent.change(screen.getByLabelText('상품 요약'), { target: { value: '15초 숏폼 영상 콘셉트와 초안을 제작합니다.' } })
        fireEvent.change(screen.getByLabelText('상품 설명'), { target: { value: '브랜드 홍보용 숏폼 영상의 기획, 콘셉트, 편집 방향을 제공합니다.' } })
        fireEvent.change(screen.getByLabelText('작업 범위'), { target: { value: '기획 방향 정리\nAI 영상 시안 제작\n짧은 편집 가이드 제공' } })
        fireEvent.change(screen.getByLabelText('작업 절차'), { target: { value: '요구사항 확인\n초안 제작\n수정 반영\n최종 전달' } })
        fireEvent.change(screen.getByLabelText('구매 전 준비사항'), { target: { value: '브랜드명, 참고 영상, 원하는 분위기를 준비해 주세요.' } })
        fireEvent.change(screen.getByLabelText('추가 옵션'), { target: { value: '긴급 작업 +20,000원\n추가 수정 1회 +10,000원' } })
        fireEvent.change(screen.getByLabelText('사용 도구'), { target: { value: 'ChatGPT, Runway, Premiere Pro' } })
        fireEvent.change(screen.getByLabelText('샘플 링크'), { target: { value: 'https://example.com/samples/shortform\nhttps://example.com/portfolio' } })
        fireEvent.change(screen.getByLabelText('썸네일 이미지 URL'), { target: { value: 'https://example.com/thumb.jpg' } })
        fireEvent.change(screen.getByLabelText('썸네일 이미지 첨부'), {
            target: { files: [new File(['tiny-image'], 'thumb.png', { type: 'image/png' })] },
        })
        fireEvent.change(screen.getByLabelText('참고자료 첨부'), {
            target: { files: [new File(['brief'], 'brief.txt', { type: 'text/plain' })] },
        })
        fireEvent.click(screen.getByRole('checkbox', { name: '이미지와 설명 등록 유의사항을 확인했습니다' }))

        const standard = screen.getByTestId('package-standard')
        fireEvent.change(within(standard).getByLabelText('가격'), { target: { value: '30000' } })
        fireEvent.change(within(standard).getByLabelText('작업일'), { target: { value: '2' } })
        fireEvent.change(within(standard).getByLabelText('수정 횟수'), { target: { value: '1' } })
        fireEvent.change(within(standard).getByLabelText('포함 항목'), { target: { value: '15초 영상 콘셉트\n대본 초안\nAI 영상 시안 1개' } })

        const deluxe = screen.getByTestId('package-deluxe')
        fireEvent.click(within(deluxe).getByRole('checkbox', { name: 'Deluxe 사용' }))
        fireEvent.change(within(deluxe).getByLabelText('가격'), { target: { value: '70000' } })
        fireEvent.change(within(deluxe).getByLabelText('작업일'), { target: { value: '4' } })
        fireEvent.change(within(deluxe).getByLabelText('수정 횟수'), { target: { value: '2' } })
        fireEvent.change(within(deluxe).getByLabelText('포함 항목'), { target: { value: '30초 영상 콘셉트\n대본\nAI 영상 시안 2개\n기본 편집' } })

        const premium = screen.getByTestId('package-premium')
        fireEvent.click(within(premium).getByRole('checkbox', { name: 'Premium 사용' }))
        fireEvent.change(within(premium).getByLabelText('가격'), { target: { value: '120000' } })
        fireEvent.change(within(premium).getByLabelText('작업일'), { target: { value: '7' } })
        fireEvent.change(within(premium).getByLabelText('수정 횟수'), { target: { value: '3' } })
        fireEvent.change(within(premium).getByLabelText('포함 항목'), { target: { value: '브랜드 숏폼 세트\n자막 스타일 가이드\n활용 가이드' } })

        fireEvent.click(screen.getByRole('button', { name: '등록하기' }))

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    expertId: 'expert-user-01',
                    expertName: 'expert@example.com',
                    title: 'AI 숏폼 영상 패키지',
                    category: 'ai-video-shortform',
                    summary: '15초 숏폼 영상 콘셉트와 초안을 제작합니다.',
                    description: expect.stringContaining('브랜드 홍보용 숏폼 영상의 기획, 콘셉트, 편집 방향을 제공합니다.'),
                    aiTools: ['ChatGPT', 'Runway', 'Premiere Pro'],
                    sampleImageUrl: expect.stringMatching(/^data:image\/png;base64,/),
                    sampleLinks: expect.arrayContaining([
                        'https://example.com/samples/shortform',
                        'https://example.com/portfolio',
                        expect.stringMatching(/^data:text\/plain;base64,/),
                    ]),
                    startingPrice: 30000,
                    deliveryDays: 2,
                    revisionCount: 1,
                    status: 'published',
                    packages: {
                        standard: {
                            name: 'Standard',
                            price: 30000,
                            deliveryDays: 2,
                            revisionCount: 1,
                            included: ['15초 영상 콘셉트', '대본 초안', 'AI 영상 시안 1개'],
                        },
                        deluxe: {
                            name: 'Deluxe',
                            price: 70000,
                            deliveryDays: 4,
                            revisionCount: 2,
                            included: ['30초 영상 콘셉트', '대본', 'AI 영상 시안 2개', '기본 편집'],
                        },
                        premium: {
                            name: 'Premium',
                            price: 120000,
                            deliveryDays: 7,
                            revisionCount: 3,
                            included: ['브랜드 숏폼 세트', '자막 스타일 가이드', '활용 가이드'],
                        },
                    },
                }),
            ),
        )
        const savedProduct = saveExpertProduct.mock.calls[0][0]
        expect(savedProduct.description).toContain('## 작업 범위')
        expect(savedProduct.description).toContain('기획 방향 정리')
        expect(savedProduct.description).toContain('## 작업 절차')
        expect(savedProduct.description).toContain('초안 제작')
        expect(savedProduct.description).toContain('## 구매 전 준비사항')
        expect(savedProduct.description).toContain('브랜드명, 참고 영상, 원하는 분위기')
        expect(savedProduct.description).toContain('## 추가 옵션')
        expect(savedProduct.description).toContain('긴급 작업 +20,000원')
        await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/^\/expert\/product-expert-user-01-/))
    })
})
