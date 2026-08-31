import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { site } from '../src/data/site.js';

const distDir = new URL('../dist/', import.meta.url);
const distPath = distDir.pathname;
const canonicalHost = new URL(site.fullUrl).host;
const forbidden = ['plainact-crypto.github.io', 'pages.dev'];
const failures = [];

const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
for (const oldHost of forbidden) {
  if (sitemap.includes(oldHost)) failures.push(`sitemap.xml: contains obsolete host ${oldHost}`);
}

const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!locs.length) failures.push('sitemap.xml: contains no <loc> URLs');

let canonicalPagesChecked = 0;
for (const loc of locs) {
  let url;
  try {
    url = new URL(loc);
  } catch {
    failures.push(`sitemap.xml: invalid URL ${loc}`);
    continue;
  }

  if (url.host !== canonicalHost) {
    failures.push(`sitemap.xml: non-canonical host ${url.host}`);
    continue;
  }

  const relativePath = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  const file = relativePath ? join(distPath, relativePath, 'index.html') : join(distPath, 'index.html');

  let html;
  try {
    html = await readFile(file, 'utf8');
  } catch {
    failures.push(`${url.pathname}: sitemap target is missing from built output`);
    continue;
  }

  canonicalPagesChecked += 1;
  for (const oldHost of forbidden) {
    if (html.includes(oldHost)) failures.push(`${url.pathname}: contains obsolete host ${oldHost}`);
  }

  const canonicals = [...html.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]);
  if (canonicals.length !== 1) {
    failures.push(`${url.pathname}: expected exactly one canonical, found ${canonicals.length}`);
    continue;
  }

  let canonical;
  try {
    canonical = new URL(canonicals[0]);
  } catch {
    failures.push(`${url.pathname}: invalid canonical ${canonicals[0]}`);
    continue;
  }

  if (canonical.host !== canonicalHost) failures.push(`${url.pathname}: canonical host is ${canonical.host}, expected ${canonicalHost}`);
  if (canonical.pathname !== url.pathname) failures.push(`${url.pathname}: canonical path ${canonical.pathname} does not match sitemap path`);
}

const robots = await readFile(new URL('../dist/robots.txt', import.meta.url), 'utf8');
const expectedSitemap = `Sitemap: ${site.siteUrl}/sitemap.xml`;
if (!robots.includes(expectedSitemap)) failures.push(`robots.txt: expected ${expectedSitemap}`);
for (const oldHost of forbidden) {
  if (robots.includes(oldHost)) failures.push(`robots.txt: contains obsolete host ${oldHost}`);
}

if (failures.length) {
  console.error('SEO domain QA failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SEO domain QA PASS: ${canonicalPagesChecked} sitemap pages checked; every sitemap URL and canonical uses ${canonicalHost}; robots.txt points to the canonical sitemap.`);
