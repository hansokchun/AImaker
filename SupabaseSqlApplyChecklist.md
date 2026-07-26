# Supabase 최신 SQL 반영 체크리스트

> 목적: `database.sql`의 최신 테이블/RLS/Storage 정책을 Supabase 프로젝트에 다시 반영할 때 사용하는 운영 절차다.

---

## 1. 언제 실행하는가

다음 경우에 실행한다.

- `database.sql`의 RLS 정책이 변경됐을 때
- `database.sql`의 Storage bucket 정책이 변경됐을 때
- dev 배포는 성공했지만 Supabase 권한 오류가 의심될 때
- 최종 QA 전에 DB 정책을 최신 코드와 맞출 때

지금까지의 개발에서는 `database.sql` 정책이 여러 번 보강됐다. 따라서 최종 QA 전에는 Supabase SQL Editor에서 최신 `database.sql` 전체를 한 번 다시 실행하는 것을 기준으로 한다.

---

## 2. 실행 전 확인

실행 전 확인할 것:

- Supabase 프로젝트가 기그온 dev/production 중 어느 환경인지 확인한다.
- SQL Editor에 예전 쿼리 조각이 남아 있으면 입력창을 완전히 비운다.
- 로컬 `database.sql` 최신본을 사용한다.
- 별도로 `drop table`, `truncate`, `delete from` 같은 쿼리를 추가하지 않는다.

현재 `database.sql`은 재실행을 고려해 작성되어 있다.

- 테이블은 `create table if not exists`를 사용한다.
- 정책과 트리거는 `drop policy if exists`, `drop trigger if exists` 후 다시 만든다.
- 기존 데이터를 삭제하는 쿼리는 포함하지 않는다.

---

## 3. 실행 순서

1. Supabase Dashboard 접속
2. 대상 프로젝트 선택
3. SQL Editor 열기
4. 입력창 전체 비우기
5. 로컬 `database.sql` 전체 복사
6. SQL Editor에 붙여넣기
7. 전체 쿼리 실행
8. 실행 결과가 `Success. No rows returned` 또는 오류 없는 성공 상태인지 확인

---

## 4. 실행 후 확인

Table Editor에서 다음 테이블이 있는지 확인한다.

- `profiles`
- `expert_profiles`
- `expert_products`
- `service_requests`
- `proposals`
- `works`
- `work_steps`
- `deliverables`
- `reviews`

Storage에서 다음 bucket이 있는지 확인한다.

- `product-samples`
- `profile-images`
- `deliverable-files`

---

## 5. 오류가 나면

오류가 나면 추가 쿼리를 임의로 이어서 실행하지 않는다.

다음 정보를 확인해서 공유한다.

- 오류 메시지 전체
- 오류가 난 line 번호
- SQL Editor에 붙여넣은 쿼리가 최신 `database.sql` 전체인지 여부
- Supabase 프로젝트가 dev인지 production인지

특히 다음 오류는 멈추고 확인한다.

- `column ... does not exist`
- `syntax error at or near`
- `permission denied`
- `policy ... already exists`

정책 중복 오류는 대개 최신 파일 전체가 아니라 일부 조각만 실행했을 때 생긴다. 이 경우 SQL Editor를 완전히 비우고 최신 `database.sql` 전체를 다시 실행한다.

---

## 6. 최종 QA에서 확인할 흐름

SQL 반영 후 실제 계정으로 다음 흐름을 확인한다.

1. 전문가 프로필 작성
2. 상품 등록
3. 의뢰 요청 작성
4. 요청 게시판에서 제안서 작성
5. 의뢰자 계정으로 제안서 승인
6. 작업방 생성 및 단계 표시
7. 산출물 링크 제출
8. 결과물 승인 또는 수정 요청
9. 완료된 작업 리뷰 작성

이 흐름이 통과하면 Supabase 테이블, RLS, Storage 정책이 초기 런칭 흐름에 맞게 연결된 것으로 본다.

---

## 7. 현재 반영 상태

- 2026-05-19: 사용자가 Supabase SQL Editor에서 최신 `database.sql` 전체 실행 성공을 확인했다.
- 로컬 회귀 테스트에 `database.sql`의 잘못된 trailing comma 패턴(`,;`) 검사를 추가했다.
- SQL 변경 후에는 `npm.cmd test`를 먼저 실행해 스키마 계약 테스트가 통과하는지 확인한다.
