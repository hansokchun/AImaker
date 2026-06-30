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
    it('uses a flat SaaS manager shell with sidebar, list, and detail columns', () => {
        const shellRule = getRule(myPageCss, '.work-dashboard-shell')
        const sidebarRule = getRule(myPageCss, '.work-dashboard-sidebar')
        const splitRule = getRule(myPageCss, '.work-dashboard-split')
        const contentRule = getRule(myPageCss, '.work-dashboard-content > section,\n.work-dashboard-panel')
        const detailRule = getRule(myPageCss, '.work-detail-panel')

        expect(shellRule).toContain('grid-template-columns: 248px minmax(0, 1fr)')
        expect(shellRule).toContain('gap: var(--space-5)')
        expect(sidebarRule).toContain('padding: var(--space-5)')
        expect(sidebarRule).toContain('border: 1px solid #e5e7eb')
        expect(sidebarRule).toContain('background: var(--surface)')
        expect(contentRule).toContain('padding: 0')
        expect(contentRule).toContain('border: 0')
        expect(contentRule).toContain('background: transparent')
        expect(splitRule).toContain('grid-template-columns: minmax(300px, 0.78fr) minmax(0, 1.42fr)')
        expect(detailRule).toContain('border: 1px solid #e8edf5')
        expect(detailRule).toContain('border-radius: 16px')
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

    it('uses a reference-style pill role switch with icon buttons', () => {
        const switchRule = getRule(myPageCss, '.work-role-switch')
        const toggleRule = getRule(myPageCss, '.work-role-toggle')
        const indicatorRule = getRule(myPageCss, '.work-role-toggle-indicator')
        const expertIndicatorRule = getRule(myPageCss, '.work-role-toggle-indicator.is-expert')
        const buttonRule = getRule(myPageCss, '.work-role-toggle-button')
        const activeButtonRule = getRule(myPageCss, '.work-role-toggle-button[aria-pressed="true"]')
        const iconRule = getRule(myPageCss, '.work-role-toggle-icon')

        expect(switchRule).toContain('padding: var(--space-2)')
        expect(switchRule).toContain('border-radius: 999px')
        expect(switchRule).toContain('max-width: 100%')
        expect(toggleRule).toContain('min-height: 48px')
        expect(toggleRule).toContain('width: 100%')
        expect(toggleRule).toContain('border-radius: 999px')
        expect(indicatorRule).toContain('width: 50%')
        expect(indicatorRule).toContain('background: linear-gradient')
        expect(indicatorRule).toContain('border-radius: 999px')
        expect(indicatorRule).toContain('transition: transform')
        expect(expertIndicatorRule).toContain('transform: translateX(100%)')
        expect(buttonRule).toContain('display: inline-flex')
        expect(buttonRule).toContain('gap: var(--space-2)')
        expect(buttonRule).toContain('min-width: 0')
        expect(buttonRule).toContain('white-space: nowrap')
        expect(activeButtonRule).toContain('color: var(--surface)')
        expect(iconRule).toContain('width: 1.15rem')
    })

    it('uses compact list rows, a progress stepper, timeline, and simple transaction info', () => {
        const menuButtonRule = getRule(myPageCss, '.work-dashboard-menu-button')
        const selectedMenuRule = getRule(myPageCss, '.work-dashboard-menu-button.is-selected')
        const listCardRule = getRule(myPageCss, '.work-list-card')
        const listMetaRule = getRule(myPageCss, '.work-list-meta-row')
        const statusBadgeRule = getRule(myPageCss, '.work-list-status-badge')
        const progressRule = getRule(myPageCss, '.work-progress-stepper')
        const currentCardRule = getRule(myPageCss, '.work-current-stage-card')
        const timelineRule = getRule(myPageCss, '.work-activity-timeline')
        const transactionInfoRule = getRule(myPageCss, '.work-transaction-info')

        expect(menuButtonRule).toContain('display: flex')
        expect(menuButtonRule).toContain('border-left: 3px solid transparent')
        expect(selectedMenuRule).toContain('border-left-color: #2563eb')
        expect(listCardRule).toContain('min-height: 92px')
        expect(listCardRule).toContain('padding: var(--space-4)')
        expect(listMetaRule).toContain('justify-content: space-between')
        expect(statusBadgeRule).toContain('border-radius: 999px')
        expect(progressRule).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))')
        expect(currentCardRule).toContain('background: #eff6ff')
        expect(timelineRule).toContain('display: grid')
        expect(transactionInfoRule).toContain('border: 1px solid #e8edf5')
    })
})
