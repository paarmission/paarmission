/* ============================================================
   Pa'ar Mission — YouTube 재생목록 자동 로딩
   재생목록에 영상 추가 시 자동으로 사이트에 반영됩니다.

   ⚠️ YouTube API는 Cloudflare Worker를 통해 프록시 호출합니다.
      → www.paarmission.org / paarmission.org 모두 정상 동작
      → API 키 HTTP Referer 도메인 제한 우회
   ============================================================ */

(function () {
  // Worker 프록시 URL (도메인 무관하게 동작)
  const WORKER_URL  = 'https://paarmission.jonathanso.workers.dev';

  // ── 스핀오프 판별 함수 ──────────────────────────────────────
  // 제목에 "Spin" 또는 "spin" 또는 "스핀" 이 포함되면 스핀오프
  function isSpinoff(title) {
    return /spin\s*off|스핀/i.test(title);
  }

  // ── 썸네일 URL ─────────────────────────────────────────────
  function thumbUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  }

  // ── 에피소드 카드 HTML ──────────────────────────────────────
  function episodeCard(item) {
    const vid   = item.snippet.resourceId.videoId;
    const title = item.snippet.title;
    // 제목에서 "ep.N" 또는 "EP.N" 태그 추출
    const epMatch = title.match(/ep\.?\s*(\d+)/i);
    const tag     = epMatch ? `ep.${epMatch[1]}` : 'ep';
    return `
      <article class="sm-video-card" data-vid="${vid}" data-title="${title.replace(/"/g,'&quot;')}">
        <div class="sm-card-thumb">
          <img src="${thumbUrl(vid)}" alt="${tag} 썸네일" loading="lazy" />
          <div class="sm-card-play"><i class="fa-brands fa-youtube"></i></div>
        </div>
        <div class="sm-card-body">
          <span class="sm-ep-tag">${tag}</span>
          <p>${title}</p>
        </div>
      </article>`;
  }

  // ── 스핀오프 카드 HTML ──────────────────────────────────────
  function spinoffCard(item, idx) {
    const vid   = item.snippet.resourceId.videoId;
    const title = item.snippet.title;
    const tag   = `Spin Off ${idx + 1}`;
    return `
      <article class="sm-video-card" data-vid="${vid}" data-title="${title.replace(/"/g,'&quot;')}">
        <div class="sm-card-thumb">
          <img src="${thumbUrl(vid)}" alt="${tag} 썸네일" loading="lazy" />
          <div class="sm-card-play"><i class="fa-brands fa-youtube"></i></div>
        </div>
        <div class="sm-card-body">
          <span class="sm-ep-tag sm-ep-tag--spin">${tag}</span>
          <p>${title}</p>
        </div>
      </article>`;
  }

  // ── 로딩 스켈레톤 ──────────────────────────────────────────
  function showSkeleton(grid, count = 4) {
    grid.innerHTML = Array(count).fill(`
      <div class="sm-video-card" style="pointer-events:none;">
        <div class="sm-card-thumb" style="background:linear-gradient(90deg,#f0ede6 25%,#e8e4db 50%,#f0ede6 75%);background-size:200% 100%;animation:skeleton-shine 1.4s ease-in-out infinite;aspect-ratio:16/9;"></div>
        <div class="sm-card-body" style="padding:10px 12px 14px;">
          <div style="height:14px;width:40%;border-radius:7px;background:linear-gradient(90deg,#f0ede6 25%,#e8e4db 50%,#f0ede6 75%);background-size:200% 100%;animation:skeleton-shine 1.4s ease-in-out infinite;margin-bottom:8px;"></div>
          <div style="height:12px;width:85%;border-radius:6px;background:linear-gradient(90deg,#f0ede6 25%,#e8e4db 50%,#f0ede6 75%);background-size:200% 100%;animation:skeleton-shine 1.4s ease-in-out infinite;"></div>
        </div>
      </div>`).join('');
  }

  // ── 에러 메시지 ────────────────────────────────────────────
  function showError(grid, msg) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#888;font-size:.9rem;">
        <i class="fa-solid fa-circle-exclamation" style="font-size:2rem;color:#ccc;display:block;margin-bottom:12px;"></i>
        ${msg}
      </div>`;
  }

  // ── 전체 재생목록 가져오기 (Worker 프록시 경유, 페이지네이션 처리) ─
  async function fetchPlaylist() {
    let items = [], pageToken = '';
    do {
      // Cloudflare Worker를 통해 호출 → API 키 도메인 제한 우회
      const proxyUrl =
        `${WORKER_URL}/youtube-playlist` +
        (pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '');

      const res  = await fetch(proxyUrl);
      const data = await res.json();

      if (data.error) throw new Error(data.error.message);
      items     = items.concat(data.items || []);
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    return items;
  }

  // ── 탭 카운트 뱃지 업데이트 ────────────────────────────────
  function updateCount(selector, count) {
    const el = document.querySelector(selector);
    if (el) el.textContent = count;
  }

  // ── 메인 실행 ──────────────────────────────────────────────
  async function init() {
    const episodeGrid = document.getElementById('yt-episodes-grid');
    const spinoffGrid = document.getElementById('yt-spinoff-grid');
    if (!episodeGrid && !spinoffGrid) return; // 이 페이지에 그리드 없으면 중단

    // 스켈레톤 표시
    if (episodeGrid) showSkeleton(episodeGrid, 8);
    if (spinoffGrid) showSkeleton(spinoffGrid, 2);

    try {
      const items = await fetchPlaylist();

      // 에피소드 / 스핀오프 분류
      const episodes = items.filter(it => !isSpinoff(it.snippet.title));
      const spinoffs = items.filter(it =>  isSpinoff(it.snippet.title));

      // 에피소드 탭
      if (episodeGrid) {
        if (episodes.length === 0) {
          showError(episodeGrid, '등록된 에피소드가 없습니다.');
        } else {
          episodeGrid.innerHTML = episodes.map(episodeCard).join('');
          updateCount('.sm-vtab[data-vtab="episodes"] .vtab-count', episodes.length);
        }
      }

      // 스핀오프 탭
      if (spinoffGrid) {
        if (spinoffs.length === 0) {
          showError(spinoffGrid, '등록된 스핀오프가 없습니다.');
        } else {
          spinoffGrid.innerHTML = spinoffs.map((it, i) => spinoffCard(it, i)).join('');
          updateCount('.sm-vtab[data-vtab="spinoff"] .vtab-count', spinoffs.length);
        }
      }

      // 카드 클릭 이벤트 재바인딩 (동적 생성이므로)
      bindVideoCards();

    } catch (err) {
      console.error('[YouTube API]', err);
      const errMsg = '영상을 불러오는 중 오류가 발생했습니다.<br>잠시 후 새로고침 해주세요.';
      if (episodeGrid) showError(episodeGrid, errMsg);
      if (spinoffGrid) showError(spinoffGrid, errMsg);
    }
  }

  // ── 동적 카드에 클릭 이벤트 재바인딩 ──────────────────────
  function bindVideoCards() {
    // main.js의 openYtModal 함수가 로드된 후 사용
    document.querySelectorAll('.sm-video-card').forEach(card => {
      // 이미 바인딩 방지
      if (card.dataset.bound) return;
      card.dataset.bound = 'true';
      card.addEventListener('click', () => {
        const vid   = card.dataset.vid;
        const title = card.dataset.title;
        if (vid && typeof openYtModal === 'function') {
          openYtModal(vid, title);
        }
      });
    });
  }

  // DOM 준비 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
