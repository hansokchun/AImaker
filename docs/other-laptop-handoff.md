# 다른 노트북 작업 인수인계

## 현재 기준

- GitHub 원격: `https://github.com/hansokchun/AImaker.git`
- 인수인계 브랜치: `codex/laptop-handoff-2026-07-18`
- Supabase 프로젝트 ref: `vtosyfoymmpjklbeufkm`
- Cloudflare Pages 프로젝트: `aimaker`
- 개발 주소: `https://dev.aimaker-e7x.pages.dev`
- 출시 기준: [배포 전 최종 체크리스트](launch-checklist.md)

`main`에 이미 배포가 있어도, 공개 출시는 체크리스트 완료 전까지 보류합니다.

## 새 노트북에서 처음 한 번만 할 일

1. Git을 설치하고 GitHub 계정으로 로그인합니다.
2. Node.js 24 이상과 Deno 2.x를 설치합니다.
3. 저장소를 내려받고 인수인계 브랜치로 이동합니다.

```powershell
git clone https://github.com/hansokchun/AImaker.git
cd AImaker
git switch codex/laptop-handoff-2026-07-18
npm ci
```

4. `.env.example`을 복사해 `.env.local`을 만들고, 실제 값은 안전한 비밀번호 관리자 또는 기존 노트북에서 별도로 옮깁니다.

```powershell
Copy-Item .env.example .env.local
```

`.env.local`에는 아래 **브라우저 공개 가능 값**만 넣습니다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TOSS_PAYMENTS_CLIENT_KEY`
- `VITE_PLATFORM_FEE_RATE`
- `VITE_ADMIN_EMAILS` (선택)

`VITE_`로 시작하는 값은 브라우저에 노출됩니다. Toss 시크릿 키, Supabase 서비스 역할 키, Cloudflare API 토큰은 절대 넣지 않습니다.

5. Supabase와 Cloudflare에 새 노트북에서 로그인합니다.

```powershell
npx supabase login
npx supabase link --project-ref vtosyfoymmpjklbeufkm
npx wrangler login
```

## GitHub에 절대 올리지 않는 것

- `.env`, `.env.local`, `.env.*`의 실제 값
- Toss 운영/테스트 시크릿 키
- `SUPABASE_SERVICE_ROLE_KEY`
- Cloudflare API 토큰
- 개인 인증서, `.pem`, `.p12`, `.pfx`, `.key`
- `.agents/`, `.omo/`, `.pnpm-store/`, `skills/` 같은 로컬 도구·캐시
- `node_modules/`, `dist/`, Supabase 임시 폴더

실제 서버 비밀값은 기존 Supabase 프로젝트의 Edge Function Secrets에 유지합니다. 새 노트북에서 값이 보이지 않는 것은 정상입니다. 값을 확인하거나 바꿔야 할 때는 Supabase Dashboard에서 직접 관리합니다.

## Edge Function Secret 이름

다음은 **이름만** 적은 목록입니다. 값은 GitHub, 문서, 채팅에 붙여넣지 않습니다.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOSS_PAYMENTS_SECRET_KEY`
- `PAYMENT_POLICY_APPROVED`
- `PLATFORM_FEE_RATE`
- `TRADE_AUTOMATION_SECRET`
- `KAKAO_ALIMTALK_WEBHOOK_URL` (사용 시)
- `SMS_FALLBACK_WEBHOOK_URL` (사용 시)

## 매번 작업 시작 전

```powershell
git status
git pull --rebase origin codex/laptop-handoff-2026-07-18
npm run typecheck
npm test
```

DB 변경이 있는 경우에는 먼저 아래 읽기 전용 확인을 하고, 결과를 확인한 뒤에만 적용합니다.

```powershell
npx supabase migration list --linked
npx supabase db advisors --linked --type security --level warn
```

## 배포 절차

개발 배포:

```powershell
npm run build
npx wrangler pages deploy dist --project-name aimaker --branch dev
```

운영 배포는 [배포 전 최종 체크리스트](launch-checklist.md)의 7단계가 확인된 뒤에만 실행합니다.

```powershell
npm run typecheck
npm run lint
npm test
npm run test:node
npm run test:e2e
npm run build
npx wrangler pages deploy dist --project-name aimaker --branch main
```

Supabase DB migration 또는 Edge Function 배포는 운영 데이터에 영향을 줄 수 있습니다. 반드시 변경 내용을 확인하고, `migration list --linked` 결과가 정상일 때만 진행합니다.

## 현재 알려진 출시 전 남은 일

1. `docs/launch-checklist.md`의 체크되지 않은 항목을 순서대로 완료합니다.
2. 운영 Toss 계약·운영 키가 준비되기 전에는 실제 금액 결제를 열지 않습니다.
3. 현재 정산은 자동 송금이 아닌 수동 은행 송금입니다.
4. 이용약관과 개인정보처리방침은 현재 초안이므로, 사업자·고객센터·환불·보관 기간 정보를 받아 확정해야 합니다.
