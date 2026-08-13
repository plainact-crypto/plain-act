// --- Email confirmation recovery + Practice no-eval layout (Reports #21/#22/#23) ---
try{
  if(!globalThis.__AUTH_CONFIRMATION_RECOVERY_PATCH__){
    globalThis.__AUTH_CONFIRMATION_RECOVERY_PATCH__=true;

    const RESEND_COOLDOWN_PREFIX='cotConfirmResendUntil:';
    const RESEND_SUCCESS_COOLDOWN_MS=60000;
    const RESEND_LIMIT_COOLDOWN_MS=300000;
    const resendKey=email=>`${RESEND_COOLDOWN_PREFIX}${String(email||'').trim().toLowerCase()}`;
    const resendRemaining=email=>Math.max(0,Number(localStorage.getItem(resendKey(email))||0)-Date.now());
    const setResendCooldown=(email,ms)=>localStorage.setItem(resendKey(email),String(Date.now()+Math.max(1000,Number(ms)||0)));
    const retryAfterMs=response=>{
      const raw=Number(response?.headers?.get?.('retry-after')||0);
      return Number.isFinite(raw)&&raw>0?raw*1000:0;
    };
    const friendlyWait=ms=>{
      const sec=Math.max(1,Math.ceil(ms/1000));
      if(sec>=120) return `${Math.ceil(sec/60)} minutes`;
      if(sec>=60) return 'about 1 minute';
      return `${sec} seconds`;
    };

    async function resendSignupConfirmation(email){
      const normalized=String(email||'').trim().toLowerCase();
      if(!normalized||!normalized.includes('@')) throw new Error('Enter the account email first.');
      const remaining=resendRemaining(normalized);
      if(remaining>0){
        const e=new Error(`A confirmation email was already requested. Please wait ${friendlyWait(remaining)} before trying again.`);
        e.code='email_cooldown';
        e.retryAfterMs=remaining;
        throw e;
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
          const wait=Math.max(retryAfterMs(r),Number(d.retry_after||0)*1000,RESEND_LIMIT_COOLDOWN_MS);
          setResendCooldown(normalized,wait);
          const e=new Error(`Confirmation email limit reached. Please wait ${friendlyWait(wait)} — you do not need to keep pressing resend.`);
          e.code='email_rate_limit';
          e.retryAfterMs=wait;
          throw e;
        }
        throw new Error(raw||'Could not resend the confirmation email.');
      }
      setResendCooldown(normalized,RESEND_SUCCESS_COOLDOWN_MS);
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
      const clearCountdown=()=>{if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null}};
      const armCooldown=(email,baseLabel='Resend confirmation email')=>{
        clearCountdown();
        const tick=()=>{
          if(!resendBtn?.isConnected){clearCountdown();return}
          const remaining=resendRemaining(email);
          if(remaining<=0){
            clearCountdown();
            resendBtn.disabled=false;
            resendBtn.textContent=baseLabel;
            return;
          }
          resendBtn.disabled=true;
          resendBtn.textContent=`Resend available in ${Math.ceil(remaining/1000)}s`;
        };
        tick();
        countdownTimer=setInterval(tick,1000);
      };
      const ensureResend=()=>{
        const current=String(msg.textContent||'');
        if(current===lastMessage&&resendBtn?.isConnected) return;
        lastMessage=current;
        const needsResend=/not confirmed|confirmation email|confirmation email limit/i.test(current);
        if(!needsResend){
          clearCountdown();
          resendBtn?.remove();
          resendBtn=null;
          return;
        }
        if(!resendBtn?.isConnected){
          resendBtn=document.createElement('button');
          resendBtn.type='button';
          resendBtn.id='resendConfirmation';
          resendBtn.className='cot-secondary';
          resendBtn.style.cssText='width:100%;margin:-2px 0 10px';
          resendBtn.textContent='Resend confirmation email';
          resendBtn.onclick=async()=>{
            const email=String(emailInput.value||'').trim().toLowerCase();
            const existing=resendRemaining(email);
            if(existing>0){
              msg.style.color='#ffcf7d';
              msg.textContent=`A confirmation email was already requested. Please wait ${friendlyWait(existing)} before trying again.`;
              armCooldown(email);
              return;
            }
            resendBtn.disabled=true;
            resendBtn.textContent='Sending…';
            try{
              await resendSignupConfirmation(email);
              msg.style.color='#c8ff5a';
              msg.textContent='Confirmation email sent. Check your inbox and spam folder, then sign in after confirming.';
              armCooldown(email);
            }catch(err){
              msg.style.color=err?.code==='email_rate_limit'||err?.code==='email_cooldown'?'#ffcf7d':'#ffb6b6';
              msg.textContent=err?.message||'Could not resend the confirmation email.';
              if(err?.code==='email_rate_limit'||err?.code==='email_cooldown') armCooldown(email);
              else{resendBtn.disabled=false;resendBtn.textContent='Resend confirmation email'}
            }
          };
          msg.insertAdjacentElement('afterend',resendBtn);
        }
        const email=String(emailInput.value||'').trim().toLowerCase();
        if(resendRemaining(email)>0) armCooldown(email);
      };
      new MutationObserver(ensureResend).observe(msg,{childList:true,subtree:true,characterData:true});
      emailInput.addEventListener('input',()=>{if(resendBtn?.isConnected) armCooldown(String(emailInput.value||'').trim().toLowerCase())});
      ensureResend();
    };

    // Report #23: Practice hides evaluation, so its board must also switch to the
    // single-column no-eval board layout. Otherwise the board is auto-placed into
    // the narrow evaluation track and appears extremely small on desktop.
    const originalRenderTrainingForPracticeLayout=renderTraining;
    renderTraining=function(){
      originalRenderTrainingForPracticeLayout();
      if(state?.mode==='test'){
        const area=document.querySelector('.board-area');
        if(area) area.classList.add('rank-no-eval','practice-no-eval');
      }
    };
  }
}catch(err){console.warn('Email confirmation / Practice layout patch could not attach',err)}