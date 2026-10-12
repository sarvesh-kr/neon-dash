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
function attributes(tag) {
  return new Map(
    [...tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map((match) => [match[1], match[2]]),
  );
}
for (const match of html.matchAll(/<(?:script|img|link|a)\b[^>]*>/g)) {
  const values = attributes(match[0]);
  if (values.get('rel') === 'canonical') continue;
  const source = values.get('src') || values.get('href');
  if (source) asset(source);
}
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
const canonical = `https://${readFileSync(join(root, 'CNAME'), 'utf8').trim()}/`;
const head = html.slice(0, html.indexOf('</head>'));
const links = [...head.matchAll(/<link\b[^>]*>/g)].map((match) => attributes(match[0]));
assert.equal(
  links.filter((link) => link.get('rel') === 'canonical').length,
  1,
  'Use one canonical URL',
);
assert.equal(links.find((link) => link.get('rel') === 'canonical').get('href'), canonical);
const metas = [...head.matchAll(/<meta\b[^>]*>/g)].map((match) => attributes(match[0]));
function meta(name, attribute = 'name') {
  const found = metas.filter((tag) => tag.get(attribute) === name);
  assert.equal(found.length, 1, `Missing or duplicate ${name} metadata`);
  return found[0].get('content');
}
assert.match(head.match(/<title>([^<]+)<\/title>/)?.[1] || '', /Neon Dash.*Endless Runner/);
assert.ok(
  meta('description').length >= 80 && meta('description').length <= 180,
  'Review description length',
);
assert.match(meta('robots'), /\bindex, follow\b/);
assert.equal(meta('og:url', 'property'), canonical);
assert.equal(meta('og:site_name', 'property'), 'Neon Dash');
assert.equal(meta('og:type', 'property'), 'website');
assert.equal(meta('twitter:card'), 'summary_large_image');
for (const name of ['title', 'description', 'image:alt']) {
  assert.ok(meta(`og:${name}`, 'property').trim(), `Empty Open Graph ${name}`);
  assert.ok(meta(`twitter:${name}`).trim(), `Empty Twitter ${name}`);
}
const image = new URL(meta('og:image', 'property'));
assert.equal(image.origin, new URL(canonical).origin, 'Share image must use the canonical origin');
assert.equal(meta('twitter:image'), image.href, 'Share image URLs disagree');
const preview = readFileSync(asset(image.pathname.slice(1)));
assert.equal(preview.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(preview.readUInt32BE(16), 1200);
assert.equal(preview.readUInt32BE(20), 630);
assert.equal(meta('og:image:width', 'property'), '1200');
assert.equal(meta('og:image:height', 'property'), '630');
assert.match(head, /itemscope itemtype="https:\/\/schema\.org\/WebSite"/);
assert.match(html, /itemscope itemtype="https:\/\/schema\.org\/VideoGame"/);
assert.equal([...html.matchAll(/<h1\b/g)].length, 1, 'Use one primary game heading');
assert.match(html, /<p itemprop="description">[\s\S]*?Neon Dash[\s\S]*?<\/p>/);
const robots = readFileSync(join(root, 'robots.txt'), 'utf8');
assert.match(robots, /User-agent: \*/);
assert.match(robots, /^Allow: \/$/m);
assert.ok(!/^Disallow:\s*\/\s*$/m.test(robots), 'Game crawling is blocked');
assert.ok(robots.includes(`Sitemap: ${canonical}sitemap.xml`), 'Sitemap discovery missing');
const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
assert.match(sitemap, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
assert.deepEqual(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]),
  [canonical],
);
const modified = sitemap.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
assert.match(modified || '', /^\d{4}-\d{2}-\d{2}$/);
assert.ok(Number.isFinite(Date.parse(modified)), 'Invalid sitemap modification date');
console.log(
  'Release checks passed: unit regressions, JavaScript syntax, local assets, unique IDs, manifest icons, CSP, and SEO metadata/crawl assets.',
);
