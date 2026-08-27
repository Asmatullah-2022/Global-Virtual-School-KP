// Lightweight JSON-file data store.
//
// This is an interim, dependency-free "database" so the app is fully
// functional out of the box. The API is deliberately collection/document
// shaped (list/get/create/update/remove) so migrating to Firestore or
// Supabase later means swapping this module's internals, not the route
// code.
//
// Runtime writes are kept OUT of the deployed source tree (server/data/
// holds only the git-tracked seed files, read-only at runtime). Some
// hosting platforms auto-restart the app when they detect a file change
// anywhere under the project directory ("hot reload" / dev-mode file
// watching); if this store wrote directly into server/data/, every
// registration, login-driven update, or Facebook cache write would look
// like a code change and could trigger a restart loop / "port in use"
// while the previous process was still shutting down. Writing instead to
// a directory outside the watched tree (RUNTIME_DATA_DIR, or the OS temp
// dir by default) avoids that class of problem entirely. Seed data is
// copied into the runtime dir once, on first read of each collection.
//
// NOT SUITABLE FOR HIGH-CONCURRENCY PRODUCTION LOAD, and the OS temp dir
// is not guaranteed persistent across restarts on most hosts. Before real
// launch, point this at Firebase Firestore or Supabase/Postgres per the
// DATABASE section of docs/DATABASE_SCHEMA.md.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(__dirname, '..', 'data');
const DATA_DIR = process.env.RUNTIME_DATA_DIR || path.join(os.tmpdir(), 'gvs-mobile-app-data');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function seedIfMissing(collection) {
  const fp = filePath(collection);
  if (fs.existsSync(fp)) return;
  ensureDataDir();
  const seedFp = path.join(SEED_DIR, `${collection}.json`);
  const seedContent = fs.existsSync(seedFp) ? fs.readFileSync(seedFp, 'utf-8') : '[]';
  fs.writeFileSync(fp, seedContent);
}

function readAll(collection) {
  seedIfMissing(collection);
  const fp = filePath(collection);
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (e) {
    throw new Error(`Failed to read collection "${collection}": ${e.message}`);
  }
}

function writeAll(collection, records) {
  ensureDataDir();
  const fp = filePath(collection);
  fs.writeFileSync(fp, JSON.stringify(records, null, 2));
}

let seq = Date.now();
function nextId(prefix) {
  seq += 1;
  return `${prefix}_${seq.toString(36)}`;
}

export const db = {
  list(collection, filterFn) {
    const all = readAll(collection);
    return filterFn ? all.filter(filterFn) : all;
  },
  get(collection, id) {
    return readAll(collection).find((r) => r.id === id) || null;
  },
  findOne(collection, filterFn) {
    return readAll(collection).find(filterFn) || null;
  },
  create(collection, record, idPrefix = collection.slice(0, 3)) {
    const all = readAll(collection);
    const doc = { id: nextId(idPrefix), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...record };
    all.push(doc);
    writeAll(collection, all);
    return doc;
  },
  update(collection, id, patch) {
    const all = readAll(collection);
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...patch, id, updatedAt: new Date().toISOString() };
    writeAll(collection, all);
    return all[idx];
  },
  remove(collection, id) {
    const all = readAll(collection);
    const next = all.filter((r) => r.id !== id);
    writeAll(collection, next);
    return next.length !== all.length;
  },
  raw: { readAll, writeAll },
};

export default db;
