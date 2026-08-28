// One-off CLI to provision the first admin account, since admins cannot
// self-register through the public API (see server/routes/auth.routes.js).
// Usage:
//   node server/scripts/createAdmin.js --name "Jane Admin" --email admin@gvskp.org --password "a-strong-password"
import bcrypt from 'bcryptjs';
import db from '../lib/dataStore.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    out[key] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const { name, email, password } = args;

if (!name || !email || !password) {
  console.error('Usage: node server/scripts/createAdmin.js --name "Full Name" --email admin@example.com --password "..."');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const existing = await db.findOne('users', (u) => u.email.toLowerCase() === email.toLowerCase());
if (existing) {
  console.error(`A user with email ${email} already exists (role: ${existing.role}).`);
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);
const user = await db.create('users', { name, email: email.toLowerCase(), passwordHash, role: 'admin' }, 'usr');
console.log(`Admin account created: ${user.email} (id ${user.id}). Log in through the app to get a token.`);
