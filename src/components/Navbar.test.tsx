import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Navbar from './Navbar'

const mockUseAuth = vi.fn()
const mockGetStoredProfile = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}))

vi.mock('../lib/storage', () => ({
    getStoredProfile: (userId: string) => mockGetStoredProfile(userId),
}))

describe('Navbar', () => {
    beforeEach(() => {
        mockUseAuth.mockReturnValue({
            user: null,
            signOut: vi.fn(),
        })
        mockGetStoredProfile.mockResolvedValue(null)
    })

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
    it('shows a profile image instead of the email and links it to the profile panel in my page', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: 'user-demo-01', email: 'demo@example.com', user_metadata: {} },
            signOut: vi.fn(),
        })
        mockGetStoredProfile.mockResolvedValue({
            imageUrl: 'https://example.com/profile.jpg',
        })

        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>,
        )

        expect(screen.queryByText('demo@example.com')).not.toBeInTheDocument()
        expect(await screen.findByRole('img', { name: '마이 프로필' })).toHaveAttribute(
            'src',
            'https://example.com/profile.jpg',
        )
        expect(screen.getByRole('link', { name: '마이 프로필' })).toHaveAttribute('href', '/mypage?panel=profile')
    })
})
