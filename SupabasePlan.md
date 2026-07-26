# 긱온 Supabase 상세 설계

> 작성일: 2026-05-15
> 목적: 초기 런칭에 필요한 Supabase 테이블, 상태값, RLS, Storage 정책을 정리한다.

---

## 1. 설계 방향

초기 Supabase 설계는 자동 결제 없이 거래 흐름과 작업 기록을 저장하는 데 집중한다.

핵심 흐름:

```text
profiles
→ expert_products
→ service_requests 또는 consultations
→ proposals
→ works
→ deliverables
→ reviews
```

기존 `database.sql`은 이전 구조를 담고 있으므로, 실제 구현 단계에서는 이 문서를 기준으로 새 migration을 작성한다.

최신 SQL을 Supabase에 다시 반영할 때는 `SupabaseSqlApplyChecklist.md`의 절차를 따른다.

---

## MVP 결제/정산 상태 확장

추천 결제 방식 확정에 따라 제안서와 작업 테이블에 결제/수수료/정산 상태를 저장한다.

`proposals` 추가 필드:

```text
payment_status text default 'unpaid'
platform_fee_rate numeric(5,4) default 0.12
paid_at timestamptz
refunded_at timestamptz
```

`payment_status` 값:

```text
unpaid
paid
refunded
```

`works` 추가 필드:

```text
total_price integer default 0
platform_fee integer default 0
expert_payout integer default 0
settlement_status text default 'held'
```

`settlement_status` 값:

```text
held       결제 완료 후 작업 진행 중
pending    의뢰자 완료 승인 후 정산 대기
settled    전문가 정산 완료
refunded   환불 처리
```

작업방은 `proposals.status = accepted`이고 `proposals.payment_status = paid`인 제안서에서만 생성된다. 실제 PG 승인, 자동 환불, 자동 정산은 후속 개발로 분리한다.

전문가 문의형 거래에서는 `consultations`와 `consultation_messages`에 결제 전 상담 기록을 남긴 뒤, 전문가가 상담 내용을 바탕으로 `proposals`를 생성한다.

---

## 2. 공통 규칙

모든 핵심 테이블은 다음 필드를 기본으로 둔다.

```text
id uuid primary key
created_at timestamptz
updated_at timestamptz
```

상태값은 `text`로 시작한다. 런칭 후 안정되면 enum으로 바꿀 수 있다.

금액은 `integer` 원화 기준으로 저장한다.

```text
price_amount integer
currency text default 'KRW'
```

---

## 3. profiles

회원 기본 정보와 전문가 여부를 저장한다.

주요 컬럼:

```text
id uuid primary key references auth.users(id)
email text
display_name text
avatar_url text
is_expert boolean default false
expert_intro text
ai_tools text[]
sample_links text[]
created_at timestamptz
updated_at timestamptz
```

RLS:

- 누구나 공개 프로필을 볼 수 있다.
- 사용자는 자기 프로필만 생성할 수 있다.
- 사용자는 자기 프로필만 수정할 수 있다.

---

## 4. expert_products

전문가가 등록하는 AI 작업 상품이다.

주요 컬럼:

```text
id uuid primary key
expert_id uuid references profiles(id)
title text
category text
summary text
description text
ai_tools text[]
sample_links text[]
sample_file_urls text[]
starting_price integer
currency text default 'KRW'
delivery_days integer
revision_count integer
packages jsonb
status text
created_at timestamptz
updated_at timestamptz
```

category 값:

```text
ai-video-shortform
ai-image-character
ai-development-automation
```

status 값:

```text
draft
published
hidden
```

packages jsonb 예시:

```json
{
  "standard": {
    "name": "Standard",
    "price": 30000,
    "deliveryDays": 3,
    "revisionCount": 1,
    "included": ["AI 이미지 시안 3장"]
  },
  "deluxe": null,
  "premium": null
}
```

RLS:

- 누구나 `published` 상품을 볼 수 있다.
- 전문가는 자기 상품 전체를 볼 수 있다.
- 전문가는 자기 상품만 생성/수정할 수 있다.
- `hidden` 상품은 운영자 또는 소유자만 볼 수 있다.

---

## 4.5. consultations / consultation_messages

전문가 문의형 거래에서 결제 전 상담을 저장한다. 상담은 작업방이 아니며, 상담만으로 작업이 시작되지 않는다.

`consultations` 주요 컬럼:

```text
id uuid primary key
client_id uuid references profiles(id)
expert_id uuid references profiles(id)
product_id uuid references expert_products(id)
status text
last_message_at timestamptz
created_at timestamptz
updated_at timestamptz
```

`consultation_messages` 주요 컬럼:

```text
id uuid primary key
consultation_id uuid references consultations(id)
sender_id uuid references profiles(id)
body text
attachment_urls text[]
created_at timestamptz
```

status 값:

```text
open
proposal_sent
closed
```

정책:

- 상담 참여자인 의뢰자와 전문가만 상담과 메시지를 볼 수 있다.
- 상담 참여자만 메시지를 작성할 수 있다.
- 외부 연락처와 외부 결제 유도 문구는 상담 메시지에서도 차단한다.
- 전문가는 상담 내용을 바탕으로 제안서를 보낼 수 있다.
- 제안서 승인 및 결제 전에는 작업방이 생성되지 않는다.

---

## 5. service_requests

의뢰자가 상품을 보고 보내는 요구사항이다.

주요 컬럼:

```text
id uuid primary key
client_id uuid references profiles(id)
expert_id uuid references profiles(id)
product_id uuid references expert_products(id)
selected_package text
desired_result text
purpose text
reference_text text
reference_links text[]
deadline date
progress_type text
checklist jsonb
additional_request text
status text
created_at timestamptz
updated_at timestamptz
```

progress_type 값:

```text
single
milestone
```

status 값:

```text
submitted
proposal_sent
cancelled
```

RLS:

- 의뢰자는 자기 요청만 볼 수 있다.
- 요청을 받은 전문가는 해당 요청을 볼 수 있다.
- 의뢰자는 자기 요청만 생성할 수 있다.
- 의뢰자는 제안서 승인 전 요청을 취소할 수 있다.

---

## 6. proposals

전문가가 보내는 최종 거래 제안서다.

주요 컬럼:

```text
id uuid primary key
request_id uuid references service_requests(id)
consultation_id uuid references consultations(id)
client_id uuid references profiles(id)
expert_id uuid references profiles(id)
title text
scope text
deliverables text[]
total_price integer
currency text default 'KRW'
delivery_days integer
revision_count integer
progress_type text
milestones jsonb
commercial_use_allowed boolean
source_file_included boolean
status text
expires_at timestamptz
created_at timestamptz
updated_at timestamptz
```

status 값:

```text
sent
revision_requested
accepted
cancelled
expired
```

정책:

- `expires_at`은 생성 시점 기준 3일 후로 설정한다.
- 의뢰자는 수정 요청을 1회만 할 수 있다.
- 의뢰자가 승인하기 전에는 작업이 생성되지 않는다.
- 제안서는 패키지 구매형의 `service_requests` 또는 전문가 문의형의 `consultations` 중 하나에서 생성된다.
- 둘 중 하나의 출처는 반드시 있어야 하며, 동시에 둘 다 비어 있으면 안 된다.

RLS:

- 의뢰자와 전문가만 제안서를 볼 수 있다.
- 요청을 받은 전문가만 제안서를 생성할 수 있다.
- 의뢰자만 승인/수정 요청/취소를 할 수 있다.

---

## 7. works

제안서가 승인되면 생성되는 작업 진행표다.

주요 컬럼:

```text
id uuid primary key
proposal_id uuid references proposals(id)
request_id uuid references service_requests(id)
client_id uuid references profiles(id)
expert_id uuid references profiles(id)
title text
progress_type text
status text
started_at timestamptz
completed_at timestamptz
created_at timestamptz
updated_at timestamptz
```

status 값:

```text
in_progress
submitted
revision_requested
completed
cancelled
```

RLS:

- 의뢰자와 전문가만 작업을 볼 수 있다.
- 승인된 제안서에 대해서만 작업을 생성할 수 있다.
- 전문가는 작업 상태와 산출물을 제출할 수 있다.
- 의뢰자는 승인/수정 요청을 할 수 있다.

---

## 8. work_steps

단계별 진행을 저장한다. 단일 진행도 하나의 단계로 저장한다.

주요 컬럼:

```text
id uuid primary key
work_id uuid references works(id)
step_order integer
title text
description text
status text
submitted_at timestamptz
approved_at timestamptz
revision_requested_at timestamptz
revision_message text
created_at timestamptz
updated_at timestamptz
```

status 값:

```text
waiting
in_progress
submitted
revision_requested
approved
```

RLS:

- 해당 작업의 의뢰자와 전문가만 볼 수 있다.
- 전문가는 단계 상태를 제출 상태로 바꿀 수 있다.
- 의뢰자는 승인 또는 수정 요청 상태로 바꿀 수 있다.

---

## 9. deliverables

전문가가 제출한 산출물 정보를 저장한다.

주요 컬럼:

```text
id uuid primary key
work_id uuid references works(id)
step_id uuid references work_steps(id)
expert_id uuid references profiles(id)
description text
external_url text
file_url text
status text
submitted_at timestamptz
created_at timestamptz
updated_at timestamptz
```

status 값:

```text
submitted
approved
revision_requested
```

저장 정책:

- 대용량 파일은 `external_url` 중심으로 저장한다.
- 소형 파일만 `file_url`로 저장한다.
- 영상, 압축 파일, 소스코드는 외부 링크를 권장한다.

RLS:

- 해당 작업의 의뢰자와 전문가만 볼 수 있다.
- 전문가만 산출물을 생성/수정할 수 있다.
- 의뢰자는 승인/수정 요청 상태만 변경할 수 있다.

---

## 10. reviews

완료된 작업에 대한 리뷰다.

주요 컬럼:

```text
id uuid primary key
work_id uuid references works(id)
client_id uuid references profiles(id)
expert_id uuid references profiles(id)
rating integer
content text
created_at timestamptz
updated_at timestamptz
```

정책:

- 완료된 작업에만 리뷰를 작성할 수 있다.
- 한 작업당 리뷰는 1개만 작성할 수 있다.
- 평점은 1~5 사이로 제한한다.

RLS:

- 누구나 공개 리뷰를 볼 수 있다.
- 해당 작업의 의뢰자만 리뷰를 작성할 수 있다.
- 리뷰 작성 후 수정 가능 여부는 초기에는 허용하지 않는다.

---

## 11. Storage bucket 정책

초기 bucket:

```text
product-samples
deliverable-files
profile-images
```

정책:

- `product-samples`: 공개 읽기 가능, 상품 소유자만 업로드
- `profile-images`: 공개 읽기 가능, 본인만 업로드
- `deliverable-files`: 비공개 읽기, 해당 작업 의뢰자/전문가만 접근

초기에는 대용량 업로드를 적극 지원하지 않는다.

권장 제한:

```text
이미지/문서 중심
파일 크기 제한
영상/압축/소스코드는 외부 링크 권장
```

---

## 12. 외부 연락처 방지

초기에는 완벽한 자동 탐지보다 입력 안내와 운영자 확인을 우선한다.

저장 전 확인할 수 있는 패턴:

```text
전화번호
이메일
카카오톡
오픈채팅
디스코드
텔레그램
계좌번호
```

적용 위치:

- 상품 설명
- 요구사항
- 제안서
- 산출물 설명
- 리뷰

자동 차단이 과하면 정상 문구도 막을 수 있으므로, 초기에는 경고 문구와 운영자 숨김 처리를 함께 사용한다.

---

## 13. 실제 구현 순서

Supabase 구현은 다음 순서가 좋다.

1. 기존 `database.sql` 백업 확인
2. 새 migration 파일 작성
3. profiles 정리
4. expert_products 추가
5. service_requests 개편
6. proposals 추가
7. works, work_steps 추가
8. deliverables 추가
9. reviews 추가
10. RLS 정책 적용
11. Storage bucket 정책 적용
12. mock data 화면을 Supabase 데이터로 교체

---

## 14. 결론

Supabase 첫 설계의 핵심은 결제보다 거래 기록이다.

```text
누가
어떤 상품을 보고
어떤 요구사항을 보냈고
어떤 제안서를 승인했으며
작업이 어디까지 진행됐는지
```

이 기록이 안정되면 이후 결제, 에스크로, 단계별 정산을 붙이기 쉬워진다.
---

## 2026-06-10 수정: 첫 런칭 결제/정산 테이블 추가

첫 런칭부터 결제와 정산을 포함한다.

추가 테이블:

```text
payments
settlements
platform_fees
refund_requests
```

### payments

```text
id uuid primary key
proposal_id uuid references proposals(id)
work_id uuid references works(id)
client_id uuid references profiles(id)
expert_id uuid references profiles(id)
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

상태값:

```text
pending
paid
failed
cancelled
refunded
partially_refunded
```

### settlements

```text
id uuid primary key
payment_id uuid references payments(id)
work_id uuid references works(id)
expert_id uuid references profiles(id)
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

상태값:

```text
pending
available
requested
paid
held
cancelled
```

### platform_fees

```text
id uuid primary key
payment_id uuid references payments(id)
client_fee_amount integer
expert_fee_amount integer
pg_fee_amount integer
total_platform_revenue integer
created_at timestamptz
```

### refund_requests

```text
id uuid primary key
payment_id uuid references payments(id)
work_id uuid references works(id)
requester_id uuid references profiles(id)
reason text
status text
admin_note text
created_at timestamptz
updated_at timestamptz
```

RLS 원칙:

- 요청자는 자기 결제 내역만 볼 수 있다.
- 메이커는 자기 정산 내역만 볼 수 있다.
- 결제/정산 상태 변경은 시스템 또는 운영자 권한으로 제한한다.
- 환불 요청은 해당 거래의 요청자만 생성할 수 있다.
---

## 2026-06-17 수정: 의뢰서 필드와 샘플 필드 추가

`service_requests`에 다음 필드를 추가한다.

```text
usage_purpose text
target_audience text
usage_channel text
style_preference text
file_format text
reference_links text[]
avoid_style text
commercial_use_required boolean
source_file_required boolean
```

메이커와 상품 샘플 필수 정책을 위해 다음 필드를 명확히 사용한다.

```text
profiles.sample_links
expert_products.sample_links
expert_products.sample_file_urls
```
---

## 2026-06-17 추가 필요 컬럼

프로필/상품 신뢰 정보 표시를 위해 다음 컬럼이 필요하다.

`expert_profiles`

- `contact_available_time text`
- `average_response_time text`

`expert_products`

- `tax_invoice_available boolean default false`

이미 존재하는 `created_at`은 상품 상세에서 등록일 표시용으로 사용한다.
