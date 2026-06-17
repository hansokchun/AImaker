# Clean AI Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the home screen into a clean, Google-like AI marketplace entry page that still shows AI specialization, low-cost positioning, three launch categories, and buyer-first CTAs.

**Architecture:** Keep the existing `Home.tsx` page and product-loading behavior. Update `Home.test.tsx` first so the desired copy, category cards, product CTAs, and subtle trust message are covered before changing production code. Add home-specific CSS classes in `src/index.css` without restructuring other pages.

**Tech Stack:** React, React Router, Vitest, Testing Library, CSS.

---

### Task 1: Home Behavior Tests

**Files:**
- Modify: `src/pages/Home.test.tsx`

- [ ] **Step 1: Write the failing test**

Update the main home test to expect:

```tsx
expect(screen.getByRole('heading', { name: 'AI 영상, 이미지, 자동화 작업을 더 저렴하게 맡기세요' })).toBeInTheDocument()
expect(screen.getByRole('link', { name: 'AI 전문가 찾기' })).toHaveAttribute('href', '/category')
expect(screen.getByRole('link', { name: '상품 둘러보기' })).toHaveAttribute('href', '/category')
expect(screen.getByRole('heading', { name: 'AI 영상/숏폼' })).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'AI 이미지/캐릭터' })).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'AI 개발/자동화' })).toBeInTheDocument()
expect(screen.getByText('샘플 확인 · 요구사항 작성 · 작업방에서 진행 확인')).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'AI 도구를 다룰 줄 안다면 작업자로 시작하세요' })).toBeInTheDocument()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/pages/Home.test.tsx`

Expected: FAIL because the current home still uses the old minimal headline and CTAs.

### Task 2: Home Markup

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Implement the clean marketplace structure**

Add:
- Buyer-first hero with two category links.
- Three category cards.
- `입문형 AI 상품` product section.
- One subtle process/trust line.
- Lower maker CTA.

- [ ] **Step 2: Keep existing product loading intact**

Continue using `getExpertProducts()` with `mockExpertProducts` fallback.

### Task 3: Home Styling

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add home-specific clean styles**

Use generous whitespace, white cards, restrained borders, green/blue/yellow category accents, and 8px border radius.

- [ ] **Step 2: Keep responsive layout stable**

On mobile, stack hero, categories, product cards, trust line, and maker CTA.

### Task 4: Verification And Push

**Files:**
- Verify all changed files.

- [ ] **Step 1: Verify focused test**

Run: `npm.cmd test -- src/pages/Home.test.tsx`

- [ ] **Step 2: Verify full suite**

Run: `npm.cmd test`

- [ ] **Step 3: Verify production build**

Run: `npm.cmd run build`

- [ ] **Step 4: Commit and push**

Run: `powershell -ExecutionPolicy Bypass -File .\scripts\sync-dev.ps1 -Message "feat: refine clean ai home"`
