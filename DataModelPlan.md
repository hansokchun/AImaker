# 일픽 데이터 구조 초안

> 작성일: 2026-05-14
> 목적: 초기 런칭에 필요한 핵심 데이터와 상태를 정의한다. 실제 DB 설계는 이후 `Architecture.md`에서 확정한다.

---

## 1. 핵심 데이터

초기 런칭에 필요한 핵심 데이터는 다음이다.

```text
회원/프로필
전문가 상품
의뢰 요청
거래 제안서
작업 진행표
산출물
리뷰
```

---

## 2. 회원/프로필

사용자의 기본 정보와 전문가 여부를 저장한다.

필요 정보:

- 사용자 ID
- 이메일
- 닉네임/활동명
- 전문가 여부
- 가입일

전문가인 경우 추가 정보:

- 사용 AI 도구
- 한 줄 소개
- 샘플 결과물
- 등록 상품 수

---

## 3. 전문가 상품

전문가가 등록하는 AI 외주 상품이다.

필요 정보:

- 상품 ID
- 전문가 ID
- 상품명
- 카테고리
  - AI 영상/숏폼
  - AI 이미지/캐릭터
  - AI 개발/자동화
- 상품 설명
- 사용 AI 도구
- 샘플 결과물
- 시작 가격
- 작업 기간
- 수정 가능 횟수
- 패키지 정보
  - Standard 필수
  - Deluxe 선택
  - Premium 선택
- 공개 상태
- 등록일/수정일

초기 상태:

```text
draft
published
hidden
```

---

## 4. 의뢰 요청

의뢰자가 `패키지로 의뢰하기`를 누른 뒤 작성하는 요구사항이다.

필요 정보:

- 요청 ID
- 의뢰자 ID
- 전문가 ID
- 상품 ID
- 선택한 패키지
- 원하는 결과물
- 작업 목적
- 참고자료/스타일
- 마감 희망일
- 단일/단계별 진행 희망
- AI 작업 체크리스트
- 요청 상태
- 작성일

초기 상태:

```text
submitted      요청 접수
proposal_sent  제안서 발송됨
cancelled      취소됨
```

---

## 5. 거래 제안서

전문가가 의뢰 요청을 확인하고 보내는 최종 작업 조건이다.

필요 정보:

- 제안서 ID
- 요청 ID
- 전문가 ID
- 의뢰자 ID
- 작업 제목
- 최종 작업 범위
- 제공 산출물
- 총 금액
- 예상 작업 기간
- 수정 가능 횟수
- 단일/단계별 진행 방식
- 상업적 이용 가능 여부
- 원본 제공 여부
- 제안서 유효기간
- 제안서 상태
- 작성일/수정일

상태:

```text
sent              발송됨
revision_requested 수정 요청됨
accepted          승인됨
cancelled         취소됨
expired           만료됨
```

정책:

- 제안서 유효기간은 3일
- 승인 전까지 전문가는 작업을 시작하지 않음
- 수정 요청은 초기 버전에서 1회 허용

---

## 6. 작업 진행표

제안서가 승인된 뒤 생성되는 작업 상태 데이터다.

필요 정보:

- 작업 ID
- 제안서 ID
- 의뢰자 ID
- 전문가 ID
- 현재 상태
- 진행 단계 목록
- 시작일
- 완료일

작업 상태:

```text
in_progress       진행 중
submitted         결과물 제출됨
revision_requested 수정 요청됨
completed         완료됨
cancelled         취소됨
```

단계 정보:

- 단계명
- 단계 설명
- 단계 상태
- 제출 산출물
- 수정 요청 내용
- 승인일

단계 상태:

```text
waiting
in_progress
submitted
revision_requested
approved
```

---

## 7. 산출물

작업 단계에서 전문가가 제출하는 결과물 정보다.

초기에는 대용량 파일을 서버에 직접 저장하지 않는다.

필요 정보:

- 산출물 ID
- 작업 ID
- 단계 ID
- 설명
- 외부 링크
- 소형 파일 URL
- 제출일
- 승인 상태

정책:

- 플랫폼에는 링크, 설명, 제출 시각, 승인/수정 상태를 저장한다.
- 이미지/문서 등 소형 파일만 제한적으로 업로드한다.
- 영상, 압축파일, 소스코드 등 대용량 파일은 외부 링크 제출을 권장한다.

---

## 8. 리뷰

작업이 완료된 뒤 의뢰자가 작성하는 평가다.

초기에는 리뷰 기능을 단순하게 둔다.

필요 정보:

- 리뷰 ID
- 작업 ID
- 전문가 ID
- 의뢰자 ID
- 평점
- 리뷰 내용
- 작성일

정책:

- 완료된 작업에만 리뷰 작성 가능
- 한 작업당 리뷰 1개

---

## 9. 마이페이지에서 필요한 상태

의뢰자 마이페이지:

- 내가 보낸 의뢰 요청
- 받은 거래 제안서
- 진행 중인 작업
- 완료된 작업
- 리뷰 작성 필요 작업

전문가 마이페이지:

- 내가 등록한 상품
- 받은 의뢰 요청
- 보낸 거래 제안서
- 진행 중인 작업
- 완료된 작업

---

## 10. 결론

초기 데이터 구조의 핵심은 자동 결제나 정산이 아니라, 다음 흐름을 안정적으로 저장하는 것이다.

```text
상품
→ 의뢰 요청
→ 거래 제안서
→ 작업 진행표
→ 산출물
→ 완료/리뷰
```

이 구조가 잡히면 이후 자동 결제, 단계별 정산, 알림, 고급 리뷰 기능을 확장할 수 있다.
---

## MVP 결제/정산 데이터

제안서 승인은 결제 완료와 같은 단계로 처리한다. 실제 PG 연동 전까지는 상태값으로 결제 흐름을 고정한다.

`proposals`:

- `payment_status`: `unpaid`, `paid`, `refunded`
- `platform_fee_rate`: 기본 `0.12`
- `paid_at`
- `refunded_at`

`works`:

- `total_price`: 제안서 총액
- `platform_fee`: `total_price * 12%`
- `expert_payout`: `total_price - platform_fee`
- `settlement_status`: `held`, `pending`, `settled`, `refunded`

상태 전환:

```text
제안서 발송: proposals.payment_status = unpaid
의뢰자 승인+결제: proposals.status = accepted, proposals.payment_status = paid
작업방 생성: works.settlement_status = held
결과물 승인: works.status = completed, works.settlement_status = pending
운영자 정산 완료: works.settlement_status = settled
환불 처리: payment_status 또는 settlement_status = refunded
```
