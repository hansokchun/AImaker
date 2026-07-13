import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const notificationQueueSource = readFileSync(
    join(process.cwd(), 'supabase', 'functions', 'notification-queue', 'index.ts'),
    'utf8',
)

describe('notification-queue Edge Function', () => {
    it('derives notification content and channels on the server', () => {
        expect(notificationQueueSource).toMatch(/const notificationTemplates:/)
        expect(notificationQueueSource).toMatch(/from\('notification_preferences'\)/)
        expect(notificationQueueSource).toMatch(/body: template\.body/)
        expect(notificationQueueSource).toMatch(/channels,/)
        expect(notificationQueueSource).toMatch(/title: template\.title/)
        expect(notificationQueueSource).not.toMatch(/payload\.title/)
        expect(notificationQueueSource).not.toMatch(/payload\.body/)
        expect(notificationQueueSource).not.toMatch(/payload\.channels/)
        expect(notificationQueueSource).not.toMatch(/payload\.createdAt/)
    })

    it('limits queued event types to the related record kind', () => {
        expect(notificationQueueSource).toMatch(/allowedTypesByRelatedType/)
        expect(notificationQueueSource).toMatch(/allowedTypesByRelatedType\[value\.relatedType\]\.has\(value\.type\)/)
        expect(notificationQueueSource).toMatch(/includesUser\(data, actorId\) && includesUser\(data, targetUserId\)/)
    })
})
