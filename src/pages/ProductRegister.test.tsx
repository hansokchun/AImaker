import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProductRegister from './ProductRegister'
import type { ExpertProduct } from '../types'

const saveExpertProduct = vi.fn(async (_product: ExpertProduct) => undefined)
const deleteExpertProduct = vi.fn(async (_productId: string) => undefined)
const uploadProductSample = vi.fn(async (_path: string, _file: File, _options: unknown) => ({ error: null }))
const getProductSamplePublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://storage.example/product-samples/${path}` },
}))
const editableProduct: ExpertProduct = {
    id: 'editable-product-01',
    expertId: 'expert-user-01',
    expertName: 'expert@example.com',
    title: '기존 AI 상품',
    category: 'ai-video-shortform',
    summary: '기존 요약입니다.',
    description: '기존 상세 설명입니다.',
    sampleLinks: ['data:image/png;base64,old-detail'],
    sampleImageUrl: 'data:image/png;base64,old-main',
    startingPrice: 50000,
    deliveryDays: 3,
    revisionCount: 2,
    packages: {
        standard: {
            name: 'Standard',
            price: 50000,
            deliveryDays: 3,
            revisionCount: 2,
            included: ['기존 제공 항목'],
        },
        deluxe: null,
        premium: null,
    },
    status: 'published',
}
const getExpertProducts = vi.fn(async () => [editableProduct])
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        session: { user: { id: 'expert-user-01', email: 'expert@example.com' } },
        user: { id: 'expert-user-01', email: 'expert@example.com' },
        loading: false,
    }),
}))

vi.mock('../lib/storage', () => ({
    saveExpertProduct: (product: ExpertProduct) => saveExpertProduct(product),
    deleteExpertProduct: (productId: string) => deleteExpertProduct(productId),
    getExpertProducts: () => getExpertProducts(),
}))

vi.mock('../lib/supabase', () => ({
    supabase: {
        storage: {
            from: (bucket: string) => {
                if (bucket !== 'product-samples') {
                    throw new Error(`unexpected bucket: ${bucket}`)
                }

                return {
                    getPublicUrl: (path: string) => getProductSamplePublicUrl(path),
                    upload: (path: string, file: File, options: unknown) => uploadProductSample(path, file, options),
                }
            },
        },
    },
}))

function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{location.pathname}{location.search}</span>
}

function renderRegister() {
    render(
        <MemoryRouter initialEntries={['/products/new']}>
            <Routes>
                <Route path="/products/new" element={<><ProductRegister /><LocationProbe /></>} />
                <Route path="/expert/:id" element={<LocationProbe />} />
                <Route path="/my-work" element={<LocationProbe />} />
            </Routes>
        </MemoryRouter>,
    )
}

function renderEditRegister() {
    render(
        <MemoryRouter initialEntries={[`/products/${editableProduct.id}/edit`]}>
            <Routes>
                <Route path="/products/:productId/edit" element={<><ProductRegister /><LocationProbe /></>} />
                <Route path="/expert/:id" element={<LocationProbe />} />
                <Route path="/my-work" element={<LocationProbe />} />
            </Routes>
        </MemoryRouter>,
    )
}

describe('ProductRegister', () => {
    beforeEach(() => {
        saveExpertProduct.mockClear()
        deleteExpertProduct.mockClear()
        uploadProductSample.mockClear()
        getProductSamplePublicUrl.mockClear()
        getExpertProducts.mockClear()
        getExpertProducts.mockResolvedValue([editableProduct])
        vi.stubGlobal('Image', class {
            width = 652
            height = 488
            onload: (() => void) | null = null
            onerror: (() => void) | null = null

            set src(value: string) {
                if (value.includes('small-main')) {
                    this.width = 500
                    this.height = 400
                }
                if (value.includes('wrong-ratio-main')) {
                    this.width = 652
                    this.height = 600
                }
                setTimeout(() => this.onload?.(), 0)
            }
        })
        vi.stubGlobal('URL', {
            createObjectURL: (file: File) => `blob:${file.name}`,
            revokeObjectURL: vi.fn(),
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('frames product registration with marketplace page navigation and guidance', () => {
        renderRegister()

        expect(screen.getByTestId('product-register-page')).toHaveClass('product-register-page')
        expect(screen.getByRole('navigation', { name: '현재 위치' })).toHaveTextContent('홈/AI 작업 등록')
        expect(screen.getByRole('form', { name: 'AI 상품 등록 폼' })).toHaveClass('product-register-form')
        expect(screen.getByText('등록 전 확인')).toBeInTheDocument()
        expect(screen.getByText('AI 작업 찾기에서 비교하기 쉬운 제목, 대표 이미지, 시작가를 먼저 정리하세요.')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '1. 기본 정보' })).toBeInTheDocument()
    })

    it('keeps the form close to Kmong service registration and publishes a single-price product', async () => {
        renderRegister()

        expect(screen.queryByTestId('package-standard')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('대표 이미지 URL')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('사용 도구')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('샘플 링크')).not.toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: 'AI 숏폼 영상 패키지' } })
        fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: 'ai-video-shortform' } })
        fireEvent.change(screen.getByLabelText('서비스 요약'), { target: { value: '15초 숏폼 영상 콘셉트와 초안을 제작합니다.' } })
        fireEvent.change(screen.getByLabelText('상세 설명'), { target: { value: '브랜드 홍보용 숏폼 영상의 기획, 콘셉트, 편집 방향을 제공합니다.\n\n작업 범위와 준비 자료를 함께 안내합니다.' } })
        fireEvent.change(screen.getByLabelText('메인 이미지 첨부'), {
            target: { files: [new File(['tiny-image'], 'thumb.png', { type: 'image/png' })] },
        })
        fireEvent.change(screen.getByLabelText('상세 미디어 첨부'), {
            target: { files: [new File(['portfolio'], 'portfolio.png', { type: 'image/png' })] },
        })
        fireEvent.change(screen.getByLabelText('가격'), { target: { value: '30000' } })
        fireEvent.change(screen.getByLabelText('작업일'), { target: { value: '2' } })
        fireEvent.change(screen.getByLabelText('수정 횟수'), { target: { value: '1' } })
        fireEvent.change(screen.getByLabelText('기본 제공 항목'), { target: { value: '15초 영상 콘셉트\n대본 초안\nAI 영상 시안 1개' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '이미지와 설명 등록 유의사항을 확인했습니다' }))
        fireEvent.click(screen.getByRole('button', { name: '등록하기' }))

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.stringMatching(uuidPattern),
                    expertId: 'expert-user-01',
                    expertName: 'expert@example.com',
                    title: 'AI 숏폼 영상 패키지',
                    category: 'ai-video-shortform',
                    summary: '15초 숏폼 영상 콘셉트와 초안을 제작합니다.',
                    description: expect.stringContaining('브랜드 홍보용 숏폼 영상의 기획'),
                    sampleImageUrl: expect.stringMatching(/^https:\/\/storage\.example\/product-samples\/expert-user-01\/[0-9a-f-]+\/main-/),
                    sampleLinks: [expect.stringMatching(/^https:\/\/storage\.example\/product-samples\/expert-user-01\/[0-9a-f-]+\/detail-/)],
                    startingPrice: 30000,
                    deliveryDays: 2,
                    revisionCount: 1,
                    status: 'published',
                    packages: {
                        standard: {
                            name: 'Standard',
                            price: 30000,
                            deliveryDays: 2,
                            revisionCount: 1,
                            included: ['15초 영상 콘셉트', '대본 초안', 'AI 영상 시안 1개'],
                            optionValues: {
                                '15초 영상 콘셉트': '포함',
                                '대본 초안': '포함',
                                'AI 영상 시안': '1개',
                            },
                        },
                        deluxe: null,
                        premium: null,
                    },
                }),
            ),
        )
        await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(new RegExp(`^/expert/${uuidPattern.source.slice(1, -1)}$`, 'i')))
    })

    it('saves an incomplete product as a draft without exposing draft in visibility options', async () => {
        renderRegister()

        const statusSelects = screen.getAllByRole('combobox')
        const statusSelect = statusSelects[statusSelects.length - 1]
        if (!statusSelect) throw new Error('공개 상태 선택 상자를 찾을 수 없습니다.')
        expect(within(statusSelect).getByRole('option', { name: '공개' })).toBeInTheDocument()
        expect(within(statusSelect).getByRole('option', { name: '숨김' })).toBeInTheDocument()
        expect(within(statusSelect).queryByRole('option', { name: '임시저장' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '임시저장' }))

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '임시저장 상품',
                    summary: '임시저장 중입니다.',
                    description: '임시저장 중입니다.',
                    status: 'draft',
                    startingPrice: 0,
                    deliveryDays: 1,
                    packages: expect.objectContaining({
                        standard: expect.objectContaining({
                            included: ['임시저장'],
                        }),
                    }),
                }),
            ),
        )
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/my-work?role=expert&panel=products'))
    })

    it('saves product tax invoice and visibility status without product-level AI tools', async () => {
        renderRegister()

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: 'AI 이미지 시안 제작' } })
        fireEvent.change(screen.getByLabelText('서비스 요약'), { target: { value: '상세페이지용 AI 이미지 시안을 제작합니다.' } })
        fireEvent.change(screen.getByLabelText('상세 설명'), { target: { value: '상품 상세페이지에 사용할 AI 이미지 시안을 제공합니다.' } })
        fireEvent.change(screen.getByLabelText('메인 이미지 첨부'), {
            target: { files: [new File(['main'], 'main.png', { type: 'image/png' })] },
        })
        fireEvent.change(screen.getByLabelText('가격'), { target: { value: '45000' } })
        fireEvent.change(screen.getByLabelText('작업일'), { target: { value: '3' } })
        fireEvent.change(screen.getByLabelText('수정 횟수'), { target: { value: '1' } })
        fireEvent.change(screen.getByLabelText('기본 제공 항목'), { target: { value: '이미지 시안 3장' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '세금계산서 발행 가능' }))
        fireEvent.change(screen.getByLabelText('공개 상태'), { target: { value: 'hidden' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '이미지와 설명 등록 유의사항을 확인했습니다' }))
        fireEvent.click(screen.getByRole('button', { name: '등록하기' }))

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    taxInvoiceAvailable: true,
                    status: 'hidden',
                }),
            ),
        )
        expect(saveExpertProduct.mock.calls[0]?.[0]).not.toHaveProperty('aiTools')
    })

    it('shows Standard, Deluxe, and Premium fields only when package pricing is enabled', async () => {
        renderRegister()

        fireEvent.click(screen.getByRole('checkbox', { name: '패키지 가격 사용' }))

        const standard = screen.getByTestId('package-standard')
        const deluxe = screen.getByTestId('package-deluxe')
        const premium = screen.getByTestId('package-premium')

        expect(within(standard).getByLabelText('가격')).toBeInTheDocument()
        expect(within(deluxe).getByLabelText('가격')).toBeInTheDocument()
        expect(within(premium).getByLabelText('가격')).toBeInTheDocument()
    })

    it('guides package options as an upgrade comparison when package pricing is enabled', async () => {
        renderRegister()

        fireEvent.click(screen.getByRole('checkbox', { name: '패키지 가격 사용' }))

        expect(screen.getByText('패키지별 포함 항목 비교')).toBeInTheDocument()
        expect(screen.getByText('같은 항목은 패키지마다 같은 이름으로 쓰고 값만 다르게 입력하세요. 예: 원본 영상: 1개 / 2개 / 3개. 없는 항목은 빈칸으로 표시됩니다.')).toBeInTheDocument()

        const standard = screen.getByTestId('package-standard')
        const deluxe = screen.getByTestId('package-deluxe')
        const premium = screen.getByTestId('package-premium')

        fireEvent.change(within(standard).getByLabelText('포함 항목'), { target: { value: '기본 편집\n자막 삽입' } })
        fireEvent.change(within(deluxe).getByLabelText('포함 항목'), { target: { value: '기본 편집\n자막 삽입\n썸네일 제작' } })
        fireEvent.change(within(premium).getByLabelText('포함 항목'), { target: { value: '기본 편집\n자막 삽입\n썸네일 제작\n소스 파일 제공' } })

        const preview = screen.getByTestId('package-option-preview')
        expect(within(preview).getByText('기본 편집')).toBeInTheDocument()
        expect(within(preview).getByText('소스 파일 제공')).toBeInTheDocument()
        expect(within(preview).getAllByText('포함').length).toBeGreaterThan(0)
    })

    it('allows Premium package fields to stay empty when package pricing is enabled', async () => {
        renderRegister()

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: 'AI 숏폼 영상 패키지' } })
        fireEvent.change(screen.getByLabelText('서비스 요약'), { target: { value: '패키지형 숏폼 영상 제작 서비스입니다.' } })
        fireEvent.change(screen.getByLabelText('상세 설명'), { target: { value: 'Standard와 Deluxe만 운영하고 Premium은 나중에 추가합니다.' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '패키지 가격 사용' }))

        const standard = screen.getByTestId('package-standard')
        const deluxe = screen.getByTestId('package-deluxe')

        fireEvent.change(within(standard).getByLabelText('가격'), { target: { value: '30000' } })
        fireEvent.change(within(standard).getByLabelText('작업일'), { target: { value: '2' } })
        fireEvent.change(within(standard).getByLabelText('수정 횟수'), { target: { value: '1' } })
        fireEvent.change(within(standard).getByLabelText('포함 항목'), { target: { value: '15초 영상 1개' } })
        fireEvent.change(within(deluxe).getByLabelText('가격'), { target: { value: '50000' } })
        fireEvent.change(within(deluxe).getByLabelText('작업일'), { target: { value: '3' } })
        fireEvent.change(within(deluxe).getByLabelText('수정 횟수'), { target: { value: '2' } })
        fireEvent.change(within(deluxe).getByLabelText('포함 항목'), { target: { value: '15초 영상 2개\n썸네일 제작' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '이미지와 설명 등록 유의사항을 확인했습니다' }))
        fireEvent.click(screen.getByRole('button', { name: '등록하기' }))

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    packages: expect.objectContaining({
                        standard: expect.objectContaining({ price: 30000 }),
                        deluxe: expect.objectContaining({ price: 50000 }),
                        premium: null,
                    }),
                }),
            ),
        )
    })

    it('blocks main images below the Kmong pixel size before publishing', async () => {
        renderRegister()

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: 'AI 숏폼 영상 패키지' } })
        fireEvent.change(screen.getByLabelText('서비스 요약'), { target: { value: '15초 숏폼 영상 콘셉트와 초안을 제작합니다.' } })
        fireEvent.change(screen.getByLabelText('상세 설명'), { target: { value: '상세 설명입니다.' } })
        fireEvent.change(screen.getByLabelText('메인 이미지 첨부'), {
            target: { files: [new File(['small'], 'small-main.png', { type: 'image/png' })] },
        })
        fireEvent.change(screen.getByLabelText('가격'), { target: { value: '30000' } })
        fireEvent.change(screen.getByLabelText('작업일'), { target: { value: '2' } })
        fireEvent.change(screen.getByLabelText('수정 횟수'), { target: { value: '1' } })
        fireEvent.change(screen.getByLabelText('기본 제공 항목'), { target: { value: 'AI 영상 시안 1개' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '이미지와 설명 등록 유의사항을 확인했습니다' }))
        fireEvent.click(screen.getByRole('button', { name: '등록하기' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('대표 이미지는 크몽 기준에 맞춰 JPG 또는 PNG, 최소 652x488px 이상이어야 합니다.')
        expect(saveExpertProduct).not.toHaveBeenCalled()
    })

    it('allows main images that are not exactly 4:3 when they meet the minimum pixel size', async () => {
        renderRegister()

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: 'AI 숏폼 영상 패키지' } })
        fireEvent.change(screen.getByLabelText('서비스 요약'), { target: { value: '15초 숏폼 영상 콘셉트와 초안을 제작합니다.' } })
        fireEvent.change(screen.getByLabelText('상세 설명'), { target: { value: '상세 설명입니다.' } })
        fireEvent.change(screen.getByLabelText('메인 이미지 첨부'), {
            target: { files: [new File(['wrong-ratio'], 'wrong-ratio-main.png', { type: 'image/png' })] },
        })
        fireEvent.change(screen.getByLabelText('가격'), { target: { value: '30000' } })
        fireEvent.change(screen.getByLabelText('작업일'), { target: { value: '2' } })
        fireEvent.change(screen.getByLabelText('수정 횟수'), { target: { value: '1' } })
        fireEvent.change(screen.getByLabelText('기본 제공 항목'), { target: { value: 'AI 영상 시안 1개' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '이미지와 설명 등록 유의사항을 확인했습니다' }))
        fireEvent.click(screen.getByRole('button', { name: '등록하기' }))

        await waitFor(() => expect(saveExpertProduct).toHaveBeenCalledWith(
            expect.objectContaining({
                sampleImageUrl: expect.stringMatching(/^https:\/\/storage\.example\/product-samples\/expert-user-01\/[0-9a-f-]+\/main-/),
            }),
        ))
    })

    it('allows image files over 1MB when they satisfy the Kmong pixel size standard', async () => {
        renderRegister()
        const overLimitImage = new File([new Uint8Array(1024 * 1024 + 1)], 'large.png', { type: 'image/png' })

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: 'AI 숏폼 영상 패키지' } })
        fireEvent.change(screen.getByLabelText('서비스 요약'), { target: { value: '15초 숏폼 영상 콘셉트와 초안을 제작합니다.' } })
        fireEvent.change(screen.getByLabelText('상세 설명'), { target: { value: '상세 설명입니다.' } })
        fireEvent.change(screen.getByLabelText('메인 이미지 첨부'), {
            target: { files: [overLimitImage] },
        })
        fireEvent.change(screen.getByLabelText('가격'), { target: { value: '30000' } })
        fireEvent.change(screen.getByLabelText('작업일'), { target: { value: '2' } })
        fireEvent.change(screen.getByLabelText('수정 횟수'), { target: { value: '1' } })
        fireEvent.change(screen.getByLabelText('기본 제공 항목'), { target: { value: 'AI 영상 시안 1개' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '이미지와 설명 등록 유의사항을 확인했습니다' }))
        fireEvent.click(screen.getByRole('button', { name: '등록하기' }))

        await waitFor(() => expect(saveExpertProduct).toHaveBeenCalledWith(
            expect.objectContaining({
                sampleImageUrl: expect.stringMatching(/^https:\/\/storage\.example\/product-samples\/expert-user-01\/[0-9a-f-]+\/main-/),
            }),
        ))
    })

    it('loads an owned product for editing and preserves existing images when saving', async () => {
        renderEditRegister()

        expect(await screen.findByDisplayValue('기존 AI 상품')).toBeInTheDocument()
        expect(screen.getByDisplayValue('기존 요약입니다.')).toBeInTheDocument()
        expect(screen.getByDisplayValue('기존 상세 설명입니다.')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: '수정한 AI 상품' } })
        fireEvent.change(screen.getByLabelText('가격'), { target: { value: '70000' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '이미지와 설명 등록 유의사항을 확인했습니다' }))
        fireEvent.click(screen.getByRole('button', { name: '수정 저장하기' }))

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: editableProduct.id,
                    expertId: 'expert-user-01',
                    title: '수정한 AI 상품',
                    sampleImageUrl: editableProduct.sampleImageUrl,
                    sampleLinks: editableProduct.sampleLinks,
                    startingPrice: 70000,
                    packages: expect.objectContaining({
                        standard: expect.objectContaining({
                            price: 70000,
                        }),
                    }),
                }),
            ),
        )
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`/expert/${editableProduct.id}`))
    })

    it('shows existing images while editing and appends newly selected detail images', async () => {
        renderEditRegister()

        expect(await screen.findByAltText('현재 대표 이미지')).toHaveAttribute('src', editableProduct.sampleImageUrl)
        expect(screen.getByAltText('현재 상세 미디어 1')).toHaveAttribute('src', editableProduct.sampleLinks[0])

        fireEvent.change(screen.getByLabelText('메인 이미지 첨부'), {
            target: { files: [new File(['new-main'], 'new-main.png', { type: 'image/png' })] },
        })
        fireEvent.change(screen.getByLabelText('상세 미디어 첨부'), {
            target: { files: [new File(['new-detail'], 'new-detail.png', { type: 'image/png' })] },
        })

        expect(await screen.findByAltText('새 메인 이미지 미리보기')).toHaveAttribute('src', 'blob:new-main.png')
        expect(screen.getByAltText('새 상세 미디어 1')).toHaveAttribute('src', 'blob:new-detail.png')

        fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '70000' } })
        fireEvent.click(screen.getAllByRole('checkbox')[0])
        fireEvent.submit(document.querySelector('form') as HTMLFormElement)

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    sampleImageUrl: expect.stringMatching(/^https:\/\/storage\.example\/product-samples\/expert-user-01\/editable-product-01\/main-/),
                    sampleLinks: [
                        editableProduct.sampleLinks[0],
                        expect.stringMatching(/^https:\/\/storage\.example\/product-samples\/expert-user-01\/editable-product-01\/detail-/),
                    ],
                }),
            ),
        )
    })

    it('keeps only one main image preview when replacing the main image', async () => {
        renderEditRegister()

        expect(await screen.findByAltText('현재 대표 이미지')).toHaveAttribute('src', editableProduct.sampleImageUrl)
        const fileInputs = document.querySelectorAll<HTMLInputElement>(`input[type="file"]`)
        fireEvent.change(fileInputs[0], {
            target: { files: [new File(['new-main'], 'new-main.png', { type: 'image/png' })] },
        })

        await waitFor(() => expect(screen.queryByAltText('현재 대표 이미지')).not.toBeInTheDocument())
        expect(screen.getByAltText('새 메인 이미지 미리보기')).toHaveAttribute('src', 'blob:new-main.png')
    })

    it('renames portfolio inputs to detail images and lets editors remove existing and new detail images', async () => {
        renderEditRegister()

        expect(await screen.findByLabelText('상세 미디어 첨부')).toBeInTheDocument()
        expect(screen.queryByLabelText('상세 이미지/포트폴리오 첨부')).not.toBeInTheDocument()

        const fileInputs = document.querySelectorAll<HTMLInputElement>(`input[type="file"]`)
        fireEvent.change(fileInputs[1], {
            target: { files: [new File(['new-detail'], 'new-detail.png', { type: 'image/png' })] },
        })

        expect(await screen.findByAltText('새 상세 미디어 1')).toHaveAttribute('src', 'blob:new-detail.png')
        fireEvent.click(screen.getByRole('button', { name: '현재 상세 미디어 1 삭제' }))
        fireEvent.click(screen.getByRole('button', { name: '새 상세 미디어 1 삭제' }))

        fireEvent.click(screen.getAllByRole('checkbox')[0])
        fireEvent.submit(document.querySelector('form') as HTMLFormElement)

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    sampleLinks: [],
                }),
            ),
        )
    })

    it('accepts video files as detail media and stores them with product sample links', async () => {
        renderRegister()

        fireEvent.change(screen.getByLabelText('상품명'), { target: { value: 'AI 영상 미디어 상품' } })
        fireEvent.change(screen.getByLabelText('서비스 요약'), { target: { value: '영상과 이미지를 함께 보여주는 상품입니다.' } })
        fireEvent.change(screen.getByLabelText('상세 설명'), { target: { value: '상세 미디어에 이미지와 영상을 함께 등록합니다.' } })
        fireEvent.change(screen.getByLabelText('메인 이미지 첨부'), {
            target: { files: [new File(['main'], 'main.png', { type: 'image/png' })] },
        })
        fireEvent.change(screen.getByLabelText('상세 미디어 첨부'), {
            target: { files: [new File(['video'], 'sample.mov', { type: 'video/quicktime' })] },
        })
        fireEvent.change(screen.getByLabelText('가격'), { target: { value: '30000' } })
        fireEvent.change(screen.getByLabelText('작업일'), { target: { value: '2' } })
        fireEvent.change(screen.getByLabelText('수정 횟수'), { target: { value: '1' } })
        fireEvent.change(screen.getByLabelText('기본 제공 항목'), { target: { value: '영상 샘플 확인' } })
        fireEvent.click(screen.getByRole('checkbox', { name: '이미지와 설명 등록 유의사항을 확인했습니다' }))
        fireEvent.click(screen.getByRole('button', { name: '등록하기' }))

        await waitFor(() =>
            expect(saveExpertProduct).toHaveBeenCalledWith(
                expect.objectContaining({
                    sampleLinks: [expect.stringMatching(/^https:\/\/storage\.example\/product-samples\/expert-user-01\/[0-9a-f-]+\/detail-/)],
                }),
            ),
        )
    })

    it('allows MOV files from the picker and previews them as video detail media', async () => {
        renderRegister()

        const detailMediaInput = screen.getByLabelText('상세 미디어 첨부')
        expect(detailMediaInput).toHaveAttribute('accept', expect.stringContaining('video/quicktime'))

        fireEvent.change(detailMediaInput, {
            target: { files: [new File(['video'], 'sample.mov', { type: 'video/quicktime' })] },
        })

        expect(await screen.findByLabelText('새 상세 미디어 1')).toBeInstanceOf(HTMLVideoElement)
    })

    it('lets owners delete an existing product from the edit page', async () => {
        renderEditRegister()

        expect(await screen.findByDisplayValue('기존 AI 상품')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '상품 삭제하기' }))

        await waitFor(() => expect(deleteExpertProduct).toHaveBeenCalledWith(editableProduct.id))
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/my-work'))
    })
})
