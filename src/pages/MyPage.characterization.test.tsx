import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { ServiceRequestData } from '../types'
import MyPage from './MyPage'

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        session: { user: { id: 'characterization-user', email: 'characterization@example.com' } },
        user: { id: 'characterization-user', email: 'characterization@example.com' },
        loading: false,
        signOut: async () => undefined,
    }),
}))

vi.mock('../lib/supabase', () => ({ supabase: null }))

function LocationProbe() {
    const location = useLocation()
    return <output data-testid="location">{location.search}</output>
}

const request: ServiceRequestData = {
    id: 'request-characterization-01',
    title: 'Characterization order',
    description: 'Locks transaction-number behavior before extraction.',
    budget: '50000',
    deadline: '2026-06-10',
    categories: ['ai-video-shortform'],
    createdAt: '2026-06-01T00:00:00.000Z',
    clientId: 'characterization-user',
    expertId: 'characterization-expert',
    productId: 'product-characterization-01',
    status: 'pending',
}

describe('MyPage extraction-boundary characterization', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('normalizes the retired reviews work-panel URL before rendering work mode', async () => {
        render(
            <MemoryRouter initialEntries={['/my-work?panel=reviews']}>
                <Routes>
                    <Route path="/my-work" element={<><MyPage mode="work" /><LocationProbe /></>} />
                </Routes>
            </MemoryRouter>,
        )

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?panel=workroom'))
    })

    it('derives a stable transaction number from the selected product-order id and creation date', async () => {
        localStorage.setItem('ai_requests', JSON.stringify([request]))

        render(
            <MemoryRouter initialEntries={['/my-work']}>
                <Routes>
                    <Route path="/my-work" element={<MyPage mode="work" />} />
                </Routes>
            </MemoryRouter>,
        )

        const list = await screen.findByTestId('client-unified-work-list')
        const row = within(list).getByTestId('work-transaction-row')
        fireEvent.click(row)

        expect(await screen.findByText('TR-2026-0601-N01')).toBeInTheDocument()
    })
})
