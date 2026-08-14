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
    localStorage.setItem('chessTrainerCloudSession', JSON.stringify({
      access_token: 'activation-smoke-invalid-token',
      user: { id: fakeUserId, email: fakeEmail }
    }));
    localStorage.setItem('chessTrainerProfileEmail', fakeEmail);
    localStorage.setItem(`chessTrainerProfile:${fakeEmail}`, JSON.stringify({
      email: fakeEmail,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      lines: [], openingElo: { white: 800, black: 800 },
      progress: { white: {}, black: {} }, rankHistory: []
    }));
    if (onboarded) {
      localStorage.setItem(`cotOnboardingCompleted:${fakeUserId}`, new Date().toISOString());
      localStorage.setItem('cotActivationFocus', 'white');
    }
  }, { fakeEmail, fakeUserId, onboarded });
}
async function settleSyntheticAuth(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.locator('#cloudAuthGate').evaluate(el => el.remove()).catch(() => {});
  // The regression fix is render-coupled; use the real app render lifecycle, not a DOM mutation trigger.
  await page.evaluate(() => { try { if (typeof render === 'function') render(); } catch {} });
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
      const publicOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(publicOverflow <= 2, `${url} ${viewport.name}: horizontal overflow ${publicOverflow}px on landing`);

      await seedSignedIn(page, false);
      await settleSyntheticAuth(page);
      await page.locator('#cotOnboarding').waitFor({ state: 'visible', timeout: 5000 });
      const onboardingText = await page.locator('#cotOnboarding').innerText();
      for (const label of ['London System','Caro-Kann','Learn','Practice','Pass','Rank','Next Level']) {
        assert(onboardingText.includes(label), `${url} ${viewport.name}: onboarding missing ${label}`);
      }
      const go = page.locator('#cotOnboardGo');
      assert(await go.isDisabled(), `${url} ${viewport.name}: onboarding CTA should wait for repertoire choice`);
      await page.locator('[data-onboard-side="white"]').click();
      assert(!(await go.isDisabled()), `${url} ${viewport.name}: onboarding CTA did not unlock after choice`);
      const onboardOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(onboardOverflow <= 2, `${url} ${viewport.name}: horizontal overflow ${onboardOverflow}px in onboarding`);

      await go.click({ timeout: 10000 });
      await page.waitForTimeout(1000);
      assert(!(await page.locator('#cotOnboarding').isVisible().catch(() => false)), `${url} ${viewport.name}: onboarding did not close`);
      const hasJourneyDestination = await page.evaluate(() => {
        const body = document.body.innerText || '';
        return Boolean(document.querySelector('.cot-activation-hub') || document.querySelector('#board') || /Guided Training|Variation|London System/i.test(body));
      });
      assert(hasJourneyDestination, `${url} ${viewport.name}: onboarding CTA reached no visible training/dashboard destination`);
      const finalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(finalOverflow <= 2, `${url} ${viewport.name}: horizontal overflow ${finalOverflow}px after onboarding`);

      const fatalErrors = pageErrors.filter(x => !/401|Unauthorized|Failed to fetch|Session expired|JWT/i.test(x));
      assert(fatalErrors.length === 0, `${url} ${viewport.name}: page errors: ${fatalErrors.join(' | ')}`);
      console.log(`PASS ${viewport.name} ${url}`);
      await context.close();
    }

    // Activation V2 regression gate: authenticated profile at a real phone viewport.
    const mobile = { width: 390, height: 844 };
    const context = await browser.newContext({ viewport: mobile });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(String(err?.message || err)));
    await gotoWithRetry(page, url);
    await seedSignedIn(page, true);
    await settleSyntheticAuth(page);
    await page.locator('#cotPrimaryNext').waitFor({ state: 'visible', timeout: 5000 });

    const hierarchy = await page.evaluate((viewportHeight) => {
      const cta = document.querySelector('#cotPrimaryNext');
      const hub = document.querySelector('.cot-activation-hub');
      const details = document.querySelector('.cot-progress-details');
      const ctaRect = cta?.getBoundingClientRect();
      const hubRect = hub?.getBoundingClientRect();
      const baseStats = [...document.querySelectorAll('#app *')].filter(el => {
        if (el.closest('.cot-activation-hub')) return false;
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 1 || r.height < 1) return false;
        const own = String(el.textContent || '').trim().replace(/\s+/g, ' ');
        if (!/^(?:0\/30|0\/20)$/.test(own)) return false;
        return ![...el.children].some(ch => /^(?:0\/30|0\/20)$/.test(String(ch.textContent || '').trim().replace(/\s+/g, ' ')));
      }).map(el => el.getBoundingClientRect().top).filter(Number.isFinite);
      return {
        ctaTop: ctaRect?.top ?? null,
        ctaBottom: ctaRect?.bottom ?? null,
        hubTop: hubRect?.top ?? null,
        detailsOpen: Boolean(details?.open),
        detailsTop: details?.getBoundingClientRect().top ?? null,
        firstBaseStatTop: baseStats.length ? Math.min(...baseStats) : null,
        hubCount: document.querySelectorAll('.cot-activation-hub').length,
        inFirstViewport: Boolean(ctaRect && ctaRect.top >= 0 && ctaRect.bottom <= viewportHeight)
      };
    }, mobile.height);
    assert(hierarchy.inFirstViewport, `${url} mobile profile: Continue / Next Best Action is not in first viewport (${JSON.stringify(hierarchy)})`);
    assert(hierarchy.detailsOpen === false, `${url} mobile profile: detailed progress must be collapsed below primary action`);
    assert(hierarchy.hubCount === 1, `${url} mobile profile: duplicate activation hubs detected`);
    if (hierarchy.firstBaseStatTop !== null) {
      assert(hierarchy.ctaTop < hierarchy.firstBaseStatTop, `${url} mobile profile: base 0/30 or 0/20 stats appear before primary CTA`);
    }

    // Force the exact repeated-render condition that caused V2 to remove/reinsert the hub.
    const stability = await page.evaluate(async () => {
      try { if (typeof render === 'function') { render(); render(); render(); } } catch {}
      await Promise.resolve();
      const samples = [];
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const cta = document.querySelector('#cotPrimaryNext');
        const hub = document.querySelector('.cot-activation-hub');
        samples.push({
          cta: cta?.getBoundingClientRect().top ?? null,
          hub: hub?.getBoundingClientRect().top ?? null,
          count: document.querySelectorAll('.cot-activation-hub').length
        });
      }
      const nums = key => samples.map(x => x[key]).filter(Number.isFinite);
      const spread = key => { const a = nums(key); return a.length ? Math.max(...a) - Math.min(...a) : Infinity; };
      return { ctaSpread: spread('cta'), hubSpread: spread('hub'), maxHubCount: Math.max(...samples.map(x => x.count)), samples };
    });
    assert(stability.maxHubCount === 1, `${url} mobile profile: repeated render duplicated activation hub`);
    assert(stability.ctaSpread <= 1, `${url} mobile profile: CTA vertically shifted by ${stability.ctaSpread}px after repeated renders`);
    assert(stability.hubSpread <= 1, `${url} mobile profile: activation hub vertically shifted by ${stability.hubSpread}px after repeated renders`);
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(mobileOverflow <= 2, `${url} mobile profile: horizontal overflow ${mobileOverflow}px`);
    const fatalErrors = pageErrors.filter(x => !/401|Unauthorized|Failed to fetch|Session expired|JWT/i.test(x));
    assert(fatalErrors.length === 0, `${url} mobile profile: page errors: ${fatalErrors.join(' | ')}`);
    console.log(`PASS mobile-profile-stability ${url} CTA=${Math.round(hierarchy.ctaTop)}px spread=${stability.ctaSpread.toFixed(2)}px`);
    await context.close();
  }
} finally {
  await browser.close();
}
