import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'

const supabaseMocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: supabaseMocks.signInWithOAuth,
      signInWithPassword: supabaseMocks.signInWithPassword,
      signUp: supabaseMocks.signUp,
    },
  },
}))

const renderLogin = () => {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

describe('Login', () => {
  beforeEach(() => {
    supabaseMocks.signInWithOAuth.mockResolvedValue({ error: null })
    supabaseMocks.signInWithPassword.mockResolvedValue({ error: null })
    supabaseMocks.signUp.mockResolvedValue({ error: null })
  })

  it('prioritizes social login and keeps email login as a verified fallback', () => {
    renderLogin()

    expect(screen.getByRole('heading', { name: '기그온 시작하기' })).toBeInTheDocument()
    expect(screen.getByText('Google 또는 카카오로 빠르게 로그인하고 거래를 이어가세요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '카카오로 계속하기' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '이메일로 계속하기' })).toBeInTheDocument()
    expect(screen.getByText('이메일 인증 후 거래 기능을 이용할 수 있어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이메일로 로그인' })).toBeInTheDocument()
  })

  it('keeps the signup screen social-first with an email verification message', () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: '회원가입' }))

    expect(screen.getByText('가입 후 프로필을 작성하면 의뢰자와 작업자 기능을 모두 이용할 수 있어요.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '이메일로 가입하기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이메일로 회원가입' })).toBeInTheDocument()
    expect(screen.getByText('가입 확인 메일을 통해 이메일 소유를 확인합니다.')).toBeInTheDocument()
  })
})
