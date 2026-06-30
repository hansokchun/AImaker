import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const myPageCss = readFileSync('src/pages/MyPage.css', 'utf8')
const globalCss = readFileSync('src/index.css', 'utf8')
const proposalCss = readFileSync('src/pages/Proposal.css', 'utf8')
const workroomCss = readFileSync('src/pages/Workroom.css', 'utf8')
const loginCss = readFileSync('src/pages/Login.css', 'utf8')

const getRule = (css: string, selector: string) => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))
    return match?.[1] ?? ''
}

describe('MyPage work dashboard visual styles', () => {
    it('uses card separation between the left menu and main work content', () => {
        const shellRule = getRule(myPageCss, '.work-dashboard-shell')
        const sidebarRule = getRule(myPageCss, '.work-dashboard-sidebar')
        const contentRule = getRule(myPageCss, '.work-dashboard-content > section,\n.work-dashboard-panel')

        expect(shellRule).toContain('gap: var(--space-6)')
        expect(sidebarRule).toContain('padding: var(--space-4)')
        expect(sidebarRule).toContain('border: 1px solid var(--border-color)')
        expect(sidebarRule).toContain('background: var(--surface)')
        expect(contentRule).toContain('padding: var(--space-6)')
        expect(contentRule).toContain('border: 1px solid var(--border-color)')
        expect(contentRule).toContain('background: var(--surface)')
    })

    it('restores the original light marketplace backgrounds', () => {
        expect(getRule(globalCss, ':root')).toContain('--background: #f8fafc')
        expect(getRule(globalCss, 'body')).toContain('background-color: var(--background)')
        expect(getRule(myPageCss, '.mypage-page')).toContain('background: var(--background)')
        expect(getRule(myPageCss, '.work-dashboard-page')).toContain('background: var(--background)')
        expect(getRule(globalCss, '.recent-requests-section')).toContain('background: #f8fafc')
        expect(getRule(proposalCss, '.proposal-page')).toContain('background: #f8fafc')
        expect(getRule(workroomCss, '.workroom-page')).toContain('background: #f8fafc')
        expect(getRule(loginCss, '.login-page')).toContain('linear-gradient(135deg, #f8fbff 0%, #eef4ff 50%, #f8fafc 100%)')
    })

    it('uses a compact role switch with a transform-driven indicator', () => {
        const switchRule = getRule(myPageCss, '.work-role-switch')
        const indicatorRule = getRule(myPageCss, '.work-role-toggle-indicator')
        const expertIndicatorRule = getRule(myPageCss, '.work-role-toggle-indicator.is-expert')
        const buttonRule = getRule(myPageCss, '.work-role-toggle-button')

        expect(switchRule).toContain('padding: var(--space-2)')
        expect(switchRule).toContain('border-radius: var(--radius-lg)')
        expect(indicatorRule).toContain('transition: transform')
        expect(expertIndicatorRule).toContain('transform: translateX(100%)')
        expect(buttonRule).toContain('min-height: 38px')
        expect(buttonRule).toContain('white-space: nowrap')
    })
})
