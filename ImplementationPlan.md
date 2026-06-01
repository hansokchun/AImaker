# AIConnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AIConnect를 AI 상품 탐색, 요구사항 작성, 거래 제안서, 작업 진행표까지 이어지는 초기 런칭 가능한 서비스로 개편한다.

**Architecture:** 기존 React + TypeScript + Vite 구조를 유지하고, 먼저 mock data로 전체 거래 흐름을 구현한다. 이후 Supabase 테이블과 RLS를 연결해 실제 저장 구조로 전환한다.

**Tech Stack:** React, TypeScript, Vite, react-router-dom, Supabase, Vitest, React Testing Library

---

## 1. 구현 원칙

- 기존 코드를 버리지 않고 필요한 화면부터 개편한다.
- 디자인 고도화, 화면 문구 톤 정리, 모바일 세부 조정은 디자인 방향 확정 후 별도 단계로 미룬다.
- 디자인 확정 전에는 기존 UI를 최대한 유지하고 기능 흐름, 데이터 저장, 권한 정책 안정화에 집중한다.
- 기능 구현 전 테스트를 먼저 작성한다.
- mock data로 전체 흐름을 먼저 완성한 뒤 Supabase를 연결한다.
- 자동 결제, 에스크로, 단계별 정산은 구현하지 않는다.

---

## 2. 작업 순서

```text
1. 테스트 환경 설정
2. 타입과 mock data 정리
3. 홈 화면 개편
4. 상품 목록 개편
5. 상품 상세/패키지 CTA 개편
6. 요구사항 작성 화면 개편
7. 거래 제안서 화면 추가
8. 작업 진행표 화면 추가
9. 전문가 상품 등록 화면 정리
10. 마이페이지 연결
11. Supabase migration 설계 반영
12. 전체 검증
```

---

## 3. Task 1: 테스트 환경 설정

**Files:**

- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`

작업:

- [x] `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`을 dev dependency로 추가한다.
- [x] `package.json`에 `test` 스크립트를 추가한다.
- [x] `vite.config.ts`에 Vitest 설정을 추가한다.
- [x] `src/test/setup.ts`에서 `@testing-library/jest-dom`을 불러온다.

검증:

```text
npm.cmd run test
```

기대 결과:

```text
테스트 파일이 없거나 기본 테스트가 통과한다.
```

---

## 4. Task 2: 타입과 mock data 정리

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/data/mockData.ts`
- Create: `src/constants/categories.ts`
- Create: `src/constants/policies.ts`

작업:

- [x] `AiCategory`, `ExpertProduct`, `ProductPackage`, `ServiceRequest`, `Proposal`, `Work`, `WorkStep`, `Deliverable`, `Review` 타입을 추가한다.
- [x] 초기 3개 카테고리를 상수로 분리한다.
- [x] 제안서 유효기간 3일, 외부 연락 금지 문구를 정책 상수로 분리한다.
- [x] mock data를 상품 중심으로 재구성한다.

우선 테스트:

- 상품 mock data에 3개 카테고리가 모두 존재하는지 확인한다.
- 각 상품에 `standard` 패키지가 있는지 확인한다.

검증:

```text
npm.cmd run test
npm.cmd run build
```

---

## 5. Task 3: 홈 화면 개편

**Files:**

- Modify: `src/pages/Home.tsx`
- Modify: `src/index.css` 또는 기존 홈 스타일 파일

작업:

- [x] 핵심 문구를 `AI 외주를 더 쉽고 저렴하게`로 교체한다.
- [x] 3개 초기 카테고리 섹션을 추가한다.
- [x] 추천 AI 상품 섹션을 추가한다.
- [x] `AI 작업 맡기기`, `AI 전문가로 시작하기` CTA를 배치한다.

우선 테스트:

- 홈에 핵심 문구가 보이는지 확인한다.
- 3개 카테고리가 모두 보이는지 확인한다.
- 주요 CTA가 존재하는지 확인한다.

---

## 6. Task 4: 상품 목록 개편

**Files:**

- Modify: `src/pages/Category.tsx`
- Modify: `src/components/ExpertCard.tsx`
- Create: `src/components/ProductCard.tsx`

작업:

- [x] 목록의 기본 단위를 전문가가 아니라 상품으로 바꾼다.
- [x] 상품 카드에 상품명, 시작가, 작업 기간, 사용 AI 도구, 샘플 정보를 표시한다.
- [x] 가격 범위, AI 도구 필터를 유지하거나 단순화한다.
- [x] 상품이 없을 때 빈 상태 문구를 표시한다.

우선 테스트:

- 상품 카드에 가격과 AI 도구가 보이는지 확인한다.
- `패키지로 의뢰하기` 버튼이 있는지 확인한다.
- 빈 상태 문구가 보이는지 확인한다.

---

## 7. Task 5: 상품 상세/패키지 CTA 개편

**Files:**

- Modify: `src/pages/ExpertDetail.tsx`
- Modify: `src/components/PackageCard.tsx`

작업:

- [x] 상품 설명, 샘플 결과물, 사용 AI 도구를 상단에서 강조한다.
- [x] Standard 패키지를 필수로 표시한다.
- [x] `패키지로 의뢰하기` 버튼을 `/request/:productId`로 연결한다.
- [x] 바로 결제가 아니라 요구사항 작성으로 이동한다는 안내를 표시한다.

우선 테스트:

- 패키지 안내 문구가 보이는지 확인한다.
- CTA가 요구사항 작성 경로로 연결되는지 확인한다.

---

## 8. Task 6: 요구사항 작성 화면 개편

**Files:**

- Modify: `src/pages/ServiceRequest.tsx`
- Modify: `src/pages/ServiceRequest.css`

작업:

- [x] 선택한 패키지 요약을 표시한다.
- [x] 원하는 결과물, 작업 목적, 참고자료, 마감 희망일 입력을 추가한다.
- [x] 단일 진행/단계별 진행 선택을 추가한다.
- [x] 연락처 입력 필드를 제거한다.
- [x] 외부 연락 금지 안내 문구를 표시한다.

우선 테스트:

- 연락처 입력 필드가 없는지 확인한다.
- 단일 진행/단계별 진행 선택이 가능한지 확인한다.
- 제출 후 제안서 대기 상태로 이동하는지 확인한다.

---

## 9. Task 7: 거래 제안서 화면 추가

**Files:**

- Create: `src/pages/Proposal.tsx`
- Create: `src/pages/Proposal.css`
- Modify: `src/App.tsx`
- Modify: `src/constants/routes.ts`

작업:

- [x] 제안서 상세 화면을 추가한다.
- [x] 최종 금액, 작업 범위, 작업 기간, 산출물, 수정 횟수를 표시한다.
- [x] 제안서 유효기간 3일 안내를 표시한다.
- [x] 승인, 수정 요청, 취소 버튼을 추가한다.
- [x] 승인 전에는 작업이 시작되지 않는다는 문구를 표시한다.

우선 테스트:

- 제안서 핵심 정보가 보이는지 확인한다.
- 만료된 제안서는 승인 버튼이 비활성화되는지 확인한다.

---

## 10. Task 8: 작업 진행표 화면 추가

**Files:**

- Create: `src/pages/Workroom.tsx`
- Create: `src/pages/Workroom.css`
- Modify: `src/App.tsx`
- Modify: `src/constants/routes.ts`

작업:

- [x] 작업 진행표 화면을 추가한다.
- [x] 단일 진행도 하나의 단계로 표시한다.
- [x] 단계별 상태를 표시한다.
- [x] 산출물 외부 링크 제출 UI를 추가한다.
- [x] 의뢰자 승인/수정 요청 UI를 추가한다.

우선 테스트:

- 단계 상태가 보이는지 확인한다.
- 산출물 링크 제출 UI가 보이는지 확인한다.
- 의뢰자 승인/수정 요청 버튼이 보이는지 확인한다.

---

## 11. Task 9: 전문가 상품 등록 화면 정리

**Files:**

- Modify: `src/pages/Profile.tsx`
- Optional Create: `src/pages/ProductForm.tsx`

작업:

- [x] 상품 등록에 필요한 최소 입력을 정리한다.
- [x] 사용 AI 도구, 샘플 결과물, 상품 설명, 시작 가격, 작업 기간을 입력받는다.
- [x] Standard 패키지를 필수로 둔다.
- [x] Deluxe/Premium은 선택으로 둔다.

우선 테스트:

- Standard 패키지 없이 상품을 공개할 수 없는지 확인한다.
- 샘플 결과물 없이 상품을 공개할 수 없는지 확인한다.

---

## 12. Task 10: 마이페이지 연결

**Files:**

- Modify: `src/pages/MyPage.tsx`

작업:

- [x] 의뢰자 섹션을 추가한다.
- [x] 전문가 섹션을 추가한다.
- [x] 내 의뢰 요청, 받은 제안서, 진행 중인 작업을 연결한다.
- [x] 내가 등록한 상품, 받은 요청, 보낸 제안서를 연결한다.
- [x] 완료된 작업에만 리뷰 작성 버튼을 표시한다.

우선 테스트:

- 의뢰자/전문가 섹션이 보이는지 확인한다.
- 완료된 작업에만 리뷰 작성 버튼이 보이는지 확인한다.

---

## 13. Task 11: Supabase migration 설계 반영

**Files:**

- Modify or Create: `database.sql`

작업:

- [x] `SupabasePlan.md` 기준으로 새 테이블 구조를 반영한다.
- [x] 기존 `profiles` 구조와 충돌하지 않게 정리한다.
- [x] `expert_products`, `proposals`, `works`, `work_steps`, `deliverables`, `reviews`를 추가한다.
- [x] RLS 정책을 작성한다.
- [x] Storage bucket 정책을 문서 기준으로 반영한다.

우선 테스트:

- Supabase SQL editor에서 migration이 실행되는지 확인한다.
- 의뢰자와 전문가 외 사용자가 비공개 작업을 볼 수 없는지 확인한다.

---

## 14. Task 12: 전체 검증

현재 우선순위:

- UI/문구/모바일 세부 정리는 디자인 방향 확정 후 진행한다.
- 런칭 전에는 기능 흐름 QA, Supabase/RLS 권한 점검, 저장 데이터 일관성 확인을 우선한다.
- 디자인을 바꿔야 하는 수정은 치명적인 사용 불가 문제가 아니라면 보류한다.

검증 시나리오:

```text
전문가가 상품을 등록한다.
의뢰자가 상품을 찾는다.
의뢰자가 요구사항을 보낸다.
전문가가 제안서를 보낸다.
의뢰자가 제안서를 승인한다.
작업 진행표가 열린다.
전문가가 산출물 링크를 제출한다.
의뢰자가 단계를 승인한다.
완료 후 리뷰를 작성한다.
```

필수 명령:

```text
npm.cmd run test
npm.cmd run build
```

현재 검증 상태:

- [x] 최신 `database.sql`을 Supabase SQL Editor에서 실행 성공 확인
- [x] `database.sql` trailing comma 회귀 테스트 추가
- [x] `npm.cmd test` 통과
- [x] `npm.cmd run lint` 통과
- [x] `npm.cmd run build` 통과

브라우저 확인:

```text
홈
상품 목록
상품 상세
요구사항 작성
거래 제안서
작업 진행표
마이페이지
```

---

## 15. 단계 구분

여기까지가 구현 계획 확정이다.

다음 단계인 `TDD 기반 구현 시작`은 기획 단계가 아니라 실제 개발 단계다. 즉, 이 문서를 기준으로 테스트를 먼저 만들고 코드를 고치는 단계로 넘어간다.
---

## 16. Task 13: MVP 결제/수수료 상태 연결

**Decision:** 추천 방식으로 확정한다. 제안서 승인과 결제를 같은 단계로 묶고, 결제 완료 후에만 작업방이 생성된다. 실제 PG 연동은 후속 단계로 분리한다.

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/lib/storage.ts`
- Modify: `src/pages/Proposal.tsx`
- Modify: `database.sql`
- Modify: `FinalSpec.md`, `PolicyPlan.md`, `SupabasePlan.md`

작업:

- [x] 제안서 화면의 승인 버튼을 MVP 테스트용 `테스트 결제 완료 처리` 흐름으로 변경한다.
- [x] 결제 완료 상태를 `proposals.payment_status = paid`로 저장한다.
- [x] 작업방 생성 시 총액, 플랫폼 수수료, 전문가 정산 예정액을 저장한다.
- [x] 플랫폼 수수료율은 MVP 기준 `12%`로 고정한다.
- [x] 작업 완료 승인 시 `works.settlement_status = pending`으로 변경한다.
- [x] 기존 테이블에도 반영할 수 있도록 `alter table ... add column if not exists`를 포함한다.
- [x] 실제 PG 연동 전까지 모의 결제임을 제안서 화면과 문구 문서에 명확히 표시한다.

검증:

```text
npm.cmd test -- src/pages/Proposal.test.tsx src/lib/storage.test.ts src/databaseSchema.test.ts
npm.cmd test
npm.cmd run build
```
