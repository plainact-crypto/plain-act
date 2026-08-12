// --- Session refresh + signed-in hero + in-app report navigation fix ---
(() => {
  const sessionKey = "chessTrainerCloudSession";

  function readSession(){
    try{return JSON.parse(localStorage.getItem(sessionKey)||"null")}catch{return null}
  }
  function writeSession(s){
    if(s) localStorage.setItem(sessionKey,JSON.stringify(s));
  }
  function clearSession(){localStorage.removeItem(sessionKey)}
  function jwtExp(token){
    try{
      const p=String(token||"").split('.')[1]||"";
      const padded=p.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-p.length%4)%4);
      return Number(JSON.parse(atob(padded))?.exp||0);
    }catch{return 0}
  }
  function expiresSoon(s,skew=180){
    if(!s?.access_token) return true;
    const exp=Number(s.expires_at||jwtExp(s.access_token)||0);
    return !exp || exp <= Math.floor(Date.now()/1000)+skew;
  }

  let refreshPromise=null;
  async function refreshChessSession(force=false){
    const current=readSession();
    if(!current?.access_token) return current;
    if(!force && !expiresSoon(current)) return current;
    if(!current?.refresh_token) throw new Error('Session expired');
    if(refreshPromise) return refreshPromise;
    const sb=window.CHESS_SUPABASE;
    if(!sb?.url||!sb?.key) throw new Error('Session service unavailable');
    refreshPromise=(async()=>{
      try{
        const r=await fetch(`${sb.url}/auth/v1/token?grant_type=refresh_token`,{
          method:'POST',
          headers:{apikey:sb.key,'Content-Type':'application/json'},
          body:JSON.stringify({refresh_token:current.refresh_token})
        });
        const d=await r.json().catch(()=>({}));
        if(!r.ok||!d?.access_token) throw new Error(d?.message||d?.msg||'Session expired');
        const next={...current,...d,user:d.user||current.user};
        writeSession(next);
        return next;
      } finally {
        refreshPromise=null;
      }
    })();
    return refreshPromise;
  }
  window.CHESS_AUTH_REFRESH=refreshChessSession;
  // Always expose the newest locally-persisted session to report/progress code.
  window.CHESS_AUTH_SESSION=readSession;

  // Refresh while the app is active and whenever mobile Chrome resumes it.
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') refreshChessSession(false).catch(()=>{});
  });
  window.addEventListener('focus',()=>refreshChessSession(false).catch(()=>{}));
  setInterval(()=>refreshChessSession(false).catch(()=>{}),4*60*1000);

  // Make reports survive an expired/rotated JWT. First refresh normally. If the
  // access token is rejected anyway, force-refresh and retry once. If the refresh
  // token itself is no longer usable, preserve the report by submitting as a guest
  // with the signed-in email instead of exposing a raw "JWT expired" error.
  try{
    if(typeof submitIssueReport==='function' && !globalThis.__ISSUE_SESSION_RETRY__){
      globalThis.__ISSUE_SESSION_RETRY__=true;
      const originalSubmitIssueReport=submitIssueReport;
      submitIssueReport=async function(description,guestEmail=""){
        const before=readSession();
        const fallbackEmail=guestEmail||before?.user?.email||state?.profileEmail||"";
        try{await refreshChessSession(false)}catch{}
        try{
          return await originalSubmitIssueReport(description,fallbackEmail);
        }catch(err){
          const msg=String(err?.message||err||'');
          if(!/jwt\s*expired|token\s*expired|invalid\s*jwt|401|unauthorized/i.test(msg)) throw err;
          try{
            await refreshChessSession(true);
            return await originalSubmitIssueReport(description,fallbackEmail);
          }catch(refreshErr){
            // Guest reports are supported by the report endpoint. Temporarily hide
            // the stale auth session so the same report can still be delivered.
            const savedAccessor=window.CHESS_AUTH_SESSION;
            window.CHESS_AUTH_SESSION=()=>null;
            try{return await originalSubmitIssueReport(description,fallbackEmail)}
            finally{window.CHESS_AUTH_SESSION=savedAccessor}
          }
        }
      };
    }
  }catch(err){console.warn('Issue session retry could not attach',err)}

  // Signed-in users must still be able to see the public Hero/Landing page.
  // Reuse the existing landing page, but replace the auth form with an account
  // state and a Continue Training action rather than asking them to sign in again.
  try{
    if(typeof authScreen==='function' && !globalThis.__SIGNED_IN_HERO__){
      globalThis.__SIGNED_IN_HERO__=true;
      const originalAuthScreen=authScreen;
      const originalBadge=typeof badge==='function'?badge:null;
      let heroHistoryActive=false;

      function closeSignedInHero(consumeHistory=true){
        document.querySelector('#cloudAuthGate')?.remove();
        if(consumeHistory && heroHistoryActive){
          heroHistoryActive=false;
          history.back();
        }else heroHistoryActive=false;
      }

      function showSignedInHero(){
        const s=readSession();
        if(!s?.user?.id){originalAuthScreen();return}
        originalAuthScreen();
        const gate=document.querySelector('#cloudAuthGate');
        if(!gate) return;
        const card=gate.querySelector('#authCard');
        if(card){
          card.innerHTML=`<div class="cot-kicker">Signed in</div><h2 style="margin-top:8px">Welcome back</h2><p class="cot-muted">${s.user.email||''}</p><div class="cot-points" style="margin:24px 0"><div class="cot-point"><span class="cot-dot">✓</span>Your repertoire and progress stay connected to this account.</div></div><button id="continueTrainingSignedIn" class="cot-primary cot-submit">Continue Training</button><button id="signOutFromHero" class="cot-secondary" style="width:100%;margin-top:10px">Sign out</button>`;
          card.querySelector('#continueTrainingSignedIn')?.addEventListener('click',()=>closeSignedInHero(true));
          card.querySelector('#signOutFromHero')?.addEventListener('click',()=>{clearSession();location.reload()});
        }
        const heroStart=gate.querySelector('#heroStart');
        if(heroStart){
          const b=heroStart.cloneNode(true);heroStart.replaceWith(b);
          b.textContent='Continue Training';
          b.addEventListener('click',()=>closeSignedInHero(true));
        }
        if(!heroHistoryActive){
          history.pushState({...(history.state||{}),chessSignedInHero:true},'',location.href);
          heroHistoryActive=true;
        }
      }
      window.CHESS_SHOW_HOME=showSignedInHero;

      if(originalBadge){
        badge=function(s){
          originalBadge(s);
          const d=document.querySelector('#cloudAccountBadge');
          if(!d||d.querySelector('#cloudHome')) return;
          const home=document.createElement('button');
          home.id='cloudHome';home.type='button';home.textContent='Home';
          home.style.cssText='margin-left:8px;border:1px solid #44515e;border-radius:999px;padding:6px 9px;background:#171f28;color:#fff;font-weight:800';
          const out=d.querySelector('#cloudOut');
          d.insertBefore(home,out||null);
          home.addEventListener('click',showSignedInHero);
        };
      }

      window.addEventListener('popstate',()=>{
        if(heroHistoryActive){
          heroHistoryActive=false;
          document.querySelector('#cloudAuthGate')?.remove();
        }
      });
    }
  }catch(err){console.warn('Signed-in hero navigation could not attach',err)}

  // Give Report Issue its own history entry. Android/browser Back closes the
  // report and returns to the exact trainer screen instead of leaving the site.
  try{
    if(typeof openIssueReport==='function' && !globalThis.__ISSUE_HISTORY_FIX__){
      globalThis.__ISSUE_HISTORY_FIX__=true;
      const originalOpenIssueReport=openIssueReport;
      let reportHistoryActive=false;
      let closingFromPop=false;

      const closeReport=(consumeHistory=true)=>{
        document.querySelector('#issueReportModal')?.remove();
        if(consumeHistory && reportHistoryActive && !closingFromPop){
          reportHistoryActive=false;
          history.back();
        }else reportHistoryActive=false;
      };

      window.addEventListener('popstate',()=>{
        if(!reportHistoryActive) return;
        closingFromPop=true;
        reportHistoryActive=false;
        document.querySelector('#issueReportModal')?.remove();
        queueMicrotask(()=>{closingFromPop=false});
      });

      openIssueReport=function(...args){
        originalOpenIssueReport(...args);
        const modal=document.querySelector('#issueReportModal');
        if(!modal) return;
        if(!reportHistoryActive){
          history.pushState({...(history.state||{}),chessIssueReport:true},'',location.href);
          reportHistoryActive=true;
        }
        const card=modal.querySelector('.issue-card');
        const title=card?.querySelector('h2');
        if(card && title && !card.querySelector('#issueBackBtn')){
          const head=document.createElement('div');
          head.style.cssText='display:flex;align-items:center;gap:10px;margin-bottom:12px';
          const back=document.createElement('button');
          back.type='button';back.id='issueBackBtn';back.textContent='← Back';
          back.style.cssText='border:0;background:transparent;color:#c8ff5a;font-weight:900;font-size:15px;padding:7px 4px;cursor:pointer';
          title.style.margin='0';
          title.parentNode.insertBefore(head,title);
          head.append(back,title);
          back.addEventListener('click',()=>closeReport(true));
        }
        const cancel=modal.querySelector('#cancelIssueReport');
        if(cancel){
          const replacement=cancel.cloneNode(true);
          cancel.replaceWith(replacement);
          replacement.addEventListener('click',()=>closeReport(true));
        }
        modal.addEventListener('click',e=>{if(e.target===modal){e.stopImmediatePropagation();closeReport(true)}},true);
      };
    }
  }catch(err){console.warn('Issue history navigation could not attach',err)}
})();
