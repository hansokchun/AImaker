# Home Fiverr-Inspired Design Spec

## Goal

AIConnect 홈화면을 Fiverr의 큰 히어로, 검색 진입, 인기 서비스 구조를 참고하되 AIConnect의 핵심인 “AI 작업을 싸고 쉽게 맡기고, 누구나 작업자로 시작할 수 있다”에 맞게 재구성한다.

## Reference

- Fiverr: 큰 첫 화면 문구, 서비스 검색 진입, 인기 서비스/카테고리 노출, freelancer 전환 CTA.
- AIConnect 차별화: AI 전용 카테고리, 샘플 결과물, 시작가, 사용 AI 도구, 작업방 진행 확인.

## Homepage Structure

1. Visual hero
   - 실제 사람이 AI 작업을 하는 분위기의 배경 이미지
   - 어두운 오버레이 위에 핵심 문구와 검색창 배치
   - 검색창은 카테고리/상품 탐색으로 이어지는 진입점
   - CTA: `AI 작업 찾기`, `작업자로 시작하기`

2. Popular AI work chips
   - AI 영상/숏폼
   - AI 이미지/캐릭터
   - AI 개발/자동화
   - 프롬프트/콘텐츠 시안

3. Trusted positioning strip
   - `AI 특화`
   - `샘플 보고 의뢰`
   - `작업방에서 진행 확인`

4. Category cards
   - 초기 3개 카테고리를 큰 카드로 노출
   - 예시 작업과 상품 탐색 CTA 포함

5. Featured products
   - 샘플 이미지, 상품명, 요약, 시작가, 작업자 이름, 사용 AI 도구 표시
   - 카드 CTA는 요구사항 작성과 상세보기로 연결

6. Work process
   - 요구사항 작성
   - 제안서 확인
   - 작업방에서 결과물 확인

7. Maker CTA
   - “AI 도구를 다룰 줄 안다면 작업자로 시작할 수 있다” 메시지

## Non-Goals

- 실제 검색 알고리즘 구현은 하지 않는다.
- 결제 CTA는 넣지 않는다.
- 복잡한 추천/랭킹 로직은 넣지 않는다.
