# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

거상(온라인 게임) 플레이어용 일일/주간 퀘스트 및 던전 관리 To-Do List 웹 앱. 순수 바닐라 HTML/CSS/JS, 빌드 도구 없음.

- **배포**: https://gersang-todo.netlify.app (Netlify, main 브랜치 자동 배포)
- **백업 배포**: https://helperjby.github.io/gersang-to-do-list/ (GitHub Pages)

## Development

```bash
python -m http.server 3000  # http://localhost:3000
```

Preview tool: `.claude/launch.json`의 `dev` 설정 사용 (`preview_start` name="dev").

빌드/린트/테스트 단계 없음. 변경 후 브라우저 새로고침으로 확인.

## Architecture

단일 IIFE(`app.js`)에 모든 로직 포함. 외부 JS 라이브러리 없음 (Firebase SDK CDN만 사용).

### Data Flow
`localStorage('gersang-todo')` ↔ `loadData()/saveData()` ↔ `render()` (전체 DOM 재생성)

모든 상태 변경은 `saveData(data)` → `render(data)` 패턴을 따름.

### Key Modules (app.js 내부)
- **Data**: `loadData()`, `saveData()`, `migrateData()` — localStorage CRUD + 마이그레이션
- **Rendering**: `render()` → `renderQuestItem()` (재귀, 하위 항목 지원) + `renderDungeon()`
- **Reset**: `checkAndReset()` — 매일 06:00 / 매주 일요일 06:00 기준 자동 초기화
- **Sync**: `uploadData()` / `downloadData()` — Firebase Realtime Database 연동, 6자리 동기화 코드
- **DnD**: `startDrag()` — 마우스 이벤트 기반 드래그앤드롭 (최상위 항목만)

### Quest Data Structure (재귀)
```js
{ id, name, done, children: [/* 같은 구조 */], collapsed }
```
`countQuests()`, `resetQuests()`, `removeQuestById()` 모두 재귀 탐색.

### Firebase Config
`app.js` 상단 `FIREBASE_CONFIG` 객체. API 키는 공개 식별자(비밀 아님). `db`가 `null`이면 동기화 비활성, 앱은 정상 동작.

## Styling

CSS Custom Properties 기반 다크 테마 (`style.css`). 카테고리별 액센트 색상:
- `--accent-gold` (해야 할 일/던전), `--accent-cyan` (일일), `--accent-purple` (주간), `--accent-green` (이벤트)

컴포넌트 패턴: `.card` (상단 액센트 라인) → `.quest-item` (좌측 3px 보더) → `.custom-checkbox`

## Cache Busting

CSS/JS 변경 시 `index.html`의 쿼리 스트링 버전 증가 필수: `style.css?v=8` → `?v=9`, `app.js?v=8` → `?v=9`

## Language

UI와 문서는 한국어. 코드 내 변수/함수명은 영어. 커밋 메시지는 한국어 설명 포함.
