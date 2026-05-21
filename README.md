# Pa'ar Mission (파아르미션) 웹사이트

이사야 61:1–3에 근거하여 회복·자유·영광의 복음을 땅 끝까지 전하는 선교 단체 **파아르미션(Pa'ar Mission)**의 공식 웹사이트입니다.

---

## 완성된 기능

### 멀티페이지 구조 (Phase 2 — 완료)
단일 `index.html`에서 7개 페이지로 분리 완료

| 페이지 | 파일 | 주요 내용 |
|--------|------|----------|
| 홈 (소개) | `index.html` | Hero + About + 페이지 바로가기 카드 |
| 신학적 기초 | `foundation.html` | 3대 기둥 (회복/자유/영광) + 5가지 핵심 원리 + 말씀 배너 |
| 주요 사업 | `projects.html` | 5탭 사업 소개 + 닿길 TF 섹션 |
| 핵심 가치 | `values.html` | 6대 핵심 가치 + 요약 배너 |
| 단기선교 | `mission.html` | 사역 소개 + 스케줄 + 영상 + **Notion 편지함 연동** |
| 후원 | `support.html` | 후원 방법 3가지 + 계좌 안내 + 투명성 약속 |
| 연락처 | `contact.html` | 문의 폼 + FAQ |

### Notion 편지함 연동 (Phase 1 — 완료)
- **기도편지** DB (`/prayer`) — Notion에서 동적 로드
- **감사편지** DB (`/thanks`) — Notion에서 동적 로드
- Cloudflare Worker 프록시 — AWS S3 CORS 이미지 프록시 포함
- 편지 모달 — 이미지 슬라이드 + 썸네일 네비게이션

---

## 진입 URI 목록

| URL | 페이지 |
|-----|--------|
| `/` | 홈 (소개) |
| `/foundation.html` | 신학적 기초 |
| `/projects.html` | 주요 사업 |
| `/values.html` | 핵심 가치 |
| `/mission.html` | 단기선교 + 편지함 |
| `/support.html` | 후원 |
| `/contact.html` | 연락처·문의 |

---

## 기술 스택

- **Frontend**: HTML5 / CSS3 / Vanilla JavaScript
- **스타일**: 커스텀 CSS (CSS Variables 기반, `css/style.css`)
- **라이브러리**: AOS (scroll animation), Font Awesome 6, Google Fonts
- **Notion 연동**: Cloudflare Worker (`worker-code.js`) + `js/notion.js`
- **Worker URL**: `https://dark-pine-8ced.superddj00.workers.dev`
  - `GET /prayer` — 기도편지 DB 목록
  - `GET /thanks` — 감사편지 DB 목록
  - `GET /blocks/:id` — 페이지 이미지 목록 (재귀 탐색)
  - `GET /img?url=` — AWS S3 이미지 CORS 프록시
- **데이터 저장**: Genspark Table API (`tables/inquiries` — 문의 폼)

---

## 파일 구조

```
index.html           홈 (소개 + Hero)
foundation.html      신학적 기초
projects.html        주요 사업 (5탭 + 닿길 TF)
values.html          핵심 가치
mission.html         단기선교 + 편지함 (notion.js 포함)
support.html         후원
contact.html         연락처 + 문의 폼
worker-code.js       Cloudflare Worker 소스 [참고용]
css/
  style.css          메인 스타일시트
js/
  main.js            공통 JS (navbar, 탭, ytModal, letterModal)
  notion.js          Notion 연동 v3
images/
  logo.png           Pa'ar Mission 로고
  danggil-logo.png   닿길 TF 로고
```

---

## 미완료 / 개선 필요 사항

- [ ] `notion.js` 디버그 `console.log` 제거 (배포 전 정리 권장)
- [ ] Cloudflare Worker v3 실제 배포 확인 필요
- [ ] `mission.html` 유튜브 영상 ID 실제 ID로 교체 (`VIDEO_ID_EP1` 등)
- [ ] `support.html` 계좌 정보 실제 계좌로 업데이트
- [ ] `images/danggil-logo.png` 실제 이미지 업로드 (현재 fallback 아이콘)
- [ ] OG 메타태그 (SNS 공유 미리보기) 추가 권장

---

## 권장 다음 단계

1. **유튜브 ID 교체**: `mission.html`에서 `VIDEO_ID_EP1~4`, `VIDEO_ID_SP1~2`를 실제 영상 ID로 수정
2. **계좌 정보**: `support.html`의 계좌 정보 업데이트
3. **notion.js 로그 제거**: 운영 배포 전 `console.log` 정리
4. **Worker 배포 확인**: `worker-code.js` 기반으로 Cloudflare에 최신 Worker 배포
5. **도메인 연결**: Publish 탭에서 배포 후 커스텀 도메인 연결

---

*© 2025 Pa'ar Mission. Isaiah 61:1–3*
