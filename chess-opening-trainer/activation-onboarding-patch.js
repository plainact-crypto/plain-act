// --- Activation & Onboarding: first-minute product journey + funnel analytics ---
(() => {
  if (globalThis.__COT_ACTIVATION_ONBOARDING__) return;
  globalThis.__COT_ACTIVATION_ONBOARDING__ = true;

  const ACTIVATION_EVENTS = new Set([
    'landing_view','signup_started','signup_completed','onboarding_completed',
    'first_training_started','first_variation_completed','practice_started',
    'rank_started','returned_user'
  ]);
  const SESSION_KEY = 'chessTrainerCloudSession';
  const ANON_KEY = 'cotActivationAnonymousId';
  const FOCUS_KEY = 'cotActivationFocus';
  const ONBOARDING_PREFIX = 'cotOnboardingCompleted:';
  const MILESTONE_PREFIX = 'cotActivationMilestone:';
  const LAST_VISIT_PREFIX = 'cotActivationLastVisit:';
  const DEPTHS = [5,10,15,20,25,30];
  const PASS_TARGET = typeof PRACTICE_PASSES_PER_VARIATION === 'number' ? PRACTICE_PASSES_PER_VARIATION : 5;

  const readSession = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  };
  const userId = () => readSession()?.user?.id || '';
  const userEmail = () => readSession()?.user?.email || '';
  const anonId = () => {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  };
  const sessionId = (() => {
    const key = 'cotActivationSessionId';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  })();
  const safeProfile = () => {
    try { return typeof loadProfile === 'function' ? loadProfile() : null; } catch { return null; }
  };
  const safeLevel = (profile, side, depth) => {
    try { return typeof ensureLevelProgress === 'function' ? ensureLevelProgress(profile, side, depth) : null; } catch { return null; }
  };
  const safeOpening = (profile, side) => {
    try { return typeof openingProgress === 'function' ? openingProgress(profile, side) : null; } catch { return null; }
  };
  const completedCount = lp => Array.isArray(lp?.lessons)
    ? lp.lessons.filter(x => Number(x?.passes || 0) >= PASS_TARGET).length : 0;

  async function track(eventName, properties = {}, once = false) {
    if (!ACTIVATION_EVENTS.has(eventName)) return;
    const uid = userId();
    const onceKey = `${MILESTONE_PREFIX}${uid || anonId()}:${eventName}`;
    if (once && localStorage.getItem(onceKey)) return;
    if (once) localStorage.setItem(onceKey, new Date().toISOString());
    const session = readSession();
    const payload = {
      user_id: uid || null,
      anonymous_id: anonId(),
      session_id: sessionId,
      event_name: eventName,
      page_path: `${location.pathname}${location.search}`,
      properties: { ...properties, email_domain: userEmail().split('@')[1] || null },
      occurred_at: new Date().toISOString()
    };
    try {
      const h = typeof headers === 'function' ? headers(session?.access_token) : {
        apikey: globalThis.CHESS_SUPABASE?.key || '',
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
      };
      const base = typeof SB_URL === 'string' ? SB_URL : globalThis.CHESS_SUPABASE?.url;
      if (!base) return;
      await fetch(`${base}/rest/v1/activation_events`, {
        method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(payload), keepalive: true
      });
    } catch (err) {
      console.warn('Activation analytics event failed', eventName, err);
    }
  }
  globalThis.CHESS_ACTIVATION_TRACK = track;

  const style = document.createElement('style');
  style.textContent = `
    .cot-activation-hub{margin:14px auto 24px;max-width:1180px;padding:0 18px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#edf3f7}
    .cot-next-card{background:linear-gradient(135deg,#111a24,#0c1219);border:1px solid #334253;border-radius:18px;padding:20px;box-shadow:0 16px 42px #0003}
    .cot-next-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;align-items:center}.cot-next-kicker{color:#c8ff5a;font-size:11px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.cot-next-title{font-size:27px;line-height:1.1;margin:6px 0 7px}.cot-next-copy{color:#9eabb7;line-height:1.45;margin:0}.cot-next-action{justify-self:end;border:0;background:#c8ff5a;color:#091016;border-radius:12px;padding:14px 18px;font-weight:950;cursor:pointer;min-width:210px}.cot-next-action:hover{filter:brightness(1.04)}
    .cot-journey{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:14px 0 0}.cot-journey span{border:1px solid #2b3948;background:#0c131b;border-radius:10px;padding:9px 7px;text-align:center;color:#9da9b5;font-size:12px;font-weight:850}.cot-journey span.active{border-color:#9ed73d;color:#dfff9d;background:#18220f}.cot-journey b{color:#71808d;margin-left:5px}
    .cot-opening-progress{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.cot-opening-card{border:1px solid #283646;background:#0d151d;border-radius:14px;padding:15px}.cot-opening-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.cot-opening-head strong{font-size:17px}.cot-opening-head small{display:block;color:#8f9ba6;margin-top:3px}.cot-elo{text-align:right}.cot-elo b{font-size:21px;display:block}.cot-elo small{color:#8996a2}.cot-meter{height:7px;border-radius:999px;background:#1b2732;overflow:hidden;margin:12px 0 8px}.cot-meter i{display:block;height:100%;background:#c8ff5a;border-radius:inherit}.cot-opening-meta{display:flex;justify-content:space-between;gap:10px;color:#a9b4be;font-size:12px;line-height:1.4}.cot-opening-meta b{color:#f2f6f8}.cot-opening-card button{width:100%;margin-top:12px;border:1px solid #405063;background:#151f29;color:#fff;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer}.cot-opening-card button.primary{border:0;background:#c8ff5a;color:#0b1116}
    #cotOnboarding{position:fixed;inset:0;z-index:20000;background:#05090dcc;backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px;font-family:Inter,ui-sans-serif,system-ui;color:#eef4f7}.cot-onboard-card{width:min(720px,100%);background:#0d151d;border:1px solid #344454;border-radius:20px;padding:26px;box-shadow:0 32px 100px #000b}.cot-onboard-card h2{font-size:31px;line-height:1.08;margin:6px 0 9px}.cot-onboard-card>p{color:#a7b2bc;line-height:1.5;margin:0 0 20px}.cot-side-choice{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cot-side-choice button{border:1px solid #344657;background:#111c26;color:#fff;border-radius:14px;padding:18px;text-align:left;cursor:pointer}.cot-side-choice button:hover,.cot-side-choice button.selected{border-color:#c8ff5a;box-shadow:0 0 0 2px #c8ff5a22}.cot-side-choice strong{display:block;font-size:19px;margin-bottom:4px}.cot-side-choice span{color:#94a2ae;font-size:13px}.cot-onboard-path{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:20px 0 16px}.cot-onboard-path div{background:#080f15;border:1px solid #263440;border-radius:10px;padding:10px 6px;text-align:center;font-size:12px;font-weight:900}.cot-onboard-path em{display:block;color:#c8ff5a;font-style:normal;font-size:10px;margin-bottom:3px}.cot-onboard-go{width:100%;border:0;border-radius:12px;background:#c8ff5a;color:#081016;padding:14px;font-weight:950;cursor:pointer}.cot-onboard-go:disabled{opacity:.45;cursor:not-allowed}.cot-onboard-note{text-align:center!important;color:#74818c!important;font-size:12px!important;margin:10px 0 0!important}
    .cot-session-next{margin-top:12px;border:1px solid #405064;background:#101a23;border-radius:12px;padding:13px}.cot-session-next b{display:block;color:#c8ff5a;margin-bottom:4px}.cot-session-next p{margin:0 0 10px;color:#aab5bf;line-height:1.4}.cot-session-next button{border:0;background:#c8ff5a;color:#091016;border-radius:9px;padding:9px 12px;font-weight:900;cursor:pointer}
    @media(max-width:760px){.cot-activation-hub{padding:0 10px;margin-top:10px}.cot-next-grid{grid-template-columns:1fr}.cot-next-action{justify-self:stretch;width:100%}.cot-next-title{font-size:23px}.cot-journey{grid-template-columns:1fr}.cot-journey span{text-align:left;padding:8px 10px}.cot-opening-progress{grid-template-columns:1fr}.cot-opening-meta{flex-direction:column;gap:3px}.cot-side-choice{grid-template-columns:1fr}.cot-onboard-card{padding:20px 16px}.cot-onboard-card h2{font-size:26px}.cot-onboard-path{grid-template-columns:1fr}.cot-onboard-path div{display:flex;gap:8px;align-items:center;text-align:left}.cot-onboard-path em{display:inline;margin:0}}
  `;
  document.head.appendChild(style);

  function openingName(side) { return side === 'white' ? 'London System' : 'Caro-Kann'; }
  function openingSub(side) { return side === 'white' ? 'White repertoire' : 'Black repertoire'; }
  function focusSide(profile) {
    const saved = localStorage.getItem(FOCUS_KEY);
    if (saved === 'white' || saved === 'black') return saved;
    const w = safeOpening(profile, 'white')?.capped || 0;
    const b = safeOpening(profile, 'black')?.capped || 0;
    return b > w ? 'black' : 'white';
  }
  function nextFor(profile, side) {
    for (const depth of DEPTHS) {
      const lp = safeLevel(profile, side, depth);
      const lessons = Array.isArray(lp?.lessons) ? lp.lessons : [];
      const rank = (() => { try { return typeof rankUnlockProgress === 'function' ? rankUnlockProgress(lp) : null; } catch { return null; } })();
      if (rank?.unlocked && !lp?.rankCompleted) {
        return { side, depth, variation: 0, mode: 'rank', label: `Take ${depth}-move Rank Test`, detail: `${rank.completed}/${rank.required} variations ready` };
      }
      for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i] || {};
        const passes = Number(lesson.passes || 0);
        if (passes >= PASS_TARGET) continue;
        const hasLearnedLine = Array.isArray(lesson.lines) ? lesson.lines.length > 0 : Boolean(lesson.line || lesson.savedLine || passes > 0);
        if (!hasLearnedLine && passes === 0) return { side, depth, variation: i, mode: 'guided', label: `Learn Variation ${i + 1}`, detail: `${openingName(side)} · ${depth} moves` };
        return { side, depth, variation: i, mode: 'test', label: `Practice Variation ${i + 1}`, detail: `${passes}/${PASS_TARGET} valid passes · ${depth} moves` };
      }
    }
    return { side, depth: 30, variation: 0, mode: 'rank', label: 'Take your next Rank Test', detail: `${openingName(side)} · keep your rank current` };
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  function candidateButtons() { return [...document.querySelectorAll('button,[role="button"],a')].filter(visible); }
  function clickMatching(regexes) {
    for (const re of regexes) {
      const el = candidateButtons().find(x => re.test(String(x.textContent || '').replace(/\s+/g, ' ').trim()));
      if (el) { el.click(); return true; }
    }
    return false;
  }
  function clickVariation(index) {
    const re = new RegExp(`Variation\\s*${index + 1}(?:\\D|$)`, 'i');
    const direct = candidateButtons().find(x => re.test(String(x.textContent || '')));
    if (direct) { direct.click(); return true; }
    const card = [...document.querySelectorAll('article,section,div')].find(x => re.test(String(x.textContent || '')) && x.querySelector('button'));
    const btn = card?.querySelector('button');
    if (btn && visible(btn)) { btn.click(); return true; }
    return false;
  }
  function driveTo(action) {
    localStorage.setItem(FOCUS_KEY, action.side);
    document.querySelector('#cotOnboarding')?.remove();
    document.querySelector('#cloudAuthGate')?.remove();
    try { if (typeof render === 'function') render(); } catch {}

    const sidePatterns = action.side === 'white'
      ? [/London System/i,/\bWhite\b/i]
      : [/Caro-?Kann/i,/\bBlack\b/i];
    const depthPatterns = [new RegExp(`(?:Depth|Level|Open)[^\\n]{0,18}\\b${action.depth}\\b`, 'i'), new RegExp(`\\b${action.depth}\\s*(?:moves|move)`, 'i')];
    const modePatterns = action.mode === 'rank' ? [/Rank Test/i,/Start Rank/i]
      : action.mode === 'test' ? [/Practice/i,/Test from memory/i,/Start Practice/i]
      : [/Guided Training/i,/Start Guided/i,/Learn/i,/Train/i];

    const steps = [
      () => clickMatching(sidePatterns),
      () => clickMatching(depthPatterns),
      () => action.mode === 'rank' ? true : clickVariation(action.variation),
      () => clickMatching(modePatterns)
    ];
    let step = 0, attempts = 0;
    const tick = () => {
      if (step >= steps.length) return;
      let ok = false;
      try { ok = steps[step](); } catch {}
      if (ok) { step++; attempts = 0; setTimeout(tick, 130); return; }
      attempts++;
      if (attempts < 8) { setTimeout(tick, 180); return; }
      step++; attempts = 0;
      setTimeout(tick, 120);
    };
    setTimeout(tick, 80);
  }

  function openingCard(profile, side, focused) {
    const prog = safeOpening(profile, side) || {};
    const count = Math.max(0, Math.min(30, Number(prog.capped || 0)));
    const pct = Math.round((count / 30) * 100);
    const action = nextFor(profile, side);
    const lp = safeLevel(profile, side, action.depth);
    const rank = (() => { try { return typeof rankUnlockProgress === 'function' ? rankUnlockProgress(lp) : null; } catch { return null; } })();
    const elo = Math.round(Number(profile?.openingElo?.[side] || 800));
    let label = '';
    try { label = typeof progressionLabel === 'function' ? progressionLabel(prog) : (count >= 30 ? 'Mastered' : `Level ${Math.floor(count / 5) + 1}`); } catch { label = `${count}/30`; }
    const rankText = rank?.unlocked ? 'Rank Test unlocked' : `Rank ${rank?.completed ?? completedCount(lp)}/${rank?.required ?? 5}`;
    return `<article class="cot-opening-card" data-opening-side="${side}">
      <div class="cot-opening-head"><div><strong>${openingName(side)}</strong><small>${openingSub(side)} · ${label}</small></div><div class="cot-elo"><b>${elo}</b><small>Opening Elo</small></div></div>
      <div class="cot-meter"><i style="width:${pct}%"></i></div>
      <div class="cot-opening-meta"><span><b>${count}/30</b> completed variations</span><span>${rankText}</span></div>
      <button class="${focused ? 'primary' : ''}" data-next-side="${side}">${action.label}<br><small style="font-weight:650;opacity:.75">${action.detail}</small></button>
    </article>`;
  }

  function renderHub() {
    const session = readSession();
    if (!session?.user?.id || document.querySelector('#cloudAuthGate') || document.querySelector('#cotOnboarding')) {
      document.querySelector('.cot-activation-hub')?.remove();
      return;
    }
    try { if (state?.screen === 'training') { document.querySelector('.cot-activation-hub')?.remove(); return; } } catch {}
    const app = document.querySelector('#app');
    if (!app) return;
    const profile = safeProfile();
    if (!profile) return;
    const focus = focusSide(profile);
    const action = nextFor(profile, focus);
    let hub = document.querySelector('.cot-activation-hub');
    if (!hub) { hub = document.createElement('section'); hub.className = 'cot-activation-hub'; app.prepend(hub); }
    hub.innerHTML = `<div class="cot-next-card">
      <div class="cot-next-grid"><div><div class="cot-next-kicker">Your next best action</div><h2 class="cot-next-title">${action.label}</h2><p class="cot-next-copy">${action.detail}. Finish this step, then the trainer will move you forward.</p></div><button class="cot-next-action" id="cotPrimaryNext">Continue Training →</button></div>
      <div class="cot-journey" aria-label="Training journey"><span class="${action.mode==='guided'?'active':''}">Learn <b>→</b></span><span class="${action.mode==='test'?'active':''}">Practice <b>→</b></span><span>Pass <b>→</b></span><span class="${action.mode==='rank'?'active':''}">Rank <b>→</b></span><span>Next Level</span></div>
      <div class="cot-opening-progress">${openingCard(profile,'white',focus==='white')}${openingCard(profile,'black',focus==='black')}</div>
    </div>`;
    hub.querySelector('#cotPrimaryNext')?.addEventListener('click', () => driveTo(action));
    hub.querySelectorAll('[data-next-side]').forEach(btn => btn.addEventListener('click', () => driveTo(nextFor(profile, btn.dataset.nextSide))));
  }

  function onboardingDone(uid = userId()) { return Boolean(uid && localStorage.getItem(`${ONBOARDING_PREFIX}${uid}`)); }
  function finishOnboarding(side, start = true) {
    const uid = userId();
    if (!uid) return;
    localStorage.setItem(`${ONBOARDING_PREFIX}${uid}`, new Date().toISOString());
    localStorage.setItem(FOCUS_KEY, side);
    track('onboarding_completed', { focus_side: side }, true);
    document.querySelector('#cotOnboarding')?.remove();
    renderHub();
    if (start) driveTo(nextFor(safeProfile(), side));
  }
  function showOnboarding() {
    const session = readSession();
    if (!session?.user?.id || onboardingDone(session.user.id) || document.querySelector('#cotOnboarding') || document.querySelector('#cloudAuthGate')) return;
    const modal = document.createElement('div'); modal.id = 'cotOnboarding';
    modal.innerHTML = `<div class="cot-onboard-card"><div class="cot-next-kicker">60-second setup</div><h2>Which repertoire do you want to train first?</h2><p>Pick one. You can switch any time. The trainer will always show one clear next step.</p>
      <div class="cot-side-choice"><button data-onboard-side="white"><strong>♙ London System</strong><span>Train your White repertoire first</span></button><button data-onboard-side="black"><strong>♟ Caro-Kann</strong><span>Train your Black repertoire first</span></button></div>
      <div class="cot-onboard-path"><div><em>1</em>Learn</div><div><em>2</em>Practice</div><div><em>3</em>Pass</div><div><em>4</em>Rank</div><div><em>5</em>Next Level</div></div>
      <button class="cot-onboard-go" id="cotOnboardGo" disabled>Start my first Guided Training →</button><p class="cot-onboard-note">Your progress, Rank status and Opening Elo will stay visible on the dashboard.</p></div>`;
    document.body.appendChild(modal);
    let selected = '';
    modal.querySelectorAll('[data-onboard-side]').forEach(btn => btn.addEventListener('click', () => {
      selected = btn.dataset.onboardSide; modal.querySelectorAll('[data-onboard-side]').forEach(x => x.classList.toggle('selected', x === btn));
      modal.querySelector('#cotOnboardGo').disabled = false;
    }));
    modal.querySelector('#cotOnboardGo')?.addEventListener('click', () => selected && finishOnboarding(selected, true));
  }

  function addSessionNextStep() {
    try {
      if (state?.screen !== 'training') return;
      const mode = state?.mode || '';
      const candidates = [...document.querySelectorAll('.side-panel,aside,main,section')];
      const completed = candidates.find(el => {
        const t = String(el.textContent || '');
        return /Session Complete|Training Complete|Practice Complete|Rank Test Complete|Test Complete/i.test(t) || (/Back to Level|Try Again|Review My Mistakes/i.test(t) && /moves|score|passes|accuracy/i.test(t));
      });
      if (!completed || completed.querySelector('.cot-session-next')) return;
      const box = document.createElement('div'); box.className = 'cot-session-next';
      const profile = safeProfile(); const side = state?.side === 'black' ? 'black' : 'white'; const next = nextFor(profile, side);
      const achieved = mode === 'rank' ? 'Rank Test recorded and your Opening Elo/status is updated.' : mode === 'test' ? 'Practice result recorded toward this variation’s pass requirement.' : 'Guided session completed; the line is ready to be recalled from memory.';
      box.innerHTML = `<b>What you achieved</b><p>${achieved}<br><strong>Next:</strong> ${next.label} — ${next.detail}.</p><button>Continue →</button>`;
      box.querySelector('button')?.addEventListener('click', () => driveTo(next));
      completed.appendChild(box);
    } catch {}
  }

  function inspectMilestones() {
    const session = readSession();
    if (!session?.user?.id) return;
    try {
      if (state?.screen === 'training') {
        if (state?.mode === 'guided') track('first_training_started', { side: state?.side, depth: state?.sessionLength }, true);
        if (state?.mode === 'test') track('practice_started', { side: state?.side, depth: state?.sessionLength });
        if (state?.mode === 'rank') track('rank_started', { side: state?.side, depth: state?.sessionLength });
      }
    } catch {}
    const profile = safeProfile();
    if (profile) {
      const hasCompleted = ['white','black'].some(side => DEPTHS.some(depth => completedCount(safeLevel(profile,side,depth)) > 0));
      if (hasCompleted) track('first_variation_completed', {}, true);
    }
  }

  function markReturn() {
    const uid = userId(); if (!uid) return;
    const key = `${LAST_VISIT_PREFIX}${uid}`; const prior = Number(localStorage.getItem(key) || 0); const now = Date.now();
    if (prior && now - prior > 30 * 60 * 1000) track('returned_user', { minutes_since_last_visit: Math.round((now-prior)/60000) });
    localStorage.setItem(key, String(now));
  }

  // Auth funnel instrumentation without changing auth behavior.
  try {
    if (typeof signUp === 'function') {
      const originalSignUp = signUp;
      signUp = async function(...args) {
        track('signup_started', { source: 'auth_submit' }, true);
        const result = await originalSignUp(...args);
        track('signup_completed', { email_confirmation_required: !result?.access_token }, true);
        return result;
      };
    }
  } catch {}
  document.addEventListener('click', e => {
    const target = e.target?.closest?.('#su,#heroStart,[data-scroll],button');
    if (!target) return;
    if (target.id === 'su') track('signup_started', { source: 'signup_tab' }, true);
  }, true);

  let lastMode = '';
  const observer = new MutationObserver(() => queueMicrotask(() => {
    if (document.querySelector('#cloudAuthGate')) track('landing_view', {}, true);
    const session = readSession();
    if (session?.user?.id) {
      showOnboarding(); renderHub(); addSessionNextStep();
      let mode = ''; try { mode = `${state?.screen||''}:${state?.mode||''}`; } catch {}
      if (mode !== lastMode) { lastMode = mode; inspectMilestones(); }
    }
  }));
  observer.observe(document.documentElement, { childList:true, subtree:true });

  track('landing_view', {}, true);
  if (userId()) { markReturn(); setTimeout(() => { showOnboarding(); renderHub(); inspectMilestones(); }, 250); }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && userId()) localStorage.setItem(`${LAST_VISIT_PREFIX}${userId()}`, String(Date.now())); });
})();
