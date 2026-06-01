import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Profile from './Profile'
import type { ExpertProfile } from '../types'
import { saveExpertProduct, saveProfile } from '../lib/storage'

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

describe('Profile product publishing requirements', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(window, 'alert').mockImplementation(() => {})
        mockProfile = makeProfile()
    })

    it('does not show external profile image URL editing', async () => {
        render(
            <MemoryRouter>
                <Profile />
            </MemoryRouter>,
        )

        expect(await screen.findByText('프로필 이미지 업로드')).toBeInTheDocument()
        expect(document.querySelector('input[type="file"]')).toBeInTheDocument()
        expect(screen.queryByText('또는 외부 이미지 링크 입력:')).not.toBeInTheDocument()
        expect(screen.queryByPlaceholderText('https://example.com/my-photo.jpg')).not.toBeInTheDocument()
    })

    it('does not publish product without a required Standard package', async () => {
        render(
            <MemoryRouter>
                <Profile />
            </MemoryRouter>,
        )

        fireEvent.change(await screen.findByLabelText('상품명'), {
            target: { value: 'AI 숏폼 영상 제작' },
        })
        fireEvent.change(screen.getByLabelText('상품 설명'), {
            target: { value: 'SNS 홍보용 숏폼 영상을 제작합니다.' },
        })
        fireEvent.change(screen.getByLabelText('샘플 결과물'), {
            target: { value: 'https://example.com/sample.mp4' },
        })
        fireEvent.change(screen.getByLabelText('시작 가격'), {
            target: { value: '30000' },
        })
        fireEvent.change(screen.getByLabelText('작업 기간'), {
            target: { value: '2' },
        })
        fireEvent.click(screen.getByRole('button', { name: '프로필 저장하기' }))

        await waitFor(() =>
            expect(window.alert).toHaveBeenCalledWith('Standard 패키지는 가격, 작업 기간, 포함 항목이 필요합니다.'),
        )
        expect(saveProfile).not.toHaveBeenCalled()
    })

    it('does not publish product without a sample result', async () => {
        mockProfile = makeProfile({
            packages: {
                standard: {
                    price: '30000',
                    description: '15초 숏폼 기본 제작',
                    workDays: '2일',
                    revisions: '1회',
                    features: ['15초 영상 시안'],
                },
                deluxe: { price: '', description: '', workDays: '', revisions: '', features: [''] },
                premium: { price: '', description: '', workDays: '', revisions: '', features: [''] },
            },
        })

        render(
            <MemoryRouter>
                <Profile />
            </MemoryRouter>,
        )

        fireEvent.change(await screen.findByLabelText('상품명'), {
            target: { value: 'AI 숏폼 영상 제작' },
        })
        fireEvent.change(screen.getByLabelText('상품 설명'), {
            target: { value: 'SNS 홍보용 숏폼 영상을 제작합니다.' },
        })
        fireEvent.change(screen.getByLabelText('시작 가격'), {
            target: { value: '30000' },
        })
        fireEvent.change(screen.getByLabelText('작업 기간'), {
            target: { value: '2' },
        })
        fireEvent.click(screen.getByRole('button', { name: '프로필 저장하기' }))

        await waitFor(() => expect(window.alert).toHaveBeenCalledWith('샘플 결과물을 입력해 주세요.'))
        expect(saveProfile).not.toHaveBeenCalled()
    })

    it('saves a published expert product with the profile', async () => {
        mockProfile = makeProfile({
            packages: {
                standard: {
                    price: '30000',
                    description: '15초 숏폼 기본 제작',
                    workDays: '2',
                    revisions: '1',
                    features: ['15초 영상 시안'],
                },
                deluxe: { price: '', description: '', workDays: '', revisions: '', features: [''] },
                premium: { price: '', description: '', workDays: '', revisions: '', features: [''] },
            },
        })

        render(
            <MemoryRouter>
                <Profile />
            </MemoryRouter>,
        )

        fireEvent.change(await screen.findByLabelText('상품명'), {
            target: { value: 'AI 숏폼 영상 제작' },
        })
        fireEvent.change(screen.getByLabelText('상품 설명'), {
            target: { value: 'SNS 홍보용 숏폼 영상을 제작합니다.' },
        })
        fireEvent.change(screen.getByLabelText('샘플 결과물'), {
            target: { value: 'https://example.com/sample.mp4' },
        })
        fireEvent.change(screen.getByLabelText('시작 가격'), {
            target: { value: '30000' },
        })
        fireEvent.change(screen.getByLabelText('작업 기간'), {
            target: { value: '2' },
        })
        fireEvent.click(screen.getByRole('button', { name: '프로필 저장하기' }))

        await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1))
        expect(saveExpertProduct).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'expert-video-01',
                expertId: 'expert-video-01',
                title: 'AI 숏폼 영상 제작',
                description: 'SNS 홍보용 숏폼 영상을 제작합니다.',
                sampleImageUrl: 'https://example.com/sample.mp4',
                startingPrice: 30000,
                deliveryDays: 2,
                status: 'published',
            }),
        )
    })

    it('blocks external contact details in product publishing fields', async () => {
        mockProfile = makeProfile({
            packages: {
                standard: {
                    price: '30000',
                    description: '15초 숏폼 기본 제작',
                    workDays: '2',
                    revisions: '1',
                    features: ['15초 영상 시안'],
                },
                deluxe: { price: '', description: '', workDays: '', revisions: '', features: [''] },
                premium: { price: '', description: '', workDays: '', revisions: '', features: [''] },
            },
        })

        render(
            <MemoryRouter>
                <Profile />
            </MemoryRouter>,
        )

        fireEvent.change(await screen.findByLabelText('상품명'), {
            target: { value: 'AI 숏폼 영상 제작' },
        })
        fireEvent.change(screen.getByLabelText('상품 설명'), {
            target: { value: 'SNS 홍보용 숏폼을 제작합니다. 카카오톡 ai-maker로 연락 주세요.' },
        })
        fireEvent.change(screen.getByLabelText('샘플 결과물'), {
            target: { value: 'https://example.com/sample.mp4' },
        })
        fireEvent.change(screen.getByLabelText('시작 가격'), {
            target: { value: '30000' },
        })
        fireEvent.change(screen.getByLabelText('작업 기간'), {
            target: { value: '2' },
        })
        fireEvent.click(screen.getByRole('button', { name: '프로필 저장하기' }))

        await waitFor(() =>
            expect(window.alert).toHaveBeenCalledWith(
                '외부 연락처는 입력할 수 없습니다. 안전한 거래를 위해 플랫폼 안에서 소통해주세요.',
            ),
        )
        expect(saveProfile).not.toHaveBeenCalled()
        expect(saveExpertProduct).not.toHaveBeenCalled()
    })
})
