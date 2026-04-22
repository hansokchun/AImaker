# Step 1: 요청 수정 사항 6건 반영 계획 (Implementation Plan)

앞서 공유해주신 **Step 1: 화면 수정 (최우선 6건)**의 작업을 수행하기 위한 구체적인 파일 접근 및 로직 수정 계획입니다.

## User Review Required
> [!IMPORTANT]
> 본 실행 계획에 대해 승인해 주시면 즉시 코드 수정을 진행합니다. 승인 전, 아래 **[Open Questions]** 항목을 확인해 주세요.

## Proposed Changes

### 타입 및 데이터 구조 수정 (Types & Data)
#### [MODIFY] [index.ts](file:///Users/hansokchun/Desktop/aiconnect/AImaker/src/types/index.ts)
*   **이메일 입력 추가**: `ServiceRequestData` 인터페이스에 `ordererEmail?: string;` 추가.
*   **다양한 정렬 지원을 위한 Mock 수정**: `Expert` 타입에 `reviews: number;` 속성 추가 (리뷰순 정렬을 계산하기 위함).
#### [MODIFY] [mockData.ts](file:///Users/hansokchun/Desktop/aiconnect/AImaker/src/data/mockData.ts)
*   `EXPERTS` 배열의 각 전문가 객체에 가상의 `reviews` (리뷰 개수) 데이터 추가.

### 컴포넌트 수정: 1. 금액 콤마 및 2. 이메일 (ServiceRequest)
#### [MODIFY] [ServiceRequest.tsx](file:///Users/hansokchun/Desktop/aiconnect/AImaker/src/pages/ServiceRequest.tsx)
*   **금액 콤마 표시**: 예산(Budget) `input type="number"`를 `type="text"`로 변경하고, `value`는 `Number().toLocaleString()`으로 콤마 추가 적용, `onChange`에서 콤마 제거 후 숫자만 상태에 저장하도록 수정합니다.
*   **이메일 입력칸 추가**: '주문자 이메일' 입력 필드를 추가하고 `ordererEmail` state를 생성하여 submit 시 함께 저장합니다.

### 컴포넌트 수정: 3. 상세보기 및 4. 수락 버튼 (RequestBoard)
#### [MODIFY] [RequestBoard.tsx](file:///Users/hansokchun/Desktop/aiconnect/AImaker/src/pages/RequestBoard.tsx)
*   **요청서 상세보기**: 각 아이템의 "상세보기" 버튼 클릭 시, 선택된 요청을 보여주는 팝업 모달(Modal) 컴포넌트/상태(state)를 렌더링하도록 뷰 추가.
*   **수락 요청 버튼**: 상세보기 모달 하단에 "요청 수락하기" 버튼을 추가. 클릭 시 "수락되었습니다" 알림을 띄우고 모달 닫힘(UI 액션 처리).
#### [MODIFY] [RequestBoard.css](file:///Users/hansokchun/Desktop/aiconnect/AImaker/src/pages/RequestBoard.css)
*   위에 추가되는 모달(Modal) 팝업 화면의 레이아웃과 오버레이 백그라운드 디자인 CSS 추가.

### 컴포넌트 수정: 5. 최신순 및 6. 다중 정렬 (Category)
#### [MODIFY] [Category.tsx](file:///Users/hansokchun/Desktop/aiconnect/AImaker/src/pages/Category.tsx)
*   리스트 우측 상단 `<select className="sort-select">`에 `onChange` 핸들러 및 정렬 기준 상태(`sortBy`)를 연결.
*   옵션 구현: 
    *   `최신순` (기본값 설정)
    *   `가격 높은순`, `가격 낮은순` (price 기준)
    *   `평점 높은순` (rating 기준)
    *   `리뷰순` (reviews 개수 기준)
*   `EXPERTS` 데이터를 렌더링하기 전 `sortBy` 값에 맞춰 다이나믹하게 재정렬 로직 적용.

---

## Open Questions
> [!NOTE]
> 정렬 기준에 관하여: "리뷰 및 작업물 목록을 '가장 최근에 올라온 순서'로 기본으로 보이게 합니다."라고 하셨는데, 현재 프론트엔드 환경에서는 리뷰/작업물이 상세 페이지(`ExpertDetail.tsx`)에 하드코딩 되어 있습니다. 
> 이 부분의 정렬 요구사항은 위 방법처럼 **전문가 찾기 리스트(`Category.tsx`)의 정렬 기준**에 '다중 정렬' 및 '최신순 우선'을 적용하여 커버하는 것으로 갈음하고 넘어갈까요? (진짜 상세 리뷰/포트폴리오 리스트 컴포넌트는 추후 Step 3 핵심 기능에서 작업)

## Verification Plan
1. `npm run dev` 구동하여 브라우저 환경에서 점검.
2. `ServiceRequest`에서 1,500,000 등 예산 입력 시 콤마 작동 확인 및 이메일 전송 테스트.
3. `RequestBoard` 접속 후 게시물 상세보기 모달 및 수락 버튼 UI 작동 점검.
4. `Category` 전문가 탐색 페이지 진입 시, 모든 `<select>` 정렬 필터(최신, 가격 등) 정상 동작 확인.
