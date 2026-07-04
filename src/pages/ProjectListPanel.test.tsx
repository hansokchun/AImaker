import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProjectListPanel } from './ProjectListPanel'
import type { ExpertProduct, Review, ServiceRequestData, Work } from '../types'

const basePackage = {
    name: 'Standard',
    price: 50000,
    deliveryDays: 3,
    revisionCount: 1,
    included: ['초안'],
} as const

const productWithImage: ExpertProduct = {
    id: 'product-image',
    expertId: 'expert-1',
    expertName: '한석준',
    title: 'AI 이미지 시안 제작',
    category: 'ai-image-character',
    summary: '대표 이미지가 있는 상품',
    description: '상세 설명',
    aiTools: ['Midjourney'],
    sampleLinks: [],
    sampleImageUrl: 'https://example.com/product-image.jpg',
    startingPrice: 50000,
    deliveryDays: 3,
    revisionCount: 1,
    packages: {
        standard: basePackage,
        deluxe: null,
        premium: null,
    },
    status: 'published',
}

const productWithoutImage: ExpertProduct = {
    ...productWithImage,
    id: 'product-empty',
    title: 'AI 자동화 설계',
    category: 'ai-development-automation',
    sampleImageUrl: '',
}

const requestWithImageProduct: ServiceRequestData = {
    id: 'request-image',
    title: '이미지 상품 주문',
    description: '요청 상세',
    budget: '50000',
    deadline: '2026-06-20',
    categories: ['AI 이미지/캐릭터'],
    createdAt: '2026. 6. 20.',
    clientId: 'client-1',
    expertId: 'expert-1',
    productId: 'product-image',
    status: 'in_progress',
}

const requestWithoutImageProduct: ServiceRequestData = {
    ...requestWithImageProduct,
    id: 'request-empty',
    title: '자동화 상품 주문',
    productId: 'product-empty',
}

const activeWork: Work = {
    id: 'work-active',
    proposalId: 'proposal-active',
    requestId: 'request-image',
    clientId: 'client-1',
    expertId: 'expert-1',
    title: '신제품 이미지 제작',
    progressType: 'single',
    status: 'in_progress',
    stepIds: [],
}

const submittedWork: Work = {
    ...activeWork,
    id: 'work-submitted',
    proposalId: 'proposal-submitted',
    requestId: 'request-empty',
    title: '자동화 설계 검토',
    status: 'submitted',
}

const completedWork: Work = {
    ...activeWork,
    id: 'work-completed',
    proposalId: 'proposal-completed',
    title: '완료된 이미지 제작',
    status: 'completed',
    expertPayout: 44000,
    settlementStatus: 'pending',
}

const renderPanel = (
    works: readonly Work[],
    reviews: readonly Review[] = [],
) => render(
    <MemoryRouter>
        <ProjectListPanel
            currentUserId="client-1"
            emptyText="프로젝트가 없습니다."
            products={[productWithImage, productWithoutImage]}
            requests={[requestWithImageProduct, requestWithoutImageProduct]}
            reviews={reviews}
            title="프로젝트"
            works={works}
            onReviewOpen={vi.fn()}
        />
    </MemoryRouter>,
)

describe('ProjectListPanel', () => {
    it('uses the linked product representative image as the project thumbnail', () => {
        renderPanel([activeWork])

        const card = screen.getByRole('link', { name: '신제품 이미지 제작' })
        const thumbnail = within(card).getByRole('img', { name: 'AI 이미지 시안 제작 프로젝트 썸네일' })

        expect(thumbnail).toHaveAttribute('src', 'https://example.com/product-image.jpg')
        expect(within(card).getByText('진행 중')).toBeInTheDocument()
        expect(within(card).getByText('새 진행 상태 확인')).toBeInTheDocument()
    })

    it('shows a category placeholder when the linked product has no image', () => {
        renderPanel([submittedWork])

        const card = screen.getByRole('link', { name: '자동화 설계 검토' })

        expect(within(card).queryByAltText('AI 자동화 설계 프로젝트 썸네일')).not.toBeInTheDocument()
        expect(within(card).getByLabelText('AI 개발/자동화 프로젝트 기본 이미지')).toBeInTheDocument()
        expect(within(card).getByText('검토 대기')).toBeInTheDocument()
        expect(within(card).getByText('결과물 확인 필요')).toBeInTheDocument()
    })

    it('keeps completed review cards white while reusing the product thumbnail and review action', () => {
        renderPanel([completedWork])

        const card = screen.getByTestId('completed-work')
        const thumbnail = within(card).getByRole('img', { name: 'AI 이미지 시안 제작 프로젝트 썸네일' })

        expect(thumbnail).toHaveAttribute('src', 'https://example.com/product-image.jpg')
        expect(card).toHaveClass('project-list-card')
        expect(card).not.toHaveClass('is-green-filled')
        expect(within(card).getByText('완료')).toBeInTheDocument()
        expect(within(card).getByText('전문가 정산 예정 44,000원')).toBeInTheDocument()
        expect(within(card).getByRole('button', { name: '리뷰 작성' })).toBeInTheDocument()
    })

    it('filters active and completed projects inside the project panel', () => {
        render(
            <MemoryRouter>
                <ProjectListPanel
                    currentUserId="client-1"
                    completedEmptyText="완료된 작업이 없습니다."
                    emptyText="진행 중인 작업이 없습니다."
                    products={[productWithImage, productWithoutImage]}
                    requests={[requestWithImageProduct, requestWithoutImageProduct]}
                    reviews={[]}
                    showStatusFilter
                    title="프로젝트"
                    works={[activeWork, completedWork]}
                    onReviewOpen={vi.fn()}
                />
            </MemoryRouter>,
        )

        expect(screen.getByRole('button', { name: '진행중 1' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('link', { name: '신제품 이미지 제작' })).toBeInTheDocument()
        expect(screen.queryByTestId('completed-work')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '완료됨 1' }))

        expect(screen.getByRole('button', { name: '완료됨 1' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByTestId('completed-work')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '신제품 이미지 제작' })).not.toBeInTheDocument()
    })
})
