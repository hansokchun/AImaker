# AIConnect — 프로젝트 오케스트레이션 문서

> **최종 업데이트**: 2026-05-04  
> **목적**: 어떤 AI 어시스턴트든 이 문서를 읽으면 프로젝트의 구조, 현재 상태, 코딩 규칙을 즉시 파악하고 작업을 이어받을 수 있도록 작성됨.

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

### 💬 Step 5: 의뢰 관리 & 채팅 시스템

> **목표**: 전문가가 요청을 수락하고, 의뢰자와 1:1 소통할 수 있는 실제 채팅 기능.

#### 5-1. 의뢰 수락/거절 플로우
- **현재**: RequestBoard에 "수락" 버튼 UI만 있음
- **변경**: 
  - service_requests에 `assigned_expert_id` 컬럼 추가
  - 전문가가 수락 시 status → `in_progress` + assigned_expert_id 저장
  - 마이페이지에 "내가 받은 의뢰" / "내가 보낸 의뢰" 섹션 추가

#### 5-2. 실시간 채팅 (Supabase Realtime)
- **테이블 추가**: `messages` (sender_id, receiver_id, content, created_at)
- **파일**: `ChatModal.tsx` 전면 교체
- **현재**: 키워드 기반 자동 응답 (하드코딩 목업)
- **변경**: Supabase Realtime subscribe로 실시간 메시지 송수신
- **⚠️ 난이도 높음**: Supabase Realtime 설정, 구독 관리, 읽음 표시 등

#### 5-3. 알림 시스템 (선택)
- 새 메시지, 의뢰 수락 알림
- Supabase Realtime 또는 Supabase Edge Functions + Push Notification

---

### 🌐 Step 6: 커뮤니티 게시판

> **목표**: Community 페이지를 실제 CRUD 게시판으로 구현.

#### 6-1. posts 테이블 생성
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

#### 6-2. Community.tsx CRUD 구현
- **현재**: 3개 하드코딩 게시글 목업
- **변경**: 글 목록 조회, 글 작성, 카테고리 필터, 투표, 댓글

---

### 📱 Step 7: 모바일 반응형 & UX 개선

> **목표**: 현재 PC 전용(min-width: 1200px)인 레이아웃을 모바일에서도 사용 가능하게.

#### 7-1. 반응형 CSS 강화
- **파일**: `index.css`, 각 페이지 CSS
- **현재**: 1200px 이하에서 스크롤바만 나옴
- **변경**: 
  - `body { min-width }` 제거
  - 768px 이하 미디어 쿼리: 1열 레이아웃, 모바일 네비게이션 (햄버거 메뉴)
  - 카드 크기 조정, 폰트 사이즈 축소

#### 7-2. 카카오 OAuth 연동
- **파일**: `Login.tsx` (이미 OAuth 인프라 존재)
- **작업**: Supabase Auth → Kakao Provider 활성화 + 리다이렉트 URL 설정

#### 7-3. 이미지 갤러리 / 포트폴리오
- **파일**: `ExpertDetail.tsx`, `Profile.tsx`
- **작업**: 전문가가 포트폴리오 이미지/영상 URL을 등록하고 ExpertDetail에서 갤러리로 표시

---

### 🚀 Step 8: 프로덕션 배포

#### 8-1. SEO 최적화
- `index.html`: title, meta description, Open Graph 태그
- 각 페이지별 `document.title` 동적 설정
- React Helmet 또는 수동 useEffect

#### 8-2. 도메인 연결 & 호스팅
- Vercel 또는 Netlify에 배포 (`npm run build` → `dist/` 폴더)
- 커스텀 도메인 연결
- Supabase 프로젝트 URL 환경변수 프로덕션용 설정

#### 8-3. 보안 점검
- Supabase RLS 정책 재검토
- 환경변수 노출 여부 확인
- CORS 설정

---

### 🎯 작업 우선순위 요약

```
[즉시] Step 3: expert_profiles RLS 공개 → Home/Category DB 전환 → mockData 제거
  ↓
[다음] Step 4: 리뷰/평점 시스템
  ↓
[이후] Step 5: 의뢰 수락 플로우 + 실시간 채팅
  ↓
[이후] Step 6: 커뮤니티 CRUD
  ↓
[이후] Step 7: 모바일 반응형 + OAuth + 포트폴리오
  ↓
[마지막] Step 8: SEO + 배포 + 보안
```

---

## 12. 알려진 이슈 & 주의사항

### ⚠️ 중요
1. **expert_profiles RLS**: 현재 본인만 SELECT 가능 → 다른 유저의 공개 프로필이 안 보임. Step 3에서 `USING(true)`로 변경 필요.
2. **mockData 의존**: Home, Category 페이지의 전문가 목록은 아직 `mockData.ts`의 하드코딩 데이터를 사용 중. DB 기반으로 전환 필요.
3. **ExpertDetail 폴백**: UUID가 아닌 숫자 id(1~6)로 접근 시 mockData에서 폴백 렌더링됨 (ExpertCard가 mockData의 숫자 id로 이동하므로).
4. **ChatModal**: 현재 목업 수준. 실제 채팅 기능 없음.
5. **Community**: 현재 목업 수준. 실제 게시판 기능 없음.

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
