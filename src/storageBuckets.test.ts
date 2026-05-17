import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const profilePage = readFileSync(join(process.cwd(), 'src/pages/Profile.tsx'), 'utf8')
const onboardingPage = readFileSync(join(process.cwd(), 'src/pages/Onboarding.tsx'), 'utf8')

describe('Supabase storage buckets', () => {
    it('uses the planned profile-images bucket for profile image uploads', () => {
        const profileImageSources = `${profilePage}\n${onboardingPage}`

        expect(profileImageSources).toContain(".from('profile-images')")
        expect(profileImageSources).not.toMatch(/storage\s*\.\s*from\('profiles'\)/)
    })
})
