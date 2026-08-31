import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { site } from '../src/data/site.js';

const distDir = new URL('../dist/', import.meta.url);
const outputFile = new URL('../dist/sitemap.xml', import.meta.url);
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

const distPath = distDir.pathname;
const candidates = (await walk(distPath))
  .filter((file) => file.endsWith('.html'))
  .filter((file) => !file.endsWith(`${sep}404.html`));

const htmlFiles = [];
for (const file of candidates) {
  const rel = relative(distPath, file).split(sep).join('/');
  if (excludedPrefixes.some((prefix) => rel.startsWith(prefix))) continue;

  const html = await readFile(file, 'utf8');
  if (!/<html\b/i.test(html)) continue;

  const noindex = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)
    || /<meta\s+content=["'][^"']*noindex[^"']*["']\s+name=["']robots["']/i.test(html);
  if (!noindex) htmlFiles.push(file);
}

const routes = htmlFiles.map((file) => {
  const rel = relative(distPath, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel.slice(0, -'.html'.length)}/`;
});

const uniqueRoutes = [...new Set(routes)].sort((a, b) => a.localeCompare(b));
const urls = uniqueRoutes.map((route) => new URL(route.replace(/^\//, ''), site.fullUrl).toString());

const escapeXml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;

await writeFile(outputFile, xml, 'utf8');
console.log(`Generated sitemap.xml with ${urls.length} indexable Plain Act URLs on ${site.siteUrl}`);
