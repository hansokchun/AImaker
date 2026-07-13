import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

const renderRoute = (path: string) => {
    window.history.pushState({}, '', path)
    render(<App />)
}

describe('public route smoke flow', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/')
    })

    it('opens the terms page through the app router', async () => {
        renderRoute('/terms')

        expect(await screen.findByRole('heading', { name: '이용약관' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '개인정보 처리방침' })).toHaveAttribute('href', '/privacy')
    })

    it('opens the privacy page through the app router', async () => {
        renderRoute('/privacy')

        expect(await screen.findByRole('heading', { name: '개인정보 처리방침' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms')
    })
})
