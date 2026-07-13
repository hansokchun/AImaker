import { supabase } from './supabase'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png']
const ACCEPTED_DETAIL_MEDIA_TYPES = ['image/jpeg', 'image/png', 'video/mp4', 'video/webm']
const MAIN_IMAGE_MIN_WIDTH = 652
const MAIN_IMAGE_MIN_HEIGHT = 488
const PRODUCT_SAMPLE_BUCKET = 'product-samples'

export type ProductImageKind = 'main' | 'detail'

type ProductSampleUpload = {
    readonly file: File
    readonly kind: ProductImageKind
    readonly productId: string
    readonly userId: string
    readonly index?: number
}

type ProductSamplePathInput = {
    readonly file: File
    readonly kind: ProductImageKind
    readonly productId: string
    readonly userId: string
    readonly index: number
}

export const uploadProductSampleFile = async ({ file, index = 0, kind, productId, userId }: ProductSampleUpload) => {
    await validateProductImageFile(file, kind)

    if (!supabase) {
        return readFileAsDataUrl(file)
    }

    const filePath = createProductSamplePath({ file, index, kind, productId, userId })
    const { error } = await supabase.storage
        .from(PRODUCT_SAMPLE_BUCKET)
        .upload(filePath, file, {
            cacheControl: '31536000',
            contentType: file.type,
            upsert: true,
        })

    if (error) {
        throw new Error('상품 이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }

    const { data } = supabase.storage.from(PRODUCT_SAMPLE_BUCKET).getPublicUrl(filePath)
    return data.publicUrl
}

const createProductSamplePath = ({ file, index, kind, productId, userId }: ProductSamplePathInput) => {
    const extension = getProductSampleExtension(file)
    return `${userId}/${productId}/${kind}-${Date.now()}-${index}.${extension}`
}

const getProductSampleExtension = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension) return extension

    const mimeExtension = file.type.split('/').pop()?.toLowerCase()
    return mimeExtension || 'bin'
}

const readFileAsDataUrl = async (file: File) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('첨부 파일을 읽지 못했습니다.'))
        reader.readAsDataURL(file)
    })
}

const validateProductImageFile = async (file: File, kind: ProductImageKind) => {
    const acceptedTypes = kind === 'main' ? ACCEPTED_IMAGE_TYPES : ACCEPTED_DETAIL_MEDIA_TYPES
    if (!acceptedTypes.includes(file.type)) {
        throw new Error(kind === 'main'
            ? '대표 이미지는 JPG 또는 PNG 파일만 등록할 수 있습니다.'
            : '상세 미디어는 JPG, PNG, MP4, WebM 파일만 등록할 수 있습니다.')
    }

    if (kind === 'main') {
        const { width, height } = await readImageDimensions(file)
        if (
            width < MAIN_IMAGE_MIN_WIDTH ||
            height < MAIN_IMAGE_MIN_HEIGHT
        ) {
            throw new Error('대표 이미지는 크몽 기준에 맞춰 JPG 또는 PNG, 최소 652x488px 이상이어야 합니다.')
        }
    }
}

const readImageDimensions = (file: File) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image()
        const objectUrl = URL.createObjectURL(file)
        image.onload = () => {
            URL.revokeObjectURL(objectUrl)
            resolve({ width: image.width, height: image.height })
        }
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error('이미지 파일을 확인하지 못했습니다. JPG 또는 PNG 파일을 다시 선택해 주세요.'))
        }
        image.src = objectUrl
    })
