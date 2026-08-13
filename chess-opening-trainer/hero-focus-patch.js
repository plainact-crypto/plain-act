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

// Practice/Rank board stability: do not rebuild the chessboard repeatedly when the
// underlying position has not changed. Background status/engine updates can call render()
// many times for the same FEN; those duplicate renders are the visible flash. Explicit
// side-panel button actions are allowed through even at the same FEN.
(function suppressDuplicateTestRenders(){
  try{
    if(globalThis.__COT_SUPPRESS_DUPLICATE_TEST_RENDERS__) return;
    globalThis.__COT_SUPPRESS_DUPLICATE_TEST_RENDERS__=true;
    const originalRender=render;
    let lastKey='';
    let forceNext=false;
    const keyNow=()=>{
      try{
        const fen=state?.chess?.fen?.()||'';
        return `${state?.screen||''}|${state?.mode||''}|${state?.side||''}|${fen}`;
      }catch{return ''}
    };
    document.addEventListener('click',e=>{
      try{
        const button=e.target?.closest?.('button');
        if(!button) return;
        if(button.closest('.side-panel,aside')) forceNext=true;
      }catch{}
    },true);
    render=function(...args){
      const isTest=state?.screen==='training'&&(state?.mode==='test'||state?.mode==='rank');
      const key=keyNow();
      if(isTest && !forceNext && key && key===lastKey && document.querySelector('#board')){
        return;
      }
      forceNext=false;
      const out=originalRender(...args);
      lastKey=keyNow();
      return out;
    };
  }catch(err){console.warn('Duplicate Practice/Rank render suppression could not attach',err)}
})();

// Practice/Rank visual continuity: a legitimate position change still rebuilds the board.
// Keep a frozen visual copy of the old board over the exact board rectangle until the
// replacement board has painted. This removes the one-frame black/empty flash without
// reusing or swapping the live cm-chessboard instance.
(function maskTestBoardRebuildFlash(){
  try{
    if(globalThis.__COT_TEST_BOARD_REBUILD_MASK__) return;
    globalThis.__COT_TEST_BOARD_REBUILD_MASK__=true;
    const originalRender=render;
    let mask=null;
    const clearMask=()=>{try{mask?.remove()}catch{};mask=null};
    render=function(...args){
      const isTest=state?.screen==='training'&&(state?.mode==='test'||state?.mode==='rank');
      const oldShell=isTest?document.querySelector('.board-shell'):null;
      if(isTest&&oldShell&&!mask){
        try{
          const rect=oldShell.getBoundingClientRect();
          if(rect.width>50&&rect.height>50){
            mask=oldShell.cloneNode(true);
            mask.id='cotBoardRebuildMask';
            mask.setAttribute('aria-hidden','true');
            mask.style.cssText=`position:fixed!important;left:${rect.left}px!important;top:${rect.top}px!important;width:${rect.width}px!important;height:${rect.height}px!important;z-index:15000!important;margin:0!important;pointer-events:none!important;overflow:hidden!important;contain:paint!important;background:#0b1015!important;`;
            document.body.appendChild(mask);
          }
        }catch{clearMask()}
      }
      const out=originalRender(...args);
      if(mask){
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          try{
            const newBoard=document.querySelector('#board');
            if(newBoard&&newBoard.getBoundingClientRect().width>50) clearMask();
            else setTimeout(clearMask,120);
          }catch{clearMask()}
        }));
      }
      return out;
    };
  }catch(err){console.warn('Practice/Rank board rebuild mask could not attach',err)}
})();

// Guided cleanup: everything rendered below the Restart/Exit control row is raw session
// output (duplicate status, move history, diagnostics). It is not part of the training UI
// and its growing height causes visible vertical jitter. Remove it from layout completely.
(function removeGuidedTrailingRawOutput(){
  try{
    if(globalThis.__COT_REMOVE_GUIDED_TRAILING_RAW_OUTPUT__) return;
    globalThis.__COT_REMOVE_GUIDED_TRAILING_RAW_OUTPUT__=true;
    const apply=()=>{
      if(state?.screen!=='training'||state?.mode!=='guided') return;
      const panels=[...document.querySelectorAll('.side-panel,aside')];
      for(const panel of panels){
        const restart=[...panel.querySelectorAll('button')].find(b=>/^Restart$/i.test(String(b.textContent||'').trim()));
        const exit=[...panel.querySelectorAll('button')].find(b=>/^Exit$/i.test(String(b.textContent||'').trim()));
        if(!restart||!exit) continue;
        let row=restart;
        while(row.parentElement&&row.parentElement!==panel&&!row.contains(exit)) row=row.parentElement;
        if(!row.contains(exit)){
          row=restart.parentElement;
          while(row?.parentElement&&row.parentElement!==panel){
            if(row.contains(exit)) break;
            row=row.parentElement;
          }
        }
        if(!row||row.parentElement!==panel) continue;
        let node=row.nextElementSibling;
        while(node){
          node.style.setProperty('display','none','important');
          node.setAttribute('aria-hidden','true');
          node=node.nextElementSibling;
        }
      }
    };
    const observer=new MutationObserver(()=>queueMicrotask(apply));
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    apply();
  }catch(err){console.warn('Guided trailing raw output cleanup could not attach',err)}
})();
