// Lightweight build check: syntax-validates every server and frontend JS
// file. There is no unit test framework wired in yet (see README "Known
// limitations"); this is what `npm run check` runs in the meantime.
import { execFileSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import path from 'path';

function collectJsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'data') continue;
      collectJsFiles(full, out);
    } else if (entry.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const files = [...collectJsFiles(path.join(root, 'server')), ...collectJsFiles(path.join(root, 'public')), ...collectJsFiles(path.join(root, 'api'))];

let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    failed++;
    console.error(`FAILED: ${file}\n${e.stderr?.toString() || e.message}`);
  }
}

console.log(`Checked ${files.length} files — ${failed === 0 ? 'all OK' : `${failed} failed`}.`);
process.exit(failed === 0 ? 0 : 1);
