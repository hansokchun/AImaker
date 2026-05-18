import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExpertDetail from './ExpertDetail'
import { mockExpertProducts } from '../data/mockData'
import type { ExpertProduct } from '../types'

const supabaseProduct: ExpertProduct = {
    ...mockExpertProducts[0],
    id: 'product-from-supabase-01',
    title: 'Supabase에서 불러온 AI 상품',
    description: '실제 DB 상품 상세 설명입니다.',
    summary: '실제 DB 상품 요약입니다.',
}

const getExpertProducts = vi.fn(async () => [supabaseProduct])

vi.mock('../lib/storage', () => ({
    getExpertProducts: () => getExpertProducts(),
}))

describe('ExpertDetail', () => {
    beforeEach(() => {
        getExpertProducts.mockReset()
        getExpertProducts.mockResolvedValue([supabaseProduct])
    })

    it('loads product details from the shared product storage', async () => {
        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()
        expect(screen.getByText(supabaseProduct.description)).toBeInTheDocument()
        expect(screen.getByText(supabaseProduct.summary)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '패키지로 의뢰하기' })).toHaveAttribute(
            'href',
            `/request/${supabaseProduct.id}`,
        )
    })

    it('shows a not found state without demo product content for unknown product ids', async () => {
        getExpertProducts.mockResolvedValue([supabaseProduct])

        render(
            <MemoryRouter initialEntries={['/expert/unknown-product-id']}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '상품을 찾을 수 없습니다' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'AI 작업 찾기로 돌아가기' })).toHaveAttribute('href', '/category')
        expect(screen.queryByText(supabaseProduct.title)).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '패키지로 의뢰하기' })).not.toBeInTheDocument()
    })
})
