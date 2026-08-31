import { chromium } from 'playwright';

const deployBase = (process.env.PLAIN_ACT_DEPLOY_URL || 'https://plainact-crypto.github.io/plain-act').replace(/\/$/, '');
const canonicalOrigin = (process.env.PLAIN_ACT_CANONICAL_ORIGIN || 'https://plain-act.com').replace(/\/$/, '');
const widths = [360, 390, 768, 1366];

const browser = await chromium.launch({ headless: true });
let failures = [];
const titles = new Map();
const descriptions = new Map();
const internalPaths = new Set();

function fail(scope, message) {
  failures.push(`${scope}: ${message}`);
  console.error(`FAIL ${scope}: ${message}`);
}

function deployUrlForPath(pathname) {
  const path = pathname === '/' ? '/' : pathname;
  return `${deployBase}${path}`;
}

function canonicalUrlForPath(pathname) {
  return `${canonicalOrigin}${pathname}`;
}

function normalizePath(pathname) {
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname !== '/' && !pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(pathname)) pathname += '/';
  return pathname;
}

try {
  const requestContext = await browser.newContext();
  const request = requestContext.request;

  const robotsResponse = await request.get(`${deployBase}/robots.txt`);
  if (!robotsResponse.ok()) fail('robots.txt', `HTTP ${robotsResponse.status()}`);
  const robotsText = await robotsResponse.text();
  if (!robotsText.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`)) fail('robots.txt', 'canonical sitemap declaration missing');
  if (/github\.io|pages\.dev/i.test(robotsText)) fail('robots.txt', 'obsolete deployment host present');

  const sitemapResponse = await request.get(`${deployBase}/sitemap.xml`);
  if (!sitemapResponse.ok()) fail('sitemap.xml', `HTTP ${sitemapResponse.status()}`);
  const sitemapText = await sitemapResponse.text();
  const locs = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (!locs.length) fail('sitemap.xml', 'no URLs found');
  if (locs.some((url) => !url.startsWith(`${canonicalOrigin}/`) && url !== `${canonicalOrigin}/`)) fail('sitemap.xml', 'non-canonical host found');
  if (/github\.io|pages\.dev/i.test(sitemapText)) fail('sitemap.xml', 'obsolete deployment host present');

  const pagePaths = locs.map((url) => normalizePath(new URL(url).pathname));
  console.log(`INFO sitemap pages: ${pagePaths.length}`);

  for (const pathname of pagePaths) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    const scope = pathname;
    try {
      const response = await page.goto(deployUrlForPath(pathname), { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (!response || !response.ok()) {
        fail(scope, `HTTP ${response?.status() ?? 'no response'} on deployed artifact`);
        continue;
      }

      const audit = await page.evaluate(() => {
        const canonical = [...document.querySelectorAll('link[rel="canonical"]')].map((el) => el.href);
        const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
        const title = document.title.trim();
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
        const h1s = [...document.querySelectorAll('h1')].map((el) => el.textContent?.trim() || '');
        const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((el) => Number(el.tagName.slice(1)));
        const headingJumps = headings.some((level, index) => index > 0 && level > headings[index - 1] + 1);
        const imagesWithoutAlt = [...document.querySelectorAll('img')].filter((img) => !img.hasAttribute('alt')).length;
        const controlsWithoutLabels = [...document.querySelectorAll('input,select,textarea')].filter((control) => {
          if (control instanceof HTMLInputElement && ['hidden','submit','button','reset'].includes(control.type)) return false;
          if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return false;
          if (control.closest('label')) return false;
          if (control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`)) return false;
          return true;
        }).length;
        const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].map((el) => el.textContent || '');
        const links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') || '');
        return { canonical, robots, title, description, h1s, headingJumps, imagesWithoutAlt, controlsWithoutLabels, schemas, links };
      });

      const expectedCanonical = canonicalUrlForPath(pathname);
      if (audit.canonical.length !== 1) fail(scope, `expected 1 canonical, found ${audit.canonical.length}`);
      else if (audit.canonical[0] !== expectedCanonical) fail(scope, `canonical mismatch: ${audit.canonical[0]} != ${expectedCanonical}`);
      if (/noindex/i.test(audit.robots)) fail(scope, 'sitemap page is noindex');
      if (!audit.title) fail(scope, 'missing title');
      if (!audit.description) fail(scope, 'missing meta description');
      if (audit.h1s.length !== 1) fail(scope, `expected 1 H1, found ${audit.h1s.length}`);
      if (audit.headingJumps) fail(scope, 'illogical heading-level jump detected');
      if (audit.imagesWithoutAlt) fail(scope, `${audit.imagesWithoutAlt} image(s) missing alt attribute`);
      if (audit.controlsWithoutLabels) fail(scope, `${audit.controlsWithoutLabels} form control(s) lack accessible label`);

      for (const schemaText of audit.schemas) {
        try { JSON.parse(schemaText); } catch { fail(scope, 'invalid JSON-LD'); }
      }

      if (audit.title) {
        if (titles.has(audit.title)) fail(scope, `duplicate title also used by ${titles.get(audit.title)}`);
        else titles.set(audit.title, pathname);
      }
      if (audit.description) {
        if (descriptions.has(audit.description)) fail(scope, `duplicate meta description also used by ${descriptions.get(audit.description)}`);
        else descriptions.set(audit.description, pathname);
      }

      for (const rawHref of audit.links) {
        if (!rawHref || rawHref.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(rawHref)) continue;
        let resolved;
        try { resolved = new URL(rawHref, canonicalUrlForPath(pathname)); } catch { continue; }
        if (resolved.origin !== canonicalOrigin) continue;
        internalPaths.add(normalizePath(resolved.pathname));
      }
    } catch (error) {
      fail(scope, error.message);
    } finally {
      await context.close();
    }
  }

  console.log(`INFO internal paths discovered: ${internalPaths.size}`);
  for (const pathname of [...internalPaths].sort()) {
    const response = await request.get(deployUrlForPath(pathname), { timeout: 30000 });
    if (!response.ok()) fail(`internal-link ${pathname}`, `HTTP ${response.status()}`);
  }

  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width < 1000 ? 900 : 900 } });
    const page = await context.newPage();
    for (const pathname of pagePaths) {
      const scope = `${width}px ${pathname}`;
      try {
        const response = await page.goto(deployUrlForPath(pathname), { waitUntil: 'domcontentloaded', timeout: 45000 });
        if (!response || !response.ok()) {
          fail(scope, `HTTP ${response?.status() ?? 'no response'}`);
          continue;
        }
        const result = await page.evaluate(() => {
          const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
          const focusables = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
            .filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0);
          let focusWorks = true;
          if (focusables.length) {
            focusables[0].focus();
            focusWorks = document.activeElement === focusables[0];
          }
          return { overflow, focusWorks };
        });
        if (result.overflow) fail(scope, 'horizontal overflow detected');
        if (!result.focusWorks) fail(scope, 'basic keyboard focus failed');
      } catch (error) {
        fail(scope, error.message);
      }
    }
    await context.close();
  }

  await requestContext.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`Plain Act final QA failed: ${failures.length} issue(s)`);
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}

console.log(`Plain Act final QA PASS: metadata/schema/internal links + responsive/accessibility checks at ${widths.join(', ')}px`);
