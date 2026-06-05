import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import Onboarding from './Onboarding'

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockUpsert = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}))

vi.mock('../lib/supabase', () => ({
    supabase: {
        storage: {
            from: () => ({
                upload: mockUpload,
                getPublicUrl: mockGetPublicUrl,
            }),
        },
        from: () => ({
            upsert: mockUpsert,
        }),
    },
}))

describe('Onboarding', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAuth.mockReturnValue({
            user: {
                id: 'user-onboarding-01',
                email: 'new-user@example.com',
            },
        })
        mockUpload.mockResolvedValue({ error: null })
        mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/uploaded-profile.jpg' } })
        mockUpsert.mockResolvedValue({ error: null })
    })

    it('stores the uploaded profile image on the basic profile row', async () => {
        render(<Onboarding />)

        const fileInput = document.querySelector('#profile-image') as HTMLInputElement
        const file = new File(['profile'], 'profile.png', { type: 'image/png' })
        fireEvent.change(fileInput, { target: { files: [file] } })

        await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1))

        fireEvent.change(document.querySelector('#nickname') as HTMLInputElement, {
            target: { value: '새 사용자' },
        })
        fireEvent.click(screen.getByRole('button', { name: /AIConnect/ }))

        await waitFor(() =>
            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'user-onboarding-01',
                    name: '새 사용자',
                    email: 'new-user@example.com',
                    avatar_url: 'https://example.com/uploaded-profile.jpg',
                }),
            ),
        )
    })
})
