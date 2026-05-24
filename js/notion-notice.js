/* ============================================================
   Pa'ar Mission — Notion Notice (공지사항) v4
   - /notice → withThumbnails 포함 (Worker가 _thumbnail 반환)
   - 팝업: _thumbnail 이미지 표시
   - 클릭(팝업 이미지·버튼 / 게시판 카드 전체) → 'URL' 속성값으로 이동
   - 게시판: 전체 목록 (중요 먼저 → 최신순)
   ============================================================ */

(function () {
  'use strict';

  var WORKER_URL = 'https://dark-pine-8ced.superddj00.workers.dev';

  /* ── 속성 파싱 헬퍼 ───────────────────────────────────────── */
  function prop(page, key) {
    var p = page.properties && page.properties[key];
    if (!p) return null;
    switch (p.type) {
      case 'title':
        return (p.title || []).map(function (r) { return r.plain_text; }).join('');
      case 'rich_text':
        return (p.rich_text || []).map(function (r) { return r.plain_text; }).join('');
      case 'select':
        return p.select ? p.select.name : null;
      case 'date':
        return p.date ? p.date.start : null;
      case 'url':
        /* URL 속성: 문자열 그대로 반환 */
        return p.url || null;
      case 'relation':
        /* 관계형: 첫 번째 연결 페이지 ID 반환 (하위 호환) */
        return (p.relation && p.relation.length > 0) ? p.relation[0].id : null;
      default:
        return null;
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  /* ── 정렬: 중요 먼저 → 같은 유형이면 최신 생성 시간 순 ───── */
  function sortNotices(notices) {
    return notices.slice().sort(function (a, b) {
      var tagA = prop(a, '공지구분') || '';
      var tagB = prop(b, '공지구분') || '';
      var aRank = tagA === '중요' ? 0 : 1;
      var bRank = tagB === '중요' ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      var tA = new Date(a.created_time || 0).getTime();
      var tB = new Date(b.created_time || 0).getTime();
      return tB - tA;
    });
  }

  /* ── Notion API 호출 ───────────────────────────────────────── */
  function fetchNotices() {
    return fetch(WORKER_URL + '/notice')
      .then(function (r) {
        if (!r.ok) throw new Error('Worker /notice 응답 오류: ' + r.status);
        return r.json();
      });
  }

  /* ── URL 속성 → 열기 대상 결정 ────────────────────────────
     'URL' 속성 문자열을 그대로 사용. 없으면 null 반환         */
  function resolveTargetUrl(item) {
    var url = prop(item, 'URL');
    if (url && url.length > 0) return url;
    return null;
  }

  /* ── 팝업 ("중요" 공지, 홈 전용) ────────────────────────────
     #notice-popup 이 있는 페이지에서만 동작
     - _thumbnail (Worker가 첨부한 프록시 이미지 URL) 사용
     - 클릭(이미지·버튼) → 'URL' 속성값으로 이동              */
  function initPopup(notices) {
    var popup = document.getElementById('notice-popup');
    if (!popup) return;

    /* 오늘 하루 숨기기 체크 */
    var today  = new Date().toISOString().slice(0, 10);
    var hidden = localStorage.getItem('notice_hide_until');
    if (hidden && hidden >= today) return;

    /* "중요" 필터 */
    var important = notices.filter(function (n) {
      return prop(n, '공지구분') === '중요';
    });
    if (!important.length) return;

    /* 최신 1건 (이미 sorted 되어 있지 않으므로 created_time 비교) */
    var item = important.reduce(function (prev, cur) {
      return new Date(cur.created_time) > new Date(prev.created_time) ? cur : prev;
    });

    var title   = prop(item, '이름') || prop(item, 'Name') || prop(item, '제목') || '공지';
    var content = prop(item, '내용') || prop(item, '본문') || '';
    var dateStr = formatDate(item.created_time);

    /* DOM 요소 */
    var titleEl   = popup.querySelector('.np-title');
    var contentEl = popup.querySelector('.np-content');
    var dateEl    = popup.querySelector('.np-date');
    var imgWrap   = popup.querySelector('.np-img-wrap');
    var moreBtn   = popup.querySelector('.np-more-btn');

    if (titleEl)   titleEl.textContent   = title;
    if (contentEl) contentEl.textContent = content;
    if (dateEl)    dateEl.textContent    = dateStr;

    /* ── 'URL' 속성 직접 사용 ─────────────────────────────── */
    var targetUrl = resolveTargetUrl(item);

    function openNotionPage() {
      if (targetUrl) {
        window.open(targetUrl, '_blank');
      } else {
        window.location.href = 'notice.html';
      }
    }

    /* ── 이미지: Worker가 _thumbnail 로 첨부한 프록시 URL 사용 ── */
    if (imgWrap) {
      var thumbSrc = item._thumbnail || null;
      if (thumbSrc) {
        var img = document.createElement('img');
        img.alt       = title;
        img.className = 'np-img';
        img.src = thumbSrc.indexOf('http') === 0
          ? thumbSrc
          : WORKER_URL + thumbSrc;
        img.onerror = function () { imgWrap.style.display = 'none'; };
        img.onload  = function () { imgWrap.style.display = 'block'; };
        imgWrap.innerHTML = '';
        imgWrap.appendChild(img);

        /* 이미지 클릭 → URL 속성값으로 이동 (버튼과 동일) */
        imgWrap.style.cursor = 'pointer';
        imgWrap.addEventListener('click', function () { openNotionPage(); });
      } else {
        imgWrap.style.display = 'none';
      }
    }

    /* ── "더 보기" 버튼 → 동일한 openNotionPage() 호출 ─────── */
    if (moreBtn) {
      moreBtn.addEventListener('click', function () { openNotionPage(); });
    }

    /* 팝업 표시 */
    popup.classList.add('open');
    document.body.classList.add('popup-open');

    /* 닫기 이벤트 */
    var closeBtn = popup.querySelector('.np-close');
    var todayBtn = popup.querySelector('.np-today-hide');
    var backdrop = popup.querySelector('.np-backdrop');

    function closePopup() {
      popup.classList.remove('open');
      document.body.classList.remove('popup-open');
    }

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    if (backdrop) backdrop.addEventListener('click', closePopup);
    if (todayBtn) {
      todayBtn.addEventListener('click', function () {
        localStorage.setItem('notice_hide_until', today);
        closePopup();
      });
    }
  }

  /* ── 게시판 렌더 (notice.html 전용) ─────────────────────────
     전체 목록, 필터 없음, 중요 먼저 → 최신순
     카드 = 공지구분 태그 + 제목 + 날짜 (썸네일 없음)
     카드 전체 클릭 → 'URL' 속성값으로 이동                   */
  function renderBoard(notices) {
    var listEl = document.getElementById('notice-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!notices.length) {
      listEl.innerHTML =
        '<p class="notice-empty"><i class="fa-regular fa-bell-slash"></i> 등록된 공지사항이 없습니다.</p>';
      return;
    }

    var sorted = sortNotices(notices);

    sorted.forEach(function (item, idx) {
      var title       = prop(item, '이름') || prop(item, 'Name') || prop(item, '제목') || '(제목 없음)';
      var tag         = prop(item, '공지구분') || '공지사항';
      var dateStr     = formatDate(item.created_time);
      var isImportant = tag === '중요';
      var targetUrl   = resolveTargetUrl(item);   /* 'URL' 속성 */

      /* 카드 전체가 클릭 가능한 링크 역할 → <article> + role="button" */
      var card = document.createElement('article');
      card.className = 'notice-card notice-card--row' +
        (isImportant ? ' notice-card--important' : '') +
        (targetUrl   ? ' notice-card--clickable' : '');
      card.setAttribute('data-aos', 'fade-up');
      card.setAttribute('data-aos-delay', String(Math.min(idx * 60, 300)));
      if (targetUrl) {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', title + ' 공지 — 자세히 보기');
      }

      card.innerHTML =
        '<div class="notice-card-body">' +
          '<div class="notice-card-head">' +
            '<span class="notice-tag ' + (isImportant ? 'notice-tag--important' : 'notice-tag--normal') + '">' +
              '<i class="fa-solid ' + (isImportant ? 'fa-circle-exclamation' : 'fa-circle-info') + '"></i> ' +
              _esc(tag) +
            '</span>' +
            '<time class="notice-date">' + dateStr + '</time>' +
          '</div>' +
          '<h3 class="notice-card-title">' + _esc(title) + '</h3>' +
        '</div>' +
        (targetUrl
          ? '<div class="notice-card-arrow"><i class="fa-solid fa-chevron-right"></i></div>'
          : '');

      listEl.appendChild(card);

      /* 카드 전체 클릭 → URL 속성값 열기 */
      if (targetUrl) {
        (function (url) {
          function openPage() { window.open(url, '_blank'); }
          card.addEventListener('click', openPage);
          card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPage(); }
          });
        })(targetUrl);
      }
    });

    if (typeof AOS !== 'undefined') AOS.refresh();
  }

  /* ── Notion 블록 상세 불러오기 ───────────────────────────── */
  function loadBlocks(pageId, containerEl) {
    var cleanId = pageId.replace(/-/g, '');
    fetch(WORKER_URL + '/blocks/' + cleanId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        containerEl.innerHTML = '';
        var images = data.results || [];
        if (!images.length) {
          containerEl.innerHTML =
            '<p class="notice-detail-empty">첨부 이미지가 없습니다.</p>';
          return;
        }
        images.forEach(function (img) {
          var figure = document.createElement('figure');
          figure.className = 'notice-img-figure';
          var pic = document.createElement('img');
          var src = img.src.indexOf('http') === 0 ? img.src : WORKER_URL + img.src;
          pic.src     = src;
          pic.alt     = img.caption || '공지 이미지';
          pic.loading = 'lazy';
          figure.appendChild(pic);
          if (img.caption) {
            var cap = document.createElement('figcaption');
            cap.textContent = img.caption;
            figure.appendChild(cap);
          }
          containerEl.appendChild(figure);
        });
      })
      .catch(function () {
        containerEl.innerHTML =
          '<p class="notice-detail-empty">내용을 불러오지 못했습니다.</p>';
      });
  }

  /* ── XSS 이스케이프 ──────────────────────────────────────── */
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  /* ── 스켈레톤 로딩 UI ────────────────────────────────────── */
  function showSkeleton() {
    var listEl = document.getElementById('notice-list');
    if (!listEl) return;
    var html = '';
    for (var i = 0; i < 3; i++) {
      html +=
        '<div class="notice-skeleton">' +
          '<div class="notice-sk-line notice-sk-short"></div>' +
          '<div class="notice-sk-line notice-sk-title"></div>' +
          '<div class="notice-sk-line notice-sk-body"></div>' +
        '</div>';
    }
    listEl.innerHTML = html;
  }

  /* ── 진입점 ─────────────────────────────────────────────── */
  function init() {
    showSkeleton();

    fetchNotices()
      .then(function (data) {
        var notices = data.results || [];
        initPopup(notices);
        renderBoard(notices);
      })
      .catch(function (err) {
        console.error('[notion-notice] 불러오기 실패:', err);
        var listEl = document.getElementById('notice-list');
        if (listEl) {
          listEl.innerHTML =
            '<p class="notice-empty">' +
              '<i class="fa-solid fa-triangle-exclamation"></i> ' +
              '공지사항을 불러오는 데 실패했습니다.' +
            '</p>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
