/**
 * Pa'ar Mission — Cloudflare Worker v4
 * Notion API 프록시 (CORS 해결 + 이미지 프록시)
 * ※ Service Worker 문법 (addEventListener 방식)
 */

var NOTION_API_KEY  = 'ntn_k86292911399zdoKzaCOSKhB2TKGlHKc3izS6mRDc4Z8PK';
var NOTION_VERSION  = '2022-06-28';
var YT_API_KEY      = 'AIzaSyBywI91_H6xejYjNX002Dr6cvHnFyIHPOk';
var YT_PLAYLIST_ID  = 'PLv-gSMPr9CVVq8qxZLXBPC2Obdp9Jzu9-';

var DB_PRAYER      = '36520258888380f49454ffa1be6f9701';
var DB_THANKS      = '3652025888838074bd91f1ea74de92f9';
var DB_CHURCH      = '36820258888380188fe3c24f7a17a818';
var DB_MISSIONARY  = '368202588883805a91b8cb13197ac380';
var DB_COMPANY     = '3682025888838026a2a2db6dd0be801b';
var DB_NOTICE      = '36a202588883806f931ddc746d633b1e';  /* Pa'ar Notice DB ID */

var CORS_HEADERS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type'                : 'application/json; charset=utf-8',
  'Cache-Control'               : 'no-cache, no-store, must-revalidate',
};
var CORS_IMG_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control'              : 'no-cache, no-store, must-revalidate',
};

/* ── Notion API 헬퍼 ─────────────────────────────────────── */
function nGet(endpoint) {
  return fetch('https://api.notion.com/v1' + endpoint, {
    headers: {
      'Authorization' : 'Bearer ' + NOTION_API_KEY,
      'Notion-Version': NOTION_VERSION,
    },
  }).then(function(r){ return r.json(); });
}

function nPost(endpoint, body) {
  return fetch('https://api.notion.com/v1' + endpoint, {
    method : 'POST',
    headers: {
      'Authorization' : 'Bearer ' + NOTION_API_KEY,
      'Notion-Version': NOTION_VERSION,
      'Content-Type'  : 'application/json',
    },
    body: JSON.stringify(body),
  }).then(function(r){ return r.json(); });
}

/* ── DB 쿼리 ─────────────────────────────────────────────── */
function queryDB(dbId) {
  return nPost('/databases/' + dbId + '/query', {
    sorts: [{ property: '날짜', direction: 'descending' }],
  });
}

function queryPartnersDB(dbId) {
  return nPost('/databases/' + dbId + '/query', {
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
}

function getBlocks(id) { return nGet('/blocks/' + id + '/children'); }
function getPage(id)   { return nGet('/pages/' + id); }

/* ── 첫 번째 이미지 추출 (썸네일용) ─────────────────────── */
/* 우선순위: 1) 페이지 커버  2) 본문 첫 번째 image 블록      */
function getFirstImage(pageId) {
  /* 페이지 정보에서 커버 이미지 먼저 확인 */
  return getPage(pageId).then(function(pg) {
    if (pg && pg.cover) {
      var c = pg.cover;
      var coverSrc = c.type === 'external'
        ? (c.external && c.external.url)
        : (c.file    && c.file.url);
      if (coverSrc) return '/img?url=' + encodeURIComponent(coverSrc);
    }
    /* 커버 없으면 본문 블록에서 첫 번째 이미지 탐색 */
    return getBlocks(pageId).then(function(data) {
      var blocks = data.results || [];
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        if (b.type === 'image') {
          var src = null;
          if (b.image.type === 'external') src = b.image.external && b.image.external.url;
          else if (b.image.type === 'file') src = b.image.file    && b.image.file.url;
          if (src) return '/img?url=' + encodeURIComponent(src);
        }
      }
      return null;
    });
  }).catch(function(){ return null; });
}

/* ── 이미지 수집 (재귀, 모달용) ─────────────────────────── */
function collectImages(blockId, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 3) return Promise.resolve([]);

  return getBlocks(blockId).then(function(data) {
    var blocks  = data.results || [];
    var images  = [];
    var promise = Promise.resolve();

    blocks.forEach(function(b) {
      promise = promise.then(function() {
        if (b.type === 'image') {
          var src = null;
          if (b.image.type === 'external') src = b.image.external && b.image.external.url;
          else if (b.image.type === 'file') src = b.image.file && b.image.file.url;
          var cap = (b.image.caption || []).map(function(c){ return c.plain_text; }).join('');
          if (src) images.push({ src: '/img?url=' + encodeURIComponent(src), caption: cap });
        } else if (b.type === 'child_page') {
          return collectImages(b.id, depth + 1).then(function(ch){ ch.forEach(function(x){ images.push(x); }); });
        } else if (b.has_children && depth < 2) {
          return collectImages(b.id, depth + 1).then(function(ch){ ch.forEach(function(x){ images.push(x); }); });
        }
      });
    });

    return promise.then(function(){ return images; });
  });
}

/* ── 썸네일 병렬 첨부 ────────────────────────────────────── */
/* _thumbnail = /thumb/{pageId} 형태로 저장                   */
/* 브라우저가 실제로 이미지를 요청할 때 Worker가 실시간으로    */
/* Notion에서 최신 URL을 받아 프록시하므로 만료 문제 없음      */
function withThumbnails(data) {
  var pages = data.results || [];
  pages.forEach(function(p) {
    p._thumbnail = '/thumb/' + p.id;
  });
  return Promise.resolve(data);
}

/* ── Worker 이벤트 리스너 ────────────────────────────────── */
addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

function handleRequest(request) {
  var url  = new URL(request.url);
  var path = url.pathname;

  /* Preflight */
  if (request.method === 'OPTIONS') {
    return Promise.resolve(new Response(null, { status: 204, headers: CORS_HEADERS }));
  }

  /* 이미지 프록시 (URL 직접 전달) */
  if (path === '/img') {
    var imgUrl = url.searchParams.get('url');
    if (!imgUrl) return Promise.resolve(new Response('missing url', { status: 400 }));
    return fetch(imgUrl).then(function(imgRes) {
      var ct = imgRes.headers.get('content-type') || 'image/jpeg';
      var h  = Object.assign({}, CORS_IMG_HEADERS, { 'Content-Type': ct });
      return new Response(imgRes.body, { status: imgRes.status, headers: h });
    });
  }

  /* 썸네일 프록시 (pageId 기반, 항상 최신 이미지) */
  /* /thumb/{pageId} → 실시간으로 Notion에서 첫 이미지 URL 조회 후 프록시 */
  if (path.indexOf('/thumb/') === 0) {
    var thumbPageId = path.slice(7);
    if (!thumbPageId) return Promise.resolve(new Response('missing pageId', { status: 400 }));
    return getFirstImage(thumbPageId).then(function(imgPath) {
      if (!imgPath) {
        return new Response('no image', { status: 404, headers: CORS_IMG_HEADERS });
      }
      /* imgPath = '/img?url=...' 형태이므로 실제 URL 추출 */
      var actualUrl = decodeURIComponent(imgPath.replace('/img?url=', ''));
      return fetch(actualUrl).then(function(imgRes) {
        var ct = imgRes.headers.get('content-type') || 'image/jpeg';
        var h  = Object.assign({}, CORS_IMG_HEADERS, { 'Content-Type': ct });
        return new Response(imgRes.body, { status: imgRes.status, headers: h });
      });
    }).catch(function() {
      return new Response('error', { status: 500, headers: CORS_IMG_HEADERS });
    });
  }

  /* YouTube 재생목록 프록시
     /youtube-playlist?pageToken=... (선택)
     브라우저 직접 호출 시 API 키 도메인 제한 우회 */
  if (path === '/youtube-playlist') {
    var pageToken = url.searchParams.get('pageToken') || '';
    var ytUrl =
      'https://www.googleapis.com/youtube/v3/playlistItems' +
      '?part=snippet&maxResults=50' +
      '&playlistId=' + YT_PLAYLIST_ID +
      '&key=' + YT_API_KEY +
      (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    return fetch(ytUrl)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        return new Response(JSON.stringify(data), { status: 200, headers: CORS_HEADERS });
      })
      .catch(function(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
      });
  }

  var dataPromise;

  if (path === '/notice') {
    /* '공지구분' 속성이 선택된 항목만 조회
       (비어 있으면 홈페이지에 노출하지 않음)            */
    dataPromise = nPost('/databases/' + DB_NOTICE + '/query', {
      filter: {
        property: '공지구분',
        select: { is_not_empty: true },
      },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    }).then(function(data) {
      return withThumbnails(data);
    });
  } else if (path === '/prayer') {
    dataPromise = queryDB(DB_PRAYER).then(withThumbnails);
  } else if (path === '/thanks') {
    dataPromise = queryDB(DB_THANKS).then(withThumbnails);
  } else if (path === '/partners-church') {
    dataPromise = queryPartnersDB(DB_CHURCH).then(withThumbnails);
  } else if (path === '/partners-missionary') {
    dataPromise = queryPartnersDB(DB_MISSIONARY).then(withThumbnails);
  } else if (path === '/partners-company') {
    dataPromise = queryPartnersDB(DB_COMPANY).then(withThumbnails);
  } else if (path.indexOf('/page/') === 0) {
    dataPromise = getPage(path.slice(6));
  } else if (path.indexOf('/blocks/') === 0) {
    var blockId = path.slice(8);
    dataPromise = collectImages(blockId, 0).then(function(images) {
      return getPage(blockId).then(function(pg) {
        var cover = null;
        if (pg && pg.cover) {
          var c = pg.cover;
          var s = c.type === 'external' ? (c.external && c.external.url) : (c.file && c.file.url);
          if (s) cover = '/img?url=' + encodeURIComponent(s);
        }
        return { results: images, cover: cover };
      }).catch(function(){ return { results: images, cover: null }; });
    });
  } else {
    dataPromise = Promise.resolve({ status: 'ok', message: "Pa'ar Mission Worker v4 🚀" });
  }

  return dataPromise.then(function(data) {
    return new Response(JSON.stringify(data), { status: 200, headers: CORS_HEADERS });
  }).catch(function(err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  });
}
