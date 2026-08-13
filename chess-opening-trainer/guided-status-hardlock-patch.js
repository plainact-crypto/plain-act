// Guided Training status hard lock.
// Internal engine messages must never be painted. The visible turn status is always
// exactly "Your move" or "Opponent move", rendered in a fixed single-line box.
(function installGuidedStatusHardLock(){
  try{
    if(globalThis.__COT_GUIDED_STATUS_HARD_LOCK__) return;
    globalThis.__COT_GUIDED_STATUS_HARD_LOCK__=true;

    const style=document.createElement('style');
    style.textContent=`
      .cot-guided-turn-status-hardlock{
        height:40px!important;
        min-height:40px!important;
        max-height:40px!important;
        box-sizing:border-box!important;
        overflow-x:auto!important;
        overflow-y:hidden!important;
        white-space:nowrap!important;
        display:flex!important;
        align-items:center!important;
        flex-wrap:nowrap!important;
        scrollbar-width:thin!important;
        scrollbar-gutter:stable!important;
      }
      .cot-guided-turn-status-hardlock *{white-space:nowrap!important;flex-wrap:nowrap!important}
    `;
    document.head.appendChild(style);

    const desired=()=>{
      try{
        const user=state?.side==='black'?'b':'w';
        return state?.chess?.turn?.()===user?'Your move':'Opponent move';
      }catch{return 'Your move'}
    };

    const normalizeDom=()=>{
      try{
        if(state?.screen!=='training'||state?.mode!=='guided') return;
        const wanted=desired();
        for(const panel of document.querySelectorAll('.side-panel,aside')){
          const candidates=[...panel.querySelectorAll('div,section,p')].filter(el=>{
            const text=String(el.textContent||'').trim();
            if(!text) return false;
            if(/Live Position Coach|OPPONENT['’]S IDEA|WHY THIS MOVE|Restart|Exit/i.test(text)) return false;
            return /^(Your move|Opponent move|Engine is|Engine |Thinking|Loading|Choosing)/i.test(text);
          });
          for(const el of candidates){
            const r=el.getBoundingClientRect();
            if(r.width<150||r.height<24||r.height>120) continue;
            el.classList.add('cot-guided-turn-status-hardlock');
            if(el.textContent!==wanted) el.textContent=wanted;
          }
        }
      }catch{}
    };

    const previousRender=render;
    render=function(...args){
      try{
        if(state?.screen==='training'&&state?.mode==='guided'){
          state.status=desired();
          state.statusError=false;
        }
      }catch{}
      const out=previousRender(...args);
      queueMicrotask(normalizeDom);
      requestAnimationFrame(normalizeDom);
      return out;
    };

    const observer=new MutationObserver(()=>queueMicrotask(normalizeDom));
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    normalizeDom();
  }catch(err){console.warn('Guided status hard lock could not attach',err)}
})();
