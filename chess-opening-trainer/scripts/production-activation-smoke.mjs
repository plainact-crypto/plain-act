import { chromium } from 'playwright';

const targets = (process.env.PRODUCTION_URLS || 'https://plainact-crypto.github.io/plain-act/chess-opening-trainer/,https://chess-opening-trainer-3jh.pages.dev')
  .split(',').map(x => x.trim()).filter(Boolean);
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 }
];
const fakeEmail = 'activation-smoke@example.invalid';
const fakeUserId = '00000000-0000-4000-8000-000000000001';

function assert(condition, message) { if (!condition) throw new Error(message); }
async function gotoWithRetry(page, url, markerRequired = true) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert(response && response.ok(), `${url} returned HTTP ${response?.status()}`);
      await page.waitForTimeout(700);
      if (!markerRequired || await page.evaluate(() => Boolean(globalThis.__COT_ACTIVATION_ONBOARDING_V2__))) return;
      lastError = new Error(`${url} does not yet contain activation V2 patch`);
    } catch (err) { lastError = err; }
    await page.waitForTimeout(5000);
  }
  throw lastError;
}
async function seedSignedIn(page) {
  await page.evaluate(({ fakeEmail, fakeUserId }) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('chessTrainerCloudSession', JSON.stringify({ access_token: 'activation-smoke-invalid-token', user: { id: fakeUserId, email: fakeEmail } }));
    localStorage.setItem('chessTrainerProfileEmail', fakeEmail);
    localStorage.setItem(`chessTrainerProfile:${fakeEmail}`, JSON.stringify({ email: fakeEmail, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lines: [], openingElo: { white: 800, black: 800 }, progress: { white: {}, black: {} }, rankHistory: [] }));
  }, { fakeEmail, fakeUserId });
}
async function settleSyntheticAuth(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.locator('#cloudAuthGate').evaluate(el => el.remove()).catch(() => {});
  await page.evaluate(() => { try { if (typeof render === 'function') render(); } catch {} });
  await page.waitForTimeout(500);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const url of targets) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const pageErrors = []; page.on('pageerror', err => pageErrors.push(String(err?.message || err)));
      await gotoWithRetry(page, url);
      assert(await page.locator('#cloudAuthGate').isVisible(), `${url} ${viewport.name}: landing/auth gate not visible`);
      assert(await page.getByText('Learn. Practice. Master Your', { exact: false }).first().isVisible(), `${url} ${viewport.name}: hero missing`);
      assert(await page.locator('#heroStart').isVisible(), `${url} ${viewport.name}: primary landing CTA missing`);
      assert(await page.locator('#su').isVisible(), `${url} ${viewport.name}: signup tab missing`);
      await page.locator('#su').click();
      assert(await page.locator('#uw').isVisible(), `${url} ${viewport.name}: signup form did not open`);
      const publicOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(publicOverflow <= 2, `${url} ${viewport.name}: horizontal overflow ${publicOverflow}px on landing`);

      // Current product intentionally skips the old onboarding modal and lands a
      // signed-in user on a dashboard-first next-action hub. The smoke test must
      // validate the shipped journey rather than require a retired modal.
      await seedSignedIn(page); await settleSyntheticAuth(page);
      await page.locator('.cot-activation-hub').waitFor({ state: 'visible', timeout: 7000 });
      assert(!(await page.locator('#cotOnboarding').isVisible().catch(() => false)), `${url} ${viewport.name}: retired onboarding modal unexpectedly visible`);
      const journeyText = await page.locator('.cot-activation-hub').innerText();
      for (const label of ['Your next best action','Continue Training','London System','Caro-Kann','Learn','Practice','Pass','Rank','Next Level']) {
        assert(journeyText.includes(label), `${url} ${viewport.name}: dashboard journey missing ${label}`);
      }
      assert(!/D4 Player|C6 Player/i.test(journeyText), `${url} ${viewport.name}: legacy D4/C6 persona language leaked into dashboard journey`);
      const primary = page.locator('#cotPrimaryNext');
      assert(await primary.isVisible(), `${url} ${viewport.name}: dashboard next-action CTA missing`);
      const signedInOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(signedInOverflow <= 2, `${url} ${viewport.name}: horizontal overflow ${signedInOverflow}px in signed-in journey`);
      const fatalErrors = pageErrors.filter(x => !/401|Unauthorized|Failed to fetch|Session expired|JWT/i.test(x));
      assert(fatalErrors.length === 0, `${url} ${viewport.name}: page errors: ${fatalErrors.join(' | ')}`);
      console.log(`PASS ${viewport.name} ${url}`); await context.close();
    }
  }
} finally { await browser.close(); }
