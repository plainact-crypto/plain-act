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
  window.CHESS_AUTH_SESSION=readSession;

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') refreshChessSession(false).catch(()=>{});
  });
  window.addEventListener('focus',()=>refreshChessSession(false).catch(()=>{}));
  setInterval(()=>refreshChessSession(false).catch(()=>{}),4*60*1000);

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
            const savedAccessor=window.CHESS_AUTH_SESSION;
            window.CHESS_AUTH_SESSION=()=>null;
            try{return await originalSubmitIssueReport(description,fallbackEmail)}
            finally{window.CHESS_AUTH_SESSION=savedAccessor}
          }
        }
      };
    }
  }catch(err){console.warn('Issue session retry could not attach',err)}

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

// --- Guided recommendation safety (Report #25) ---
try{
  if(!globalThis.__GUIDED_RECOMMENDATION_SAFETY_25__){
    globalThis.__GUIDED_RECOMMENDATION_SAFETY_25__=true;
    const MAX_REPERTOIRE_LOSS_CP=35;
    bestRepertoireMove=async function(){
      try{
        if(typeof repertoireAnchorForFen==='function'){
          const anchor=repertoireAnchorForFen(state.chess,state.side);
          if(anchor){
            const from=anchor.slice(0,2),to=anchor.slice(2,4),promotion=anchor[4]||null;
            const legal=state.chess.moves({square:from,verbose:true}).some(m=>m.to===to);
            if(legal) return {from,to,promotion};
          }
        }
      }catch{}
      const candidates=repertoireCandidates();
      if(!candidates.length){
        const best=await bestMove();
        return best?{from:best.slice(0,2),to:best.slice(2,4),promotion:best[4]||null}:null;
      }
      let repertoireBest=null;
      for(const candidate of candidates){
        const scored=await evaluateCandidate(candidate);
        if(!repertoireBest||scored.score>repertoireBest.score) repertoireBest=scored;
      }
      const unrestricted=await bestMove();
      if(unrestricted){
        const fallback={from:unrestricted.slice(0,2),to:unrestricted.slice(2,4),promotion:unrestricted[4]||null};
        const fallbackResult=await evaluateCandidate(fallback);
        if(!repertoireBest||fallbackResult.score>repertoireBest.score+MAX_REPERTOIRE_LOSS_CP) return fallback;
      }
      return repertoireBest?.candidate||null;
    };
  }
}catch(err){console.warn('Guided recommendation safety patch could not attach',err)}

// --- Resume exact in-progress training on browser reload (Report #26) ---
try{
  if(!globalThis.__TRAINING_RELOAD_RESUME_26__){
    globalThis.__TRAINING_RELOAD_RESUME_26__=true;
    const SNAPSHOT_KEY='cotTrainerReloadSnapshot:v1';
    const AUTH_KEY='chessTrainerCloudSession';
    const navType=performance.getEntriesByType?.('navigation')?.[0]?.type||'';
    const readAuth=()=>{try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch{return null}};
    const readSnap=()=>{try{return JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY)||'null')}catch{return null}};
    const userTurn=()=>{try{return state.chess.turn()===(state.side==='white'?'w':'b')}catch{return false}};

    function saveTrainerSnapshot(){
      try{
        const auth=readAuth();
        if(!auth?.user?.id||state?.screen!=='training'||state?.complete||state?.engineBusy||!userTurn()){
          if(state?.complete) sessionStorage.removeItem(SNAPSHOT_KEY);
          return;
        }
        const fen=state.chess?.fen?.();
        if(!fen) return;
        const snap={
          v:1,ts:Date.now(),userId:auth.user.id,fen,
          mode:state.mode,side:state.side,sessionLength:state.sessionLength,
          variationIndex:state.variationIndex,history:Array.isArray(state.history)?state.history:[],
          userMovesDone:Number(state.userMovesDone||0),mistakes:Number(state.mistakes||0),
          testCursor:Number(state.testCursor||0),trainingLine:Array.isArray(state.trainingLine)?state.trainingLine:[],
          guideMove:state.guideMove?{...state.guideMove}:null,hintVisible:!!state.hintVisible,
          practiceInvalid:!!state.practiceInvalid,practiceHintUsed:!!state.practiceHintUsed,
          status:String(state.status||'Your move'),statusError:!!state.statusError
        };
        sessionStorage.setItem(SNAPSHOT_KEY,JSON.stringify(snap));
      }catch(err){console.warn('Training snapshot save failed',err)}
    }

    const resumeOriginalRender=render;
    render=function(...args){
      const out=resumeOriginalRender(...args);
      queueMicrotask(saveTrainerSnapshot);
      return out;
    };

    if(navType==='reload'){
      setTimeout(()=>{
        try{
          const auth=readAuth();
          const snap=readSnap();
          if(!auth?.user?.id||!snap||snap.v!==1||snap.userId!==auth.user.id||Date.now()-Number(snap.ts||0)>6*60*60*1000){
            sessionStorage.removeItem(SNAPSHOT_KEY);return;
          }
          if(!snap.fen||!snap.mode||!snap.side){sessionStorage.removeItem(SNAPSHOT_KEY);return}
          if(!state?.chess?.load?.(snap.fen)){sessionStorage.removeItem(SNAPSHOT_KEY);return}
          state.screen='training';state.complete=false;state.engineBusy=false;state.board=null;
          state.mode=snap.mode;state.side=snap.side;state.sessionLength=snap.sessionLength;
          state.variationIndex=Number(snap.variationIndex||0);state.history=Array.isArray(snap.history)?snap.history:[];
          state.userMovesDone=Number(snap.userMovesDone||0);state.mistakes=Number(snap.mistakes||0);
          state.testCursor=Number(snap.testCursor||0);state.trainingLine=Array.isArray(snap.trainingLine)?snap.trainingLine:[];
          state.guideMove=snap.guideMove||null;state.hintVisible=!!snap.hintVisible;
          state.practiceInvalid=!!snap.practiceInvalid;state.practiceHintUsed=!!snap.practiceHintUsed;
          state.status=snap.status||'Your move';state.statusError=!!snap.statusError;
          document.querySelector('#cloudAuthGate')?.remove();
          render();
          try{drawGuide?.()}catch{}
        }catch(err){
          console.warn('Training reload resume failed',err);
          sessionStorage.removeItem(SNAPSHOT_KEY);
        }
      },650);
    }
  }
}catch(err){console.warn('Training reload resume patch could not attach',err)}

// --- Keep the actual board DOM/instance stable during rerenders (Report #27) ---
try{
  if(!globalThis.__PERSISTENT_TRAINING_BOARD_27__){
    globalThis.__PERSISTENT_TRAINING_BOARD_27__=true;
    const stableBoardOriginalRender=render;
    const specialReview=()=>!!(state?.practiceReviewActive||state?.rankReviewActive);
    render=function(...args){
      const preserve=state?.screen==='training'&&!state?.complete&&!specialReview();
      const oldShell=preserve?document.querySelector('.board-shell'):null;
      const oldBoard=preserve?state?.board:null;
      const oldTop=oldShell?.getBoundingClientRect?.().top;
      const oldY=window.scrollY;
      const out=stableBoardOriginalRender(...args);
      if(preserve&&state?.screen==='training'&&!state?.complete&&!specialReview()&&oldShell&&oldBoard){
        const freshShell=document.querySelector('.board-shell');
        if(freshShell&&freshShell!==oldShell){
          const throwaway=state.board;
          freshShell.replaceWith(oldShell);
          state.board=oldBoard;
          try{throwaway?.destroy?.()}catch{}
          try{oldBoard.setPosition?.(state.chess.fen(),true)}catch{}
          try{drawGuide?.()}catch{}
          if(Number.isFinite(oldTop)) requestAnimationFrame(()=>{
            if(state?.screen!=='training') return;
            const delta=oldShell.getBoundingClientRect().top-oldTop;
            if(Math.abs(delta)>0.5) window.scrollTo(0,Math.max(0,oldY+delta));
          });
        }
      }
      return out;
    };
    const style=document.createElement('style');
    style.textContent=`
      .board-shell,#board,.cm-chessboard{overflow-anchor:none}
      .board-shell{contain:layout paint}
      body{overflow-anchor:none}
      .training .status,.training .status-line,.training .training-status{min-height:1.5em}
    `;
    document.head.appendChild(style);
  }
}catch(err){console.warn('Persistent training board patch could not attach',err)}
