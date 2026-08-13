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
  style.textContent='@media (min-width:900px){.board-shell{min-width:min(58vh,620px)}#board{width:100%!important;max-width:720px}}';
  document.head.appendChild(style);
})();

// Hide internal engine diagnostics from every Training mode. They are implementation
// details, not user-facing coaching information, and their changing PV/move-list height
// was causing the right panel and page to reflow after every move.
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

        // Find the marker's top-level branch inside this panel, then hide that branch
        // and every following sibling (PV and raw move list live below it).
        let branch=marker;
        while(branch.parentElement && branch.parentElement!==panel) branch=branch.parentElement;
        if(branch.parentElement===panel){
          let node=branch;
          while(node){
            node.style.setProperty('display','none','important');
            node=node.nextElementSibling;
          }
          continue;
        }

        // Fallback for unexpected markup: hide the smallest blocks containing the
        // diagnostic labels without touching the coaching/status controls above them.
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
