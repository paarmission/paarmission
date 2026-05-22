/* ============================================================
   Pa'ar Mission — 협력단체 Notion 연동
   Worker URL: https://dark-pine-8ced.superddj00.workers.dev/
   엔드포인트:
     /partners-church      → 협력 교회 & 단체
     /partners-missionary  → 협력 선교사
     /partners-company     → 협력 기업
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

  function escAttr(str) {
    return String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  }

  /* ── 썸네일 URL 결정 ────────────────────────────────────────
     우선순위: 1) Worker _thumbnail  2) cover  3) files 속성  4) null  */
  function resolveThumbnail(page, logoPropVal) {
    /* Worker가 내려준 첫 이미지 썸네일 */
    if (page._thumbnail) {
      return page._thumbnail.startsWith('http')
        ? page._thumbnail
        : WORKER + page._thumbnail;
    }
    /* Notion 커버 이미지 */
    const cover = page.cover;
    if (cover) {
      if (cover.type === 'external' && cover.external?.url) return cover.external.url;
      if (cover.type === 'file'     && cover.file?.url)     return cover.file.url;
    }
    /* 속성에서 파일/이미지 */
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

  /* ── 카드 클릭 핸들러 속성 ──────────────────────────────────
     notionOpenModal 은 notion-v4.js 에서 전역으로 노출됨           */
  function clickAttr(pageId, name) {
    return `onclick="if(window.notionOpenModal)notionOpenModal('${escAttr(pageId)}','${escAttr(name)}')"
            style="cursor:pointer;"`;
  }

  /* ── 교회/단체 카드 ─────────────────────────────────────────── */
  function churchCard(page, idx) {
    const p      = page.properties;
    const name   = titleProp(p);
    const region = prop(p, '지역') || prop(p, '국가') || prop(p, 'Region') || '';
    const type   = prop(p, '유형') || prop(p, '종류') || prop(p, 'Type') || '';
    const desc   = prop(p, '소개') || prop(p, '설명') || prop(p, 'Description') || '';
    const link   = prop(p, '링크') || prop(p, 'URL') || prop(p, 'Website') || '';
    const logoProp = prop(p, '로고') || prop(p, 'Logo') || '';
    const thumb  = resolveThumbnail(page, logoProp);
    const delay  = idx * 80;

    /* 썸네일 영역: 이미지 있으면 꽉 채움, 없으면 아이콘 */
    const thumbHtml = thumb
      ? `<div class="partner-card-thumb partner-card-thumb--img" ${clickAttr(page.id, name)}>
           <img src="${esc(thumb)}" alt="${esc(name)}" loading="lazy" />
           <div class="partner-card-overlay"><i class="fa-solid fa-magnifying-glass-plus"></i><span>내용 보기</span></div>
         </div>`
      : `<div class="partner-card-thumb" ${clickAttr(page.id, name)}>
           <div class="partner-logo-placeholder"><i class="fa-solid fa-church"></i></div>
           <div class="partner-card-overlay"><i class="fa-solid fa-magnifying-glass-plus"></i><span>내용 보기</span></div>
         </div>`;

    const tagHtml  = type   ? `<span class="partner-type-tag">${esc(type)}</span>` : '';
    const regHtml  = region ? `<span class="partner-region"><i class="fa-solid fa-location-dot"></i> ${esc(region)}</span>` : '';
    const descHtml = desc   ? `<p class="partner-desc">${esc(desc)}</p>` : '';
    const linkHtml = link
      ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="partner-link"
            onclick="event.stopPropagation()">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> 바로가기</a>`
      : '';

    return `
      <div class="partner-card" data-aos="fade-up" data-aos-delay="${delay}">
        ${thumbHtml}
        <div class="partner-card-body">
          ${tagHtml}
          <h4 class="partner-name">${esc(name)}</h4>
          ${regHtml}
          ${descHtml}
          ${linkHtml}
          <button class="partner-view-btn" ${clickAttr(page.id, name)}>
            <i class="fa-solid fa-book-open"></i> 내용 보기
          </button>
        </div>
      </div>`;
  }

  /* ── 선교사 카드 ───────────────────────────────────────────── */
  function missionaryCard(page, idx) {
    const p       = page.properties;
    const name    = titleProp(p);
    const field   = prop(p, '사역지') || prop(p, '지역') || prop(p, 'Field') || '';
    const org     = prop(p, '소속') || prop(p, '단체') || prop(p, 'Organization') || '';
    const desc    = prop(p, '소개') || prop(p, '설명') || prop(p, 'Description') || '';
    const photoProp = prop(p, '사진') || prop(p, 'Photo') || '';
    const thumb   = resolveThumbnail(page, photoProp);
    const delay   = idx * 80;

    /* 사진 영역 */
    const photoHtml = thumb
      ? `<div class="partner-card-photo" ${clickAttr(page.id, name)}>
           <img src="${esc(thumb)}" alt="${esc(name)}" loading="lazy" />
           <div class="partner-card-overlay"><i class="fa-solid fa-magnifying-glass-plus"></i><span>내용 보기</span></div>
         </div>`
      : `<div class="partner-card-photo partner-card-photo--empty" ${clickAttr(page.id, name)}>
           <div class="partner-logo-placeholder partner-logo-placeholder--person"><i class="fa-solid fa-user"></i></div>
           <div class="partner-card-overlay"><i class="fa-solid fa-magnifying-glass-plus"></i><span>내용 보기</span></div>
         </div>`;

    const fieldHtml = field ? `<span class="partner-region"><i class="fa-solid fa-globe"></i> ${esc(field)}</span>` : '';
    const orgHtml   = org   ? `<span class="partner-org"><i class="fa-solid fa-building"></i> ${esc(org)}</span>` : '';
    const descHtml  = desc  ? `<p class="partner-desc">${esc(desc)}</p>` : '';

    return `
      <div class="partner-card partner-card--person" data-aos="fade-up" data-aos-delay="${delay}">
        ${photoHtml}
        <div class="partner-card-body">
          <h4 class="partner-name">${esc(name)}</h4>
          ${fieldHtml}
          ${orgHtml}
          ${descHtml}
          <button class="partner-view-btn" ${clickAttr(page.id, name)}>
            <i class="fa-solid fa-book-open"></i> 내용 보기
          </button>
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
    const logoProp = prop(p, '로고') || prop(p, 'Logo') || '';
    const thumb  = resolveThumbnail(page, logoProp);
    const delay  = idx * 80;

    const thumbHtml = thumb
      ? `<div class="partner-card-thumb partner-card-thumb--img" ${clickAttr(page.id, name)}>
           <img src="${esc(thumb)}" alt="${esc(name)}" loading="lazy" />
           <div class="partner-card-overlay"><i class="fa-solid fa-magnifying-glass-plus"></i><span>내용 보기</span></div>
         </div>`
      : `<div class="partner-card-thumb" ${clickAttr(page.id, name)}>
           <div class="partner-logo-placeholder"><i class="fa-solid fa-building-columns"></i></div>
           <div class="partner-card-overlay"><i class="fa-solid fa-magnifying-glass-plus"></i><span>내용 보기</span></div>
         </div>`;

    const secHtml  = sector ? `<span class="partner-type-tag partner-type-tag--company">${esc(sector)}</span>` : '';
    const descHtml = desc   ? `<p class="partner-desc">${esc(desc)}</p>` : '';
    const linkHtml = link
      ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="partner-link"
            onclick="event.stopPropagation()">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> 바로가기</a>`
      : '';

    return `
      <div class="partner-card" data-aos="fade-up" data-aos-delay="${delay}">
        ${thumbHtml}
        <div class="partner-card-body">
          ${secHtml}
          <h4 class="partner-name">${esc(name)}</h4>
          ${descHtml}
          ${linkHtml}
          <button class="partner-view-btn" ${clickAttr(page.id, name)}>
            <i class="fa-solid fa-book-open"></i> 내용 보기
          </button>
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
