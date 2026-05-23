/* ============================================================
   Pa'ar Mission — Notion 편지함 연동 v3
   Worker URL: https://dark-pine-8ced.superddj00.workers.dev/
   ============================================================ */

const WORKER_URL = 'https://dark-pine-8ced.superddj00.workers.dev';

/* ── 유틸: Notion 속성 파싱 ─────────────────────────────── */
function getPropText(props, key) {
  const p = props[key];
  if (!p) return '';
  if (p.type === 'title')        return p.title.map(t => t.plain_text).join('');
  if (p.type === 'rich_text')    return p.rich_text.map(t => t.plain_text).join('');
  if (p.type === 'select')       return p.select?.name || '';
  if (p.type === 'multi_select') return p.multi_select.map(s => s.name).join(', ');
  if (p.type === 'date')         return p.date?.start || '';
  if (p.type === 'url')          return p.url || '';
  if (p.type === 'files') {
    const f = p.files?.[0];
    if (!f) return '';
    return f.type === 'external' ? f.external.url : f.file?.url || '';
  }
  return '';
}

/* ── 유틸: title 타입 속성 자동 탐색 ───────────────────── */
function getPageTitle(props) {
  for (const key of Object.keys(props)) {
    if (props[key].type === 'title') {
      return props[key].title.map(t => t.plain_text).join('');
    }
  }
  return '편지';
}

/* ── 유틸: 커버 이미지 URL ───────────────────────────────── */
function getCoverUrl(page) {
  const cover = page.cover;
  if (!cover) return null;
  if (cover.type === 'external') return cover.external.url;
  if (cover.type === 'file')     return cover.file.url;
  return null;
}

/* ── 유틸: 날짜 포맷 ─────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.getFullYear() + '. ' + (d.getMonth()+1) + '. ' + d.getDate();
  } catch(e) { return dateStr; }
}

/* ── 특수문자 이스케이프 ──────────────────────────────────── */
function _escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _escAttr(str) {
  return String(str).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}

/* ── 로딩 HTML ───────────────────────────────────────────── */
function loadingHTML() {
  return '<div class="notion-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>편지함을 불러오는 중...</span></div>';
}

/* ── 에러 HTML ───────────────────────────────────────────── */
function errorHTML() {
  return '<div class="notion-error"><i class="fa-solid fa-triangle-exclamation"></i><span>편지함을 불러오지 못했습니다.</span></div>';
}

/* ── 빈 상태 HTML ────────────────────────────────────────── */
function emptyHTML(type) {
  var tag   = type === 'prayer' ? '기도편지' : '감사편지';
  var title = type === 'prayer' ? '기도편지' : '감사편지 (결산보고)';
  var cls   = type === 'prayer' ? '' : 'letter-num-tag--thanks';
  return '<div class="letter-card letter-card--coming">'
    + '<div class="letter-card-thumb letter-card-thumb--empty">'
    + '<i class="fa-solid fa-envelope-open-text"></i><p>준비 중</p></div>'
    + '<div class="letter-card-body">'
    + '<span class="letter-num-tag ' + cls + '">' + tag + '</span>'
    + '<h4>' + title + '</h4>'
    + '<p class="letter-desc">편지가 아직 등록되지 않았습니다.</p>'
    + '<button class="btn-letter-view btn-letter-view--disabled" disabled>'
    + '<i class="fa-solid fa-clock"></i> 곧 업로드 예정</button>'
    + '</div></div>';
}

/* ── 편지 카드 HTML 생성 ──────────────────────────────────── */
function buildLetterCard(page, type, index) {
  var props    = page.properties;
  var title    = getPageTitle(props);
  var date     = getPropText(props, '날짜') || getPropText(props, 'Date') || getPropText(props, '기간') || '';
  var desc     = getPropText(props, '설명') || getPropText(props, 'Description') || getPropText(props, '내용') || '';
  var delay    = (index + 1) * 100;
  var tagClass = type === 'prayer' ? '' : 'letter-num-tag--thanks';
  var tagLabel = type === 'prayer' ? '기도편지' : '감사편지';
  var safeId   = _escAttr(page.id);
  var safeTitle= _escAttr(title);

  /* Worker v4: page._thumbnail (Worker가 미리 조회한 첫 이미지)
     없으면 페이지 커버, 없으면 플레이스홀더 */
  var rawThumb = page._thumbnail || null;
  var coverImg = getCoverUrl(page);
  var imgSrc   = null;

  if (rawThumb) {
    /* Worker 상대경로 → 절대 URL */
    imgSrc = rawThumb.indexOf('http') === 0
      ? rawThumb
      : WORKER_URL + rawThumb;
  } else if (coverImg) {
    imgSrc = coverImg;
  }

  var thumbHTML = imgSrc
    ? '<img src="' + imgSrc + '" alt="' + _escAttr(title) + ' 썸네일" loading="lazy" />'
    : '<div class="letter-thumb-placeholder"><i class="fa-solid fa-' + (type === 'prayer' ? 'hands-praying' : 'heart') + '"></i></div>';

  var dateHTML = date ? '<p class="letter-date"><i class="fa-regular fa-calendar"></i> ' + formatDate(date) + '</p>' : '';
  var descHTML = desc ? '<p class="letter-desc">' + _escHtml(desc) + '</p>' : '';

  return '<div class="letter-card" data-aos="fade-up" data-aos-delay="' + delay + '">'
    + '<div class="letter-card-thumb notion-letter-thumb" onclick="notionOpenModal(\'' + safeId + '\',\'' + safeTitle + '\')">'
    + thumbHTML
    + '<div class="letter-card-overlay"><i class="fa-solid fa-magnifying-glass-plus"></i><span>편지 보기</span></div>'
    + '</div>'
    + '<div class="letter-card-body">'
    + '<span class="letter-num-tag ' + tagClass + '">' + tagLabel + '</span>'
    + '<h4>' + _escHtml(title) + '</h4>'
    + dateHTML + descHTML
    + '<button class="btn-letter-view" onclick="notionOpenModal(\'' + safeId + '\',\'' + safeTitle + '\')">'
    + '<i class="fa-solid fa-book-open"></i> 펼쳐보기</button>'
    + '</div></div>';
}

/* ── DB 목록 렌더링 ──────────────────────────────────────── */
async function renderLetterGrid(gridEl, endpoint, type) {
  gridEl.innerHTML = loadingHTML();
  try {
    var res  = await fetch(WORKER_URL + endpoint);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data  = await res.json();
    var pages = data.results || [];
    console.log('[Notion] ' + endpoint + ' pages:', pages.length);

    if (!pages.length) {
      gridEl.innerHTML = emptyHTML(type);
      return;
    }

    /* Worker v4: _thumbnail이 이미 각 페이지에 포함되어 있음 — 바로 렌더 */
    gridEl.innerHTML = pages.map(function(p, i) {
      return buildLetterCard(p, type, i);
    }).join('');

    if (window.AOS) AOS.refresh();

  } catch(err) {
    console.error('[Notion]', err);
    gridEl.innerHTML = errorHTML();
  }
}

/* ============================================================
   Notion 모달 — 전역 상태 (main.js 와 충돌 없는 별도 네임스페이스)
   ============================================================ */
var _nm = { pages: [], current: 0 };

function _nmRenderImg() {
  var wrap = document.getElementById('letterModalImgWrap');
  var info = document.getElementById('letterPageInfo');
  var prev = document.getElementById('letterPrev');
  var next = document.getElementById('letterNext');
  if (!wrap || !_nm.pages.length) return;

  var p = _nm.pages[_nm.current];
  wrap.innerHTML = '<img id="letterModalImg" src="' + p.src + '" alt="' + _escAttr(p.caption) + '" />';

  if (info) info.textContent = (_nm.current + 1) + ' / ' + _nm.pages.length;
  var multi = _nm.pages.length > 1;
  if (prev) prev.style.visibility = multi ? 'visible' : 'hidden';
  if (next) next.style.visibility = multi ? 'visible' : 'hidden';
  // 핀치 줌 바인딩
  if (typeof _bindImgZoom === 'function') _bindImgZoom(wrap);
}

function _nmRenderThumbs() {
  var wrap = document.getElementById('letterThumbs');
  if (!wrap) return;
  wrap.innerHTML = _nm.pages.map(function(p, i) {
    return '<button class="letter-thumb' + (i === _nm.current ? ' active' : '')
      + '" onclick="_nmGoTo(' + i + ')" aria-label="' + _escAttr(p.caption) + '">'
      + '<img src="' + p.src + '" alt="' + _escAttr(p.caption) + '" loading="lazy" />'
      + '</button>';
  }).join('');
}

window._nmGoTo = function(i) {
  _nm.current = i;
  _nmRenderImg();
  _nmRenderThumbs();
};

/* changeLetterPage 는 main.js 에서도 쓰므로 오버라이드 */
window.changeLetterPage = function(dir) {
  if (!_nm.pages.length) return;
  _nm.current = (_nm.current + dir + _nm.pages.length) % _nm.pages.length;
  _nmRenderImg();
  _nmRenderThumbs();
};

/* ── Notion 모달 열기 ─────────────────────────────────────── */
window.notionOpenModal = async function(pageId, title) {
  var modal   = document.getElementById('letterModal');
  var titleEl = document.getElementById('letterModalTitle');
  var wrap    = document.getElementById('letterModalImgWrap');
  var info    = document.getElementById('letterPageInfo');
  var prev    = document.getElementById('letterPrev');
  var next    = document.getElementById('letterNext');
  var thumbs  = document.getElementById('letterThumbs');

  if (!modal) return;

  /* 초기화 & 모달 열기 */
  if (titleEl) titleEl.textContent = title || '편지 보기';
  if (wrap)    wrap.innerHTML = '<div class="notion-loading" style="padding:60px 0;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:#CFA742;"></i></div>';
  if (info)    info.textContent = '';
  if (thumbs)  thumbs.innerHTML = '';
  if (prev)    prev.style.visibility = 'hidden';
  if (next)    next.style.visibility = 'hidden';

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    /* Worker v2: /blocks/:id 가 커버+이미지 목록을 한번에 반환 */
    var blocksUrl = WORKER_URL + '/blocks/' + pageId;
    console.log('[Notion] fetch:', blocksUrl);
    var blocksRes = await fetch(blocksUrl).then(function(r){ return r.json(); });
    console.log('[Notion] blocksRes:', JSON.stringify(blocksRes).substring(0, 300));

    var images = [];

    /* 커버 이미지 (Worker가 cover 필드로 반환) */
    if (blocksRes.cover) {
      var coverSrc = blocksRes.cover.indexOf('http') === 0
        ? blocksRes.cover
        : WORKER_URL + blocksRes.cover;
      images.push({ src: coverSrc, caption: title || '표지' });
    }

    /* 이미지 블록 목록 — Worker가 /img?url=... 프록시 URL로 반환 */
    var imgBlocks = blocksRes.results || [];
    console.log('[Notion] imgBlocks count:', imgBlocks.length);
    imgBlocks.forEach(function(item) {
      if (item.src) {
        /* Worker 상대경로 → 절대 URL 변환 */
        var imgSrc = item.src.indexOf('http') === 0
          ? item.src
          : WORKER_URL + item.src;
        images.push({ src: imgSrc, caption: item.caption || title || '' });
      }
    });
    console.log('[Notion] images collected:', images.length);

    if (!images.length) {
      if (wrap) wrap.innerHTML = '<div class="notion-no-image">'
        + '<i class="fa-solid fa-file-lines fa-3x"></i>'
        + '<p>이미지가 없습니다.</p>'
        + '<a href="https://www.notion.so/' + pageId.replace(/-/g,'') + '" target="_blank" rel="noopener" class="btn btn-outline-dark" style="margin-top:12px;">'
        + '<i class="fa-solid fa-arrow-up-right-from-square"></i> Notion에서 열기</a>'
        + '</div>';
      return;
    }

    _nm.pages   = images;
    _nm.current = 0;
    _nmRenderImg();
    _nmRenderThumbs();

  } catch(err) {
    console.error('[Notion Modal]', err);
    if (wrap) wrap.innerHTML = '<div class="notion-error" style="padding:60px 20px;">'
      + '<i class="fa-solid fa-triangle-exclamation fa-2x"></i>'
      + '<p>내용을 불러오지 못했습니다.</p></div>';
  }
};

/* ── 초기화 ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  var prayerGrid = document.getElementById('notion-prayer-grid');
  var thanksGrid = document.getElementById('notion-thanks-grid');
  if (prayerGrid) renderLetterGrid(prayerGrid, '/prayer', 'prayer');
  if (thanksGrid) renderLetterGrid(thanksGrid, '/thanks', 'thanks');
});
