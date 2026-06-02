import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import PackageCard from './PackageCard'
import { mockExpertProducts } from '../data/mockData'

describe('PackageCard', () => {
    it('shows the required standard package and links CTA to the request form', () => {
        const product = mockExpertProducts[0]

        render(
            <MemoryRouter>
                <PackageCard productId={product.id} packages={product.packages} />
            </MemoryRouter>,
        )

        expect(screen.getByRole('button', { name: 'Standard' })).toHaveClass('active')
        expect(screen.getByText('30,000원')).toBeInTheDocument()
        expect(screen.getByText('결제 전 요구사항을 먼저 작성하고 전문가 제안을 받습니다.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '패키지로 의뢰하기' })).toHaveAttribute(
            'href',
            `/request/${product.id}`,
        )
    })

    it('renders a fallback package item when included items are missing', () => {
        const packages = {
            standard: {
                name: 'Standard',
                price: 50000,
                deliveryDays: 3,
                revisionCount: 1,
            },
            deluxe: null,
            premium: null,
        } as unknown as typeof mockExpertProducts[0]['packages']

        render(
            <MemoryRouter>
                <PackageCard productId="product-missing-included" packages={packages} />
            </MemoryRouter>,
        )

        expect(screen.getByRole('button', { name: 'Standard' })).toHaveClass('active')
        expect(screen.getByRole('link', { name: '패키지로 의뢰하기' })).toHaveAttribute(
            'href',
            '/request/product-missing-included',
        )
    })
})
