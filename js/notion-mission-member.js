/* ============================================================
   Pa'ar Mission — 단기선교 참석자 명단 Notion 연동
   Worker URL: https://dark-pine-8ced.superddj00.workers.dev/
   개인 후원자 아코디언과 동일한 UI 사용
   ============================================================ */

(function () {

  const WORKER = 'https://dark-pine-8ced.superddj00.workers.dev';

  /* ── 유틸 ──────────────────────────────────────────────── */
  function titleProp(props) {
    for (const k of Object.keys(props)) {
      if (props[k].type === 'title')
        return props[k].title.map(t => t.plain_text).join('');
    }
    return '';
  }

  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── 로딩 스켈레톤 ─────────────────────────────────────── */
  function skeleton() {
    return `
      <div class="person-skeleton">
        <div class="skeleton-line" style="width:40%;"></div>
        <div class="skeleton-line" style="width:55%;margin-top:10px;"></div>
        <div class="skeleton-line" style="width:35%;margin-top:10px;"></div>
      </div>`;
  }

  /* ── 에러 ──────────────────────────────────────────────── */
  function errorBlock() {
    return `<div class="partner-empty">
      <i class="fa-solid fa-circle-exclamation"></i>
      <p>정보를 불러오지 못했습니다. 잠시 후 새로고침 해주세요.</p>
    </div>`;
  }

  /* ── 아코디언 리스트 렌더 ──────────────────────────────── */
  function renderMemberList(listEl) {
    listEl.innerHTML = skeleton();

    fetch(WORKER + '/mission-member')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        const pages = data.results || [];

        if (!pages.length) {
          listEl.innerHTML = `<div class="partner-empty">
            <i class="fa-solid fa-users"></i>
            <p>등록된 참석자 명단이 없습니다.</p>
          </div>`;
          return;
        }

        listEl.innerHTML = pages.map(function (page, idx) {
          const name   = titleProp(page.properties);
          const pageId = page.id;
          const delay  = Math.min(idx * 60, 300);

          return `
            <div class="person-item person-item--accordion"
                 data-page-id="${esc(pageId)}"
                 data-aos="fade-up" data-aos-delay="${delay}">
              <button class="person-item-header" aria-expanded="false">
                <span class="person-item-icon person-item-icon--mission">
                  <i class="fa-solid fa-users"></i>
                </span>
                <span class="person-item-name">${esc(name)}</span>
                <span class="person-item-arrow"><i class="fa-solid fa-chevron-down"></i></span>
              </button>
              <div class="person-item-body" hidden>
                <div class="person-item-content">
                  <div class="person-item-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i> 불러오는 중...
                  </div>
                </div>
              </div>
            </div>`;
        }).join('');

        /* ── 아코디언 이벤트 ────────────────────────────── */
        listEl.querySelectorAll('.person-item-header').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const item    = btn.closest('.person-item--accordion');
            const body    = item.querySelector('.person-item-body');
            const content = item.querySelector('.person-item-content');
            const arrow   = btn.querySelector('.person-item-arrow i');
            const isOpen  = btn.getAttribute('aria-expanded') === 'true';

            if (isOpen) {
              /* 닫기 */
              btn.setAttribute('aria-expanded', 'false');
              body.hidden = true;
              arrow.className = 'fa-solid fa-chevron-down';
            } else {
              /* 열기 */
              btn.setAttribute('aria-expanded', 'true');
              body.hidden = false;
              arrow.className = 'fa-solid fa-chevron-up';

              /* 이미 로드된 경우 스킵 */
              if (content.dataset.loaded) return;
              content.dataset.loaded = 'true';

              const pageId = item.dataset.pageId;
              fetch(WORKER + '/mission-member-text/' + pageId.replace(/-/g, ''))
                .then(function (r) { return r.json(); })
                .then(function (d) {
                  const lines = d.lines || [];
                  if (!lines.length) {
                    content.innerHTML = '<p class="person-text-empty">내용이 없습니다.</p>';
                    return;
                  }
                  content.innerHTML = lines.map(function (line) {
                    if (line.type === 'heading_1') {
                      return `<h3 class="person-text-line person-text-h3">${esc(line.text)}</h3>`;
                    } else if (line.type === 'heading_2') {
                      return `<h4 class="person-text-line person-text-h4">${esc(line.text)}</h4>`;
                    } else if (line.type === 'heading_3') {
                      return `<h5 class="person-text-line person-text-h5">${esc(line.text)}</h5>`;
                    } else if (line.type === 'numbered_list_item') {
                      return `<p class="person-text-line person-text-numbered">${esc(line.index + '. ' + line.text)}</p>`;
                    } else {
                      /* paragraph, bulleted_list_item 등 → 텍스트 그대로 */
                      return `<p class="person-text-line">${esc(line.text)}</p>`;
                    }
                  }).join('');
                })
                .catch(function () {
                  content.innerHTML = '<p class="person-text-empty">내용을 불러오지 못했습니다.</p>';
                });
            }
          });
        });

        if (window.AOS) AOS.refresh();
      })
      .catch(function (err) {
        console.error('[MissionMember]', err);
        listEl.innerHTML = errorBlock();
      });
  }

  /* ── 초기화 ────────────────────────────────────────────── */
  function init() {
    const listEl = document.getElementById('mission-member-list');
    if (listEl) renderMemberList(listEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
