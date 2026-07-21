# Supabase Advisor 출시 전 분류

기준일: 2026-07-22

## 이번 점검에서 해결

- `works.dispute_opened_by` 외래키 인덱스: 운영 DB에 부분 인덱스를 추가했고 `unindexed_foreign_keys` 경고가 사라진 것을 확인했습니다.

## 의도된 보안 구조

- `financial_operations`, `financial_provider_inbox`, `financial_reconciliation_outbox`: RLS를 켜고 브라우저 정책을 만들지 않은 서버 전용 원장입니다. 클라이언트 접근을 허용하지 않는 것이 의도입니다.
- 상담 관련 `SECURITY DEFINER` 함수 3개: 로그인 사용자에게 호출 권한이 필요하지만 함수 내부에서 `auth.uid()`, 활성 계정, 거래 참여자, 허용 상태 전이를 검증합니다.
- `is_admin`, `is_active_admin`: 관리자 RLS 판단에 사용되므로 로그인 역할의 실행 권한이 필요합니다. 인자로 현재 로그인 ID를 사용하는 정책만 유지합니다.

## 외부 설정 필요

- 유출 비밀번호 차단: 현재 Free 플랜에서 사용할 수 없습니다. Pro 전환 시 Authentication → Attack Protection에서 활성화합니다.

## 출시 후 성능 최적화

- `auth_rls_initplan`: 25건. 신규·핵심 정책은 `(select auth.uid())` 형태를 사용하고 있으며, 기존 정책은 실제 쿼리 지연을 측정하며 순차 정리합니다.
- `multiple_permissive_policies`: 24건. 사용자·관리자 조회 권한이 합쳐진 경우가 많아, 기능 회귀 테스트와 함께 통합합니다.
- `unused_index`: 35건. 출시 전 데이터량이 적어 사용 통계가 쌓이지 않은 상태이므로 바로 삭제하지 않습니다.

Advisor 경고 개수만 줄이기 위해 서버 전용 원장을 공개하거나 인덱스를 성급히 삭제하지 않습니다.

