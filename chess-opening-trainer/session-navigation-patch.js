// --- Session refresh + in-app report navigation fix ---
// Keeps long-lived mobile sessions usable and prevents Android/browser Back
// from leaving the site while the Report Issue dialog is open.
(() => {
  const sessionKey = "chessTrainerCloudSession";

  function readSession(){
    try{return JSON.parse(localStorage.getItem(sessionKey)||"null")}catch{return null}
  }
  function writeSession(s){
    if(s) localStorage.setItem(sessionKey,JSON.stringify(s));
  }
  function jwtExp(token){
    try{
      const p=token.split('.')[1];
      const json=atob(p.replace(/-/g,'+').replace(/_/g,'/'));
      return Number(JSON.parse(json)?.exp||0);
    }catch{return 0}
  }
  function expiresSoon(s,skew=90){
    if(!s?.access_token) return true;
    const exp=Number(s.expires_at||jwtExp(s.access_token)||0);
    return !!exp && exp <= Math.floor(Date.now()/1000)+skew;
  }

  let refreshPromise=null;
  async function refreshChessSession(force=false){
    const current=readSession();
    if(!current?.refresh_token) return current;
    if(!force && !expiresSoon(current)) return current;
    if(refreshPromise) return refreshPromise;
    const sb=window.CHESS_SUPABASE;
    if(!sb?.url||!sb?.key) return current;
    refreshPromise=(async()=>{
      try{
        const r=await fetch(`${sb.url}/auth/v1/token?grant_type=refresh_token`,{
          method:'POST',
          headers:{apikey:sb.key,'Content-Type':'application/json'},
          body:JSON.stringify({refresh_token:current.refresh_token})
        });
        const d=await r.json().catch(()=>({}));
        if(!r.ok||!d?.access_token) throw new Error(d?.message||d?.msg||'Session refresh failed');
        // Supabase may rotate refresh tokens. Always persist the newest session.
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

  // Refresh proactively when returning to the tab/app after it has been idle.
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') refreshChessSession(false).catch(()=>{});
  });
  window.addEventListener('focus',()=>refreshChessSession(false).catch(()=>{}));

  // Make issue submission resilient to an expired access token. Refresh before
  // sending when needed; if the server still says JWT expired, refresh and retry once.
  try{
    if(typeof submitIssueReport==='function' && !globalThis.__ISSUE_SESSION_RETRY__){
      globalThis.__ISSUE_SESSION_RETRY__=true;
      const originalSubmitIssueReport=submitIssueReport;
      submitIssueReport=async function(description,guestEmail=""){
        try{await refreshChessSession(false)}catch{}
        try{
          return await originalSubmitIssueReport(description,guestEmail);
        }catch(err){
          const msg=String(err?.message||err||'');
          if(!/jwt\s*expired|token\s*expired|invalid\s*jwt/i.test(msg)) throw err;
          await refreshChessSession(true);
          return originalSubmitIssueReport(description,guestEmail);
        }
      };
    }
  }catch(err){console.warn('Issue session retry could not attach',err)}

  // Give the report modal its own history entry. Android/browser Back closes the
  // report and returns to the exact trainer screen instead of navigating away.
  try{
    if(typeof openIssueReport==='function' && !globalThis.__ISSUE_HISTORY_FIX__){
      globalThis.__ISSUE_HISTORY_FIX__=true;
      const originalOpenIssueReport=openIssueReport;
      let reportHistoryActive=false;
      let closingFromPop=false;

      const closeReport=(consumeHistory=true)=>{
        const modal=document.querySelector('#issueReportModal');
        if(modal) modal.remove();
        if(consumeHistory && reportHistoryActive && !closingFromPop){
          reportHistoryActive=false;
          history.back();
        }else{
          reportHistoryActive=false;
        }
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
