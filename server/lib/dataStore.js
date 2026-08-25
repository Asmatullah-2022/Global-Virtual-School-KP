// Lightweight JSON-file data store.
//
// This is an interim, dependency-free "database" so the app is fully
// functional out of the box. Every collection is a JSON file under
// server/data/. The API is deliberately collection/document shaped
// (list/get/create/update/remove) so migrating to Firestore or Supabase
// later means swapping this module's internals, not the route code.
//
// NOT SUITABLE FOR HIGH-CONCURRENCY PRODUCTION LOAD. Before real launch,
// point this at Firebase Firestore or Supabase/Postgres per DATABASE
// section of docs/DATABASE_SCHEMA.md.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

function filePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function readAll(collection) {
  const fp = filePath(collection);
  if (!fs.existsSync(fp)) return [];
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (e) {
    throw new Error(`Failed to read collection "${collection}": ${e.message}`);
  }
}

function writeAll(collection, records) {
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
