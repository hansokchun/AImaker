import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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

vi.mock('../lib/storage', () => ({
    getExpertProducts: vi.fn(async () => [supabaseProduct]),
}))

describe('ExpertDetail', () => {
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
})
