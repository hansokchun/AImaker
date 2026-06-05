import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

    it('publishes a new expert product and opens the product detail page', async () => {
        render(
            <MemoryRouter initialEntries={['/products/new']}>
                <Routes>
                    <Route path="/products/new" element={<><ProductRegister /><LocationProbe /></>} />
                    <Route path="/expert/:id" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: '새 AI 영상 상품' } })
        fireEvent.change(screen.getByLabelText('상품 요약'), { target: { value: '짧은 홍보 영상을 빠르게 만듭니다.' } })
        fireEvent.change(screen.getByLabelText('상품 설명'), { target: { value: '기획, 이미지, 편집 방향까지 포함합니다.' } })
        fireEvent.change(screen.getByLabelText('썸네일 이미지 URL'), { target: { value: 'https://example.com/thumb.jpg' } })
        fireEvent.change(screen.getByLabelText('사용 도구'), { target: { value: 'Runway, ChatGPT' } })
        fireEvent.change(screen.getByLabelText('시작 가격'), { target: { value: '55000' } })
        fireEvent.change(screen.getByLabelText('작업 기간'), { target: { value: '4' } })
        fireEvent.click(screen.getByRole('button', { name: '등록하기' }))

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    expertId: 'expert-user-01',
                    expertName: 'expert@example.com',
                    title: '새 AI 영상 상품',
                    summary: '짧은 홍보 영상을 빠르게 만듭니다.',
                    description: '기획, 이미지, 편집 방향까지 포함합니다.',
                    aiTools: ['Runway', 'ChatGPT'],
                    sampleImageUrl: 'https://example.com/thumb.jpg',
                    startingPrice: 55000,
                    deliveryDays: 4,
                    status: 'published',
                }),
            ),
        )
        await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/^\/expert\/product-expert-user-01-/))
    })
})
