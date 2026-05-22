/* ============================================================
   Pa'ar Mission — 협력단체 Notion 연동
   Worker URL: https://dark-pine-8ced.superddj00.workers.dev/
   클릭 시 → Notion 페이지 새 탭으로 열기
   ============================================================ */

(function () {

  const WORKER = 'https://dark-pine-8ced.superddj00.workers.dev';

  /* ── 유틸: Notion 속성 파싱 ───────────────────────────────── */
  function prop(props, key) {
    const p = props[key];
    if (!p) return '';
    if (p.type === 'title')        return p.title.map(t => t.plain_text).join('');
    if (p.type === 'rich_text')    return p.rich_text.map(t => t.plain_text).join('');
    if (p.type === 'select')       return p.select?.name || '';
    if (p.type === 'multi_select') return p.multi_select.map(s => s.name).join(' · ');
    if (p.type === 'url')          return p.url || '';
    if (p.type === 'email')        return p.email || '';
    if (p.type === 'phone_number') return p.phone_number || '';
    if (p.type === 'files') {
      const f = p.files?.[0];
      if (!f) return '';
      return f.type === 'external' ? f.external.url : f.file?.url || '';
    }
    return '';
  }

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

  /* ── Notion 페이지 URL 생성 ─────────────────────────────────
     page.url 이 있으면 그대로, 없으면 ID로 조합                  */
  function notionUrl(page) {
    if (page.url) return page.url;
    const id = page.id.replace(/-/g, '');
    return 'https://www.notion.so/' + id;
  }

  /* ── 썸네일 URL 결정 ────────────────────────────────────────
     우선순위: 1) Worker _thumbnail  2) cover  3) files 속성      */
  function resolveThumbnail(page, logoPropVal) {
    if (page._thumbnail) {
      return page._thumbnail.startsWith('http')
        ? page._thumbnail
        : WORKER + page._thumbnail;
    }
    const cover = page.cover;
    if (cover) {
      if (cover.type === 'external' && cover.external?.url) return cover.external.url;
      if (cover.type === 'file'     && cover.file?.url)     return cover.file.url;
    }
    if (logoPropVal) return logoPropVal;
    return null;
  }

  /* ── 로딩 스켈레톤 ─────────────────────────────────────────── */
  function skeletonCards(count) {
    return Array(count).fill(`
      <div class="partner-card partner-card--skeleton">
        <div class="partner-card-logo skeleton-box"></div>
        <div class="partner-card-body">
          <div class="skeleton-line" style="width:60%;"></div>
          <div class="skeleton-line short" style="width:40%;margin-top:8px;"></div>
        </div>
      </div>`).join('');
  }

  /* ── 에러 / 빈 상태 ─────────────────────────────────────────── */
  function errorCard() {
    return `<div class="partner-empty">
      <i class="fa-solid fa-circle-exclamation"></i>
      <p>정보를 불러오지 못했습니다. 잠시 후 새로고침 해주세요.</p>
    </div>`;
  }

  function emptyCard(label) {
    return `<div class="partner-empty">
      <i class="fa-solid fa-handshake"></i>
      <p>등록된 ${label}이(가) 없습니다.</p>
    </div>`;
  }

  /* ── 썸네일 영역 HTML ───────────────────────────────────────── */
  function thumbHtml(thumb, placeholderIcon, url) {
    const inner = thumb
      ? `<img src="${esc(thumb)}" loading="lazy" />`
      : `<div class="partner-logo-placeholder"><i class="fa-solid fa-${placeholderIcon}"></i></div>`;
    return `
      <a class="partner-card-thumb${thumb ? ' partner-card-thumb--img' : ''}"
         href="${esc(url)}" target="_blank" rel="noopener noreferrer"
         aria-label="Notion 페이지 열기">
        ${inner}
        <div class="partner-card-overlay">
          <i class="fa-brands fa-notion" style="font-size:1.6rem;"></i>
          <span>Notion에서 보기</span>
        </div>
      </a>`;
  }

  /* ── 교회/단체 카드 ─────────────────────────────────────────── */
  function churchCard(page, idx) {
    const p      = page.properties;
    const name   = titleProp(p);
    const region = prop(p, '지역') || prop(p, '국가') || prop(p, 'Region') || '';
    const type   = prop(p, '유형') || prop(p, '종류') || prop(p, 'Type') || '';
    const desc   = prop(p, '소개') || prop(p, '설명') || prop(p, 'Description') || '';
    const link   = prop(p, '링크') || prop(p, 'URL') || prop(p, 'Website') || '';
    const thumb  = resolveThumbnail(page, prop(p, '로고') || prop(p, 'Logo') || '');
    const nUrl   = notionUrl(page);
    const delay  = idx * 80;

    const tagHtml  = type   ? `<span class="partner-type-tag">${esc(type)}</span>` : '';
    const regHtml  = region ? `<span class="partner-region"><i class="fa-solid fa-location-dot"></i> ${esc(region)}</span>` : '';
    const descHtml = desc   ? `<p class="partner-desc">${esc(desc)}</p>` : '';
    const linkHtml = link
      ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="partner-link" onclick="event.stopPropagation()">
           <i class="fa-solid fa-arrow-up-right-from-square"></i> 웹사이트
         </a>`
      : '';

    return `
      <div class="partner-card" data-aos="fade-up" data-aos-delay="${delay}">
        ${thumbHtml(thumb, 'church', nUrl)}
        <div class="partner-card-body">
          ${tagHtml}
          <h4 class="partner-name">${esc(name)}</h4>
          ${regHtml}
          ${descHtml}
          <div class="partner-card-actions">
            ${linkHtml}
            <a href="${esc(nUrl)}" target="_blank" rel="noopener" class="partner-view-btn">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> 자세히 보기
            </a>
          </div>
        </div>
      </div>`;
  }

  /* ── 선교사 카드 ───────────────────────────────────────────── */
  function missionaryCard(page, idx) {
    const p      = page.properties;
    const name   = titleProp(p);
    const field  = prop(p, '사역지') || prop(p, '지역') || prop(p, 'Field') || '';
    const org    = prop(p, '소속') || prop(p, '단체') || prop(p, 'Organization') || '';
    const desc   = prop(p, '소개') || prop(p, '설명') || prop(p, 'Description') || '';
    const thumb  = resolveThumbnail(page, prop(p, '사진') || prop(p, 'Photo') || '');
    const nUrl   = notionUrl(page);
    const delay  = idx * 80;

    const fieldHtml = field ? `<span class="partner-region"><i class="fa-solid fa-globe"></i> ${esc(field)}</span>` : '';
    const orgHtml   = org   ? `<span class="partner-org"><i class="fa-solid fa-building"></i> ${esc(org)}</span>` : '';
    const descHtml  = desc  ? `<p class="partner-desc">${esc(desc)}</p>` : '';

    return `
      <div class="partner-card partner-card--person" data-aos="fade-up" data-aos-delay="${delay}">
        ${thumbHtml(thumb, 'user', nUrl)}
        <div class="partner-card-body">
          <h4 class="partner-name">${esc(name)}</h4>
          ${fieldHtml}
          ${orgHtml}
          ${descHtml}
          <div class="partner-card-actions">
            <a href="${esc(nUrl)}" target="_blank" rel="noopener" class="partner-view-btn">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> 자세히 보기
            </a>
          </div>
        </div>
      </div>`;
  }

  /* ── 기업 카드 ─────────────────────────────────────────────── */
  function companyCard(page, idx) {
    const p      = page.properties;
    const name   = titleProp(p);
    const sector = prop(p, '업종') || prop(p, '분야') || prop(p, 'Sector') || '';
    const desc   = prop(p, '소개') || prop(p, '설명') || prop(p, 'Description') || '';
    const link   = prop(p, '링크') || prop(p, 'URL') || prop(p, 'Website') || '';
    const thumb  = resolveThumbnail(page, prop(p, '로고') || prop(p, 'Logo') || '');
    const nUrl   = notionUrl(page);
    const delay  = idx * 80;

    const secHtml  = sector ? `<span class="partner-type-tag partner-type-tag--company">${esc(sector)}</span>` : '';
    const descHtml = desc   ? `<p class="partner-desc">${esc(desc)}</p>` : '';
    const linkHtml = link
      ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="partner-link" onclick="event.stopPropagation()">
           <i class="fa-solid fa-arrow-up-right-from-square"></i> 웹사이트
         </a>`
      : '';

    return `
      <div class="partner-card" data-aos="fade-up" data-aos-delay="${delay}">
        ${thumbHtml(thumb, 'building-columns', nUrl)}
        <div class="partner-card-body">
          ${secHtml}
          <h4 class="partner-name">${esc(name)}</h4>
          ${descHtml}
          <div class="partner-card-actions">
            ${linkHtml}
            <a href="${esc(nUrl)}" target="_blank" rel="noopener" class="partner-view-btn">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> 자세히 보기
            </a>
          </div>
        </div>
      </div>`;
  }

  /* ── 그리드 렌더링 ─────────────────────────────────────────── */
  async function renderGrid(gridEl, endpoint, cardFn, emptyLabel) {
    gridEl.innerHTML = skeletonCards(4);
    try {
      const res   = await fetch(WORKER + endpoint);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data  = await res.json();
      const pages = data.results || [];
      console.log('[Partners]', endpoint, pages.length);

      if (!pages.length) {
        gridEl.innerHTML = emptyCard(emptyLabel);
        return;
      }
      gridEl.innerHTML = pages.map((p, i) => cardFn(p, i)).join('');
      if (window.AOS) AOS.refresh();

    } catch (err) {
      console.error('[Partners]', err);
      gridEl.innerHTML = errorCard();
    }
  }

  /* ── 초기화 ────────────────────────────────────────────────── */
  function init() {
    const churchGrid     = document.getElementById('partners-church-grid');
    const missionaryGrid = document.getElementById('partners-missionary-grid');
    const companyGrid    = document.getElementById('partners-company-grid');

    if (churchGrid)     renderGrid(churchGrid,     '/partners-church',     churchCard,     '협력 교회 & 단체');
    if (missionaryGrid) renderGrid(missionaryGrid, '/partners-missionary', missionaryCard, '협력 선교사');
    if (companyGrid)    renderGrid(companyGrid,    '/partners-company',    companyCard,    '협력 기업');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
