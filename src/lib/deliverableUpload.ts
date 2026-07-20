import { supabase } from './supabase'

const DELIVERABLE_BUCKET = 'deliverable-files'
const MAX_DELIVERABLE_BYTES = 100 * 1024 * 1024
const ACCEPTED_DELIVERABLE_TYPES = new Set([
    'application/pdf', 'application/zip', 'application/x-zip-compressed',
    'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/wav', 'text/plain', 'text/csv',
])

export type UploadedDeliverableFile = {
    readonly storagePath: string
    readonly fileName: string
    readonly fileSize: number
    readonly fileSha256: string
    readonly signedUrl?: string
}

const safeFileName = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    if (!extension || !/^[a-z0-9]{1,10}$/.test(extension)) throw new Error('파일 확장자를 확인할 수 없습니다.')
    return `deliverable.${extension}`
}

const sha256 = async (file: File): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('')
}

export async function uploadDeliverableFile(workId: string, expertId: string, file: File): Promise<UploadedDeliverableFile> {
    if (file.size <= 0) throw new Error('빈 파일은 제출할 수 없습니다.')
    if (file.size > MAX_DELIVERABLE_BYTES) throw new Error('공식 제출 파일은 100MB 이하만 업로드할 수 있습니다.')
    if (!ACCEPTED_DELIVERABLE_TYPES.has(file.type)) {
        throw new Error('PDF, ZIP, 이미지, MP4/WebM, 오디오, 텍스트 파일만 공식 제출할 수 있습니다.')
    }

    const fileName = safeFileName(file.name)
    const storagePath = `${workId}/${expertId}/${crypto.randomUUID()}-${fileName}`
    const fileSha256 = await sha256(file)

    if (!supabase) {
        return { storagePath, fileName: file.name, fileSize: file.size, fileSha256 }
    }

    const { error } = await supabase.storage.from(DELIVERABLE_BUCKET).upload(storagePath, file, {
        cacheControl: '31536000',
        contentType: file.type,
        upsert: false,
    })
    if (error) throw new Error('공식 제출 파일을 업로드하지 못했습니다. 잠시 후 다시 시도해주세요.')

    const signedUrl = await createDeliverableSignedUrl(storagePath)
    return { storagePath, fileName: file.name, fileSize: file.size, fileSha256, ...(signedUrl ? { signedUrl } : {}) }
}

export async function createDeliverableSignedUrl(storagePath: string): Promise<string | null> {
    if (!supabase) return storagePath
    const { data, error } = await supabase.storage.from(DELIVERABLE_BUCKET).createSignedUrl(storagePath, 60 * 60)
    return error || !data?.signedUrl ? null : data.signedUrl
}
