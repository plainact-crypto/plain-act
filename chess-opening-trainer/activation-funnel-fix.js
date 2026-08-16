// --- Activation funnel measurement hardening ---
(() => {
  if (globalThis.__COT_ACTIVATION_FUNNEL_FIX__) return;
  globalThis.__COT_ACTIVATION_FUNNEL_FIX__ = true;

  const PENDING_KEY = 'cotActivationPendingSignup';
  const COMPLETE_KEY = 'cotActivationSignupComplete:';
  const session = () => {
    try { return JSON.parse(localStorage.getItem('chessTrainerCloudSession') || 'null'); }
    catch { return null; }
  };
  const track = (name, props = {}, once = false) => {
    try { return globalThis.CHESS_ACTIVATION_TRACK?.(name, props, once); }
    catch { return undefined; }
  };

  function markPending(source) {
    const gate = document.querySelector('#cloudAuthGate');
    const create = gate?.querySelector('#su')?.classList.contains('active');
    if (!create) return;
    const email = gate.querySelector('#em')?.value?.trim()?.toLowerCase() || '';
    localStorage.setItem(PENDING_KEY, JSON.stringify({ source, email, at: Date.now() }));
    track('signup_started', { source }, true);
  }

  function completeIfProven() {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch {}
    if (!pending) return;

    const s = session();
    const msg = String(document.querySelector('#cloudAuthGate #msg')?.textContent || '');
    const confirmedByResponse = /account created/i.test(msg);
    const confirmedBySession = Boolean(s?.user?.id && s?.access_token);
    if (!confirmedByResponse && !confirmedBySession) return;

    const identity = s?.user?.id || pending.email || 'anonymous';
    const dedupe = `${COMPLETE_KEY}${identity}`;
    if (!localStorage.getItem(dedupe)) {
      localStorage.setItem(dedupe, new Date().toISOString());
      track('signup_completed', {
        source: pending.source || 'auth_submit',
        email_confirmation_required: !confirmedBySession
      }, false);
    }
    localStorage.removeItem(PENDING_KEY);
  }

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
