import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const notificationDispatcherSource = readFileSync(
    join(process.cwd(), 'supabase', 'functions', 'notification-dispatcher', 'index.ts'),
    'utf8',
)

describe('notification-dispatcher Edge Function', () => {
    it('keeps in-app notifications processable without a phone number', () => {
        expect(notificationDispatcherSource).toMatch(/event\.channels\.includes\('in_app'\)/)
        expect(notificationDispatcherSource).toMatch(/provider: 'in_app', status: 'sent'/)
        expect(notificationDispatcherSource.indexOf("event.channels.includes('in_app')"))
            .toBeLessThan(notificationDispatcherSource.indexOf("알림 수신 전화번호가 없습니다."))
    })

    it('tries SMS after Kakao is unavailable or rejected', () => {
        expect(notificationDispatcherSource).toMatch(/if \(phoneNumber && event\.channels\.includes\('kakao_alimtalk'\)/)
        expect(notificationDispatcherSource).toMatch(/if \(phoneNumber && event\.channels\.includes\('sms'\)/)
        expect(notificationDispatcherSource.indexOf("event.channels.includes('kakao_alimtalk')"))
            .toBeLessThan(notificationDispatcherSource.indexOf("event.channels.includes('sms')"))
        expect(notificationDispatcherSource).not.toMatch(/return sent\s*\?\s*\{ provider: 'kakao_alimtalk', status: 'sent' \}\s*:\s*\{ failureReason: 'Kakao provider returned a non-2xx response.'/)
    })

    it('treats provider network errors as a failed delivery instead of aborting the batch', () => {
        expect(notificationDispatcherSource).toMatch(/const postProviderWebhook[\s\S]*?try \{[\s\S]*?await fetch\([\s\S]*?\}\s*catch \{\s*return false\s*\}[\s\S]*?finally \{\s*clearTimeout\(timeoutId\)/)
    })
})
