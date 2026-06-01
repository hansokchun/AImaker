import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

    it('keeps request creation inside the request board navigation', () => {
        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>,
        )

        expect(screen.getByRole('link', { name: 'AI 작업 찾기' })).toHaveAttribute('href', '/category')
        expect(screen.getByRole('link', { name: '요청 게시판' })).toHaveAttribute('href', '/requests')
        expect(screen.getByRole('link', { name: '내 작업' })).toHaveAttribute('href', '/my-work')
        expect(screen.queryByRole('link', { name: 'AI 작업 요청' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '커뮤니티' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '전문가 찾기' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '서비스 요청' })).not.toBeInTheDocument()
    })

    it('opens my page and logout actions from the profile image menu', async () => {
        const signOut = vi.fn(async () => undefined)
        mockUseAuth.mockReturnValue({
            user: { id: 'user-demo-01', email: 'demo@example.com', user_metadata: {} },
            signOut,
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
        expect(await screen.findByRole('img', { name: '마이 프로필 메뉴' })).toHaveAttribute(
            'src',
            'https://example.com/profile.jpg',
        )
        expect(screen.queryByRole('link', { name: '마이페이지' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '프로필 메뉴 열기' }))

        expect(screen.getByRole('menuitem', { name: '마이페이지' })).toHaveAttribute('href', '/mypage?panel=profile')
        fireEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }))

        await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
    })
})
