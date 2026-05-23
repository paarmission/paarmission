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

var CORS_HEADERS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type'                : 'application/json; charset=utf-8',
};
var CORS_IMG_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control'              : 'public, max-age=3600',
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
function getFirstImage(pageId) {
  return getBlocks(pageId).then(function(data) {
    var blocks = data.results || [];
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.type === 'image') {
        var src = null;
        if (b.image.type === 'external') src = b.image.external && b.image.external.url;
        else if (b.image.type === 'file') src = b.image.file && b.image.file.url;
        if (src) return '/img?url=' + encodeURIComponent(src);
      }
    }
    return null;
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
function withThumbnails(data) {
  var pages = data.results || [];
  return Promise.all(pages.map(function(p){ return getFirstImage(p.id); }))
    .then(function(thumbs) {
      pages.forEach(function(p, i){ if (thumbs[i]) p._thumbnail = thumbs[i]; });
      return data;
    });
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

  /* 이미지 프록시 */
  if (path === '/img') {
    var imgUrl = url.searchParams.get('url');
    if (!imgUrl) return Promise.resolve(new Response('missing url', { status: 400 }));
    return fetch(imgUrl).then(function(imgRes) {
      var ct = imgRes.headers.get('content-type') || 'image/jpeg';
      var h  = Object.assign({}, CORS_IMG_HEADERS, { 'Content-Type': ct });
      return new Response(imgRes.body, { status: imgRes.status, headers: h });
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

  if (path === '/prayer') {
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
