// Public hero focus copy: current supported repertoire scope.
(function applyHeroFocusCopy(){
  const run=()=>{
    const gate=document.querySelector('#cloudAuthGate');
    if(!gate)return false;
    const sub=gate.querySelector('.cot-sub');
    if(sub) sub.textContent='Build a repertoire you can actually remember. The current trainer focuses on the London System as White and Caro-Kann-style structures as Black, with more openings planned.';
    const points=gate.querySelector('.cot-points');
    if(points && !gate.querySelector('#currentOpeningFocus')){
      const note=document.createElement('div');
      note.id='currentOpeningFocus';
      note.style.cssText='margin:18px 0 4px;padding:12px 14px;border:1px solid #2b3846;border-radius:12px;background:#0d141c;color:#cbd5df;font-size:14px;line-height:1.45';
      note.innerHTML='<strong style="color:#c8ff5a">Current opening focus</strong><br>White: London System &nbsp;•&nbsp; Black: Caro-Kann-style repertoire structures';
      points.after(note);
    }
    return true;
  };
  if(run()) return;
  const obs=new MutationObserver(()=>{if(run())obs.disconnect()});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>obs.disconnect(),10000);
})();

// Report #23: prevent the Practice/Rank board from collapsing to an unusably small desktop size.
(function keepTrainingBoardUsable(){
  const style=document.createElement('style');
  style.textContent='@media (min-width:900px){.board-shell{min-width:min(58vh,620px)}#board{width:100%!important;max-width:720px}.cot-test-board-large{width:min(72vh,720px)!important;min-width:min(72vh,720px)!important;max-width:720px!important}.cot-test-board-large #board{width:100%!important;max-width:720px!important}}';
  document.head.appendChild(style);

  const apply=()=>{
    try{
      if(state?.screen!=='training') return;
      const shell=document.querySelector('.board-shell');
      if(!shell) return;
      const isTest=state?.mode==='test'||state?.mode==='rank';
      shell.classList.toggle('cot-test-board-large',isTest);
    }catch{}
  };
  const observer=new MutationObserver(apply);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  apply();
})();

// Hide internal engine diagnostics from every Training mode.
(function hideTrainingEngineDiagnostics(){
  try{
    if(globalThis.__COT_HIDE_ENGINE_DIAGNOSTICS__) return;
    globalThis.__COT_HIDE_ENGINE_DIAGNOSTICS__=true;
    const hide=()=>{
      if(state?.screen!=='training') return;
      const panels=[...document.querySelectorAll('.side-panel, aside')];
      for(const panel of panels){
        const all=[...panel.querySelectorAll('*')];
        const marker=all.find(el=>/Engine\s+depth\s*:/i.test(String(el.textContent||'')));
        if(!marker) continue;
        let branch=marker;
        while(branch.parentElement && branch.parentElement!==panel) branch=branch.parentElement;
        if(branch.parentElement===panel){
          let node=branch;
          while(node){node.style.setProperty('display','none','important');node=node.nextElementSibling}
          continue;
        }
        for(const el of all){
          const t=String(el.textContent||'').trim();
          if(/^Engine\s+depth\s*:|^PV\s*:/i.test(t)) el.style.setProperty('display','none','important');
        }
      }
    };
    const observer=new MutationObserver(hide);
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    hide();
  }catch(err){console.warn('Training engine diagnostics hide could not attach',err)}
})();

// Keep Live Position Coach at a fixed visual height.
(function makeLiveCoachScrollable(){
  try{
    if(globalThis.__COT_SCROLLABLE_LIVE_COACH__) return;
    globalThis.__COT_SCROLLABLE_LIVE_COACH__=true;
    const style=document.createElement('style');
    style.textContent=`
      .cot-live-coach-scroll{height:420px!important;max-height:420px!important;overflow-y:auto!important;overflow-x:hidden!important;scrollbar-gutter:stable;overscroll-behavior:contain}
      @media (max-width:700px){.cot-live-coach-scroll{height:360px!important;max-height:360px!important}}
    `;
    document.head.appendChild(style);
    const apply=()=>{
      if(state?.screen!=='training') return;
      const candidates=[...document.querySelectorAll('div,section,article')];
      let card=null;
      for(const el of candidates){
        const t=String(el.textContent||'');
        if(!/Live Position Coach/i.test(t) || !/OPPONENT['’]S IDEA/i.test(t) || !/WHY THIS MOVE/i.test(t)) continue;
        const nested=[...el.children].some(child=>{
          const ct=String(child.textContent||'');
          return /Live Position Coach/i.test(ct) && /OPPONENT['’]S IDEA/i.test(ct) && /WHY THIS MOVE/i.test(ct);
        });
        if(!nested){card=el;break}
      }
      if(card) card.classList.add('cot-live-coach-scroll');
    };
    const observer=new MutationObserver(apply);
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    apply();
  }catch(err){console.warn('Scrollable Live Position Coach could not attach',err)}
})();

// Keep the training status box fixed and user-facing only. Internal engine/loading text
// is replaced with exactly "Your move" or "Opponent move" based on whose turn it is.
(function normalizeTrainingTurnStatus(){
  try{
    if(globalThis.__COT_NORMALIZED_TURN_STATUS__) return;
    globalThis.__COT_NORMALIZED_TURN_STATUS__=true;
    const style=document.createElement('style');
    style.textContent=`
      .cot-training-status-scroll{
        height:52px!important;
        min-height:52px!important;
        max-height:52px!important;
        overflow:hidden!important;
        display:flex!important;
        align-items:center!important;
      }
    `;
    document.head.appendChild(style);

    let applying=false;
    const desiredText=()=>{
      try{
        const userColor=state?.side==='black'?'b':'w';
        return state?.chess?.turn?.()===userColor?'Your move':'Opponent move';
      }catch{return 'Your move'}
    };
    const apply=()=>{
      if(applying||state?.screen!=='training') return;
      applying=true;
      try{
        const panels=[...document.querySelectorAll('.side-panel, aside')];
        for(const panel of panels){
          const nodes=[...panel.querySelectorAll('div,section,p')];
          let target=null;
          for(const el of nodes){
            const t=String(el.textContent||'').trim();
            if(!t) continue;
            if(!(/Your move/i.test(t)||/Opponent move/i.test(t)||/engine/i.test(t)||/thinking/i.test(t)||/loading/i.test(t))) continue;
            if(/Live Position Coach/i.test(t)||/Restart/i.test(t)||/Exit/i.test(t)||/OPPONENT['’]S IDEA/i.test(t)||/WHY THIS MOVE/i.test(t)) continue;
            const r=el.getBoundingClientRect();
            if(r.width>180 && r.height>25 && r.height<140){target=el;break}
          }
          if(target){
            target.classList.add('cot-training-status-scroll');
            const text=desiredText();
            if(target.textContent!==text) target.textContent=text;
          }
        }
      }finally{applying=false}
    };
    const observer=new MutationObserver(()=>queueMicrotask(apply));
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    apply();
  }catch(err){console.warn('Training turn status normalization could not attach',err)}
})();
