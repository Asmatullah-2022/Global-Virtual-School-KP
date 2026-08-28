// Data store with two backends: Upstash Redis when configured, or a
// lightweight JSON-file store as a zero-config fallback.
//
// Why: on Vercel (and any host running serverless functions without
// guaranteed request-to-container affinity), the JSON-file backend's
// writes land in a container-local /tmp that other containers cannot see.
// That is fine for local dev / single-process hosts (Bonto, Render, plain
// `node server/index.js`), but on Vercel it means a user registered in one
// container is invisible to a login request served by a different, equally
// valid container — "register succeeds, login says invalid credentials".
//
// Redis (via Upstash's REST API, which needs no persistent TCP connection
// and so works from a serverless function) fixes that by giving every
// container the same shared store. It activates automatically, with zero
// code changes required elsewhere, whenever a REST URL+token pair is
// present in the environment; otherwise this module behaves exactly as it
// did before.
//
// Two naming conventions exist for the same thing, depending on how the
// Upstash database was connected to the Vercel project:
//   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — the names used
//     when connecting directly through Upstash, and the names Upstash's
//     own docs and the @upstash/redis README use.
//   - KV_REST_API_URL / KV_REST_API_TOKEN — the names Vercel's Marketplace
//     "Storage" integration actually injects when an Upstash Redis
//     database is connected that way (Vercel's KV product is Upstash
//     under the hood, and the integration carries the KV_* naming even
//     though the underlying database is a plain Upstash Redis instance).
// Both are accepted here, UPSTASH_* preferred if both happen to be set,
// so this activates correctly regardless of which flow was used to
// connect the database — no dashboard renaming required.
//
// The public API (list/get/findOne/create/update/remove/count) is async
// under both backends now, so callers must await it — the file backend
// doesn't strictly need to be async, but keeping one shape for both avoids
// a caller ever having to know or care which backend is active.
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import logger from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, '..', 'data');
const DATA_DIR = process.env.RUNTIME_DATA_DIR || path.join(os.tmpdir(), 'gvs-mobile-app-data');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const REDIS_ENABLED = Boolean(REDIS_URL && REDIS_TOKEN);

// Generated once when this module is first loaded — i.e. once per cold
// start / container instance, not once per request. On a host whose
// serverless functions can route different requests to different,
// isolated container instances, two requests a few seconds apart logging
// two *different* instance IDs is direct evidence they ran in separate
// containers — useful to confirm cross-container isolation regardless of
// which backend is active.
export const INSTANCE_ID = crypto.randomBytes(4).toString('hex');

let seq = Date.now();
function nextId(prefix) {
  seq += 1;
  return `${prefix}_${seq.toString(36)}`;
}

function stampCreate(record) {
  const now = new Date().toISOString();
  return { createdAt: now, updatedAt: now, ...record };
}

// ---------------------------------------------------------------------
// File backend (default, zero-config)
// ---------------------------------------------------------------------
function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function seedFrom(collection) {
  const seedFp = path.join(SEED_DIR, `${collection}.json`);
  return fs.existsSync(seedFp) ? fs.readFileSync(seedFp, 'utf-8') : '[]';
}

function seedIfMissing(collection) {
  const fp = filePath(collection);
  if (fs.existsSync(fp)) return;
  ensureDataDir();
  fs.writeFileSync(fp, seedFrom(collection));
}

function readAllFile(collection) {
  seedIfMissing(collection);
  const fp = filePath(collection);
  let raw;
  try {
    raw = fs.readFileSync(fp, 'utf-8');
  } catch (e) {
    throw new Error(`Failed to read collection "${collection}": ${e.message}`);
  }
  if (!raw.trim()) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    // A serverless host can reuse the same warm container (and its /tmp
    // contents) across invocations. If an earlier request was interrupted
    // mid-write, the file left behind can be truncated/corrupt. Recover
    // automatically: log it, reset from the git-tracked seed, and
    // continue, rather than failing every future request on this
    // container until a fresh cold start happens to occur.
    logger.error('data_file_corrupt_reseeding', { collection, message: e.message });
    const fresh = seedFrom(collection);
    fs.writeFileSync(fp, fresh);
    return fresh.trim() ? JSON.parse(fresh) : [];
  }
}

function writeAllFile(collection, records) {
  ensureDataDir();
  const fp = filePath(collection);
  const tmpFp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  const json = JSON.stringify(records, null, 2);
  // Write-then-rename instead of writing fp directly: a rename is atomic
  // on POSIX filesystems, so a request interrupted mid-write can never
  // leave fp itself truncated for the next request to trip over.
  fs.writeFileSync(tmpFp, json);
  fs.renameSync(tmpFp, fp);
}

const fileBackend = {
  async readAll(collection) {
    return readAllFile(collection);
  },
  async writeAll(collection, records) {
    writeAllFile(collection, records);
  },
};

// ---------------------------------------------------------------------
// Redis backend (Upstash REST) — one key per collection, holding the
// full array. @upstash/redis auto-JSON-(de)serializes values, so no
// manual JSON.stringify/parse is needed here (verified empirically
// against a mock of the real Upstash /pipeline wire format).
// ---------------------------------------------------------------------
let redisClient = null;
async function getRedisClient() {
  if (redisClient) return redisClient;
  const { Redis } = await import('@upstash/redis');
  redisClient = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  return redisClient;
}

function redisKey(collection) {
  return `gvs:${collection}`;
}

let seededCollections = new Set();
async function seedIfMissingRedis(collection) {
  if (seededCollections.has(collection)) return;
  const redis = await getRedisClient();
  const key = redisKey(collection);
  const existing = await redis.get(key);
  if (existing === null || existing === undefined) {
    const seed = JSON.parse(seedFrom(collection) || '[]');
    await redis.set(key, seed);
  }
  seededCollections.add(collection);
}

const redisBackend = {
  async readAll(collection) {
    await seedIfMissingRedis(collection);
    const redis = await getRedisClient();
    const value = await redis.get(redisKey(collection));
    return Array.isArray(value) ? value : [];
  },
  async writeAll(collection, records) {
    const redis = await getRedisClient();
    await redis.set(redisKey(collection), records);
    seededCollections.add(collection);
  },
};

const backend = REDIS_ENABLED ? redisBackend : fileBackend;

if (REDIS_ENABLED) {
  logger.info('data_store_backend', { backend: 'upstash-redis', instanceId: INSTANCE_ID });
} else {
  logger.info('data_store_backend', { backend: 'json-file', instanceId: INSTANCE_ID, dataDir: DATA_DIR });
}

function redisHost() {
  if (!REDIS_ENABLED) return null;
  try {
    return new URL(REDIS_URL).host;
  } catch {
    return 'unparseable';
  }
}

export const db = {
  instanceId: INSTANCE_ID,
  dataDir: DATA_DIR,
  backend: REDIS_ENABLED ? 'redis' : 'file',
  // Hostname only, for diagnostics — never the URL's credentials or the
  // token. Safe to expose (a hostname alone grants no access).
  redisHost: redisHost(),
  // Record count only — never used to log actual content — so this is
  // safe to include in diagnostic logs even for sensitive collections.
  async count(collection) {
    const all = await backend.readAll(collection);
    return all.length;
  },
  async list(collection, filterFn) {
    const all = await backend.readAll(collection);
    return filterFn ? all.filter(filterFn) : all;
  },
  async get(collection, id) {
    const all = await backend.readAll(collection);
    return all.find((r) => r.id === id) || null;
  },
  async findOne(collection, filterFn) {
    const all = await backend.readAll(collection);
    return all.find(filterFn) || null;
  },
  async create(collection, record, idPrefix = collection.slice(0, 3)) {
    const all = await backend.readAll(collection);
    const doc = stampCreate({ id: nextId(idPrefix), ...record });
    all.push(doc);
    await backend.writeAll(collection, all);
    return doc;
  },
  async update(collection, id, patch) {
    const all = await backend.readAll(collection);
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch, id, updatedAt: new Date().toISOString() };
    await backend.writeAll(collection, all);
    return all[idx];
  },
  async remove(collection, id) {
    const all = await backend.readAll(collection);
    const next = all.filter((r) => r.id !== id);
    await backend.writeAll(collection, next);
    return next.length !== all.length;
  },
  raw: { readAll: (collection) => backend.readAll(collection), writeAll: (collection, records) => backend.writeAll(collection, records) },
};

export default db;
