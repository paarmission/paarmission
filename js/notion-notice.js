/* ============================================================
   Pa'ar Mission — Notion Notice (공지사항) v3
   - /notice → withThumbnails 포함 (Worker가 _thumbnail 반환)
   - 팝업: _thumbnail 이미지 1:1 표시
   - "공지사항 더 보기" → 관계형 '페이지' 속성에 연결된 Notion 페이지로 이동
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
      case 'relation':
        /* 관계형: 첫 번째 연결 페이지 ID 반환 */
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

  /* ── 관계형 페이지 ID → Notion 페이지 URL 변환 ────────────
     Worker /page/:id 를 통해 페이지 URL 가져오기             */
  function getNotionPageUrl(pageId) {
    if (!pageId) return Promise.resolve(null);
    var cleanId = pageId.replace(/-/g, '');
    return fetch(WORKER_URL + '/page/' + cleanId)
      .then(function (r) { return r.json(); })
      .then(function (pg) {
        /* Notion 페이지 URL: https://notion.so/{id without dashes} */
        if (pg && pg.url) return pg.url;
        /* fallback */
        return 'https://www.notion.so/' + cleanId;
      })
      .catch(function () {
        return 'https://www.notion.so/' + cleanId;
      });
  }

  /* ── 팝업 ("중요" 공지, 홈 전용) ────────────────────────────
     #notice-popup 이 있는 페이지에서만 동작
     - _thumbnail (Worker가 첨부한 프록시 이미지 URL) 사용
     - "더 보기" 클릭 → 관계형 '페이지' 속성의 Notion 페이지로 이동 */
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

    /* ── 관계형 '페이지' URL 미리 fetch (버튼 + 이미지 공용) ─── */
    var relatedPageId = prop(item, '페이지');
    var _notionUrl    = null;   /* fetch 완료 후 채워짐 */

    function openNotionPage() {
      var target = _notionUrl
        || (relatedPageId ? 'https://www.notion.so/' + relatedPageId.replace(/-/g, '') : 'notice.html');
      if (relatedPageId) {
        window.open(target, '_blank');
      } else {
        window.location.href = target;
      }
    }

    if (relatedPageId) {
      getNotionPageUrl(relatedPageId).then(function (url) {
        _notionUrl = url;
      });
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

        /* 이미지 클릭 → Notion 페이지로 이동 (버튼과 동일) */
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
     전체 목록, 필터 없음, 중요 먼저 → 최신순               */
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
      var title   = prop(item, '이름') || prop(item, 'Name') || prop(item, '제목') || '(제목 없음)';
      var content = prop(item, '내용') || prop(item, '본문') || '';
      var tag     = prop(item, '공지구분') || '공지사항';
      var dateStr = formatDate(item.created_time);
      var isImportant    = tag === '중요';
      var relatedPageId  = prop(item, '페이지');

      var card = document.createElement('article');
      card.className = 'notice-card' + (isImportant ? ' notice-card--important' : '');
      card.setAttribute('data-aos', 'fade-up');
      card.setAttribute('data-aos-delay', String(Math.min(idx * 60, 300)));

      /* 썸네일 (있으면 표시) */
      var thumbSrc = item._thumbnail || null;
      var thumbHtml = '';
      if (thumbSrc) {
        var fullSrc = thumbSrc.indexOf('http') === 0 ? thumbSrc : WORKER_URL + thumbSrc;
        thumbHtml =
          '<div class="notice-card-thumb">' +
            '<img src="' + fullSrc + '" alt="' + _esc(title) + '" loading="lazy" />' +
          '</div>';
      }

      /* 관계형 페이지 링크 버튼 */
      var pageBtn = relatedPageId
        ? '<a class="notice-page-btn" data-page-id="' + relatedPageId + '" href="#" target="_blank">' +
            '<i class="fa-solid fa-arrow-up-right-from-square"></i> 관련 페이지 보기' +
          '</a>'
        : '';

      card.innerHTML =
        thumbHtml +
        '<div class="notice-card-body">' +
          '<div class="notice-card-head">' +
            '<span class="notice-tag ' + (isImportant ? 'notice-tag--important' : 'notice-tag--normal') + '">' +
              '<i class="fa-solid ' + (isImportant ? 'fa-circle-exclamation' : 'fa-circle-info') + '"></i> ' +
              _esc(tag) +
            '</span>' +
            '<time class="notice-date">' + dateStr + '</time>' +
          '</div>' +
          '<h3 class="notice-card-title">' + _esc(title) + '</h3>' +
          (content ? '<p class="notice-card-content">' + _esc(content) + '</p>' : '') +
          '<div class="notice-card-actions">' +
            (content
              ? '<button class="notice-toggle" aria-expanded="false">' +
                  '<span class="notice-toggle-text">이미지 보기</span>' +
                  '<i class="fa-solid fa-chevron-down"></i>' +
                '</button>'
              : '') +
            pageBtn +
          '</div>' +
          '<div class="notice-detail" hidden></div>' +
        '</div>';

      listEl.appendChild(card);

      /* 관계형 페이지 링크 href 동적 설정 */
      if (relatedPageId) {
        var pageLink = card.querySelector('.notice-page-btn');
        if (pageLink) {
          getNotionPageUrl(relatedPageId).then(function (url) {
            pageLink.href = url;
          });
        }
      }

      /* 이미지 보기 토글 */
      var toggleBtn = card.querySelector('.notice-toggle');
      var detailEl  = card.querySelector('.notice-detail');
      if (toggleBtn && detailEl) {
        var loaded = false;
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
            toggleBtn.querySelector('.notice-toggle-text').textContent = '이미지 보기';
            toggleBtn.querySelector('i').style.transform = '';
            detailEl.hidden = true;
          }
        });
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
