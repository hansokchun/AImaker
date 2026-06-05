import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveExpertProduct, saveProfile } from '../lib/storage'
import type { ExpertProfile } from '../types'
import Profile from './Profile'

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
    supabase: null,
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
})
