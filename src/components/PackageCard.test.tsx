import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import PackageCard from './PackageCard'
import { mockExpertProducts } from '../data/mockData'

function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{location.pathname}</span>
}

describe('PackageCard', () => {
    it('shows the required standard package and links CTA to the request form', () => {
        const product = mockExpertProducts[0]

        render(
            <MemoryRouter initialEntries={[`/expert/${product.id}`]}>
                <Routes>
                    <Route
                        path="/expert/:id"
                        element={
                            <>
                                <PackageCard productId={product.id} packages={product.packages} />
                                <LocationProbe />
                            </>
                        }
                    />
                    <Route path="/request/:productId" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByRole('button', { name: 'Standard' })).toHaveClass('active')
        expect(screen.getByText('30,000원')).toBeInTheDocument()
        expect(screen.getByText('결제 전 요구사항을 먼저 작성하고 전문가 제안을 받습니다.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '패키지로 의뢰하기' }))
        expect(screen.getByTestId('location')).toHaveTextContent(`/request/${product.id}`)
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
            <MemoryRouter initialEntries={['/expert/product-missing-included']}>
                <Routes>
                    <Route
                        path="/expert/:id"
                        element={
                            <>
                                <PackageCard productId="product-missing-included" packages={packages} />
                                <LocationProbe />
                            </>
                        }
                    />
                    <Route path="/request/:productId" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByRole('button', { name: 'Standard' })).toHaveClass('active')
        fireEvent.click(screen.getByRole('button', { name: '패키지로 의뢰하기' }))
        expect(screen.getByTestId('location')).toHaveTextContent('/request/product-missing-included')
    })

    it('hides buyer actions while the owner is viewing their own product', () => {
        const product = mockExpertProducts[0]

        render(
            <MemoryRouter>
                <PackageCard
                    productId={product.id}
                    packages={product.packages}
                    isOwner
                    onOpenChat={vi.fn()}
                />
            </MemoryRouter>,
        )

        expect(screen.queryByRole('link', { name: '패키지로 의뢰하기' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '전문가에게 문의하기' })).not.toBeInTheDocument()
        expect(screen.getByText('내가 등록한 상품입니다. 상품 수정에서 가격과 패키지 정보를 관리할 수 있습니다.')).toBeInTheDocument()
    })

    it('asks guests to log in before requesting a package', () => {
        const product = mockExpertProducts[0]
        const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

        render(
            <MemoryRouter initialEntries={[`/expert/${product.id}`]}>
                <Routes>
                    <Route
                        path="/expert/:id"
                        element={
                            <>
                                <PackageCard productId={product.id} packages={product.packages} requireLogin />
                                <LocationProbe />
                            </>
                        }
                    />
                    <Route path="/login" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '패키지로 의뢰하기' }))

        expect(alert).toHaveBeenCalledWith('로그인 후 이용할 수 있습니다.')
        expect(screen.getByTestId('location')).toHaveTextContent('/login')
        alert.mockRestore()
    })

    it('asks guests to log in before opening expert inquiry', () => {
        const product = mockExpertProducts[0]
        const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)

        render(
            <MemoryRouter initialEntries={[`/expert/${product.id}`]}>
                <Routes>
                    <Route
                        path="/expert/:id"
                        element={
                            <>
                                <PackageCard
                                    productId={product.id}
                                    packages={product.packages}
                                    requireLogin
                                    onOpenChat={vi.fn()}
                                />
                                <LocationProbe />
                            </>
                        }
                    />
                    <Route path="/login" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가에게 문의하기' }))

        expect(alert).toHaveBeenCalledWith('로그인 후 이용할 수 있습니다.')
        expect(screen.getByTestId('location')).toHaveTextContent('/login')
        alert.mockRestore()
    })
})
