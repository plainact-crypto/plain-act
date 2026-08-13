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