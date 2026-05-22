/**
 * Pa'ar Mission — Cloudflare Worker v4
 * Notion API 프록시 (CORS 해결 + 이미지 프록시)
 * Worker URL: https://dark-pine-8ced.superddj00.workers.dev/
 */

const NOTION_API_KEY = 'ntn_k86292911399zdoKzaCOSKhB2TKGlHKc3izS6mRDc4Z8PK';
const NOTION_VERSION = '2022-06-28';

/* ── DB IDs ───────────────────────────────────────────────── */
const DB_PRAYER      = '36520258888380f49454ffa1be6f9701';
const DB_THANKS      = '3652025888838074bd91f1ea74de92f9';
const DB_CHURCH      = '36820258888380188fe3c24f7a17a818';
const DB_MISSIONARY  = '368202588883805a91b8cb13197ac380';
const DB_COMPANY     = '3682025888838026a2a2db6dd0be801b';

/* ── CORS 헤더 ────────────────────────────────────────────── */
const CORS = {
  'Access-Control-Allow-Origin' : '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type'                : 'application/json; charset=utf-8',
};

const CORS_IMG = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control'              : 'public, max-age=3600',
};

/* ── Notion API 헬퍼 ──────────────────────────────────────── */
async function nGet(endpoint) {
  const res = await fetch('https://api.notion.com/v1' + endpoint, {
    headers: {
      'Authorization' : 'Bearer ' + NOTION_API_KEY,
      'Notion-Version': NOTION_VERSION,
    },
  });
  return res.json();
}

async function nPost(endpoint, body) {
  const res = await fetch('https://api.notion.com/v1' + endpoint, {
    method : 'POST',
    headers: {
      'Authorization' : 'Bearer ' + NOTION_API_KEY,
      'Notion-Version': NOTION_VERSION,
      'Content-Type'  : 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

/* ── DB 쿼리 (날짜 속성 내림차순 — 기도편지/감사편지용) ──── */
async function queryDB(dbId) {
  return nPost('/databases/' + dbId + '/query', {
    sorts: [{ property: '날짜', direction: 'descending' }],
  });
}

/* ── DB 쿼리 (생성순 오름차순 — 협력단체용) ──────────────── */
async function queryPartnersDB(dbId) {
  return nPost('/databases/' + dbId + '/query', {
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  });
}

/* ── 협력단체 DB 목록 + 썸네일 병렬 조회 ─────────────────── */
async function queryPartnersDBWithThumbnails(dbId) {
  const data  = await queryPartnersDB(dbId);
  const pages = data.results || [];

  const thumbPromises = pages.map(function (p) { return getFirstImage(p.id); });
  const thumbs = await Promise.all(thumbPromises);

  pages.forEach(function (p, i) {
    if (thumbs[i]) p._thumbnail = thumbs[i];
  });

  return data;
}

/* ── 블록 목록 조회 ───────────────────────────────────────── */
async function getBlocks(id) {
  return nGet('/blocks/' + id + '/children');
}

/* ── 페이지 조회 ──────────────────────────────────────────── */
async function getPage(id) {
  return nGet('/pages/' + id);
}

/* ── 첫 번째 이미지 URL 추출 (썸네일용, 얕은 탐색) ────────── */
async function getFirstImage(pageId) {
  try {
    const data   = await getBlocks(pageId);
    const blocks = data.results || [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === 'image') {
        const ib = b.image;
        let src  = null;
        if (ib.type === 'external') src = ib.external && ib.external.url;
        else if (ib.type === 'file') src = ib.file && ib.file.url;
        if (src) return '/img?url=' + encodeURIComponent(src);
      }
    }
  } catch (e) {}
  return null;
}

/* ── 이미지 수집 (재귀, 모달용) ──────────────────────────── */
async function collectImages(blockId, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 3) return [];

  const data   = await getBlocks(blockId);
  const blocks = data.results || [];
  const images = [];

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'image') {
      const ib  = b.image;
      let src   = null;
      if (ib.type === 'external') {
        src = ib.external && ib.external.url;
      } else if (ib.type === 'file') {
        src = ib.file && ib.file.url;
      }
      const cap = ib.caption
        ? ib.caption.map(function (c) { return c.plain_text; }).join('')
        : '';
      if (src) {
        const proxyUrl = '/img?url=' + encodeURIComponent(src);
        images.push({ src: proxyUrl, caption: cap });
      }
    } else if (b.type === 'child_page') {
      const child = await collectImages(b.id, depth + 1);
      for (let j = 0; j < child.length; j++) images.push(child[j]);
    } else if (b.has_children && depth < 2) {
      const child = await collectImages(b.id, depth + 1);
      for (let j = 0; j < child.length; j++) images.push(child[j]);
    }
  }
  return images;
}

/* ── DB 목록 + 썸네일 병렬 조회 (기도편지/감사편지용) ──────── */
async function queryDBWithThumbnails(dbId) {
  const data  = await queryDB(dbId);
  const pages = data.results || [];

  const thumbPromises = pages.map(function (p) { return getFirstImage(p.id); });
  const thumbs = await Promise.all(thumbPromises);

  pages.forEach(function (p, i) {
    if (thumbs[i]) p._thumbnail = thumbs[i];
  });

  return data;
}

/* ── Worker 라우터 ────────────────────────────────────────── */
export default {
  async fetch(request) {
    const url  = new URL(request.url);
    const path = url.pathname;

    /* Preflight */
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {

      /* ── 이미지 프록시 (/img?url=...) ── */
      if (path === '/img') {
        const imgUrl = url.searchParams.get('url');
        if (!imgUrl) {
          return new Response('missing url', { status: 400 });
        }
        const imgRes      = await fetch(imgUrl);
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        return new Response(imgRes.body, {
          status : imgRes.status,
          headers: Object.assign({}, CORS_IMG, { 'Content-Type': contentType }),
        });
      }

      let data;

      /* ── 기도편지 ── */
      if (path === '/prayer') {
        data = await queryDBWithThumbnails(DB_PRAYER);

      /* ── 감사편지 ── */
      } else if (path === '/thanks') {
        data = await queryDBWithThumbnails(DB_THANKS);

      /* ── 협력 교회 & 단체 ── */
      } else if (path === '/partners-church') {
        data = await queryPartnersDBWithThumbnails(DB_CHURCH);

      /* ── 협력 선교사 ── */
      } else if (path === '/partners-missionary') {
        data = await queryPartnersDBWithThumbnails(DB_MISSIONARY);

      /* ── 협력 기업 ── */
      } else if (path === '/partners-company') {
        data = await queryPartnersDBWithThumbnails(DB_COMPANY);

      /* ── 페이지 단건 조회 ── */
      } else if (path.startsWith('/page/')) {
        const id = path.slice(6);
        data = await getPage(id);

      /* ── 블록 이미지 수집 ── */
      } else if (path.startsWith('/blocks/')) {
        const id     = path.slice(8);
        const images = await collectImages(id, 0);

        let coverProxyUrl = null;
        try {
          const pageInfo = await getPage(id);
          const cover    = pageInfo && pageInfo.cover;
          if (cover) {
            let coverSrc = null;
            if (cover.type === 'external') coverSrc = cover.external && cover.external.url;
            else if (cover.type === 'file') coverSrc = cover.file && cover.file.url;
            if (coverSrc) coverProxyUrl = '/img?url=' + encodeURIComponent(coverSrc);
          }
        } catch (e) {}

        data = { results: images, cover: coverProxyUrl };

      /* ── 헬스체크 ── */
      } else {
        data = { status: 'ok', message: "Pa'ar Mission Worker v4 🚀" };
      }

      return new Response(JSON.stringify(data), { status: 200, headers: CORS });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: CORS,
      });
    }
  },
};
