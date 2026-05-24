/* ============================================================
   Pa'ar Mission — Notion Notice (공지사항) v2
   - /notice Worker 엔드포인트에서 Notion DB 읽기
   - 정렬: 중요 → 공지사항 순, 같은 유형이면 최신 생성순
   - "중요" 공지 → 홈 팝업 (첫 번째 이미지 1:1 표시)
   - 게시판 → 전체 목록 (필터 없음)
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
      var aIsImportant = tagA === '중요' ? 0 : 1;
      var bIsImportant = tagB === '중요' ? 0 : 1;
      if (aIsImportant !== bIsImportant) return aIsImportant - bIsImportant;
      /* 같은 유형이면 최신순 (created_time 내림차순) */
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

  /* ── 페이지 첫 번째 이미지 URL 가져오기 (팝업용) ─────────── */
  function fetchFirstImage(pageId) {
    var cleanId = pageId.replace(/-/g, '');
    return fetch(WORKER_URL + '/blocks/' + cleanId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var images = data.results || [];
        if (images.length > 0) return images[0].src;
        return null;
      })
      .catch(function () { return null; });
  }

  /* ── 팝업 ("중요" 공지, 홈 전용) ────────────────────────────
     #notice-popup 이 있는 페이지에서만 동작                     */
  function initPopup(notices) {
    var popup = document.getElementById('notice-popup');
    if (!popup) return;

    /* 오늘 하루 숨기기 체크 */
    var today = new Date().toISOString().slice(0, 10);
    var hidden = localStorage.getItem('notice_hide_until');
    if (hidden && hidden >= today) return;

    /* "중요" 필터 */
    var important = notices.filter(function (n) {
      return prop(n, '공지구분') === '중요';
    });
    if (!important.length) return;

    /* 최신 1건 */
    var item    = important[0];
    var title   = prop(item, '이름') || prop(item, 'Name') || prop(item, '제목') || '공지';
    var content = prop(item, '내용') || prop(item, '본문') || '';
    var dateStr = formatDate(item.created_time);

    /* DOM 요소 */
    var titleEl   = popup.querySelector('.np-title');
    var contentEl = popup.querySelector('.np-content');
    var dateEl    = popup.querySelector('.np-date');
    var imgWrap   = popup.querySelector('.np-img-wrap');

    if (titleEl)   titleEl.textContent   = title;
    if (contentEl) contentEl.textContent = content;
    if (dateEl)    dateEl.textContent    = dateStr;

    /* 첫 번째 이미지 로드 → 1:1 박스에 표시 */
    if (imgWrap) {
      imgWrap.style.display = 'none'; /* 로드 전 숨김 */
      fetchFirstImage(item.id).then(function (src) {
        if (src) {
          var img = document.createElement('img');
          img.src = src;
          img.alt = title;
          img.className = 'np-img';
          imgWrap.appendChild(img);
          imgWrap.style.display = 'block';
        }
      });
    }

    /* 팝업 표시 */
    popup.classList.add('open');
    document.body.classList.add('popup-open');

    /* 닫기 버튼 */
    var closeBtn  = popup.querySelector('.np-close');
    var todayBtn  = popup.querySelector('.np-today-hide');
    var backdrop  = popup.querySelector('.np-backdrop');
    var moreBtn   = popup.querySelector('.np-more-btn');

    function closePopup() {
      popup.classList.remove('open');
      document.body.classList.remove('popup-open');
    }

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    if (todayBtn) {
      todayBtn.addEventListener('click', function () {
        localStorage.setItem('notice_hide_until', today);
        closePopup();
      });
    }
    if (backdrop) backdrop.addEventListener('click', closePopup);
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        window.location.href = 'notice.html';
      });
    }
  }

  /* ── 게시판 렌더 (notice.html 전용) ─────────────────────────
     #notice-list 가 있는 페이지에서만 동작
     필터 없음 — 전체 목록 표시 (중요 → 공지사항, 최신순)       */
  function renderBoard(notices) {
    var listEl = document.getElementById('notice-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!notices.length) {
      listEl.innerHTML =
        '<p class="notice-empty"><i class="fa-regular fa-bell-slash"></i> 등록된 공지사항이 없습니다.</p>';
      return;
    }

    /* 정렬 적용 */
    var sorted = sortNotices(notices);

    sorted.forEach(function (item, idx) {
      var title   = prop(item, '이름') || prop(item, 'Name') || prop(item, '제목') || '(제목 없음)';
      var content = prop(item, '내용') || prop(item, '본문') || '';
      var tag     = prop(item, '공지구분') || '공지사항';
      var dateStr = formatDate(item.created_time);
      var isImportant = tag === '중요';

      var card = document.createElement('article');
      card.className = 'notice-card' + (isImportant ? ' notice-card--important' : '');
      card.setAttribute('data-aos', 'fade-up');
      card.setAttribute('data-aos-delay', String(Math.min(idx * 60, 300)));

      card.innerHTML =
        '<div class="notice-card-head">' +
          '<span class="notice-tag ' + (isImportant ? 'notice-tag--important' : 'notice-tag--normal') + '">' +
            '<i class="fa-solid ' + (isImportant ? 'fa-circle-exclamation' : 'fa-circle-info') + '"></i> ' +
            _esc(tag) +
          '</span>' +
          '<time class="notice-date">' + dateStr + '</time>' +
        '</div>' +
        '<h3 class="notice-card-title">' + _esc(title) + '</h3>' +
        (content ? '<p class="notice-card-content">' + _esc(content) + '</p>' : '') +
        '<button class="notice-toggle" aria-expanded="false">' +
          '<span class="notice-toggle-text">자세히 보기</span>' +
          '<i class="fa-solid fa-chevron-down"></i>' +
        '</button>' +
        '<div class="notice-detail" hidden></div>';

      listEl.appendChild(card);

      /* 자세히 보기 토글 */
      var toggleBtn = card.querySelector('.notice-toggle');
      var detailEl  = card.querySelector('.notice-detail');
      var loaded    = false;

      toggleBtn.addEventListener('click', function () {
        var expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        if (!expanded) {
          toggleBtn.setAttribute('aria-expanded', 'true');
          toggleBtn.querySelector('.notice-toggle-text').textContent = '접기';
          toggleBtn.querySelector('i').style.transform = 'rotate(180deg)';
          detailEl.hidden = false;
          if (!loaded) {
            loaded = true;
            detailEl.innerHTML =
              '<p class="notice-detail-loading">' +
                '<i class="fa-solid fa-spinner fa-spin"></i> 불러오는 중...' +
              '</p>';
            loadBlocks(item.id, detailEl);
          }
        } else {
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.querySelector('.notice-toggle-text').textContent = '자세히 보기';
          toggleBtn.querySelector('i').style.transform = '';
          detailEl.hidden = true;
        }
      });

      /* 내용 없으면 토글 숨김 */
      if (!content) toggleBtn.style.display = 'none';
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
          pic.src     = img.src;
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
        /* 팝업은 원본 순서 그대로 (중요 최신 1건) */
        initPopup(notices);
        /* 게시판은 정렬 후 렌더 */
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
