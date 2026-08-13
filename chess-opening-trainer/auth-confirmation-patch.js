// Disable the broken Report #27 DOM/instance preservation experiment before session-navigation-patch loads.
globalThis.__PERSISTENT_TRAINING_BOARD_27__=true;

// --- Email confirmation recovery flow (Report #21/#22) ---
try{
  if(!globalThis.__AUTH_CONFIRMATION_RECOVERY_PATCH__){
    globalThis.__AUTH_CONFIRMATION_RECOVERY_PATCH__=true;
    const RESEND_COOLDOWN_MS=60*1000;
    const resendKey=email=>`cotConfirmationResendAt:${String(email||'').trim().toLowerCase()}`;
    const resendRemaining=email=>Math.max(0,Number(localStorage.getItem(resendKey(email))||0)-Date.now());
    const startResendCooldown=(email,ms=RESEND_COOLDOWN_MS)=>localStorage.setItem(resendKey(email),String(Date.now()+Math.max(1000,Number(ms)||RESEND_COOLDOWN_MS)));

    async function resendSignupConfirmation(email){
      const normalized=String(email||'').trim().toLowerCase();
      if(!normalized||!normalized.includes('@')) throw new Error('Enter the account email first.');
      const remaining=resendRemaining(normalized);
      if(remaining>0){
        const e=new Error(`Please wait ${Math.ceil(remaining/1000)} seconds before requesting another confirmation email.`);
        e.code='email_rate_limit';e.retryAfterMs=remaining;throw e;
      }
      const r=await fetch(`${SB_URL}/auth/v1/resend`,{
        method:'POST',
        headers:headers(),
        body:JSON.stringify({type:'signup',email:normalized})
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok){
        const raw=String(d.message||d.msg||'');
        if(r.status===429||/rate\s*limit|too many/i.test(raw)){
          const retryHeader=Number(r.headers.get('Retry-After')||0);
          const retryMs=retryHeader>0?retryHeader*1000:RESEND_COOLDOWN_MS;
          startResendCooldown(normalized,retryMs);
          const e=new Error(`Confirmation email limit reached. Please wait ${Math.ceil(retryMs/1000)} seconds before trying again.`);
          e.code='email_rate_limit';e.retryAfterMs=retryMs;throw e;
        }
        throw new Error(raw||'Could not resend the confirmation email.');
      }
      startResendCooldown(normalized,RESEND_COOLDOWN_MS);
      return d;
    }

    const originalSignInForConfirmation=signIn;
    signIn=async function(email,password){
      try{
        return await originalSignInForConfirmation(email,password);
      }catch(err){
        if(/email\s+not\s+confirmed/i.test(String(err?.message||''))){
          const e=new Error('Your email is not confirmed yet. Check your inbox or spam folder, or resend the confirmation email below.');
          e.code='email_not_confirmed';
          e.email=String(email||'').trim().toLowerCase();
          throw e;
        }
        throw err;
      }
    };

    const originalAuthScreenForConfirmation=authScreen;
    authScreen=function(){
      originalAuthScreenForConfirmation();
      const gate=document.querySelector('#cloudAuthGate');
      const msg=gate?.querySelector('#msg');
      const emailInput=gate?.querySelector('#em');
      if(!gate||!msg||!emailInput) return;

      let resendBtn=null;
      let countdownTimer=null;
      let lastMessage='';
      const stopCountdown=()=>{if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null}};
      const updateButtonCooldown=()=>{
        if(!resendBtn?.isConnected){stopCountdown();return}
        const email=String(emailInput.value||'').trim().toLowerCase();
        const ms=resendRemaining(email);
        if(ms>0){resendBtn.disabled=true;resendBtn.textContent=`Resend available in ${Math.ceil(ms/1000)}s`}
        else{resendBtn.disabled=false;resendBtn.textContent='Resend confirmation email';stopCountdown()}
      };
      const runCountdown=()=>{stopCountdown();updateButtonCooldown();if(resendBtn?.disabled)countdownTimer=setInterval(updateButtonCooldown,1000)};
      const ensureResend=()=>{
        const current=String(msg.textContent||'');
        if(current===lastMessage) return;
        lastMessage=current;
        const needsResend=/not confirmed|confirmation email|confirmation email limit reached|wait \d+ seconds/i.test(current);
        if(!needsResend){
          stopCountdown();resendBtn?.remove();resendBtn=null;return;
        }
        if(resendBtn?.isConnected){runCountdown();return}
        resendBtn=document.createElement('button');
        resendBtn.type='button';resendBtn.id='resendConfirmation';resendBtn.className='cot-secondary';
        resendBtn.style.cssText='width:100%;margin:-2px 0 10px';
        resendBtn.textContent='Resend confirmation email';
        resendBtn.onclick=async()=>{
          const email=String(emailInput.value||'').trim().toLowerCase();
          const ms=resendRemaining(email);
          if(ms>0){runCountdown();return}
          resendBtn.disabled=true;resendBtn.textContent='Sending…';
          try{
            await resendSignupConfirmation(email);
            msg.style.color='#c8ff5a';
            msg.textContent='Confirmation email sent. Check your inbox and spam folder, then sign in after confirming.';
            runCountdown();
          }catch(err){
            msg.style.color='#ffb6b6';msg.textContent=err?.message||'Could not resend the confirmation email.';
            if(err?.code==='email_rate_limit'){
              startResendCooldown(email,err.retryAfterMs||RESEND_COOLDOWN_MS);runCountdown();
            }else{resendBtn.disabled=false;resendBtn.textContent='Resend confirmation email'}
          }
        };
        msg.insertAdjacentElement('afterend',resendBtn);
        emailInput.addEventListener('input',runCountdown);
        runCountdown();
      };
      new MutationObserver(ensureResend).observe(msg,{childList:true,subtree:true,characterData:true});
      ensureResend();
    };
  }
}catch(err){console.warn('Email confirmation recovery patch could not attach',err)}

// --- Training viewport stability (Report #24) ---
try{
  if(!globalThis.__TRAINING_VIEWPORT_STABILITY_PATCH__){
    globalThis.__TRAINING_VIEWPORT_STABILITY_PATCH__=true;
    const originalStableRender=render;
    render=function(...args){
      const oldBoard=document.querySelector('#board');
      const shouldPreserve=state?.screen==='training' && !!oldBoard;
      const oldTop=shouldPreserve?oldBoard.getBoundingClientRect().top:null;
      const oldY=shouldPreserve?window.scrollY:null;
      const result=originalStableRender(...args);
      if(shouldPreserve && oldTop!=null){
        requestAnimationFrame(()=>{
          if(state?.screen!=='training') return;
          const newBoard=document.querySelector('#board');
          if(!newBoard) return;
          const newTop=newBoard.getBoundingClientRect().top;
          const delta=newTop-oldTop;
          if(Math.abs(delta)>0.5){
            window.scrollTo({top:Math.max(0,Number(oldY||0)+delta),left:window.scrollX,behavior:'instant'});
          }
        });
      }
      return result;
    };
    const stableStyle=document.createElement('style');
    stableStyle.textContent=`
      .training .status,.training .status-line,.training .training-status{min-height:1.5em}
      #board{overflow-anchor:none}
      body{overflow-anchor:none}
    `;
    document.head.appendChild(stableStyle);
  }
}catch(err){console.warn('Training viewport stability patch could not attach',err)}

// --- Report #28: keep board shell measurable while preserving the board instance ---
try{
  if(!globalThis.__BOARD_VISIBILITY_28__){
    globalThis.__BOARD_VISIBILITY_28__=true;
    const visibilityStyle=document.createElement('style');
    visibilityStyle.textContent=`
      .board-shell{contain:none!important;min-width:0}
      #board,.cm-chessboard{visibility:visible!important}
    `;
    document.head.appendChild(visibilityStyle);
  }
}catch(err){console.warn('Board visibility fix could not attach',err)}

// --- Final Guided Training polish: stable status/coach, lower engine contention, move-quality badge ---
try{
  if(!globalThis.__COT_GUIDED_POLISH_30__){
    globalThis.__COT_GUIDED_POLISH_30__=true;

    // Prevent the older mutation-based status/coach patches from attaching later.
    globalThis.__COT_NORMALIZED_TURN_STATUS__=true;
    globalThis.__COT_SCROLLABLE_LIVE_COACH__=true;

    const polishStyle=document.createElement('style');
    polishStyle.textContent=`
      .cot-guided-status-fixed{height:52px!important;min-height:52px!important;max-height:52px!important;overflow:hidden!important;display:flex!important;align-items:center!important;white-space:nowrap!important}
      .cot-guided-coach-fixed{height:420px!important;min-height:420px!important;max-height:420px!important;overflow-y:auto!important;overflow-x:hidden!important;scrollbar-gutter:stable;overscroll-behavior:contain}
      .cot-move-quality-badge{position:fixed;z-index:17000;pointer-events:none;padding:4px 7px;border-radius:999px;background:#111923;border:1px solid rgba(255,255,255,.28);color:#fff;font:800 12px/1.1 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.35);transform:translate(-50%,-115%);white-space:nowrap}
      @media (max-width:700px){.cot-guided-coach-fixed{height:360px!important;min-height:360px!important;max-height:360px!important}.cot-move-quality-badge{font-size:10px;padding:3px 5px}}
    `;
    document.head.appendChild(polishStyle);

    const userColor=()=>state?.side==='black'?'b':'w';
    const desiredStatus=()=>{
      try{return state?.chess?.turn?.()===userColor()?'Your move':'Opponent move'}catch{return 'Your move'}
    };

    function findCoach(){
      try{
        const nodes=[...document.querySelectorAll('.side-panel div,.side-panel section,.side-panel article,aside div,aside section,aside article')];
        let best=null;
        for(const el of nodes){
          const t=String(el.textContent||'');
          if(!/Live Position Coach/i.test(t)||!/WHY THIS MOVE/i.test(t)) continue;
          const nested=[...el.children].some(c=>/Live Position Coach/i.test(String(c.textContent||''))&&/WHY THIS MOVE/i.test(String(c.textContent||'')));
          if(!nested){best=el;break}
        }
        return best;
      }catch{return null}
    }

    function stabilizeGuidedDom(){
      try{
        if(state?.screen!=='training') return;
        const status=desiredStatus();
        const panels=[...document.querySelectorAll('.side-panel,aside')];
        for(const panel of panels){
          const coach=findCoach();
          if(coach) coach.classList.add('cot-guided-coach-fixed');
          const candidates=[...panel.querySelectorAll('div,section,p')]
            .filter(el=>!coach?.contains(el))
            .filter(el=>{
              const t=String(el.textContent||'').trim();
              return t===status||/^(Engine is|Engine |Thinking|Loading|Choosing)/i.test(t);
            });
          const target=candidates.sort((a,b)=>a.getBoundingClientRect().height-b.getBoundingClientRect().height)[0];
          if(target){
            target.classList.add('cot-guided-status-fixed');
            if(target.textContent!==status) target.textContent=status;
          }
        }
      }catch{}
    }

    // Make status text deterministic before HTML is created, so long engine strings never paint.
    const polishOriginalRender=render;
    render=function(...args){
      try{
        if(state?.screen==='training'){
          state.status=desiredStatus();
          state.statusError=false;
        }
      }catch{}
      const out=polishOriginalRender(...args);
      queueMicrotask(stabilizeGuidedDom);
      requestAnimationFrame(stabilizeGuidedDom);
      queueMicrotask(processGuidedMoveQuality);
      return out;
    };

    // Evaluation is UI-only. Do not let it compete with move generation while the move engine is busy.
    try{
      const evalEngine=globalThis.__COT_EVAL_ENGINE_SERVICE__;
      if(evalEngine?.evaluate&&!evalEngine.__cotDeferredWhileBusy){
        evalEngine.__cotDeferredWhileBusy=true;
        const rawEval=evalEngine.evaluate.bind(evalEngine);
        evalEngine.evaluate=async(...args)=>{
          let waited=0;
          while(state?.screen==='training'&&state?.engineBusy&&waited<2500){
            await new Promise(r=>setTimeout(r,50));waited+=50;
          }
          return rawEval(...args);
        };
      }
    }catch{}

    let userTurnSnapshot=null;
    let lastHistoryLen=-1;
    let badgeData=null;
    let qualitySeq=0;

    const whiteEvalFromResult=(fen,result)=>{
      if(!result) return null;
      const cp=Number(result.cp);
      if(!Number.isFinite(cp)) return null;
      const turn=String(fen||'').split(/\s+/)[1]||'w';
      return turn==='w'?cp:-cp;
    };
    const classifyLoss=loss=>{
      const x=Math.max(0,Number(loss)||0);
      if(x<=10) return {label:'★ Best',key:'best'};
      if(x<=25) return {label:'✓ Excellent',key:'excellent'};
      if(x<=60) return {label:'Good',key:'good'};
      if(x<=120) return {label:'?! Inaccuracy',key:'inaccuracy'};
      if(x<=250) return {label:'? Mistake',key:'mistake'};
      return {label:'?? Blunder',key:'blunder'};
    };

    function placeQualityBadge(){
      try{
        document.querySelector('#cotMoveQualityBadge')?.remove();
        if(!badgeData||state?.screen!=='training'||state?.mode!=='guided') return;
        const board=document.querySelector('#board');
        if(!board) return;
        const r=board.getBoundingClientRect();
        if(r.width<50||r.height<50) return;
        const file=badgeData.square.charCodeAt(0)-97;
        const rank=Number(badgeData.square[1]);
        const black=state?.side==='black';
        const col=black?7-file:file;
        const row=black?rank-1:8-rank;
        const x=r.left+(col+.5)*(r.width/8);
        const y=r.top+(row+.30)*(r.height/8);
        const b=document.createElement('div');
        b.id='cotMoveQualityBadge';b.className='cot-move-quality-badge';
        b.textContent=badgeData.label;
        b.style.left=`${x}px`;b.style.top=`${y}px`;
        document.body.appendChild(b);
      }catch{}
    }

    async function analyzeUserMove(snapshot,afterFen,to,seq){
      try{
        const evalEngine=globalThis.__COT_EVAL_ENGINE_SERVICE__;
        if(!evalEngine?.evaluate) return;
        // Wait until move-generation work is finished; badge analysis must never slow the opponent.
        let waited=0;
        while(state?.engineBusy&&waited<4000){await new Promise(r=>setTimeout(r,80));waited+=80}
        await new Promise(r=>setTimeout(r,220));
        if(seq!==qualitySeq) return;
        let beforeWhite=Number.isFinite(snapshot.evalCp)?snapshot.evalCp:null;
        if(beforeWhite==null){
          const beforeResult=await evalEngine.evaluate(snapshot.fen);
          beforeWhite=whiteEvalFromResult(snapshot.fen,beforeResult);
        }
        if(seq!==qualitySeq||beforeWhite==null) return;
        const afterResult=await evalEngine.evaluate(afterFen);
        const afterWhite=whiteEvalFromResult(afterFen,afterResult);
        if(seq!==qualitySeq||afterWhite==null) return;
        const mover=userColor();
        const beforeMover=mover==='w'?beforeWhite:-beforeWhite;
        const afterMover=mover==='w'?afterWhite:-afterWhite;
        const loss=Math.max(0,beforeMover-afterMover);
        const q=classifyLoss(loss);
        badgeData={...q,square:to,lossCp:Math.round(loss)};
        placeQualityBadge();
      }catch(err){console.warn('Guided move quality analysis failed',err)}
    }

    function processGuidedMoveQuality(){
      try{
        if(state?.screen!=='training'||state?.mode!=='guided'){
          userTurnSnapshot=null;badgeData=null;document.querySelector('#cotMoveQualityBadge')?.remove();return;
        }
        const fen=state?.chess?.fen?.()||'';
        const hist=state?.chess?.history?.({verbose:true})||[];
        const turn=state?.chess?.turn?.();
        const u=userColor();
        if(turn===u){
          const cp=Number(state?.evalCp);
          userTurnSnapshot={fen,evalCp:Number(state?.evalDepth)>0&&Number.isFinite(cp)?cp:null};
        }
        if(lastHistoryLen<0) lastHistoryLen=hist.length;
        if(hist.length>lastHistoryLen){
          const last=hist[hist.length-1];
          if(last?.color===u&&userTurnSnapshot?.fen){
            const snap={...userTurnSnapshot};
            const afterFen=fen;
            const to=last.to;
            const seq=++qualitySeq;
            badgeData=null;document.querySelector('#cotMoveQualityBadge')?.remove();
            analyzeUserMove(snap,afterFen,to,seq);
          }
        }
        lastHistoryLen=hist.length;
        placeQualityBadge();
      }catch{}
    }

    window.addEventListener('resize',placeQualityBadge,{passive:true});
    window.addEventListener('scroll',placeQualityBadge,{passive:true});
    const polishObserver=new MutationObserver(()=>queueMicrotask(stabilizeGuidedDom));
    polishObserver.observe(document.documentElement,{childList:true,subtree:true});
    stabilizeGuidedDom();
  }
}catch(err){console.warn('Final Guided Training polish could not attach',err)}