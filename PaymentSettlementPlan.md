# AIMaker 결제/정산 기획서

> 작성일: 2026-06-10
> 변경 사항: 첫 런칭 범위에 결제와 정산 기능을 포함한다.

---

## 1. 변경 배경

기존 기획은 첫 런칭에서 결제와 정산을 제외하고, 요구사항 작성, 거래 제안서, 작업 진행표 흐름을 먼저 검증하는 방향이었다.

하지만 AIMaker는 실제 거래 플랫폼이므로 첫 런칭부터 결제와 정산 기능이 있어야 한다.

결제 없이 작업 진행만 제공하면 다음 문제가 생긴다.

- 요청자와 메이커가 플랫폼 밖에서 결제할 가능성이 높아진다.
- 플랫폼 수익화가 늦어진다.
- 거래 신뢰와 분쟁 기준이 약해진다.
- 작업 진행표와 제안서의 실질적인 거래 효력이 낮아진다.

따라서 첫 런칭의 핵심 흐름을 다음처럼 수정한다.

```text
상품 탐색
→ 요구사항 작성
→ 거래 제안서
→ 결제
→ 작업 진행표
→ 산출물 승인
→ 정산
→ 리뷰
```

---

## 2. 첫 런칭 결제 원칙

첫 런칭에는 다음 기능을 포함한다.

- 요청자 결제
- 플랫폼 수수료 계산
- 메이커 정산 예정 금액 표시
- 작업 완료 후 정산 가능 상태 전환
- 결제/정산 상태 기록
- 결제 전 작업 시작 방지

첫 런칭에서 제외하거나 단순화할 기능:

- 완전 자동 분쟁 조정
- 단계별 자동 분할 정산
- 세금계산서 자동 발행
- 다중 통화 결제
- 복잡한 쿠폰/프로모션
- 메이커별 차등 수수료

---

## 3. 결제 흐름

요청자는 거래 제안서를 승인한 뒤 결제를 진행한다.

```text
거래 제안서 확인
→ 제안서 승인
→ 결제 페이지
→ 결제 완료
→ 작업 진행표 생성
→ 작업 시작
```

정책:

- 결제 완료 전에는 작업 진행표가 활성화되지 않는다.
- 메이커는 결제 완료 전 작업을 시작할 수 없다.
- 결제 금액에는 작업 금액과 요청자 서비스 수수료가 포함된다.
- 결제 완료 후 플랫폼은 메이커 정산 예정 금액을 계산한다.

---

## 4. 수수료 구조

초기 추천값:

```text
메이커 수수료: 10%
요청자 서비스 수수료: 3%
```

예시:

```text
작업 금액: 100,000원
요청자 서비스 수수료: 3,000원
요청자 총 결제 금액: 103,000원
메이커 수수료: 10,000원
메이커 정산 예정 금액: 90,000원
플랫폼 총 수익: 13,000원 - PG 수수료
```

주의:

- 첫 런칭에서 너무 높은 수수료는 메이커 확보에 불리하다.
- 낮은 수수료를 강조하되, 플랫폼의 가치가 단순히 싸다는 것에만 머물지 않게 한다.

---

## 5. 정산 흐름

정산은 작업이 완료된 뒤 가능하다.

```text
결제 완료
→ 작업 진행
→ 산출물 제출
→ 요청자 최종 승인
→ 작업 완료
→ 정산 가능
→ 정산 처리
```

첫 런칭 정산 상태:

```text
pending       정산 대기
available     정산 가능
requested     정산 요청됨
paid          정산 완료
held          보류
cancelled     정산 취소
```

정책:

- 요청자가 최종 승인하면 정산 가능 상태가 된다.
- 분쟁 또는 신고가 있으면 정산은 `held` 상태로 보류한다.
- 첫 런칭에서는 운영자가 수동으로 정산 완료 처리할 수 있다.

---

## 6. 결제 상태

결제 상태:

```text
pending
paid
failed
cancelled
refunded
partially_refunded
```

결제 완료 조건:

- PG 결제 승인 성공
- 결제 기록 저장
- 제안서 결제 완료 상태 전환
- 작업 진행표 생성

---

## 7. 환불/취소 기본 정책

첫 런칭에서는 자동 환불보다 상태 관리와 운영자 검토를 우선한다.

환불 가능 예시:

- 결제 후 메이커가 작업을 시작하지 않은 경우
- 메이커가 작업을 수행할 수 없다고 취소한 경우
- 명백한 미제공 또는 허위 상품인 경우

환불 보류 예시:

- 작업이 이미 진행 중인 경우
- 산출물이 제출된 후 요청자와 메이커 의견이 다른 경우
- 외부 연락/외부 결제 유도 정황이 있는 경우

---

## 8. 데이터 구조 추가

첫 런칭에 다음 테이블을 추가한다.

```text
payments
settlements
platform_fees
refund_requests
```

### payments

```text
id uuid primary key
proposal_id uuid
work_id uuid
client_id uuid
expert_id uuid
amount integer
client_fee_amount integer
total_paid_amount integer
currency text default 'KRW'
provider text
provider_payment_id text
status text
paid_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### settlements

```text
id uuid primary key
payment_id uuid
work_id uuid
expert_id uuid
gross_amount integer
platform_fee_amount integer
net_amount integer
status text
available_at timestamptz
requested_at timestamptz
paid_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### platform_fees

```text
id uuid primary key
payment_id uuid
client_fee_amount integer
expert_fee_amount integer
pg_fee_amount integer
total_platform_revenue integer
created_at timestamptz
```

### refund_requests

```text
id uuid primary key
payment_id uuid
work_id uuid
requester_id uuid
reason text
status text
admin_note text
created_at timestamptz
updated_at timestamptz
```

---

## 9. 페이지 추가/수정

첫 런칭에 다음 화면이 추가된다.

### 결제 페이지

경로 예시:

```text
/checkout/:proposalId
```

기능:

- 제안서 요약
- 작업 금액
- 요청자 서비스 수수료
- 총 결제 금액
- 결제 버튼
- 결제 완료/실패 상태

### 정산 관리 영역

마이페이지 내 메이커 섹션에 추가한다.

기능:

- 정산 예정 금액
- 정산 가능 금액
- 정산 보류 금액
- 정산 완료 내역
- 정산 요청 버튼

### 결제 내역 영역

마이페이지 내 요청자 섹션에 추가한다.

기능:

- 결제 완료 작업
- 결제 실패/취소 내역
- 환불 요청 상태

---

## 10. 개발 우선순위 변경

수정된 구현 순서:

1. 테스트 환경 설정
2. 타입과 mock data 정리
3. 상품 탐색/상세/요구사항 작성
4. 거래 제안서
5. 결제 페이지
6. 결제 상태 저장
7. 결제 완료 후 작업 진행표 생성
8. 작업 진행표/산출물 승인
9. 정산 상태 생성
10. 마이페이지 결제/정산 영역
11. 환불/정산 보류 기본 상태
12. Supabase/RLS/Storage 연결

---

## 11. 결론

첫 런칭 목표는 다음으로 수정한다.

```text
상품을 보고,
요구사항을 보내고,
제안서를 승인하고,
결제하고,
작업 진행표에서 산출물을 확인하고,
완료 후 메이커에게 정산되는 플랫폼
```
---

## 최신 결정: 취소와 환불 상태

첫 런칭에서는 취소가 발생해도 자동 환불 완료로 처리하지 않는다. 작업방과 관리자 확인 흐름에서는 다음 상태를 우선 사용한다.

- 작업 시작 전 취소: `수수료 제외 환불 예정`
- 작업 시작 후 양측 합의 취소: `수수료 제외 환불 예정`
- 정산 상태: 작업이 취소되면 작업자 정산은 보류 또는 취소 검토 상태로 둔다.
- 환불 완료, 부분 환불, 분쟁 조정은 운영자 검토 또는 추후 정책 확정 후 처리한다.

범위 변경 관련 결제 정책:

- 범위 증가: 작업방에서 추가 범위나 결과물 내용 변경을 지원하지 않는다.
- 범위 감소: 지원하지 않는다.
- 수정 요청: 제안서에 명시된 수정 횟수만큼만 허용한다.
