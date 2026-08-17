import { chromium } from 'playwright';

const targets = (process.env.PRODUCTION_URLS || 'https://plainact-crypto.github.io/plain-act/chess-opening-trainer/,https://chess-opening-trainer-3jh.pages.dev')
  .split(',').map(x => x.trim()).filter(Boolean);
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 }
];

function assert(condition, message) { if (!condition) throw new Error(message); }
async function gotoWithRetry(page, url, markerRequired = true) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert(response && response.ok(), `${url} returned HTTP ${response?.status()}`);
      await page.waitForTimeout(700);
      if (!markerRequired || await page.evaluate(() => Boolean(globalThis.__COT_ACTIVATION_ONBOARDING_V2__ && globalThis.__COT_ACTIVATION_FUNNEL_FIX__))) return;
      lastError = new Error(`${url} does not yet contain activation + funnel production patches`);
    } catch (err) { lastError = err; }
    await page.waitForTimeout(5000);
  }
  throw lastError;
}

const browser = await chromium.launch({ headless: true });
try {
  for (const url of targets) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(String(err?.message || err)));

      await gotoWithRetry(page, url);
      assert(await page.locator('#cloudAuthGate').isVisible(), `${url} ${viewport.name}: landing/auth gate not visible`);
      assert(await page.getByText('Learn. Practice. Master Your', { exact: false }).first().isVisible(), `${url} ${viewport.name}: hero missing`);
      assert(await page.locator('#heroStart').isVisible(), `${url} ${viewport.name}: primary landing CTA missing`);
      assert(await page.locator('#su').isVisible(), `${url} ${viewport.name}: signup tab missing`);

      await page.locator('#su').click();
      assert(await page.locator('#uw').isVisible(), `${url} ${viewport.name}: signup form did not open`);
      assert(await page.locator('#em').isVisible() && await page.locator('#pw').isVisible(), `${url} ${viewport.name}: signup credentials missing`);
      assert(await page.locator('#go').isVisible(), `${url} ${viewport.name}: signup submit missing`);

      const publicText = await page.locator('#cloudAuthGate').innerText();
      assert(/Build a repertoire you can actually remember/i.test(publicText), `${url} ${viewport.name}: repertoire value proposition missing`);
      assert(!/D4 Player|C6 Player/i.test(publicText), `${url} ${viewport.name}: legacy D4/C6 persona language leaked into public journey`);

      const patches = await page.evaluate(() => ({
        activation: Boolean(globalThis.__COT_ACTIVATION_ONBOARDING_V2__),
        funnel: Boolean(globalThis.__COT_ACTIVATION_FUNNEL_FIX__),
        tracker: typeof globalThis.CHESS_ACTIVATION_TRACK === 'function'
      }));
      assert(patches.activation && patches.funnel && patches.tracker, `${url} ${viewport.name}: activation instrumentation not live`);

      const publicOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(publicOverflow <= 2, `${url} ${viewport.name}: horizontal overflow ${publicOverflow}px on landing`);

      // Do not fake authentication here. A synthetic localStorage session is not a
      // valid proof of the signed-in product and repeatedly produced false CI gates.
      // Authenticated dashboard coverage belongs in deterministic app/component tests;
      // this production smoke verifies only behavior a real anonymous visitor can use.
      const fatalErrors = pageErrors.filter(x => !/401|Unauthorized|Failed to fetch|Session expired|JWT/i.test(x));
      assert(fatalErrors.length === 0, `${url} ${viewport.name}: page errors: ${fatalErrors.join(' | ')}`);
      console.log(`PASS ${viewport.name} ${url}`);
      await context.close();
    }
  }
} finally { await browser.close(); }
