import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveExpertProduct, saveProfile } from '../lib/storage'
import type { ExpertProfile } from '../types'
import Profile from './Profile'

const supabaseMocks = vi.hoisted(() => ({
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
    profileUpdateEq: vi.fn(),
    profileUpdate: vi.fn(),
    profileSingle: vi.fn(),
    profileEq: vi.fn(),
    profileSelect: vi.fn(),
    from: vi.fn(),
}))

const makeProfile = (overrides: Partial<ExpertProfile> = {}): ExpertProfile => ({
    imageUrl: 'https://example.com/profile.jpg',
    profession: 'AI 영상/숏폼',
    name: '루미 AI 스튜디오',
    oneLiner: '',
    greeting: '',
    activities: [''],
    awards: [''],
    aiTools: ['ChatGPT'],
    editTools: [],
    packages: {
        standard: { price: '', description: '', workDays: '', revisions: '', features: [''] },
        deluxe: { price: '', description: '', workDays: '', revisions: '', features: [''] },
        premium: { price: '', description: '', workDays: '', revisions: '', features: [''] },
    },
    ...overrides,
})

let mockProfile = makeProfile()

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'expert-video-01' }, loading: false }),
}))

vi.mock('../lib/supabase', () => ({
    supabase: {
        storage: {
            from: () => ({
                upload: supabaseMocks.upload,
                getPublicUrl: supabaseMocks.getPublicUrl,
            }),
        },
        from: supabaseMocks.from,
    },
}))

vi.mock('../lib/storage', () => ({
    createDefaultProfile: () => makeProfile(),
    getStoredProfile: vi.fn(async () => mockProfile),
    saveProfile: vi.fn(async () => undefined),
    saveExpertProduct: vi.fn(async () => undefined),
}))

describe('Profile editing', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(window, 'alert').mockImplementation(() => {})
        mockProfile = makeProfile()
        supabaseMocks.upload.mockResolvedValue({ error: null })
        supabaseMocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/updated-avatar.jpg' } })
        supabaseMocks.profileSingle.mockResolvedValue({
            data: { is_expert: true, name: '루미 AI 스튜디오', avatar_url: 'https://example.com/profile.jpg' },
            error: null,
        })
        supabaseMocks.profileEq.mockReturnValue({ single: supabaseMocks.profileSingle })
        supabaseMocks.profileSelect.mockReturnValue({ eq: supabaseMocks.profileEq })
        supabaseMocks.profileUpdateEq.mockResolvedValue({ error: null })
        supabaseMocks.profileUpdate.mockReturnValue({ eq: supabaseMocks.profileUpdateEq })
        supabaseMocks.from.mockReturnValue({
            select: supabaseMocks.profileSelect,
            update: supabaseMocks.profileUpdate,
            upsert: vi.fn(async () => ({ error: null })),
        })
    })

    it('does not show product publishing fields inside profile editing', async () => {
        const { container } = render(
            <MemoryRouter>
                <Profile />
            </MemoryRouter>,
        )

        await waitFor(() => expect(container.querySelector('form')).toBeInTheDocument())

        expect(screen.queryByText('상품 등록')).not.toBeInTheDocument()
        expect(screen.queryByText('요금 패키지')).not.toBeInTheDocument()
        expect(screen.queryByText('Standard')).not.toBeInTheDocument()
        expect(screen.queryByText('Deluxe')).not.toBeInTheDocument()
        expect(screen.queryByText('Premium')).not.toBeInTheDocument()
        expect(screen.queryByPlaceholderText('https://example.com/sample')).not.toBeInTheDocument()
        expect(container.querySelector('.product-register-section')).not.toBeInTheDocument()
    })

    it('saves the expert profile without publishing a product', async () => {
        const { container } = render(
            <MemoryRouter>
                <Profile />
            </MemoryRouter>,
        )

        const form = await waitFor(() => {
            const foundForm = container.querySelector('form')
            expect(foundForm).toBeInTheDocument()
            return foundForm as HTMLFormElement
        })

        fireEvent.submit(form)

        await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1))
        expect(saveExpertProduct).not.toHaveBeenCalled()
    })

    it('saves an uploaded profile image to the expert profile and basic profile row', async () => {
        const { container } = render(
            <MemoryRouter>
                <Profile />
            </MemoryRouter>,
        )

        await waitFor(() => expect(container.querySelector('form')).toBeInTheDocument())

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
        fireEvent.change(fileInput, {
            target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] },
        })

        await waitFor(() => expect(supabaseMocks.upload).toHaveBeenCalledTimes(1))
        fireEvent.submit(container.querySelector('form') as HTMLFormElement)

        await waitFor(() =>
            expect(saveProfile).toHaveBeenCalledWith(
                'expert-video-01',
                expect.objectContaining({ imageUrl: 'https://example.com/updated-avatar.jpg' }),
            ),
        )
        expect(supabaseMocks.profileUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ avatar_url: 'https://example.com/updated-avatar.jpg' }),
        )
    })

    it('shows required profile errors inline instead of only alerting', async () => {
        mockProfile = makeProfile({ name: '', profession: '', aiTools: [] })

        const { container } = render(
            <MemoryRouter>
                <Profile />
            </MemoryRouter>,
        )

        await waitFor(() => expect(container.querySelector('form')).toBeInTheDocument())
        fireEvent.submit(container.querySelector('form') as HTMLFormElement)

        expect(await screen.findByText('이름을 입력해 주세요.')).toHaveClass('profile-field-error')
        expect(screen.getByText('전문 분야를 선택해 주세요.')).toHaveClass('profile-field-error')
        expect(screen.getByText('사용 AI 도구를 하나 이상 입력해 주세요.')).toHaveClass('profile-field-error')
        expect(saveProfile).not.toHaveBeenCalled()
    })
})
