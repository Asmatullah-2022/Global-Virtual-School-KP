// One-off CLI to promote an EXISTING account to role: 'admin', for the
// case createAdmin.js explicitly refuses to handle: the person already
// has an account (self-registered as student/teacher/parent/school) and
// just needs the role changed, not a new duplicate account created.
// Same connection model as createAdmin.js -- run this locally with the
// SAME datastore env vars your deployment uses (UPSTASH_REDIS_REST_URL/
// UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN) so it
// updates the same production Redis, never Vercel/hosting credentials.
//
// Usage:
//   node server/scripts/promoteAdmin.js --email you@example.com
import db from '../lib/dataStore.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    out[key] = argv[i + 1];
  }
  return out;
}

const { email } = parseArgs(process.argv.slice(2));
if (!email) {
  console.error('Usage: node server/scripts/promoteAdmin.js --email you@example.com');
  process.exit(1);
}

// Printed FIRST and unmissable: the single most common way this script
// silently "succeeds" without fixing production is UPSTASH_REDIS_REST_*
// / KV_REST_API_* not actually being set in this shell -- db.backend
// then falls back to the local JSON-file store, and every check below
// runs against a database your live Vercel deployment never reads. If
// this says "file", stop here and fix your env vars before continuing;
// nothing below can be trusted otherwise.
console.log(`Datastore backend in use: ${db.backend}${db.backend === 'redis' ? ` (host: ${db.redisHost})` : ''}`);
if (db.backend !== 'redis') {
  console.log('WARNING: not connected to Redis -- UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN are missing or not exported in this shell.');
  console.log('Anything this script does next will NOT affect your production (Vercel) app. Set those env vars from your Vercel project\'s Storage tab and re-run.');
}

const totalUsers = await db.count('users');
console.log(`Total user records in this datastore: ${totalUsers}`);

const user = await db.findOne('users', (u) => u.email.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No account found with email "${email.toLowerCase()}" in this datastore.`);
  console.error('If the backend above is "redis" and you\'re certain you registered with this email, the email you log in with may differ slightly (check for typos, a different domain, or extra whitespace) -- registration and login both lowercase/trim the email the same way, so it must match exactly, case aside.');
  process.exit(1);
}
console.log(`Found account: email="${user.email}" id=${user.id} current role="${user.role}"`);

if (user.role === 'admin') {
  console.log('Already role: admin -- nothing to change. If #/admin still refuses you after this, the problem is a stale JWT, not the database record -- see the login step below.');
  process.exit(0);
}

const previousRole = user.role;
const updated = await db.update('users', user.id, { role: 'admin' });
console.log(`Promoted: email="${updated.email}" id=${updated.id} role changed "${previousRole}" -> "${updated.role}".`);

// Read the record back independently of the update() call's own return
// value, as direct confirmation the write actually persisted rather
// than trusting the in-memory result of the call that made it.
const verify = await db.findOne('users', (u) => u.id === updated.id);
console.log(`Verified by re-reading the record: role is now "${verify.role}".`);
console.log('Next: log out, then log back in through the app -- this issues a brand-new JWT, and signToken() reads the role from this record at that moment, so the new token will carry role: "admin".');
