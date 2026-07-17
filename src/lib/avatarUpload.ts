const AVATAR_CONTENT_TYPES = {
    'image/jpeg': new Set(['jpeg', 'jpg']),
    'image/png': new Set(['png']),
    'image/webp': new Set(['webp']),
} as const

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

type AvatarFile = Pick<File, 'name' | 'size' | 'slice' | 'type'>

export type PreparedAvatarUpload = {
    readonly contentType: keyof typeof AVATAR_CONTENT_TYPES
    readonly objectPath: string
}

export class AvatarUploadError extends Error {
    readonly code: 'empty' | 'invalid_content' | 'invalid_file_name' | 'invalid_type' | 'oversize' | 'type_mismatch'

    constructor(code: AvatarUploadError['code'], message: string) {
        super(message)
        this.name = 'AvatarUploadError'
        this.code = code
    }
}

const contentTypeIsAllowed = (value: string): value is keyof typeof AVATAR_CONTENT_TYPES =>
    Object.prototype.hasOwnProperty.call(AVATAR_CONTENT_TYPES, value)

const hasPrefix = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
    prefix.every((value, index) => bytes[index] === value)

const contentMatchesType = (bytes: Uint8Array, type: keyof typeof AVATAR_CONTENT_TYPES): boolean => {
    if (type === 'image/jpeg') return hasPrefix(bytes, [0xff, 0xd8, 0xff])
    if (type === 'image/png') return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    return hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) && hasPrefix(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
}

export async function prepareAvatarUpload(
    userId: string,
    file: AvatarFile,
    createRandomId: () => string = () => crypto.randomUUID(),
): Promise<PreparedAvatarUpload> {
    if (file.size <= 0) throw new AvatarUploadError('empty', '빈 이미지는 업로드할 수 없습니다.')
    if (file.size > MAX_AVATAR_BYTES) {
        throw new AvatarUploadError('oversize', '프로필 이미지는 5 MiB 이하여야 합니다.')
    }
    if (!contentTypeIsAllowed(file.type)) {
        throw new AvatarUploadError('invalid_type', 'JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.')
    }

    const match = /\.([a-z0-9]+)$/i.exec(file.name)
    if (!match?.[1] || file.name.includes('/') || file.name.includes('\\')) {
        throw new AvatarUploadError('invalid_file_name', '안전한 이미지 파일명을 사용해 주세요.')
    }

    const extension = match[1].toLowerCase()
    if (!AVATAR_CONTENT_TYPES[file.type].has(extension)) {
        throw new AvatarUploadError('type_mismatch', '파일 확장자와 이미지 형식이 일치하지 않습니다.')
    }
    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    if (!contentMatchesType(signature, file.type)) {
        throw new AvatarUploadError('invalid_content', '실제 JPEG, PNG, WebP 이미지 파일만 업로드할 수 있습니다.')
    }

    const storageExtension = file.type === 'image/jpeg' ? 'jpg' : extension
    return {
        contentType: file.type,
        objectPath: `${userId}/${createRandomId()}.${storageExtension}`,
    }
}
