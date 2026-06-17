import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Navbar from './Navbar'

const mockUseAuth = vi.fn()
const mockGetStoredProfile = vi.fn()
const mockGetUserDisplayProfile = vi.fn()
const mockGetUserNotifications = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}))

vi.mock('../lib/storage', () => ({
    getStoredProfile: (userId: string) => mockGetStoredProfile(userId),
    getUserDisplayProfile: (userId: string) => mockGetUserDisplayProfile(userId),
}))

vi.mock('../lib/notifications', () => ({
    getUserNotifications: (userId: string) => mockGetUserNotifications(userId),
}))

function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{location.pathname}{location.search}</span>
}

describe('Navbar', () => {
    beforeEach(() => {
        mockUseAuth.mockReturnValue({
            user: null,
            signOut: vi.fn(),
        })
        mockGetStoredProfile.mockResolvedValue(null)
        mockGetUserDisplayProfile.mockResolvedValue(null)
        mockGetUserNotifications.mockResolvedValue([])
        window.localStorage.clear()
    })

    it('keeps the header focused on account actions before login', () => {
        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>,
        )

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'AI 작업 찾기' })).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'AIConnect' })).toHaveAttribute('href', '/')
        expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login')
    })

    it('surfaces my work as a top-level shortcut after login', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: 'user-demo-01', email: 'demo@example.com', user_metadata: {} },
            signOut: vi.fn(),
        })

        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>,
        )

        expect(await screen.findByRole('link', { name: '내 작업' })).toHaveAttribute('href', '/my-work')
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

        expect(screen.getByRole('menuitem', { name: '내 작업' })).toHaveAttribute('href', '/my-work')
        expect(screen.getByRole('menuitem', { name: '마이페이지' })).toHaveAttribute('href', '/mypage?panel=profile')
        fireEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }))

        await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
    })

    it('uses the basic profile avatar when an expert profile image is not available', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: 'user-demo-01', email: 'demo@example.com', user_metadata: {} },
            signOut: vi.fn(),
        })
        mockGetStoredProfile.mockResolvedValue(null)
        mockGetUserDisplayProfile.mockResolvedValue({
            imageUrl: 'https://example.com/basic-avatar.jpg',
        })

        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>,
        )

        expect(await screen.findByRole('img', { name: '마이 프로필 메뉴' })).toHaveAttribute(
            'src',
            'https://example.com/basic-avatar.jpg',
        )
    })

    it('prefers the basic profile avatar so recent profile edits update the top menu', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: 'user-demo-01', email: 'demo@example.com', user_metadata: {} },
            signOut: vi.fn(),
        })
        mockGetStoredProfile.mockResolvedValue({
            imageUrl: 'https://example.com/old-expert-avatar.jpg',
        })
        mockGetUserDisplayProfile.mockResolvedValue({
            imageUrl: 'https://example.com/new-basic-avatar.jpg',
        })

        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>,
        )

        expect(await screen.findByRole('img', { name: '마이 프로필 메뉴' })).toHaveAttribute(
            'src',
            'https://example.com/new-basic-avatar.jpg',
        )
    })

    it('updates the top-right profile menu image after a profile avatar change event', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: 'user-demo-01', email: 'demo@example.com', user_metadata: {} },
            signOut: vi.fn(),
        })
        mockGetStoredProfile.mockResolvedValue(null)
        mockGetUserDisplayProfile.mockResolvedValueOnce({
            imageUrl: 'https://example.com/old-avatar.jpg',
        })
        mockGetUserDisplayProfile.mockResolvedValueOnce({
            imageUrl: 'https://example.com/updated-avatar.jpg',
        })

        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>,
        )

        expect(await screen.findByRole('img', { name: '마이 프로필 메뉴' })).toHaveAttribute(
            'src',
            'https://example.com/old-avatar.jpg',
        )

        window.dispatchEvent(new CustomEvent('aiconnect:profile-updated', { detail: { userId: 'user-demo-01' } }))

        await waitFor(() =>
            expect(screen.getByRole('img', { name: '마이 프로필 메뉴' })).toHaveAttribute(
                'src',
                'https://example.com/updated-avatar.jpg',
            ),
        )
    })

    it('shows received marketplace notifications next to the profile menu with direct links', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: 'user-demo-01', email: 'demo@example.com', user_metadata: {} },
            signOut: vi.fn(),
        })
        mockGetUserNotifications.mockResolvedValue([
            {
                id: 'request-request-01',
                kind: 'request',
                title: '새 상품 의뢰',
                body: '숏폼 영상 제작',
                to: '/my-work?role=expert&panel=client&expertRequest=request-01',
                createdAt: '2026-06-10T10:00:00.000Z',
            },
            {
                id: 'proposal-proposal-01',
                kind: 'proposal',
                title: '새 제안서 도착',
                body: '50,000원',
                to: '/proposal/proposal-01',
                createdAt: '2026-06-10T09:00:00.000Z',
            },
        ])

        render(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>,
        )

        const notificationButton = await screen.findByRole('button', { name: '알림 2개 열기' })
        expect(notificationButton).toHaveTextContent('2')

        fireEvent.click(notificationButton)

        expect(screen.getByRole('menu', { name: '알림 목록' })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /새 상품 의뢰/ })).toHaveAttribute(
            'href',
            '/my-work?role=expert&panel=client&expertRequest=request-01',
        )
        expect(screen.getByRole('menuitem', { name: /새 제안서 도착/ })).toHaveAttribute('href', '/proposal/proposal-01')
    })
    it('marks a notification as read after opening its target screen', async () => {
        mockUseAuth.mockReturnValue({
            user: { id: 'user-demo-01', email: 'demo@example.com', user_metadata: {} },
            signOut: vi.fn(),
        })
        mockGetUserNotifications.mockResolvedValue([
            {
                id: 'request-request-01',
                kind: 'request',
                title: '새 상품 의뢰',
                body: '숏폼 영상 제작',
                to: '/my-work?role=expert&panel=client&expertRequest=request-01',
                createdAt: '2026-06-10T10:00:00.000Z',
            },
            {
                id: 'proposal-proposal-01',
                kind: 'proposal',
                title: '새 제안서 도착',
                body: '50,000원',
                to: '/proposal/proposal-01',
                createdAt: '2026-06-10T09:00:00.000Z',
            },
        ])

        render(
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="*" element={<><Navbar /><LocationProbe /></>} />
                </Routes>
            </MemoryRouter>,
        )

        const notificationButton = await screen.findByRole('button', { name: '알림 2개 열기' })
        fireEvent.click(notificationButton)
        fireEvent.click(screen.getByRole('menuitem', { name: /새 상품 의뢰/ }))

        await waitFor(() =>
            expect(screen.getByTestId('location')).toHaveTextContent('/my-work?role=expert&panel=client&expertRequest=request-01'),
        )
        expect(screen.getByRole('button', { name: '알림 1개 열기' })).toHaveTextContent('1')
        expect(window.localStorage.getItem('aiconnect_read_notifications_user-demo-01')).toContain('request-request-01')
    })
})
