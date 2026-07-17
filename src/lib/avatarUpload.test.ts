import { describe, expect, it } from 'vitest'
import { AvatarUploadError, prepareAvatarUpload } from './avatarUpload'

const userId = '11111111-1111-4111-8111-111111111111'
const randomId = '22222222-2222-4222-8222-222222222222'

describe('avatar upload boundary', () => {
    it('creates an owner-folder path with a random name for an allowed image', async () => {
        const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'portrait.png', { type: 'image/png' })

        await expect(prepareAvatarUpload(userId, file, () => randomId)).resolves.toEqual({
            contentType: 'image/png',
            objectPath: `${userId}/${randomId}.png`,
        })
    })

    it.each([
        ['root-style traversal', '../avatar.png', 'image/png', 6],
        ['SVG content', 'avatar.svg', 'image/svg+xml', 6],
        ['mismatched extension', 'avatar.jpg', 'image/png', 6],
        ['empty image', 'avatar.webp', 'image/webp', 0],
        ['oversize image', 'avatar.webp', 'image/webp', (5 * 1024 * 1024) + 1],
    ])('rejects %s', async (_label, name, type, size) => {
        const file = { name, type, size, slice: () => new Blob() }

        await expect(prepareAvatarUpload(userId, file, () => randomId)).rejects.toBeInstanceOf(AvatarUploadError)
    })

    it('rejects spoofed image content even when MIME and extension agree', async () => {
        const file = new File(['not-a-png'], 'portrait.png', { type: 'image/png' })

        await expect(prepareAvatarUpload(userId, file, () => randomId)).rejects.toMatchObject({
            code: 'invalid_content',
        })
    })
})
