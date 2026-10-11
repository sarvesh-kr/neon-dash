import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function node(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const tests = readdirSync(join(root, 'tests'))
  .filter((name) => name.endsWith('.test.cjs'))
  .sort();
// Run individual files so every supported Node version reports the contained tests.
for (const test of tests) node([join('tests', test)]);
for (const directory of ['', 'scripts', 'tests']) {
  for (const name of readdirSync(join(root, directory))) {
    if (/\.(?:js|mjs|cjs)$/.test(name)) node(['--check', join(directory, name)]);
  }
}

const base = new URL('https://release.invalid/neon-dash/');
function asset(value, file = 'index.html') {
  const url = new URL(value, new URL(file, base));
  assert.equal(url.origin, base.origin, `External resource in ${file}: ${value}`);
  assert.ok(url.pathname.startsWith(base.pathname), `Resource escapes the project: ${value}`);
  const path = join(root, decodeURIComponent(url.pathname.slice(base.pathname.length)));
  const location = relative(root, path);
  assert.ok(
    !isAbsolute(location) && location !== '..' && !location.startsWith(`..${sep}`),
    `Resource escapes the project: ${value}`,
  );
  assert.ok(statSync(path), `Missing resource: ${value}`);
  return path;
}
const html = readFileSync(join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) asset(match[1]);
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
for (const match of readFileSync(join(root, 'styles.css'), 'utf8').matchAll(
  /url\(["']?([^\s"')]+)["']?\)/g,
))
  asset(match[1], 'styles.css');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
for (const field of ['id', 'start_url', 'scope']) asset(manifest[field], 'manifest.webmanifest');
for (const icon of manifest.icons) {
  const data = readFileSync(asset(icon.src, 'manifest.webmanifest'));
  assert.equal(
    data.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    'Manifest icon must be a PNG',
  );
  assert.equal(
    `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,
    icon.sizes,
    `Wrong icon size: ${icon.src}`,
  );
}
const policy = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
assert.ok(policy, 'Missing Content Security Policy');
const directives = new Map(
  policy.split(';').map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values.join(' ')];
  }),
);
for (const name of ['default-src', 'script-src', 'style-src', 'img-src'])
  assert.equal(directives.get(name), "'self'", `Unexpected ${name} policy`);
for (const name of ['connect-src', 'object-src', 'form-action', 'frame-src', 'worker-src'])
  assert.equal(directives.get(name), "'none'", `Unexpected ${name} policy`);
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  assert.match(match[1], /\bsrc=/, 'Inline scripts are prohibited');
  assert.match(match[1], /\bdefer\b/, 'Game scripts must defer loading');
  assert.equal(match[2].trim(), '', 'Inline scripts are prohibited');
}
console.log(
  'Release checks passed: unit regressions, JavaScript syntax, local assets, unique IDs, manifest icons, and CSP.',
);
