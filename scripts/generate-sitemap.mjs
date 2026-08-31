import { readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { site } from '../src/data/site.js';

const distDir = new URL('../dist/', import.meta.url);
const outputFile = new URL('../dist/sitemap.xml', import.meta.url);

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
const htmlFiles = (await walk(distPath))
  .filter((file) => file.endsWith('.html'))
  .filter((file) => !file.endsWith(`${sep}404.html`))
  .filter((file) => !relative(distPath, file).startsWith(`chess-opening-trainer${sep}`));

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
console.log(`Generated sitemap.xml with ${urls.length} canonical URLs on ${site.siteUrl}`);
