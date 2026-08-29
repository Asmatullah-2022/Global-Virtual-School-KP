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

const user = await db.findOne('users', (u) => u.email.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No account found with email ${email}. Register normally in the app first, then run this again.`);
  process.exit(1);
}
if (user.role === 'admin') {
  console.log(`${user.email} is already role: admin (id ${user.id}). Nothing to do.`);
  process.exit(0);
}

const previousRole = user.role;
const updated = await db.update('users', user.id, { role: 'admin' });
console.log(`Promoted ${updated.email} (id ${updated.id}) from role: ${previousRole} to role: admin.`);
console.log('Log out and log back in through the app to get a token with the new role -- your current session token still has the old role baked in.');
