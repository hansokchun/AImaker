# Home Fiverr-Inspired Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the AIConnect homepage into a Fiverr-inspired, AI-specialized marketplace landing page.

**Architecture:** Keep the existing `Home.tsx` page and global `src/index.css` styles. Add test coverage in `Home.test.tsx` for the new hero, search entry, category chips, trust strip, featured products, process section, and maker CTA.

**Tech Stack:** React 19, React Router, Vitest, Testing Library, CSS.

---

### Task 1: Homepage Behavior Tests

**Files:**
- Modify: `src/pages/Home.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that expect:
- Hero heading `AI 작업을 싸고 쉽게 맡기세요`
- Search input placeholder `어떤 AI 작업이 필요하세요?`
- Popular work chips
- Trust strip labels
- Category cards
- Product cards from storage
- Logged-in my work shortcut

- [ ] **Step 2: Run home tests**

Run: `npm.cmd test -- src/pages/Home.test.tsx`
Expected: FAIL until the homepage is updated.

### Task 2: Homepage Markup

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Implement the hero**

Add visual hero, search form, popular chips, CTA links, and logged-in my work shortcut.

- [ ] **Step 2: Implement supporting sections**

Add trust strip, category cards, featured products, process section, and maker CTA.

### Task 3: Homepage Styling

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add responsive styles**

Style the hero, search bar, category chips, trust strip, featured product cards, process band, and maker CTA.

### Task 4: Verification

**Files:**
- No file changes.

- [ ] **Step 1: Run focused tests**

Run: `npm.cmd test -- src/pages/Home.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run full verification**

Run:
```text
npm.cmd test
npm.cmd run build
```

Expected: all tests and build pass.
