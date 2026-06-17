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
의뢰자가 요구사항을 보내거나 전문가에게 문의한다.
전문가 문의형이면 상담으로 조건을 협의한다.
전문가가 제안서를 보낸다.
의뢰자가 제안서를 승인하고 결제한다.
작업방이 열린다.
전문가가 산출물 링크를 제출한다.
의뢰자가 단계를 승인한다.
완료 후 리뷰를 작성한다.
```

필수 명령:

```text
npm.cmd run test
npm.cmd run build
```

---

## 17. Task 14: 전문가 문의형 거래 흐름 추가

**Decision:** 상품에서 거래를 시작하는 방식은 `패키지 구매형`과 `전문가 문의형` 두 가지로 확정한다. 두 흐름 모두 최종 거래 성사는 제안서 승인 및 결제로 통일하고, 결제 완료 후에만 작업방을 생성한다.

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/lib/storage.ts`
- Modify: `src/pages/ExpertDetail.tsx`
- Add: 상담/메시지 화면 컴포넌트
- Modify: `database.sql`
- Modify: `FinalSpec.md`, `PagePlan.md`, `PolicyPlan.md`, `SupabasePlan.md`, `CopyPlan.md`, `TestPlan.md`

작업:

- [ ] 상품 상세의 `전문가에게 문의하기` CTA를 결제 전 상담 흐름으로 연결한다.
- [ ] 상담방은 상품, 의뢰자, 전문가를 기준으로 생성한다.
- [ ] 상담 메시지에는 외부 연락처/외부 결제 유도 문구 차단을 적용한다.
- [ ] 전문가는 상담 내용을 바탕으로 제안서를 보낼 수 있다.
- [ ] 상담에서 생성된 제안서도 `승인 및 결제하기` 후에만 작업방을 생성한다.
- [ ] 마이페이지/작업 관리에서 패키지 의뢰와 상담 기반 제안서를 같은 거래 단계 모델로 표시한다.

검증:

```text
npm.cmd test -- src/pages/ExpertDetail.test.tsx src/pages/Proposal.test.tsx src/lib/storage.test.ts
npm.cmd test
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

- [x] 제안서 화면의 승인 버튼을 MVP 테스트용 `승인 및 결제하기` 흐름으로 변경한다.
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
---

## 2026-06-10 수정: 결제/정산 구현을 첫 런칭에 포함

첫 런칭 범위에 결제와 정산 기능을 포함한다. 따라서 구현 순서를 다음처럼 수정한다.

수정된 작업 순서:

```text
1. 테스트 환경 설정
2. 타입과 mock data 정리
3. 홈/상품 목록/상품 상세 개편
4. 요구사항 작성 화면 개편
5. 거래 제안서 화면 추가
6. 결제 페이지 추가
7. 결제 상태 저장 및 작업 진행표 생성 조건 연결
8. 작업 진행표와 산출물 승인 구현
9. 정산 상태 생성 및 마이페이지 정산 영역 추가
10. 결제 내역/환불 요청 기본 UI 추가
11. Supabase 결제/정산 테이블과 RLS 반영
12. 전체 거래 시나리오 검증
```

추가 Task: 결제 페이지

Files:

- Create: `src/pages/Checkout.tsx`
- Create: `src/pages/Checkout.css`
- Modify: `src/App.tsx`
- Modify: `src/constants/routes.ts`
- Modify: `src/types/index.ts`
- Modify: `src/data/mockData.ts`

작업:

- 제안서 요약을 표시한다.
- 작업 금액, 요청자 서비스 수수료, 총 결제 금액을 표시한다.
- 결제 대기/완료/실패 상태를 표시한다.
- 결제 완료 후 작업 진행표로 이동한다.

우선 테스트:

- 총 결제 금액이 작업 금액 + 요청자 서비스 수수료로 계산되는지 확인한다.
- 결제 완료 전에는 작업 진행표가 열리지 않는지 확인한다.

추가 Task: 정산 영역

Files:

- Modify: `src/pages/MyPage.tsx`
- Modify: `src/types/index.ts`
- Modify: `src/data/mockData.ts`

작업:

- 메이커 정산 예정 금액을 표시한다.
- 정산 가능/정산 요청/정산 완료/정산 보류 상태를 표시한다.
- 작업 완료 후 정산 가능 상태로 전환한다.

우선 테스트:

- 완료된 작업만 정산 가능 상태가 되는지 확인한다.
- 분쟁/환불 요청 상태에서는 정산이 보류되는지 확인한다.

추가 Task: Supabase 결제/정산 테이블

Files:

- Modify: `database.sql`

작업:

- `payments` 테이블을 추가한다.
- `settlements` 테이블을 추가한다.
- `platform_fees` 테이블을 추가한다.
- `refund_requests` 테이블을 추가한다.
- 요청자/메이커/운영자 기준 RLS를 추가한다.
---

## 2026-06-17 수정: 의뢰서/샘플 구현 추가

추가 구현 항목:

1. 요구사항 작성 화면 필드 확장
   - 사용 목적
   - 타겟
   - 참고자료 링크
   - 스타일
   - 사용처
   - 파일 형식

2. 샘플 필수 검증
   - 메이커 프로필 대표 샘플 1개 이상 필수
   - 상품별 샘플 1개 이상 필수
   - 사용 AI 도구와 샘플 설명 필수

우선 테스트:

- 요구사항 작성 화면에 사용 목적, 타겟, 참고자료 링크, 스타일, 사용처, 파일 형식 필드가 보인다.
- 샘플이 없는 상품은 공개할 수 없다.

---

## 2026-06-17 수정: 관리자페이지 추가 계획

관리자페이지는 첫 런칭에서 모든 운영 자동화를 구현하기 위한 화면이 아니라, 실제 결제와 정산이 포함된 거래를 운영자가 안전하게 확인하고 처리하기 위한 최소 운영 콘솔로 추가한다.

### 추가 Task: 관리자페이지 MVP

**목표**

- 운영자가 회원, 상품, 의뢰, 제안서, 작업방, 결제/정산 상태를 한 화면에서 확인한다.
- 초기에는 자동 제재/자동 분쟁판정보다 수동 확인과 상태 변경을 우선한다.
- 의뢰자와 메이커가 유도한 거래 흐름을 벗어났을 때 운영자가 개입할 수 있게 한다.

**Files**

- Create: `src/pages/AdminDashboard.tsx`
- Create: `src/pages/AdminDashboard.css`
- Modify: `src/App.tsx`
- Modify: `src/constants/routes.ts`
- Modify: `src/types/index.ts`
- Modify: `database.sql`

**MVP 기능**

- 관리자 접근 권한 확인
  - `profiles` 또는 별도 `admin_users` 기준으로 관리자만 접근
  - 일반 사용자가 직접 URL로 접근해도 차단
- 거래 현황 목록
  - 의뢰 요청, 제안서, 작업방, 결제 상태, 정산 상태 표시
  - 상태별 필터: 대기, 진행중, 수정요청, 완료, 취소, 환불 예정
- 상품/메이커 검수
  - 샘플 누락, 부적절한 상품, 허위 정보 의심 상품 확인
  - 상품 숨김 처리
- 취소/환불 운영 처리
  - 작업 시작 전 취소: 수수료 제외 환불 예정 상태 확인
  - 작업 시작 후 합의 취소: 운영자 검토 상태로 보류
- 정산 운영 처리
  - 완료 작업의 정산 예정 금액 확인
  - 정산 대기, 정산 완료, 정산 보류 상태 변경
- 신고/분쟁 메모
  - 첫 버전에서는 복잡한 분쟁 시스템 대신 운영자 메모와 상태 표시로 처리

**첫 런칭 이후 확장**

- 관리자 통계 대시보드
- 신고/분쟁 전용 워크플로우
- 사용자 제재 이력
- 수수료/정산 리포트
- 상품 승인제 또는 추천 상품 관리

**우선순위**

관리자페이지는 실제 결제/정산 기능과 함께 런칭 안정성에 직접 영향을 준다. 따라서 PG 연동과 정산 상태 저장 다음 순서로 구현한다.

**검증**

```text
npm.cmd test -- src/pages/AdminDashboard.test.tsx src/databaseSchema.test.ts
npm.cmd test
npm.cmd run build
```
