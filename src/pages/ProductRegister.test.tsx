import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductRegister from './ProductRegister'
import type { ExpertProduct } from '../types'

const saveExpertProduct = vi.fn(async (_product: ExpertProduct) => undefined)
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

function renderRegister() {
    render(
        <MemoryRouter initialEntries={['/products/new']}>
            <Routes>
                <Route path="/products/new" element={<><ProductRegister /><LocationProbe /></>} />
                <Route path="/expert/:id" element={<LocationProbe />} />
            </Routes>
        </MemoryRouter>,
    )
}

describe('ProductRegister', () => {
    beforeEach(() => {
        saveExpertProduct.mockClear()
    })

    it('keeps the form close to Kmong service registration and publishes a single-price product', async () => {
        renderRegister()

        expect(screen.queryByTestId('package-standard')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('대표 이미지 URL')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('사용 도구')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('샘플 링크')).not.toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: 'AI 숏폼 영상 패키지' } })
        fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: 'ai-video-shortform' } })
        fireEvent.change(screen.getByLabelText('서비스 요약'), { target: { value: '15초 숏폼 영상 콘셉트와 초안을 제작합니다.' } })
        fireEvent.change(screen.getByLabelText('상세 설명'), { target: { value: '브랜드 홍보용 숏폼 영상의 기획, 콘셉트, 편집 방향을 제공합니다.\n\n작업 범위와 준비 자료를 함께 안내합니다.' } })
        fireEvent.change(screen.getByLabelText('대표 이미지 첨부'), {
            target: { files: [new File(['tiny-image'], 'thumb.png', { type: 'image/png' })] },
        })
        fireEvent.change(screen.getByLabelText('상세 이미지/포트폴리오 첨부'), {
            target: { files: [new File(['brief'], 'brief.txt', { type: 'text/plain' })] },
        })
        fireEvent.change(screen.getByLabelText('가격'), { target: { value: '30000' } })
        fireEvent.change(screen.getByLabelText('작업일'), { target: { value: '2' } })
        fireEvent.change(screen.getByLabelText('수정 횟수'), { target: { value: '1' } })
        fireEvent.change(screen.getByLabelText('기본 제공 항목'), { target: { value: '15초 영상 콘셉트\n대본 초안\nAI 영상 시안 1개' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '이미지와 설명 등록 유의사항을 확인했습니다' }))
        fireEvent.click(screen.getByRole('button', { name: '등록하기' }))

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.stringMatching(uuidPattern),
                    expertId: 'expert-user-01',
                    expertName: 'expert@example.com',
                    title: 'AI 숏폼 영상 패키지',
                    category: 'ai-video-shortform',
                    summary: '15초 숏폼 영상 콘셉트와 초안을 제작합니다.',
                    description: expect.stringContaining('브랜드 홍보용 숏폼 영상의 기획'),
                    aiTools: [],
                    sampleImageUrl: expect.stringMatching(/^data:image\/png;base64,/),
                    sampleLinks: [expect.stringMatching(/^data:text\/plain;base64,/)],
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
                        deluxe: null,
                        premium: null,
                    },
                }),
            ),
        )
        await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(new RegExp(`^/expert/${uuidPattern.source.slice(1, -1)}$`, 'i')))
    })

    it('shows Standard, Deluxe, and Premium fields only when package pricing is enabled', async () => {
        renderRegister()

        fireEvent.click(screen.getByRole('checkbox', { name: '패키지 가격 사용' }))

        const standard = screen.getByTestId('package-standard')
        const deluxe = screen.getByTestId('package-deluxe')
        const premium = screen.getByTestId('package-premium')

        expect(within(standard).getByLabelText('가격')).toBeInTheDocument()
        expect(within(deluxe).getByLabelText('가격')).toBeInTheDocument()
        expect(within(premium).getByLabelText('가격')).toBeInTheDocument()
    })
})
