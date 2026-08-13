// --- Email confirmation recovery flow (Report #21) ---
try{
  if(!globalThis.__AUTH_CONFIRMATION_RECOVERY_PATCH__){
    globalThis.__AUTH_CONFIRMATION_RECOVERY_PATCH__=true;

    async function resendSignupConfirmation(email){
      const normalized=String(email||'').trim().toLowerCase();
      if(!normalized||!normalized.includes('@')) throw new Error('Enter the account email first.');
      const r=await fetch(`${SB_URL}/auth/v1/resend`,{
        method:'POST',
        headers:headers(),
        body:JSON.stringify({type:'signup',email:normalized})
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(d.message||d.msg||'Could not resend the confirmation email.');
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
      let lastMessage='';
      const ensureResend=()=>{
        const current=String(msg.textContent||'');
        if(current===lastMessage) return;
        lastMessage=current;
        const needsResend=/not confirmed|confirmation email/i.test(current);
        if(!needsResend){
          resendBtn?.remove();
          resendBtn=null;
          return;
        }
        if(resendBtn?.isConnected) return;
        resendBtn=document.createElement('button');
        resendBtn.type='button';
        resendBtn.id='resendConfirmation';
        resendBtn.className='cot-secondary';
        resendBtn.style.cssText='width:100%;margin:-2px 0 10px';
        resendBtn.textContent='Resend confirmation email';
        resendBtn.onclick=async()=>{
          const email=String(emailInput.value||'').trim().toLowerCase();
          resendBtn.disabled=true;
          const old=resendBtn.textContent;
          resendBtn.textContent='Sending…';
          try{
            await resendSignupConfirmation(email);
            msg.style.color='#c8ff5a';
            msg.textContent='Confirmation email sent. Check your inbox and spam folder, then sign in after confirming.';
            resendBtn.textContent='Sent ✓';
            setTimeout(()=>{if(resendBtn?.isConnected){resendBtn.disabled=false;resendBtn.textContent=old}},5000);
          }catch(err){
            msg.style.color='#ffb6b6';
            msg.textContent=err?.message||'Could not resend the confirmation email.';
            resendBtn.disabled=false;
            resendBtn.textContent=old;
          }
        };
        msg.insertAdjacentElement('afterend',resendBtn);
      };
      new MutationObserver(ensureResend).observe(msg,{childList:true,subtree:true,characterData:true});
      ensureResend();
    };
  }
}catch(err){console.warn('Email confirmation recovery patch could not attach',err)}
