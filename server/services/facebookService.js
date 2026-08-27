// Meta Graph API integration for the GVS Facebook Page.
// Preserves the original starter's approach (official Graph API only, no
// scraping) and adds: pagination, retry with backoff, rate-limit handling,
// disk-persisted cache so a restart doesn't lose the last good feed, and a
// "stale but available" fallback when Meta is unreachable.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import logger from '../logger.js';

// Written outside the deployed source tree, same reasoning as
// server/lib/dataStore.js: some hosts auto-restart on any file change
// under the project directory, and this cache is rewritten on every
// successful feed fetch.
const CACHE_FILE = path.join(process.env.RUNTIME_DATA_DIR || path.join(os.tmpdir(), 'gvs-mobile-app-data'), 'fbCache.json');
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes — respectful of Graph API rate limits
const FIELDS =
  'id,message,created_time,full_picture,permalink_url,attachments{media,type,url,title},reactions.limit(0).summary(true),comments.limit(0).summary(true),shares';

let memoryCache = loadCacheFromDisk();

function loadCacheFromDisk() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      return { updatedAt: raw.updatedAt || 0, posts: raw.posts || [], paging: raw.paging || null };
    }
  } catch (e) {
    logger.warn('fb_cache_load_failed', { message: e.message });
  }
  return { updatedAt: 0, posts: [], paging: null };
}

function persistCache() {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryCache, null, 2));
  } catch (e) {
    logger.warn('fb_cache_persist_failed', { message: e.message });
  }
}

function normalizePost(p) {
  return {
    id: p.id,
    message: p.message || '',
    created_time: p.created_time || null,
    full_picture: p.full_picture || p.picture || null,
    permalink_url: p.permalink_url || `https://www.facebook.com/${p.id}`,
    attachments: p.attachments?.data || [],
    reactions: p.reactions?.summary?.total_count ?? 0,
    comments: p.comments?.summary?.total_count ?? 0,
    shares: p.shares?.count ?? 0,
    source: 'GVS Facebook',
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url);
      const data = await r.json();
      if (r.status === 429 || data?.error?.code === 4 || data?.error?.code === 17) {
        lastErr = new Error(data.error?.message || 'Meta API rate limit reached.');
        await sleep(500 * 2 ** i);
        continue;
      }
      if (!r.ok || data.error) {
        throw new Error(data.error?.message || `Meta API error (HTTP ${r.status}).`);
      }
      return data;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(300 * 2 ** i);
    }
  }
  throw lastErr;
}

async function fetchFromMeta(after) {
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${config.pageId}/feed`);
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('limit', '25');
  url.searchParams.set('access_token', config.pageAccessToken);
  if (after) url.searchParams.set('after', after);

  const data = await fetchWithRetry(url.toString());
  return {
    posts: (data.data || []).map(normalizePost),
    paging: data.paging || null,
  };
}

// Shown only while PAGE_ACCESS_TOKEN/META_GRAPH_VERSION are unset, so the
// UI and the Facebook integration can be built/tested end-to-end before
// real Meta credentials exist. Every item is explicitly labeled as demo
// content (both in the text itself and via `isDemo: true`) so it can never
// be mistaken for a real GVS announcement. The moment isFacebookConfigured()
// is true, this branch is skipped entirely and getFeed() calls the real
// Graph API instead — no code change or restart-order dependency needed
// beyond setting the env vars.
function demoPosts() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: 'demo_1',
      message: '[Demo Content] This is a sample post shown only because the GVS Facebook Page connection is not yet configured. Once an administrator sets PAGE_ACCESS_TOKEN and META_GRAPH_VERSION, real posts from the official GVS Facebook Page will appear here automatically.',
      created_time: new Date(now - 1 * day).toISOString(),
      full_picture: null,
      permalink_url: 'https://www.facebook.com/profile.php?id=61592435229097',
      attachments: [],
      reactions: 0,
      comments: 0,
      shares: 0,
      source: 'Demo Content',
      isDemo: true,
    },
    {
      id: 'demo_2',
      message: '[Demo Content] Example of how a GVS update with an image and a longer message will be displayed once the live Facebook feed is connected. This text, and this post, is not a real GVS announcement.',
      created_time: new Date(now - 3 * day).toISOString(),
      full_picture: null,
      permalink_url: 'https://www.facebook.com/profile.php?id=61592435229097',
      attachments: [],
      reactions: 0,
      comments: 0,
      shares: 0,
      source: 'Demo Content',
      isDemo: true,
    },
  ];
}

// Fetch the feed, honoring cache freshness. Never throws to the caller:
// on failure it returns the last known-good cache with a status flag.
export async function getFeed({ forceRefresh = false, after } = {}) {
  if (!config.isFacebookConfigured()) {
    return {
      status: 'demo',
      configured: false,
      posts: demoPosts(),
      updatedAt: memoryCache.updatedAt,
      message: 'Official Facebook updates will appear here when the GVS Page connection is activated. Showing demo content for now.',
    };
  }

  const fresh = !forceRefresh && !after && Date.now() - memoryCache.updatedAt < CACHE_TTL_MS && memoryCache.posts.length > 0;
  if (fresh) {
    return { status: 'cache', configured: true, posts: memoryCache.posts, paging: memoryCache.paging, updatedAt: memoryCache.updatedAt };
  }

  try {
    const { posts, paging } = await fetchFromMeta(after);
    if (!after) {
      memoryCache = { updatedAt: Date.now(), posts, paging };
      persistCache();
    }
    return { status: 'live', configured: true, posts, paging, updatedAt: memoryCache.updatedAt };
  } catch (e) {
    logger.error('facebook_fetch_failed', { message: e.message });
    if (memoryCache.posts.length > 0) {
      return {
        status: 'stale_cache',
        configured: true,
        posts: memoryCache.posts,
        paging: memoryCache.paging,
        updatedAt: memoryCache.updatedAt,
        message: 'Showing recently cached GVS updates.',
        error: e.message,
      };
    }
    return {
      status: 'error',
      configured: true,
      posts: [],
      updatedAt: memoryCache.updatedAt,
      message: 'Live Facebook updates are temporarily unavailable.',
      error: e.message,
    };
  }
}

// Called by the webhook handler when Meta notifies us of a feed change.
export function invalidateCache() {
  memoryCache = { updatedAt: 0, posts: memoryCache.posts, paging: memoryCache.paging };
  logger.info('facebook_cache_invalidated');
}

export function getCacheSnapshot() {
  return memoryCache;
}
