import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Category from './Category'
import { mockExpertProducts } from '../data/mockData'

vi.mock('../lib/storage', () => ({
  getExpertProducts: vi.fn(async () => mockExpertProducts),
}))

describe('Category', () => {
  it('renders products instead of expert cards', async () => {
    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'AI 작업 찾기' })).toBeInTheDocument()
    expect(screen.getByText('AI 영상/숏폼')).toBeInTheDocument()
    expect(screen.getByText('AI 이미지/캐릭터')).toBeInTheDocument()
    expect(screen.getByText('AI 개발/자동화')).toBeInTheDocument()
    expect(await screen.findAllByRole('link', { name: /상세 보기/ })).toHaveLength(3)
    expect(screen.queryByRole('link', { name: '패키지로 의뢰하기' })).not.toBeInTheDocument()
    expect(screen.getByText('시작가 30,000원')).toBeInTheDocument()
    expect(screen.getByText('ChatGPT · Runway · Premiere Pro')).toBeInTheDocument()
  })

  it('shows an empty state when filters remove all products', async () => {
    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    await screen.findAllByRole('link', { name: /상세 보기/ })
    fireEvent.change(screen.getByLabelText('최대 가격'), { target: { value: '10000' } })

    expect(screen.getByText('아직 등록된 AI 작업이 없습니다.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AI 작업 요청하기' })).toBeInTheDocument()
  })
})
