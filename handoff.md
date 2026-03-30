# 거상 To-Do List - Handoff 문서

## 프로젝트 개요
거상(온라인 게임) 플레이어를 위한 일일/주간 퀘스트 및 던전 공고 관리 To-Do List 웹 앱.
순수 HTML/CSS/JS(바닐라)로 구현. Pretendard 웹폰트 CDN + Firebase SDK CDN 사용.

- **배포 URL (Netlify)**: https://gersang-todo.netlify.app
- **배포 URL (GitHub Pages)**: https://helperjby.github.io/gersang-to-do-list/
- **저장소**: https://github.com/helperjby/gersang-to-do-list
- **배포 방식**: Netlify (main 브랜치 자동 배포) + GitHub Pages (병행)

---

## 파일 구조

```
├── index.html    # 메인 HTML (2컬럼 레이아웃, 헤더, 전체 진행률, 퀘스트 카드 4개, 던전 카드, footer)
├── app.js        # 전체 비즈니스 로직 + Firebase 동기화 (IIFE, ~820줄)
├── style.css     # CSS Custom Properties 기반 다크 테마 스타일링 (~900줄)
├── README.md     # 프로젝트 소개 (GitHub 저장소 페이지)
├── handoff.md    # 개발자 핸드오프 문서
├── docs/
│   └── image.png # README 스크린샷 이미지
└── .claude/
    └── launch.json  # 로컬 개발 서버 설정 (python http.server :3000)
```

---

## 주요 기능

### 1. 카테고리 (4개)
| 카테고리 | 키 | 아이콘 | 액센트 색상 | 리셋 |
|---------|-----|-------|-----------|------|
| 해야 할 일 | `todo` | 📋 | 골드 (#e8b04a) | 없음 |
| 일일 퀘스트 | `daily` | 🔄 | 시안 (#4ac8e8) | 매일 06:00 |
| 주간 퀘스트 | `weekly` | 📅 | 퍼플 (#a04ae8) | 매주 일요일 06:00 |
| 이벤트 | `event` | 🎉 | 그린 (#4ae868) | 없음 |

### 2. 퀘스트 관리
- **추가**: 입력란 + 버튼 (Enter키 지원)
- **완료 체크**: 커스텀 체크박스 (골드 배경 + 체크마크 + bounce 애니메이션)
- **삭제**: − 버튼 (호버 시에만 표시, confirm 알럿으로 확인 후 삭제, 하위 항목 있으면 개수 표시)
- **인라인 편집**: 퀘스트 이름 더블클릭 → input 전환 (Enter/blur 저장, Escape 취소)
- **순서 변경**: ⇅ 버튼 토글 → 드래그 핸들(☰) 표시 → 마우스 이벤트 기반 드래그앤드롭 (최상위 항목만)
- **하위 항목(Sub-Item)**: + 버튼으로 하위 항목 추가, 재귀적 다단계 지원
  - ▶/▼ 토글로 접기/펼치기
  - 하위 항목도 체크/삭제/인라인편집/하위추가 모두 지원
  - 인라인 추가 폼 (하위 항목 추가...) 표시
- **진행률**: 카테고리별 완료/전체 카운트 (하위 항목 포함 재귀 집계) + 그라디언트 프로그레스 바
- **100% 달성 효과**: 프로그레스 바가 초록색으로 변하며 pulse glow 애니메이션

### 3. 던전 공고(반복) 패널
- 항상 노출 (토글 없음), 좌측 카드와 동일한 `.card` + `.quest-item` 스타일
- 2컬럼 레이아웃: 좌우 동일 너비 (flex: 1)
- **고정 20개 던전 목록**: 고수동굴, 대관령, 한라산, 월기봉, 거제해저동굴, 무령왕릉, 천년호, 이시즈치산, 하치만타이온천, 대설산, 일본해저동굴, 귀곡성, 대둔산, 대만해저동굴, 해적동굴, 해적동굴2층(200렙 이하), 유명계, 륭산, 샤오링의후원, 챠우신전
- **삭제**: ✕ 버튼으로 개별 던전 제거 (confirm 알럿 확인 후 hidden 처리, localStorage 유지)
- **리셋**: ↻ 리셋 버튼 → 전체 목록 복원 + 체크 초기화
- **일일 리셋(06:00)**: 체크만 초기화, 삭제된 목록은 유지
- 진행률 카운트 + 골드 그라디언트 프로그레스 바

### 4. 전체 진행률
- 헤더 아래에 전체 카테고리 + 던전 합산 진행률 바 표시
- 퍼센트(%) 텍스트 라벨
- 100% 달성 시 초록색 + glow 효과

### 5. 데이터 동기화 (Firebase)
- **동기화 코드**: 6자리 영숫자 코드 생성 → 다른 기기에서 코드 입력하여 데이터 불러오기
- **업로드**: 현재 데이터를 Firebase Realtime Database에 저장, 7일간 유효
- **다운로드**: 코드 입력 → 서버에서 데이터 조회 → 로컬 데이터 덮어쓰기 (confirm 확인)
- **충돌 처리**: 명시적 업로드/다운로드 방식 (덮어쓰기)
- **오프라인**: Firebase 미설정 시에도 앱 정상 동작 (동기화 기능만 비활성)
- **코드 복사**: 클립보드 복사 버튼 제공

### 6. 자동 리셋
- **일일 리셋**: 매일 06:00 기준, `daily` 퀘스트 + `dungeon` 체크 초기화
- **주간 리셋**: 매주 일요일 06:00 기준, `weekly` 퀘스트 초기화
- 헤더에 마지막 리셋 시각 표시

---

## 디자인 시스템

### CSS Custom Properties
```css
:root {
  --bg-primary: #0f0f1a;        /* 메인 배경 */
  --bg-card: #161625;           /* 카드 배경 */
  --bg-item: #1a1a30;           /* 아이템 배경 */
  --bg-item-hover: #1e1e38;     /* 아이템 호버 */
  --accent-gold: #e8b04a;       /* 주요 액센트 */
  --accent-gold-light: #f0c868; /* 밝은 골드 */
  --accent-gold-dim: #b8924a;   /* 어두운 골드 */
  --accent-cyan: #4ac8e8;       /* 일일 퀘스트 */
  --accent-purple: #a04ae8;     /* 주간 퀘스트 */
  --accent-green: #4ae868;      /* 이벤트 */
  --accent-complete: #4ae868;   /* 100% 달성 */
  --text-primary: #e8e8f0;
  --text-secondary: #8888a0;
  --text-muted: #555568;
  --border: #2a2a40;
  --border-accent: #3a3a55;
  --danger: #e05555;
  --radius-sm: 6px;
  --radius-md: 12px;
}
```

### 폰트
- **Pretendard Variable** (CDN: jsdelivr, 한글 최적화 무료 폰트)
- 폴백: Segoe UI, Tahoma, Geneva, Verdana, sans-serif

### 카드 컴포넌트 패턴
- `.card` 클래스: 배경 `--bg-card`, 보더 `--border`, radius `--radius-md`
- `::before` 상단 2px 액센트 라인 (카테고리별 색상 그라디언트)
- 호버 시 `translateY(-1px)` + border 밝아짐
- `.quest-item` 좌측 3px 보더: 호버 시 카테고리 색상 표시

### 커스텀 체크박스
- `.custom-checkbox` div 기반 (네이티브 checkbox 미사용)
- 체크 시 골드 배경 + `::after` 체크마크 + bounce 애니메이션

---

## 데이터 구조 (localStorage)

키: `gersang-todo`

```json
{
  "todo": [{ "id": "xxx", "name": "할일명", "done": false, "children": [...], "collapsed": false }],
  "daily": [...],
  "weekly": [...],
  "event": [...],
  "dungeon": [{ "name": "고수동굴", "done": false, "hidden": false }, ...],
  "lastDailyReset": "2026-03-28T21:00:00.000Z",
  "lastWeeklyReset": "2026-03-21T21:00:00.000Z"
}
```

- 퀘스트: `id`(자동 생성), `name`, `done`, `children`(하위 항목 배열, 재귀 구조), `collapsed`(접기 상태)
- 던전: `name`(고정), `done`, `hidden`
- `showDungeon` 필드는 제거됨 (항상 노출)
- 기존 데이터 마이그레이션: `children`/`collapsed` 없는 항목은 자동으로 `[]`/`false` 추가

---

## 커밋 히스토리

| 커밋 | 내용 |
|------|------|
| `bf91c54` | 초기 구현 |
| `f14e22d` | 기능 고도화 - 카테고리 변경, 드래그앤드롭, 진행률, 인라인 편집 |
| `fdaca7c` | 드래그앤드롭 버그 수정 (setData, pointer-events) |
| `25e3296` | 브라우저 캐시 방지 메타 태그 |
| `c2cc717` | 던전 공고(반복) 패널 추가 |
| `02e3906` | 캐시 버스팅(CSS/JS ?v=2), 던전 패널 스크롤 제거, cache-control 메타 태그 제거 |
| `ce1be93` | 드래그앤드롭을 마우스 이벤트 기반으로 교체 |
| `8d7e388` | 완료 체크 시 자동 정렬 제거, README.md 작성 |
| `616e854` | handoff.md 최신 상태로 업데이트 |
| `d0575fa` | UI 전면 개편 - 게임 UI 강화 스타일 |
| `fb858b1` | 하위 뎁스(Sub-Item) 추가 + 삭제 확인 알럿 |
| `75d1d42` | Firebase 동기화 코드 기능 추가 |
| (NEW) | Netlify 배포 전환 (gersang-todo.netlify.app) |

---

## UI 개편 내역 (v2)

### 디자인 시스템
- 모든 하드코딩 색상을 CSS Custom Properties로 전환
- Pretendard 웹폰트 CDN 추가
- 카테고리별 색상 체계 도입 (골드/시안/퍼플/그린)

### 레이아웃
- 고정 너비 2컬럼 (480+380px) → 전체 화면 너비 flex 레이아웃 (좌우 동일 비율)
- 던전 패널: 토글 방식 → 항상 노출, 좌측과 동일한 `.card` 스타일로 통일

### 컴포넌트 개선
- 네이티브 체크박스 → 커스텀 CSS 체크박스 (골드 배경 + bounce 애니메이션)
- 프로그레스 바: 3px → 6px, 카테고리별 그라디언트, 100% 달성 시 초록색 + pulse glow
- 전체 진행률 바 추가 (헤더 아래)
- 카드 상단 카테고리별 액센트 라인
- 카테고리 아이콘 추가 (📋🔄📅🎉⚔)
- 삭제 버튼: 호버 시에만 표시
- 빈 상태: 📭 아이콘 + 텍스트

### 기타
- 헤더 타이틀: 1.5rem → 2rem + text-shadow glow
- footer 추가 (제작자 정보 + Made with Claude Code)
- CSS/JS 캐시 버스팅 v4 → v6

---

## 로컬 개발

```bash
# 개발 서버 실행
python -m http.server 3000

# 브라우저에서 확인
http://localhost:3000
```

---

## 배포 구성

### Netlify (주 배포)
- **URL**: https://gersang-todo.netlify.app
- **플랜**: 무료 (Starter)
- **연결**: GitHub `helperjby/gersang-to-do-list` 저장소 → `main` 브랜치
- **빌드 설정**: Build command 없음, Publish directory `.` (정적 사이트)
- **자동 배포**: `main` 브랜치 push 시 자동 배포
- **사이트 이름 변경**: Netlify Dashboard → Domain management → Edit site name

### GitHub Pages (병행)
- **URL**: https://helperjby.github.io/gersang-to-do-list/
- **설정**: main 브랜치, / 경로

### Firebase (동기화 백엔드)
- **프로젝트**: `gersang-to-do` (Firebase Console)
- **서비스**: Realtime Database (asia-southeast1)
- **Database URL**: `https://gersang-to-do-default-rtdb.asia-southeast1.firebasedatabase.app`
- **플랜**: Spark (무료) — 1GB 저장, 10GB/월 전송
- **보안 규칙**: test mode (운영 시 validate 규칙 적용 권장)
- **API 키**: 클라이언트 공개 식별자 (비밀 아님), 보안은 Security Rules로 제어
- **데이터 경로**: `/sync/{코드}` — `{ data, timestamp, expiresAt }` 구조
- **만료**: 7일 (클라이언트에서 체크, 서버 자동 삭제는 미구현)

---

## 알려진 사항 / 참고
- PC 전용 레이아웃 (모바일 뷰 미고려)
- 외부 라이브러리: Pretendard 폰트 CDN + Firebase SDK CDN (동기화용)
- 다크 테마 고정, 게임 UI 강화 스타일 (카테고리별 색상 구분)
- CSS/JS 파일 변경 시 index.html의 쿼리 스트링 버전(`?v=N`)을 올려야 캐시 갱신됨 (현재 v8)
- Firebase 설정: `app.js` 상단의 `FIREBASE_CONFIG` 객체에 Firebase 프로젝트 설정값 입력 필요
