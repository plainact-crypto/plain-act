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
async function seedSignedIn(page, onboarded = false) {
  await page.evaluate(({ fakeEmail, fakeUserId, onboarded }) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('chessTrainerCloudSession', JSON.stringify({ access_token: 'activation-smoke-invalid-token', user: { id: fakeUserId, email: fakeEmail } }));
    localStorage.setItem('chessTrainerProfileEmail', fakeEmail);
    localStorage.setItem(`chessTrainerProfile:${fakeEmail}`, JSON.stringify({ email: fakeEmail, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lines: [], openingElo: { white: 800, black: 800 }, progress: { white: {}, black: {} }, rankHistory: [] }));
    if (onboarded) { localStorage.setItem(`cotOnboardingCompleted:${fakeUserId}`, new Date().toISOString()); localStorage.setItem('cotActivationFocus', 'white'); }
  }, { fakeEmail, fakeUserId, onboarded });
}
async function settleSyntheticAuth(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.locator('#cloudAuthGate').evaluate(el => el.remove()).catch(() => {});
  await page.evaluate(() => { try { if (typeof render === 'function') render(); } catch {} });
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

      await seedSignedIn(page, false); await settleSyntheticAuth(page);
      await page.locator('#cotOnboarding').waitFor({ state: 'visible', timeout: 5000 });
      const onboardingText = await page.locator('#cotOnboarding').innerText();
      for (const label of ['Which repertoire do you want to train first?','London System','Caro-Kann','Learn','Practice','Pass','Rank','Next Level']) assert(onboardingText.includes(label), `${url} ${viewport.name}: onboarding missing ${label}`);
      assert(!/D4 Player|C6 Player/i.test(onboardingText), `${url} ${viewport.name}: legacy D4/C6 persona language leaked into onboarding`);
      const go = page.locator('#cotOnboardGo'); assert(await go.isDisabled(), `${url} ${viewport.name}: onboarding CTA should wait for repertoire choice`);
      await page.locator('[data-onboard-side="white"]').click(); assert(!(await go.isDisabled()), `${url} ${viewport.name}: onboarding CTA did not unlock after choice`);
      const onboardOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert(onboardOverflow <= 2, `${url} ${viewport.name}: horizontal overflow ${onboardOverflow}px in onboarding`);
      await go.click({ timeout: 10000 }); await page.waitForTimeout(1000);
      assert(!(await page.locator('#cotOnboarding').isVisible().catch(() => false)), `${url} ${viewport.name}: onboarding did not close`);
      const hasJourneyDestination = await page.evaluate(() => { const body = document.body.innerText || ''; return Boolean(document.querySelector('.cot-activation-hub') || document.querySelector('#board') || /Guided Training|Variation|London System|Caro-Kann/i.test(body)); });
      assert(hasJourneyDestination, `${url} ${viewport.name}: onboarding CTA reached no visible training/dashboard destination`);
      const finalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert(finalOverflow <= 2, `${url} ${viewport.name}: horizontal overflow ${finalOverflow}px after onboarding`);
      const fatalErrors = pageErrors.filter(x => !/401|Unauthorized|Failed to fetch|Session expired|JWT/i.test(x)); assert(fatalErrors.length === 0, `${url} ${viewport.name}: page errors: ${fatalErrors.join(' | ')}`);
      console.log(`PASS ${viewport.name} ${url}`); await context.close();
    }
  }
} finally { await browser.close(); }
