// --- Activation & Onboarding V2: stable first-minute journey + funnel analytics ---
(() => {
  if (globalThis.__COT_ACTIVATION_ONBOARDING_V2__) return;
  globalThis.__COT_ACTIVATION_ONBOARDING_V2__ = true;

  const EVENTS = new Set(['landing_view','signup_started','signup_completed','onboarding_completed','first_training_started','first_variation_completed','practice_started','rank_started','returned_user']);
  const SESSION_KEY='chessTrainerCloudSession', ANON_KEY='cotActivationAnonymousId', FOCUS_KEY='cotActivationFocus';
  const ONBOARDING_PREFIX='cotOnboardingCompleted:', MILESTONE_PREFIX='cotActivationMilestone:', LAST_VISIT_PREFIX='cotActivationLastVisit:';
  const DEPTHS=[5,10,15,20,25,30];
  const PASS_TARGET=typeof PRACTICE_PASSES_PER_VARIATION==='number'?PRACTICE_PASSES_PER_VARIATION:5;
  const session=()=>{try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}};
  const uid=()=>session()?.user?.id||'';
  const email=()=>session()?.user?.email||'';
  const anon=()=>{let x=localStorage.getItem(ANON_KEY);if(!x){x=crypto?.randomUUID?.()||`anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;localStorage.setItem(ANON_KEY,x)}return x};
  const sessionId=(()=>{let x=sessionStorage.getItem('cotActivationSessionId');if(!x){x=crypto?.randomUUID?.()||`session-${Date.now()}`;sessionStorage.setItem('cotActivationSessionId',x)}return x})();
  const profile=()=>{try{return typeof loadProfile==='function'?loadProfile():null}catch{return null}};
  const level=(p,s,d)=>{try{return typeof ensureLevelProgress==='function'?ensureLevelProgress(p,s,d):null}catch{return null}};
  const opening=(p,s)=>{try{return typeof openingProgress==='function'?openingProgress(p,s):null}catch{return null}};
  const completed=lp=>Array.isArray(lp?.lessons)?lp.lessons.filter(x=>Number(x?.passes||0)>=PASS_TARGET).length:0;

  async function track(name,props={},once=false){
    if(!EVENTS.has(name))return;
    const who=uid()||anon(), key=`${MILESTONE_PREFIX}${who}:${name}`;
    if(once&&localStorage.getItem(key))return;
    if(once)localStorage.setItem(key,new Date().toISOString());
    const s=session();
    try{
      const base=typeof SB_URL==='string'?SB_URL:globalThis.CHESS_SUPABASE?.url;
      if(!base)return;
      const h=typeof headers==='function'?headers(s?.access_token):{apikey:globalThis.CHESS_SUPABASE?.key||'','Content-Type':'application/json',...(s?.access_token?{Authorization:`Bearer ${s.access_token}`}:{})};
      await fetch(`${base}/rest/v1/activation_events`,{method:'POST',headers:{...h,Prefer:'return=minimal'},keepalive:true,body:JSON.stringify({user_id:uid()||null,anonymous_id:anon(),session_id:sessionId,event_name:name,page_path:`${location.pathname}${location.search}`,properties:{...props,email_domain:email().split('@')[1]||null},occurred_at:new Date().toISOString()})});
    }catch{}
  }
  globalThis.CHESS_ACTIVATION_TRACK=track;

  const css=document.createElement('style');
  css.textContent=`
  .cot-activation-hub{margin:14px auto 24px;max-width:1180px;padding:0 18px;font-family:Inter,ui-sans-serif,system-ui;color:#edf3f7}.cot-next-card{background:linear-gradient(135deg,#111a24,#0c1219);border:1px solid #334253;border-radius:18px;padding:20px;box-shadow:0 16px 42px #0003}.cot-next-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;align-items:center}.cot-next-kicker{color:#c8ff5a;font-size:11px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.cot-next-title{font-size:27px;line-height:1.1;margin:6px 0 7px}.cot-next-copy{color:#9eabb7;line-height:1.45;margin:0}.cot-next-action{justify-self:end;border:0;background:#c8ff5a;color:#091016;border-radius:12px;padding:14px 18px;font-weight:950;cursor:pointer;min-width:210px}.cot-journey{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:14px 0}.cot-journey span{border:1px solid #2b3948;background:#0c131b;border-radius:10px;padding:9px 7px;text-align:center;color:#9da9b5;font-size:12px;font-weight:850}.cot-journey span.active{border-color:#9ed73d;color:#dfff9d;background:#18220f}.cot-opening-progress{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cot-opening-card{border:1px solid #283646;background:#0d151d;border-radius:14px;padding:15px}.cot-opening-head{display:flex;justify-content:space-between;gap:12px}.cot-opening-head small,.cot-elo small{display:block;color:#8f9ba6;margin-top:3px}.cot-elo{text-align:right}.cot-elo b{font-size:21px;display:block}.cot-meter{height:7px;border-radius:999px;background:#1b2732;overflow:hidden;margin:12px 0 8px}.cot-meter i{display:block;height:100%;background:#c8ff5a}.cot-opening-meta{display:flex;justify-content:space-between;gap:10px;color:#a9b4be;font-size:12px}.cot-opening-meta b{color:#f2f6f8}.cot-opening-card button{width:100%;margin-top:12px;border:1px solid #405063;background:#151f29;color:#fff;border-radius:10px;padding:10px 12px;font-weight:900;cursor:pointer}.cot-opening-card button.primary{border:0;background:#c8ff5a;color:#0b1116}
  #cotOnboarding{position:fixed;inset:0;z-index:20000;background:#05090dcc;backdrop-filter:blur(10px);display:grid;place-items:center;padding:18px;font-family:Inter,ui-sans-serif,system-ui;color:#eef4f7}.cot-onboard-card{width:min(720px,100%);background:#0d151d;border:1px solid #344454;border-radius:20px;padding:26px;box-shadow:0 32px 100px #000b}.cot-onboard-card h2{font-size:31px;line-height:1.08;margin:6px 0 9px}.cot-onboard-card>p{color:#a7b2bc;line-height:1.5}.cot-side-choice{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cot-side-choice button{border:1px solid #344657;background:#111c26;color:#fff;border-radius:14px;padding:18px;text-align:left;cursor:pointer}.cot-side-choice button.selected{border-color:#c8ff5a;box-shadow:0 0 0 2px #c8ff5a22}.cot-side-choice strong{display:block;font-size:19px;margin-bottom:4px}.cot-side-choice span{color:#94a2ae;font-size:13px}.cot-onboard-path{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:20px 0 16px}.cot-onboard-path div{background:#080f15;border:1px solid #263440;border-radius:10px;padding:10px 6px;text-align:center;font-size:12px;font-weight:900}.cot-onboard-path em{display:block;color:#c8ff5a;font-style:normal;font-size:10px}.cot-onboard-go{width:100%;border:0;border-radius:12px;background:#c8ff5a;color:#081016;padding:14px;font-weight:950;cursor:pointer}.cot-onboard-go:disabled{opacity:.45}.cot-onboard-note{text-align:center;color:#74818c;font-size:12px}.cot-session-next{margin-top:12px;border:1px solid #405064;background:#101a23;border-radius:12px;padding:13px}.cot-session-next b{display:block;color:#c8ff5a;margin-bottom:4px}.cot-session-next p{margin:0 0 10px;color:#aab5bf}.cot-session-next button{border:0;background:#c8ff5a;color:#091016;border-radius:9px;padding:9px 12px;font-weight:900}
  @media(max-width:760px){.cot-activation-hub{padding:0 10px}.cot-next-grid,.cot-opening-progress,.cot-side-choice{grid-template-columns:1fr}.cot-next-action{justify-self:stretch;width:100%}.cot-next-title{font-size:23px}.cot-journey,.cot-onboard-path{grid-template-columns:1fr}.cot-journey span,.cot-onboard-path div{text-align:left}.cot-opening-meta{flex-direction:column;gap:3px}.cot-onboard-card{padding:20px 16px}.cot-onboard-card h2{font-size:26px}.cot-onboard-path div{display:flex;gap:8px;align-items:center}.cot-onboard-path em{display:inline}}
  `;
  document.head.appendChild(css);

  const openingName=s=>s==='white'?'London System':'Caro-Kann';
  function focusSide(p){const x=localStorage.getItem(FOCUS_KEY);if(x==='white'||x==='black')return x;return Number(opening(p,'black')?.capped||0)>Number(opening(p,'white')?.capped||0)?'black':'white'}
  function nextFor(p,side){
    for(const depth of DEPTHS){
      const lp=level(p,side,depth), lessons=Array.isArray(lp?.lessons)?lp.lessons:[];
      let rp=null;try{rp=typeof rankUnlockProgress==='function'?rankUnlockProgress(lp):null}catch{}
      if(rp?.unlocked&&!lp?.rankCompleted)return{side,depth,variation:0,mode:'rank',label:`Take ${depth}-move Rank Test`,detail:`${rp.completed}/${rp.required} variations ready`};
      for(let i=0;i<lessons.length;i++){
        const l=lessons[i]||{},passes=Number(l.passes||0);if(passes>=PASS_TARGET)continue;
        const learned=(Array.isArray(l.lines)&&l.lines.length>0)||Boolean(l.line||l.savedLine||l.trained||passes>0);
        return learned?{side,depth,variation:i,mode:'test',label:`Practice Variation ${i+1}`,detail:`${passes}/${PASS_TARGET} valid passes · ${depth} moves`}:{side,depth,variation:i,mode:'guided',label:`Learn Variation ${i+1}`,detail:`${openingName(side)} · ${depth} moves`};
      }
    }
    return{side,depth:30,variation:0,mode:'rank',label:'Take your next Rank Test',detail:`${openingName(side)} · keep your rank current`};
  }
  const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'};
  const buttons=()=>[...document.querySelectorAll('button,[role="button"],a')].filter(visible);
  function clickText(res){for(const re of res){const el=buttons().find(x=>re.test(String(x.textContent||'').replace(/\s+/g,' ').trim()));if(el){el.click();return true}}return false}
  function clickVariation(i){const re=new RegExp(`Variation\\s*${i+1}(?:\\D|$)`,'i');const el=buttons().find(x=>re.test(String(x.textContent||'')));if(el){el.click();return true}const card=[...document.querySelectorAll('article,section,div')].find(x=>re.test(String(x.textContent||''))&&x.querySelector('button'));const b=card?.querySelector('button');if(visible(b)){b.click();return true}return false}
  function driveTo(a){
    localStorage.setItem(FOCUS_KEY,a.side);document.querySelector('#cotOnboarding')?.remove();document.querySelector('#cloudAuthGate')?.remove();
    try{render?.()}catch{}
    const side=a.side==='white'?[/London System/i,/\bWhite\b/i]:[/Caro-?Kann/i,/\bBlack\b/i];
    const depth=[new RegExp(`(?:Depth|Level|Open)[^\\n]{0,18}\\b${a.depth}\\b`,'i'),new RegExp(`\\b${a.depth}\\s*moves?`,'i')];
    const mode=a.mode==='rank'?[/Rank Test/i,/Start Rank/i]:a.mode==='test'?[/Practice/i,/Test from memory/i,/Start Practice/i]:[/Guided Training/i,/Start Guided/i,/\bLearn\b/i,/\bTrain\b/i];
    const steps=[()=>clickText(side),()=>clickText(depth),()=>a.mode==='rank'?true:clickVariation(a.variation),()=>clickText(mode)];
    let i=0,tries=0;const tick=()=>{if(i>=steps.length)return;let ok=false;try{ok=steps[i]()}catch{}if(ok){i++;tries=0;setTimeout(tick,130)}else if(++tries<8)setTimeout(tick,180);else{i++;tries=0;setTimeout(tick,120)}};setTimeout(tick,80);
  }

  function card(p,side,focused){const op=opening(p,side)||{},count=Math.max(0,Math.min(30,Number(op.capped||0))),pct=Math.round(count/30*100),a=nextFor(p,side),lp=level(p,side,a.depth);let rp=null;try{rp=rankUnlockProgress(lp)}catch{}let label=`${count}/30`;try{label=progressionLabel(op)}catch{}const elo=Math.round(Number(p?.openingElo?.[side]||800));const rank=rp?.unlocked?'Rank Test unlocked':`Rank ${rp?.completed??completed(lp)}/${rp?.required??5}`;return `<article class="cot-opening-card"><div class="cot-opening-head"><div><strong>${openingName(side)}</strong><small>${side==='white'?'White':'Black'} repertoire · ${label}</small></div><div class="cot-elo"><b>${elo}</b><small>Opening Elo</small></div></div><div class="cot-meter"><i style="width:${pct}%"></i></div><div class="cot-opening-meta"><span><b>${count}/30</b> completed variations</span><span>${rank}</span></div><button class="${focused?'primary':''}" data-next-side="${side}">${a.label}<br><small>${a.detail}</small></button></article>`}
  function renderHub(){
    const s=session();if(!s?.user?.id||document.querySelector('#cloudAuthGate')||document.querySelector('#cotOnboarding')){document.querySelector('.cot-activation-hub')?.remove();return}
    try{if(state?.screen==='training'){document.querySelector('.cot-activation-hub')?.remove();return}}catch{}
    const app=document.querySelector('#app'),p=profile();if(!app||!p)return;const focus=focusSide(p),a=nextFor(p,focus);
    const html=`<div class="cot-next-card"><div class="cot-next-grid"><div><div class="cot-next-kicker">Your next best action</div><h2 class="cot-next-title">${a.label}</h2><p class="cot-next-copy">${a.detail}. Finish this step, then the trainer will move you forward.</p></div><button class="cot-next-action" id="cotPrimaryNext">Continue Training →</button></div><div class="cot-journey"><span class="${a.mode==='guided'?'active':''}">Learn →</span><span class="${a.mode==='test'?'active':''}">Practice →</span><span>Pass →</span><span class="${a.mode==='rank'?'active':''}">Rank →</span><span>Next Level</span></div><div class="cot-opening-progress">${card(p,'white',focus==='white')}${card(p,'black',focus==='black')}</div></div>`;
    let hub=document.querySelector('.cot-activation-hub');if(!hub){hub=document.createElement('section');hub.className='cot-activation-hub';app.prepend(hub)}
    if(hub.dataset.activationHtml===html)return;
    hub.dataset.activationHtml=html;hub.innerHTML=html;
    hub.querySelector('#cotPrimaryNext')?.addEventListener('click',()=>driveTo(a));hub.querySelectorAll('[data-next-side]').forEach(b=>b.addEventListener('click',()=>driveTo(nextFor(profile(),b.dataset.nextSide))));
  }

  const onboarded=id=>Boolean(id&&localStorage.getItem(`${ONBOARDING_PREFIX}${id}`));
  function finishOnboarding(side){const id=uid();if(!id)return;localStorage.setItem(`${ONBOARDING_PREFIX}${id}`,new Date().toISOString());localStorage.setItem(FOCUS_KEY,side);track('onboarding_completed',{focus_side:side},true);document.querySelector('#cotOnboarding')?.remove();setTimeout(()=>driveTo(nextFor(profile(),side)),0)}
  function showOnboarding(){const s=session();if(!s?.user?.id||onboarded(s.user.id)||document.querySelector('#cotOnboarding')||document.querySelector('#cloudAuthGate'))return;const m=document.createElement('div');m.id='cotOnboarding';m.innerHTML=`<div class="cot-onboard-card"><div class="cot-next-kicker">60-second setup</div><h2>Which repertoire do you want to train first?</h2><p>Pick one. You can switch any time. The trainer will always show one clear next step.</p><div class="cot-side-choice"><button data-onboard-side="white"><strong>♙ London System</strong><span>Train your White repertoire first</span></button><button data-onboard-side="black"><strong>♟ Caro-Kann</strong><span>Train your Black repertoire first</span></button></div><div class="cot-onboard-path"><div><em>1</em>Learn</div><div><em>2</em>Practice</div><div><em>3</em>Pass</div><div><em>4</em>Rank</div><div><em>5</em>Next Level</div></div><button class="cot-onboard-go" id="cotOnboardGo" disabled>Start my first Guided Training →</button><p class="cot-onboard-note">Your progress, Rank status and Opening Elo stay visible on the dashboard.</p></div>`;document.body.appendChild(m);let side='';m.querySelectorAll('[data-onboard-side]').forEach(b=>b.onclick=()=>{side=b.dataset.onboardSide;m.querySelectorAll('[data-onboard-side]').forEach(x=>x.classList.toggle('selected',x===b));m.querySelector('#cotOnboardGo').disabled=false});m.querySelector('#cotOnboardGo').onclick=()=>side&&finishOnboarding(side)}
  function sessionNext(){try{if(state?.screen!=='training')return;const target=[...document.querySelectorAll('.side-panel,aside,main,section')].find(el=>{const t=String(el.textContent||'');return /Session Complete|Training Complete|Practice Complete|Rank Test Complete|Test Complete/i.test(t)||(/Back to Level|Try Again|Review My Mistakes/i.test(t)&&/moves|score|passes|accuracy/i.test(t))});if(!target||target.querySelector('.cot-session-next'))return;const p=profile(),side=state?.side==='black'?'black':'white',a=nextFor(p,side),mode=state?.mode||'';const achieved=mode==='rank'?'Rank Test recorded; Opening Elo and Rank status are updated.':mode==='test'?`Practice result recorded toward the ${PASS_TARGET}-pass requirement.`:'Guided line completed and ready for memory Practice.';const box=document.createElement('div');box.className='cot-session-next';box.innerHTML=`<b>What you achieved</b><p>${achieved}<br><strong>Next:</strong> ${a.label} — ${a.detail}.</p><button>Continue →</button>`;box.querySelector('button').onclick=()=>driveTo(a);target.appendChild(box)}catch{}}
  function milestones(){if(!uid())return;try{if(state?.screen==='training'){if(state?.mode==='guided')track('first_training_started',{side:state?.side,depth:state?.sessionLength},true);if(state?.mode==='test')track('practice_started',{side:state?.side,depth:state?.sessionLength});if(state?.mode==='rank')track('rank_started',{side:state?.side,depth:state?.sessionLength})}}catch{}const p=profile();if(p&&['white','black'].some(s=>DEPTHS.some(d=>completed(level(p,s,d))>0)))track('first_variation_completed',{},true)}
  function returned(){const id=uid();if(!id)return;const k=`${LAST_VISIT_PREFIX}${id}`,old=Number(localStorage.getItem(k)||0),now=Date.now();if(old&&now-old>30*60*1000)track('returned_user',{minutes_since_last_visit:Math.round((now-old)/60000)});localStorage.setItem(k,String(now))}

  try{if(typeof signUp==='function'){const original=signUp;signUp=async(...a)=>{track('signup_started',{source:'auth_submit'},true);const r=await original(...a);track('signup_completed',{email_confirmation_required:!r?.access_token},true);return r}}}catch{}
  document.addEventListener('click',e=>{if(e.target?.closest?.('#su'))track('signup_started',{source:'signup_tab'},true)},true);

  let scheduled=false,lastMode='';
  function refresh(){scheduled=false;if(document.querySelector('#cloudAuthGate'))track('landing_view',{},true);if(!uid())return;showOnboarding();renderHub();sessionNext();let mode='';try{mode=`${state?.screen||''}:${state?.mode||''}`}catch{}if(mode!==lastMode){lastMode=mode;milestones()}}
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(refresh,40)}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  track('landing_view',{},true);if(uid()){returned();setTimeout(refresh,250)}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&uid())localStorage.setItem(`${LAST_VISIT_PREFIX}${uid()}`,String(Date.now()))});
})();
