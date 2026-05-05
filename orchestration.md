# AIConnect — 프로젝트 오케스트레이션 문서

> **최종 업데이트**: 2026-05-05  
> **목적**: 어떤 AI 어시스턴트든 이 문서를 읽으면 프로젝트의 구조, 현재 상태, 코딩 규칙을 즉시 파악하고 작업을 이어받을 수 있도록 작성됨.

> **⚠️ 자동 업데이트 규칙 (필수)**  
> 프로젝트 코드를 수정할 때마다 이 문서(`orchestration.md`)를 반드시 함께 업데이트할 것.  
> - 파일 추가/삭제 → 3번(디렉토리 구조) 반영  
> - 라우트 변경 → 4번(라우팅 구조) 반영  
> - DB 스키마 변경 → 5번(데이터베이스 스키마) 반영  
> - 타입 변경 → 9번(데이터 타입) 반영  
> - 기능 완료/추가 → 11번(진행 상태 & 작업 계획) 체크리스트 업데이트  
> - 최종 업데이트 날짜도 갱신할 것

---

## 1. 프로젝트 개요

**AIConnect**는 AI 기술 분야의 전문가(영상, 이미지, 음원 등)와 의뢰자를 연결하는 **프리랜서 매칭 플랫폼**이다.  
크몽(Kmong)이나 Fiverr와 유사한 비즈니스 모델이지만, "AI 크리에이티브" 분야에 특화되어 있다.

### 핵심 사용자 흐름
```
[의뢰자] 가입 → 온보딩(역할선택) → 전문가 검색 → 서비스 요청서 작성 → 전문가 매칭
[전문가] 가입 → 온보딩(역할선택) → 프로필 상세 작성 → 요청 게시판 탐색 → 의뢰 수락
```

### 10대 핵심 서비스 카테고리
1. AI 영화 제작  
2. AI 애니메이션 제작  
3. AI 광고 제작 (숏폼)  
4. AI 이미지 제작  
5. AI 캐릭터 제작  
6. AI 음원 만들기  
7. AI 성우 입히기  
8. AI 그래픽 디자인  
9. AI 클립 구매 (결과물 판매)  
10. AI 프롬프트 구매 (레시피+결과물 패키지 판매)

> 서비스 요청서 카테고리는 1~8번만 사용 (9~10번은 결과물 판매이므로 요청 불가)

---

## 2. 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| **프레임워크** | React + TypeScript | React 19, TS 6 |
| **빌드 도구** | Vite | 8.x |
| **라우팅** | react-router-dom | 7.x |
| **백엔드/DB** | Supabase (PostgreSQL + Auth + Storage) | supabase-js 2.x |
| **스타일링** | Vanilla CSS (CSS Variables 기반 디자인 시스템) | — |
| **아이콘** | Google Material Symbols (CDN) | — |
| **폰트** | Noto Sans KR, Inter (CDN) | — |
| **패키지 매니저** | npm | — |

### 환경변수 (.env)
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```
> Supabase 환경변수가 없어도 앱이 크래시하지 않음 — `supabase.ts`에서 null 체크 후 localStorage 폴백

---

## 3. 디렉토리 구조

```
AIconnect/
├── .env                    # Supabase 환경변수 (git 미추적)
├── blueprint.md            # 초기 기획서 & 로드맵
├── orchestration.md        # ★ 이 문서 (AI 인수인계용)
├── database.sql            # Supabase에서 실행할 DDL (테이블 + RLS)
├── index.html              # Vite 진입점 (Google Fonts, Material Icons CDN)
├── package.json
├── vite.config.ts
├── tsconfig*.json
│
├── public/                 # 정적 파일
│
└── src/
    ├── main.tsx            # React 진입점 (AuthProvider 래핑)
    ├── App.tsx             # 라우팅 정의 (Navbar + Routes + Footer)
    ├── index.css           # 글로벌 CSS 디자인 시스템
    │
    ├── components/         # 재사용 컴포넌트
    │   ├── Navbar.tsx          # 상단 네비게이션 (로고, 메뉴, 로그인/마이페이지)
    │   ├── Footer.tsx          # 하단 푸터
    │   ├── ExpertCard.tsx      # 전문가 카드 (이미지, 이름, 평점, 가격)
    │   ├── ExpertCard.css
    │   ├── PackageCard.tsx     # 요금 패키지 카드 (Standard/Deluxe/Premium 탭)
    │   ├── CategorySelector.tsx # 카테고리 선택 체크박스 컴포넌트
    │   ├── CategorySelector.css
    │   ├── ChatModal.tsx       # 1:1 채팅 모달 (현재 목업 수준)
    │   └── ErrorBoundary.tsx   # 런타임 에러 처리 래퍼
    │
    ├── pages/              # 라우트별 페이지
    │   ├── Home.tsx            # 메인 랜딩 (히어로, 카테고리, 추천전문가, 최신요청)
    │   ├── Category.tsx        # 전문가 찾기 (카테고리 필터 + 전문가 그리드)
    │   ├── Category.css
    │   ├── ExpertDetail.tsx    # 전문가 상세 프로필 (공개용)
    │   ├── ExpertDetail.css
    │   ├── ServiceRequest.tsx  # 서비스 요청서 작성 폼
    │   ├── ServiceRequest.css
    │   ├── RequestBoard.tsx    # 요청 게시판 (목록 + 필터 + 상세 모달)
    │   ├── RequestBoard.css
    │   ├── Community.tsx       # 커뮤니티 (현재 목업)
    │   ├── Community.css
    │   ├── Login.tsx           # 로그인/회원가입 (이메일 + OAuth)
    │   ├── Login.css
    │   ├── Onboarding.tsx      # ★ 신규가입 온보딩 (역할선택 + 닉네임)
    │   ├── Onboarding.css
    │   ├── MyPage.tsx          # 마이페이지 (프로필 조회 + 수정 진입점)
    │   ├── Profile.tsx         # 프로필 수정 (전문가/의뢰자 폼 분리)
    │   ├── Profile.css
    │   └── NotFound.tsx        # 404 페이지
    │
    ├── contexts/
    │   └── AuthContext.tsx     # Supabase 인증 상태 전역 관리
    │
    ├── constants/
    │   └── routes.ts           # 라우트 경로 상수
    │
    ├── data/
    │   └── mockData.ts         # 목업 전문가 데이터 + 카테고리 목록
    │
    ├── lib/
    │   ├── supabase.ts         # Supabase 클라이언트 초기화
    │   └── storage.ts          # DB CRUD 유틸리티 (프로필, 서비스요청)
    │
    └── types/
        └── index.ts            # 공유 타입 정의 (Expert, ExpertProfile, ServiceRequestData 등)
```

---

## 4. 라우팅 구조

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | Home | 메인 랜딩 |
| `/category` | Category | 전문가 찾기 (카테고리 필터) |
| `/expert/:id` | ExpertDetail | 전문가 공개 프로필 (DB에서 id로 조회) |
| `/request` | ServiceRequest | 서비스 요청서 작성 |
| `/requests` | RequestBoard | 요청 게시판 |
| `/community` | Community | 커뮤니티 (목업) |
| `/login` | Login | 로그인/회원가입 |
| `/onboarding` | Onboarding | ★ 신규가입 강제 온보딩 |
| `/mypage` | MyPage | 프로필 정보 조회 + 수정 진입 |
| `/profile` | Profile | 프로필 수정 (전문가/의뢰자 폼 분리) |
| `*` | NotFound | 404 |

---

## 5. 데이터베이스 스키마 (Supabase)

### 5.1. `profiles` 테이블 (공통 유저 정보)
```sql
id          uuid PK → auth.users(id)
name        text         -- 닉네임/활동명
email       text
is_expert   boolean      -- true: 전문가 / false: 의뢰자
created_at  timestamptz
```
- RLS: 누구나 SELECT 가능, INSERT/UPDATE는 본인(auth.uid() = id)만

### 5.2. `expert_profiles` 테이블 (전문가 상세 프로필)
```sql
user_id     uuid PK → auth.users(id) ON DELETE CASCADE
image_url   text
profession  text         -- 전문 분야
name        text
one_liner   text         -- 한 줄 소개
greeting    text         -- 상세 인사말
activities  jsonb        -- 주요 활동 목록
awards      jsonb        -- 수상 이력
ai_tools    jsonb        -- AI 도구 리스트
edit_tools  jsonb        -- 편집 도구 리스트
packages    jsonb        -- {standard, deluxe, premium} 요금 패키지
updated_at  timestamptz
```
- RLS: SELECT/INSERT/UPDATE 모두 본인(auth.uid() = user_id)만
- ⚠️ **향후 공개 프로필 전환 시 SELECT USING(true)로 변경 필요**

### 5.3. `service_requests` 테이블 (서비스 요청서)
```sql
id              bigint PK (auto-increment)
title           text NOT NULL
description     text NOT NULL
budget          numeric
deadline        date
categories      text[]
orderer_email   text
status          text DEFAULT 'pending'  -- pending | in_progress | completed
created_at      timestamptz
user_id         uuid → auth.users(id)
```
- RLS: 누구나 SELECT 가능, INSERT 누구나 가능, UPDATE는 본인만

### 5.4. Supabase Storage
- **버킷**: `profiles` — 프로필 이미지 저장용
- 업로드 경로 패턴: `{user_id}_{timestamp}.{ext}`

---

## 6. 인증 & 온보딩 플로우

### 인증 방식
- **이메일/비밀번호**: Supabase Auth 기본 인증
- **OAuth**: Google, Kakao (소셜 로그인)

### 온보딩 플로우 (핵심 로직)
```
1. 가입/로그인 완료
2. AuthContext.tsx: onAuthStateChange 감지
3. profiles 테이블에서 해당 유저 조회
4. 프로필 없음 or 이름 비어있음 → /onboarding 강제 리다이렉트
5. 온보딩 페이지: 역할(전문가/의뢰자) + 닉네임 + 이미지(선택) 입력
6. 저장 후 분기:
   - 전문가 → /profile (상세 프로필 편집)
   - 의뢰자 → / (홈으로)
```

### 무한 루프 방지
- `/onboarding`, `/login` 페이지에 있으면 리다이렉트 스킵

---

## 7. 권한별 UI 분기

### 마이페이지 (`/mypage`)
- 프로필 정보 **읽기 전용** 표시 (닉네임, 이메일, 회원유형 배지)
- "프로필 수정하기" 버튼 → `/profile`
- 전문가인 경우 "내 공개 프로필 보기" 버튼 → `/expert/{user_id}`
- 로그아웃 버튼

### 프로필 수정 (`/profile`)
- **상단 공통**: 회원 유형 선택 UI (의뢰자 🔍 / 전문가 🏆 버튼)
  - 선택 즉시 `profiles.is_expert` DB 업데이트
  - 전문가로 전환 시 `expert_profiles` 빈 레코드 자동 생성
- **의뢰자 모드**: 이름 입력만 (간소화 폼)
- **전문가 모드**: 전체 상세 폼
  - 프로필 이미지 (Supabase Storage 업로드)
  - 이름, 전문분야, 한줄소개, 인사말
  - 주요 활동, 수상 이력 (동적 리스트)
  - AI 도구, 편집 도구 (태그 입력)
  - 요금 패키지 3단계 (Standard/Deluxe/Premium 탭)

### Navbar 상태
- **비로그인**: "로그인" 버튼만 표시
- **로그인**: 이메일 표시 + "마이페이지" + "로그아웃"

---

## 8. 디자인 시스템

### CSS Variables (index.css :root)
```css
--primary: #2563eb          /* 메인 블루 */
--primary-hover: #1d4ed8
--background: #f8fafc       /* 라이트 그레이 배경 */
--surface: #ffffff           /* 카드/패널 배경 */
--text-primary: #0f172a
--text-secondary: #475569
--text-muted: #94a3b8
--border-color: #e2e8f0
--star: #fbbf24              /* 별점 노란색 */
--container-max: 1280px      /* PC 최적화 컨테이너 */
--font-family: 'Noto Sans KR', 'Inter', sans-serif
```

### 디자인 원칙
- **PC 우선** 레이아웃 (min-width: 1200px, 그 이하에서 스크롤바)
- 화이트/라이트그레이 배경에 블루 포인트 (Clean UI)
- 카드: `border-radius: 24px`, `box-shadow: shadow-lg`
- 카테고리 그리드: 5열 / 전문가·요청 그리드: 3열
- 반응형: 1200px 이하 4열, 1024px 이하 1열

---

## 9. 주요 데이터 타입 (types/index.ts)

```typescript
// 전문가 카드 (mockData용)
Expert { id, name, profession, rating, reviews, price, imageUrl }

// 전문가 상세 프로필 (Supabase expert_profiles)
ExpertProfile { id?, imageUrl, profession, name, oneLiner, greeting,
                activities[], awards[], aiTools[], editTools[],
                packages: { standard, deluxe, premium: PackageInfo },
                updatedAt? }

// 요금 패키지
PackageInfo { price, description, workDays, revisions, features[] }

// 서비스 요청서
ServiceRequestData { id, title, description, budget, deadline,
                     categories[], createdAt, ordererEmail?, status }

// 인증 컨텍스트
AuthContextType { session, user, loading, signOut() }
```

---

## 10. 데이터 흐름 패턴

### storage.ts — DB 유틸리티
- `getStoredRequests()` → service_requests SELECT (폴백: localStorage)
- `saveRequest()` → service_requests INSERT
- `getStoredProfile(userId)` → expert_profiles SELECT (snake_case → camelCase 매핑)
- `saveProfile(userId, profile)` → expert_profiles UPSERT (camelCase → snake_case 매핑)
- `createDefaultProfile()` → 빈 ExpertProfile 객체 생성

### 필드명 매핑 규칙
| 앱 (camelCase) | DB (snake_case) |
|---|---|
| `imageUrl` | `image_url` |
| `oneLiner` | `one_liner` |
| `aiTools` | `ai_tools` |
| `editTools` | `edit_tools` |
| `workDays` | `work_days` |

---

## 11. 개발 진행 상태 & 향후 작업 계획

### ✅ 완료된 작업

| Step | 내용 | 상태 |
|------|------|------|
| Step 1 | UI 수정 6건 (금액 콤마, 이메일란, 상세보기 모달, 수락 버튼, 정렬) | ✅ |
| Step 2 | Supabase DB 연동 (service_requests, profiles, expert_profiles) | ✅ |
| — | 온보딩 페이지 (역할선택 + 닉네임 + 이미지) | ✅ |
| — | AuthContext 프로필 체크 → 온보딩 강제 리다이렉트 | ✅ |
| — | 프로필 수정 — 전문가/의뢰자 폼 분리 + 회원유형 전환 | ✅ |
| — | 마이페이지 — 프로필 조회 + 수정 진입점 | ✅ |
| — | ExpertDetail 동적 라우팅 (DB에서 프로필 로드) | ✅ |
| — | 프로필 이미지 Supabase Storage 업로드 | ✅ |
| — | Navbar 정리 (마이페이지 링크, 전문가 가입 버튼 제거) | ✅ |
| Step 3 | 전문가 탐색 & 검색 시스템 (mockData 제거 및 DB 연동) | ✅ |
| — | Home/Category 전문가 DB 기반 표시 및 카테고리/가격 필터 연동 | ✅ |
| — | 전문가 프로필 전문분야 다중 선택 및 기타 직접 입력 UI 적용 | ✅ |

---

### 🔧 Step 3: 전문가 탐색 & 검색 시스템 (최우선)

> **목표**: mockData를 제거하고, 실제 DB에 등록된 전문가가 Home/Category에 표시되도록 한다.

#### 3-1. expert_profiles RLS 공개 전환
- **파일**: `database.sql`
- **작업**: `expert_profiles` SELECT 정책을 `USING(auth.uid() = user_id)` → `USING(true)` 변경
- **이유**: 다른 유저의 공개 프로필을 볼 수 있어야 전문가 탐색이 가능
- **⚠️ Supabase SQL Editor에서 직접 실행 필요**

#### 3-2. Home 페이지 — DB 기반 전문가 표시
- **파일**: `Home.tsx`, `storage.ts`
- **현재**: `EXPERTS` mockData에서 상위 3명 하드코딩
- **변경**: `storage.ts`에 `getExpertList()` 함수 추가 → `expert_profiles` + `profiles` 조인 쿼리 → Home에서 호출
- **ExpertCard 타입 수정**: `Expert` 타입에 `id`를 `string | number`로 변경하거나, DB 전문가용 별도 타입 추가 (UUID 지원)

#### 3-3. Category 페이지 — DB 기반 전문가 검색
- **파일**: `Category.tsx`
- **현재**: `EXPERTS` mockData 6명 전체 표시, 카테고리 필터 UI만 존재 (실제 필터링 안 됨)
- **변경**:
  - `expert_profiles`에서 profession 기반 필터링 쿼리
  - 가격 범위 슬라이더 실제 동작 연결 (packages.standard.price 기준)
  - 정렬 기능: DB 쿼리 ORDER BY 반영
  - 키워드 검색: name, profession, one_liner 텍스트 검색

#### 3-4. ExpertCard 컴포넌트 DB 대응
- **파일**: `ExpertCard.tsx`, `types/index.ts`
- **현재**: `Expert` 타입 (숫자 id, rating, reviews 등 mockData 전용)
- **변경**: DB에서 가져온 전문가 데이터도 렌더링할 수 있도록 타입 통합 또는 별도 카드 컴포넌트

#### 3-5. mockData 제거
- **파일**: `data/mockData.ts`
- **변경**: `EXPERTS` 배열 삭제 (CATEGORIES 배열은 유지)
- **영향 범위**: Home.tsx, Category.tsx, ExpertDetail.tsx에서 EXPERTS 참조 모두 제거

---

### 📋 Step 4: 리뷰 & 평점 시스템

> **목표**: 의뢰 완료 후 의뢰자가 전문가에게 리뷰를 남기고, 평점이 프로필에 표시되도록 한다.

#### 4-1. reviews 테이블 생성
```sql
CREATE TABLE public.reviews (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    expert_id uuid REFERENCES auth.users(id),   -- 리뷰 대상 전문가
    reviewer_id uuid REFERENCES auth.users(id),  -- 리뷰 작성 의뢰자
    rating integer CHECK (rating BETWEEN 1 AND 5),
    content text,
    created_at timestamptz DEFAULT now()
);
```
- RLS: 누구나 SELECT, INSERT는 로그인 유저만, UPDATE/DELETE는 작성자만

#### 4-2. ExpertDetail에 리뷰 섹션 추가
- **파일**: `ExpertDetail.tsx`
- **작업**: 프로필 하단에 리뷰 목록 표시 + 리뷰 작성 폼 (로그인 유저만)
- 평균 평점 계산하여 프로필 헤더에 표시

#### 4-3. ExpertCard에 실제 평점 반영
- **파일**: `ExpertCard.tsx`
- **작업**: DB에서 가져온 평균 평점/리뷰 수 표시

---

### 🛒 Step 5: 직접 주문(Direct Order) 및 마이페이지 대시보드화

> **목표**: 게시판 역경매 방식 외에, 패키지를 바로 구매하는 플로우와 이를 관리할 대시보드를 구축한다.

#### 5-1. orders & notifications 테이블 신설
```sql
-- 직접 주문 내역
CREATE TABLE public.orders (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    client_id uuid REFERENCES auth.users(id),
    expert_id uuid REFERENCES auth.users(id),
    package_type text, -- standard, deluxe, premium
    price numeric,
    status text DEFAULT 'pending', -- pending, in_progress, delivered, completed, cancelled
    created_at timestamptz DEFAULT now()
);

-- 유저 알림
CREATE TABLE public.notifications (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    type text,
    content text,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);
```

#### 5-2. 직접 주문 플로우
- **UI (`PackageCard.tsx`)**: 각 요금 패키지 하단에 **[이 패키지로 의뢰하기]** 버튼 추가
- **라우팅 (`/order/:expert_id`)**: 결제 및 요구사항 입력 폼 신설
- **기능**: 주문 생성 시 status='pending'으로 저장 및 전문가에게 알림 생성

#### 5-3. 마이페이지 대시보드 개편
- **UI (`MyPage.tsx`)**: 단순 프로필 조회에서 탭 구조([내 프로필], [진행 중인 프로젝트], [알림 내역], [결제 관리])로 고도화
- **Navbar**: 종 모양(🔔) 아이콘 추가 및 읽지 않은 알림 뱃지 표시

---

### 💬 Step 6: 의뢰 관리 & 작업물 전달 (채팅)

> **목표**: 수락된 의뢰에 대해 1:1 실시간 소통 및 최종 작업물을 전달/승인하는 플로우.

#### 6-1. 실시간 채팅 (Supabase Realtime)
- **테이블 추가**: `messages` (sender_id, receiver_id, content, created_at)
- **UI (`ChatModal.tsx`)**: 하드코딩 응답을 제거하고 Realtime 채널 구독으로 실제 채팅 송수신 구현

#### 6-2. 작업물 전달 및 구매 확정
- **기능**: 전문가가 최종 결과물(파일 URL 등)을 전송하면 order status → `delivered`
- 의뢰자가 확인 후 **[구매 확정]** 클릭 시 status → `completed` (이후 리뷰 작성 가능)

---

### 🌐 Step 7: 커뮤니티 게시판

> **목표**: Community 페이지를 실제 CRUD 게시판으로 구현.

#### 7-1. posts 테이블 생성
```sql
CREATE TABLE public.posts (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    author_id uuid REFERENCES auth.users(id),
    category text,          -- 노하우, 질문, 자유
    title text NOT NULL,
    content text NOT NULL,
    votes integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
```

#### 7-2. Community.tsx CRUD 구현
- **현재**: 3개 하드코딩 게시글 목업
- **변경**: 글 목록 조회, 글 작성, 카테고리 필터, 투표, 댓글

---

### 📱 Step 8: 모바일 반응형 & 부가 기능

> **목표**: 반응형 지원 및 외부 서비스 연동.

#### 8-1. 반응형 CSS 강화
- **파일**: `index.css`, 각 페이지 CSS
- **작업**: 768px 이하 미디어 쿼리(1열 레이아웃, 모바일 햄버거 메뉴, 폰트/패딩 축소)

#### 8-2. 카카오 OAuth 연동 및 갤러리
- **OAuth**: Supabase Auth → Kakao Provider 활성화 및 `Login.tsx` 연결
- **갤러리**: 전문가가 포트폴리오 이미지/영상을 업로드하고 `ExpertDetail`에 표시

---

### 🛡️ Step 9: 관리자 페이지, 법적 고지 및 배포

> **목표**: 안전한 플랫폼 운영을 위한 관리자 기능, 필수 약관 동의, 그리고 최종 프로덕션 배포.

#### 9-1. 관리자(Admin) 대시보드
- **DB 권한**: `profiles`에 `is_admin` boolean 추가
- **라우팅 (`/admin`)**: admin 권한 체크 후 진입
- **기능**: 악성 유저 차단, 거래 강제 취소/환불, 불량 커뮤니티 글 숨김 처리

#### 9-2. 약관 동의 및 정적 페이지
- **라우팅 (`/terms`, `/privacy`)**: 이용약관, 개인정보처리방침 페이지 생성
- **온보딩 (`Onboarding.tsx`)**: 닉네임 입력 폼 하단에 필수 체크박스 2개 추가. 모두 체크해야 가입 완료.

#### 9-3. SEO 및 프로덕션 배포
- **SEO**: `index.html` 태그 및 React Helmet 동적 타이틀 설정
- **호스팅**: Vercel/Netlify 배포 및 도메인 연결
- **보안**: RLS 재검토 및 결제/에스크로 연동 준비

---

### 🎯 작업 우선순위 요약

```
[완료] Step 3: expert_profiles RLS 공개 → Home/Category DB 전환 → mockData 제거
  ↓
[즉시] Step 4: 리뷰/평점 시스템
  ↓
[이후] Step 5: 직접 주문(Direct Order) 및 마이페이지 대시보드화
  ↓
[이후] Step 6: 의뢰 관리 & 실시간 채팅 & 작업물 전달/승인
  ↓
[이후] Step 7: 커뮤니티 CRUD
  ↓
[이후] Step 8: 모바일 반응형 + OAuth + 포트폴리오
  ↓
[마지막] Step 9: 관리자 대시보드 + 약관 동의 + 배포
```

---

## 12. 알려진 이슈 & 주의사항

### ⚠️ 중요
1. **ChatModal**: 현재 목업 수준. 실제 채팅 기능 없음.
2. **Community**: 현재 목업 수준. 실제 게시판 기능 없음.

### 코딩 규칙
- **언어**: 모든 주석, 설명은 **한국어**
- 변수명은 직관적으로, 왜 이렇게 짰는지 의도를 주석으로 설명
- 하나의 파일이 너무 길어지지 않게 기능별 분리
- 에러 처리(Error Handling) 항상 고려
- 답변 형식: [결론/해결책] → [코드] → [상세 설명] 순서

### Git 브랜치 전략
- `main`: 안정 버전 (dev에서 머지)
- `dev`: 개발 브랜치 (기본 작업 브랜치)
- 원격: `origin` → `https://github.com/hansokchun/AImaker`
- 작업 후 dev 커밋 → dev 푸시 → 필요 시 main 머지 & 푸시

---

## 13. 빠른 시작 가이드

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview
```

### Supabase 셋업
1. Supabase 프로젝트 생성
2. `database.sql` 내용을 SQL Editor에서 실행
3. Storage에서 `profiles` 버킷 생성 (Public 설정)
4. `.env`에 URL과 ANON_KEY 입력
5. Auth → Providers에서 Google/Kakao OAuth 설정 (선택)
