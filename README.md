# Pa'ar Mission (파아르미션) 웹사이트

이사야 61:1–3에 근거하여 회복·자유·영광의 복음을 땅 끝까지 전하는 선교 단체 **파아르미션(Pa'ar Mission)**의 공식 웹사이트입니다.

---

## 완성된 기능

### 멀티페이지 구조 (9개 페이지)

| 페이지 | 파일 | 주요 내용 |
|--------|------|----------|
| 홈 (소개) | `index.html` | Hero + About + 페이지 바로가기 카드 |
| 신학적 기초 | `foundation.html` | 3대 기둥 (회복/자유/영광) + 5가지 핵심 원리 + 말씀 배너 |
| 핵심 가치 | `values.html` | 6대 핵심 가치 + 요약 배너 |
| 주요 사역 | `projects.html` | 5탭 사역 소개 + 닿길 TF 섹션 |
| 단기선교 — 사역 | `mission.html` | 사역 소개 + 스케줄 + **Notion 편지함 연동** |
| 단기선교 — 현황 | `mission-status.html` | **YouTube API 자동 에피소드/스핀오프 그리드** + 기도편지/감사편지 |
| 후원 | `support.html` | 후원 방법 3가지 + 계좌 안내 + 투명성 약속 |
| 연락처 | `contact.html` | 문의 폼 + FAQ |
| **협력단체** | `partners.html` | 협력 교회&단체 / 선교사 / 기업 — **Notion DB 동적 연동** |

### Notion 편지함 연동 (완료)
- **기도편지** DB (`/prayer`) — Notion에서 동적 로드
- **감사편지** DB (`/thanks`) — Notion에서 동적 로드
- Cloudflare Worker 프록시 — AWS S3 CORS 이미지 프록시 포함
- 편지 모달 — 이미지 슬라이드 + 썸네일 네비게이션

### YouTube Data API v3 자동화 (완료)
- 재생목록 ID: `PLv-gSMPr9CVVq8qxZLXBPC2Obdp9Jzu9-`
- 제목 패턴(`/spin\s*off|스핀/i`)으로 에피소드 / 스핀오프 자동 분류
- `js/youtube-playlist.js` — 스켈레톤 로딩 + 에러 처리
- **YouTube API 호출 → Cloudflare Worker 프록시 경유** (`/youtube-playlist`)
  - `www.paarmission.org` / `paarmission.org` 모두 정상 동작
  - API 키 HTTP Referer 도메인 제한 완전 우회

### 협력단체 Notion 연동 (완료 — Worker 배포 필요)
- Cloudflare Worker 3개 엔드포인트 추가 (`worker-code.js`)
- `js/notion-partners.js` — 교회/선교사/기업 카드 동적 렌더링
- Notion DB IDs:
  - 교회&단체: `36820258888380188fe3c24f7a17a818`
  - 선교사: `368202588883805a91b8cb13197ac380`
  - 기업: `3682025888838026a2a2db6dd0be801b`

---

## 진입 URI 목록

| URL | 페이지 |
|-----|--------|
| `/` | 홈 (소개) |
| `/foundation.html` | 신학적 기초 |
| `/values.html` | 핵심 가치 |
| `/projects.html` | 주요 사역 |
| `/mission.html` | 단기선교 — 사역 + 편지함 |
| `/mission-status.html` | 단기선교 — 현황 (YouTube + 편지함) |
| `/support.html` | 후원 |
| `/contact.html` | 연락처·문의 |
| `/partners.html` | 협력단체 (교회/선교사/기업) |

---

## 기술 스택

- **Frontend**: HTML5 / CSS3 / Vanilla JavaScript
- **스타일**: 커스텀 CSS (CSS Variables 기반, `css/style.css`)
- **라이브러리**: AOS (scroll animation), Font Awesome 6, Google Fonts
- **Notion 연동**: Cloudflare Worker (`worker-code.js`) + `js/notion.js` / `js/notion-v4.js` / `js/notion-partners.js`
- **YouTube 연동**: YouTube Data API v3 + `js/youtube-playlist.js`
- **Worker URL**: `https://dark-pine-8ced.superddj00.workers.dev`
  - `GET /prayer` — 기도편지 DB 목록
  - `GET /thanks` — 감사편지 DB 목록
  - `GET /partners-church` — 협력 교회&단체 DB 목록
  - `GET /partners-missionary` — 협력 선교사 DB 목록
  - `GET /partners-company` — 협력 기업 DB 목록
  - `GET /blocks/:id` — 페이지 이미지 목록 (재귀 탐색)
  - `GET /img?url=` — AWS S3 이미지 CORS 프록시
  - `GET /youtube-playlist?pageToken=` — **YouTube 재생목록 프록시** (API 키 도메인 제한 우회)

---

## 파일 구조

```
index.html              홈 (소개 + Hero)
foundation.html         신학적 기초
projects.html           주요 사역 (5탭 + 닿길 TF)
values.html             핵심 가치
mission.html            단기선교 — 사역 + 편지함
mission-status.html     단기선교 — 현황 (YouTube API + 편지함)
support.html            후원
contact.html            연락처 + 문의 폼
partners.html           협력단체 (교회 / 선교사 / 기업)
sitemap.xml             검색엔진 사이트맵 (9개 URL)
worker-code.js          Cloudflare Worker 소스 [참고용 — 별도 배포 필요]
css/
  style.css             메인 스타일시트
js/
  main.js               공통 JS (navbar, 탭, ytModal, letterModal)
  notion.js             Notion 편지함 연동 (mission.html)
  notion-v4.js          Notion 편지함 연동 v4 (mission-status.html)
  notion-partners.js    Notion 협력단체 연동 (partners.html)
  youtube-playlist.js   YouTube Data API v3 재생목록 (mission-status.html)
images/
  logo.png              Pa'ar Mission 로고
  danggil-logo.png      닿길 TF 로고
```

---

## 미완료 / 개선 필요 사항

- [ ] **Cloudflare Worker 배포** — `worker-code.js`에 추가한 3개 엔드포인트(`/partners-church`, `/partners-missionary`, `/partners-company`) 실제 Worker에 배포 필요
- [ ] `support.html` 계좌 정보 실제 계좌로 업데이트
- [ ] `images/danggil-logo.png` 실제 이미지 업로드 (현재 fallback 아이콘)
- [x] ~~YouTube API 키 도메인 제한~~ → **Worker 프록시로 해결** (`www.paarmission.org` 포함 모든 도메인 정상 동작)
- [ ] `notion.js` 디버그 `console.log` 제거 (배포 전 정리 권장)

---

## 권장 다음 단계

1. **Worker 배포** (최우선): `worker-code.js`에 추가된 `queryPartnersDB()` 함수와 3개 라우트를 Cloudflare Worker에 배포
2. **Notion DB 채우기**: 협력 교회&단체 / 선교사 / 기업 DB에 데이터 입력 → `partners.html` 자동 반영
3. **계좌 정보**: `support.html`의 계좌 정보 업데이트
4. **Worker 로그 정리**: 운영 배포 전 `console.log` 정리
5. **배포**: Publish 탭에서 배포 → paarmission.org 반영

---

*© 2025 Pa'ar Mission. Isaiah 61:1–3*
