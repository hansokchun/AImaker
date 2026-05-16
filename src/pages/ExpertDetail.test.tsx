import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ExpertDetail from './ExpertDetail'
import { mockExpertProducts } from '../data/mockData'

describe('ExpertDetail', () => {
    it('highlights product details, sample result, AI tools, and package request CTA', async () => {
        const product = mockExpertProducts[0]

        render(
            <MemoryRouter initialEntries={[`/expert/${product.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: product.title })).toBeInTheDocument()
        expect(screen.getByText(product.description)).toBeInTheDocument()
        expect(screen.getByAltText(`${product.title} 샘플 결과물`)).toBeInTheDocument()
        expect(screen.getByText('ChatGPT')).toBeInTheDocument()
        expect(screen.getByText('Runway')).toBeInTheDocument()
        expect(screen.getByText('Premiere Pro')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '패키지로 의뢰하기' })).toHaveAttribute(
            'href',
            `/request/${product.id}`,
        )
    })
})
