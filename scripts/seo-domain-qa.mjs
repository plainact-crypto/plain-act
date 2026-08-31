import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { site } from '../src/data/site.js';

const distDir = new URL('../dist/', import.meta.url);
const distPath = distDir.pathname;
const canonicalHost = new URL(site.fullUrl).host;
const forbidden = ['plainact-crypto.github.io', 'pages.dev'];
const excludedPrefixes = ['chess-opening-trainer/', 'nexora/', 'media-bio/', 'press-kit/'];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

const files = await walk(distPath);
const htmlFiles = files
  .filter((file) => file.endsWith('.html'))
  .filter((file) => !file.endsWith(`${sep}404.html`));

const failures = [];
let canonicalPagesChecked = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const rel = relative(distPath, file).split(sep).join('/');

  for (const oldHost of forbidden) {
    if (html.includes(oldHost)) failures.push(`${rel}: contains obsolete host ${oldHost}`);
  }

  if (!/<html\b/i.test(html)) continue;
  if (excludedPrefixes.some((prefix) => rel.startsWith(prefix))) continue;

  const noindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)
    || /<meta\s+content=["'][^"']*noindex[^"']*["']\s+name=["']robots["']/i.test(html);
  if (noindex) continue;

  canonicalPagesChecked += 1;
  const canonicals = [...html.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
  if (canonicals.length !== 1) {
    failures.push(`${rel}: expected exactly one canonical, found ${canonicals.length}`);
    continue;
  }

  let canonical;
  try { canonical = new URL(canonicals[0]); }
  catch { failures.push(`${rel}: invalid canonical ${canonicals[0]}`); continue; }
  if (canonical.host !== canonicalHost) failures.push(`${rel}: canonical host is ${canonical.host}, expected ${canonicalHost}`);
}

const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
for (const oldHost of forbidden) {
  if (sitemap.includes(oldHost)) failures.push(`sitemap.xml: contains obsolete host ${oldHost}`);
}
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!locs.length) failures.push('sitemap.xml: contains no <loc> URLs');
for (const loc of locs) {
  let url;
  try { url = new URL(loc); }
  catch { failures.push(`sitemap.xml: invalid URL ${loc}`); continue; }
  if (url.host !== canonicalHost) failures.push(`sitemap.xml: non-canonical host ${url.host}`);
  if (excludedPrefixes.some((prefix) => url.pathname.replace(/^\//, '').startsWith(prefix))) {
    failures.push(`sitemap.xml: excluded utility route leaked into sitemap: ${url.pathname}`);
  }
}

if (failures.length) {
  console.error('SEO domain QA failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SEO domain QA PASS: ${canonicalPagesChecked} indexable Plain Act HTML pages checked; ${locs.length} sitemap URLs; canonical host ${canonicalHost}; no obsolete github.io/pages.dev hosts.`);
