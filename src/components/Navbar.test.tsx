import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Navbar from './Navbar'

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
        signOut: vi.fn(),
    }),
}))

describe('Navbar', () => {
    it('uses product-first navigation labels', () => {
        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>,
        )

        expect(screen.getByRole('link', { name: 'AI 작업 찾기' })).toHaveAttribute('href', '/category')
        expect(screen.getByRole('link', { name: 'AI 작업 요청' })).toHaveAttribute('href', '/request')
        expect(screen.queryByRole('link', { name: '전문가 찾기' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '서비스 요청' })).not.toBeInTheDocument()
    })
})
