# AIMaker 개발 동기화

이 저장소는 `dev` 브랜치를 기준으로 작업한다.

작업 완료 후 안전하게 원격 `origin/dev`에 반영하려면 다음 스크립트를 사용한다.

```powershell
.\scripts\sync-dev.ps1 -Message "feat: 작업 내용 요약"
```

스크립트 흐름:

- 현재 브랜치가 `dev`인지 확인
- `origin/dev` fetch
- 변경사항이 있으면 `npm.cmd test` 실행
- `npm.cmd run build` 실행
- 전체 변경사항 stage
- 커밋 생성
- `git pull --rebase origin dev`
- 충돌이 없으면 `git push origin dev`

테스트나 빌드가 실패하면 커밋/푸시하지 않는다. rebase 충돌이 발생하면 스크립트가 멈추므로 충돌을 직접 해결한 뒤 다시 실행한다.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
