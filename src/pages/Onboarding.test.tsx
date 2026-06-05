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
        fireEvent.change(document.querySelector('#client-interests') as HTMLInputElement, {
            target: { value: 'video' },
        })
        fireEvent.change(document.querySelector('#client-purposes') as HTMLInputElement, {
            target: { value: 'promotion' },
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

    it('requires and stores client profile details for new clients', async () => {
        render(<Onboarding />)

        fireEvent.change(screen.getByLabelText('표시 이름/닉네임'), {
            target: { value: '의뢰자 테스트' },
        })
        fireEvent.change(screen.getByLabelText('관심 작업 분야'), {
            target: { value: '영상, 자동화' },
        })
        fireEvent.change(screen.getByLabelText('주로 맡기려는 목적'), {
            target: { value: '홍보, 업무 자동화' },
        })
        fireEvent.click(screen.getByRole('button', { name: /AIConnect/ }))

        await waitFor(() =>
            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: '의뢰자 테스트',
                    interests: ['영상', '자동화'],
                    request_purposes: ['홍보', '업무 자동화'],
                    is_expert: false,
                }),
            ),
        )
    })

    it('requires and stores expert profile details for new experts', async () => {
        render(<Onboarding />)

        fireEvent.click(screen.getByRole('button', { name: /전문가로 활동하기/ }))
        fireEvent.change(screen.getByLabelText('전문가 이름/닉네임'), {
            target: { value: '전문가 테스트' },
        })
        fireEvent.change(screen.getByLabelText('사용 도구'), {
            target: { value: 'ChatGPT, Midjourney' },
        })
        fireEvent.click(screen.getByRole('button', { name: /AIConnect/ }))

        await waitFor(() =>
            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'user-onboarding-01',
                    name: '전문가 테스트',
                    is_expert: true,
                }),
            ),
        )
        expect(mockUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user-onboarding-01',
                name: '전문가 테스트',
                ai_tools: ['ChatGPT', 'Midjourney'],
            }),
        )
    })
})
