// --- Activation funnel measurement hardening ---
(() => {
  if (globalThis.__COT_ACTIVATION_FUNNEL_FIX__) return;
  globalThis.__COT_ACTIVATION_FUNNEL_FIX__ = true;

  const PENDING_KEY = 'cotActivationPendingSignup';
  const COMPLETE_KEY = 'cotActivationSignupComplete:';
  const PROD_AUTH_REDIRECT = 'https://chess-opening-trainer-3jh.pages.dev/';
  const session = () => {
    try { return JSON.parse(localStorage.getItem('chessTrainerCloudSession') || 'null'); }
    catch { return null; }
  };
  const track = (name, props = {}, once = false) => {
    try { return globalThis.CHESS_ACTIVATION_TRACK?.(name, props, once); }
    catch { return undefined; }
  };

  function pendingSignup() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); }
    catch { return null; }
  }

  function recordCompletion(identity, props = {}) {
    const key = String(identity || 'anonymous');
    const dedupe = `${COMPLETE_KEY}${key}`;
    if (localStorage.getItem(dedupe)) return;
    localStorage.setItem(dedupe, new Date().toISOString());
    track('signup_completed', props, false);
    localStorage.removeItem(PENDING_KEY);
  }

  function markPending(source) {
    const gate = document.querySelector('#cloudAuthGate');
    const create = gate?.querySelector('#su')?.classList.contains('active');
    if (!create) return;
    const email = gate.querySelector('#em')?.value?.trim()?.toLowerCase() || '';
    localStorage.setItem(PENDING_KEY, JSON.stringify({ source, email, at: Date.now() }));
    track('signup_started', { source }, true);
  }

  function completeIfProven() {
    const pending = pendingSignup();
    if (!pending) return;

    const s = session();
    const msg = String(document.querySelector('#cloudAuthGate #msg')?.textContent || '');
    const confirmedByResponse = /account created/i.test(msg);
    const confirmedBySession = Boolean(s?.user?.id && s?.access_token);
    if (!confirmedByResponse && !confirmedBySession) return;

    recordCompletion(s?.user?.id || pending.email || 'anonymous', {
      source: pending.source || 'auth_submit',
      proof: confirmedBySession ? 'authenticated_session' : 'auth_ui_success',
      email_confirmation_required: !confirmedBySession
    });
  }

  // Supabase falls back to the project's Site URL when a signup request does not
  // include redirect_to. The hosted project previously inherited localhost:3000.
  // Force the production app URL into the signup request so confirmation emails
  // return users to the live trainer even if the dashboard Site URL is stale.
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (...args) => {
    let requestArgs = args;
    try {
      const rawUrl = String(args[0]?.url || args[0] || '');
      if (/\/auth\/v1\/signup(?:\?|$)/.test(rawUrl)) {
        const url = new URL(rawUrl);
        url.searchParams.set('redirect_to', PROD_AUTH_REDIRECT);
        requestArgs = [url.toString(), ...args.slice(1)];
      }
    } catch {}

    const response = await nativeFetch(...requestArgs);
    try {
      const url = String(requestArgs[0]?.url || requestArgs[0] || '');
      if (response.ok && /\/auth\/v1\/signup(?:\?|$)/.test(url)) {
        const payload = await response.clone().json().catch(() => null);
        const pending = pendingSignup();
        const userId = payload?.user?.id;
        if (userId || pending) {
          recordCompletion(userId || pending?.email || 'anonymous', {
            source: pending?.source || 'auth_signup_response',
            proof: 'supabase_signup_success',
            email_confirmation_required: !payload?.access_token
          });
        }
      }
    } catch {}
    return response;
  };

  document.addEventListener('click', e => {
    if (e.target?.closest?.('#cloudAuthGate #go')) markPending('auth_submit');
    if (e.target?.closest?.('#cloudAuthGate #heroStart')) track('signup_started', { source: 'hero_cta' }, true);
  }, true);

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target?.closest?.('#cloudAuthGate') && e.target?.matches?.('#pw')) markPending('auth_enter');
  }, true);

  const observer = new MutationObserver(completeIfProven);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  completeIfProven();
})();
