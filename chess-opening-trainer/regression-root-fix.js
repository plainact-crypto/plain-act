// --- Root regression closure for Reports #42-#49 ---
// Deterministic activation navigation + stable Practice entry/exit lifecycle.
try{
  if(!globalThis.__COT_REPORTS_42_47_ROOT_FIX__){
    globalThis.__COT_REPORTS_42_47_ROOT_FIX__=true;
    const DEPTHS=[5,10,15,20,25,30];
    const PASS_TARGET=typeof PRACTICE_PASSES_PER_VARIATION==='number'?PRACTICE_PASSES_PER_VARIATION:5;
    const FOCUS_KEY='cotActivationFocus';
    let nextActionFlowActive=false;
    const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    async function settle(predicate,frames=12){for(let i=0;i<frames;i++){try{if(predicate())return true}catch{}await nextFrame()}return false}
    function progressLevel(p,side,depth){try{return ensureLevelProgress(p,side,depth)}catch{return null}}
    function nextAction(p,side){
      for(const depth of DEPTHS){
        const lp=progressLevel(p,side,depth),lessons=Array.isArray(lp?.lessons)?lp.lessons:[];
        let rp=null;try{rp=rankUnlockProgress(lp)}catch{}
        if(rp?.unlocked&&!lp?.rankCompleted)return{side,depth,variation:0,mode:'rank'};
        for(let i=0;i<lessons.length;i++){
          const l=lessons[i]||{},passes=Number(l.passes||0);if(passes>=PASS_TARGET)continue;
          const learned=(Array.isArray(l.lines)&&l.lines.length>0)||Boolean(l.line||l.savedLine||l.trained||passes>0);
          return{side,depth,variation:i,mode:learned?'test':'guided'};
        }
      }
      return{side,depth:30,variation:0,mode:'rank'};
    }
    function focusedSide(p,explicit){
      if(explicit==='white'||explicit==='black')return explicit;
      const stored=localStorage.getItem(FOCUS_KEY);if(stored==='white'||stored==='black')return stored;
      try{return Number(openingProgress(p,'black')?.capped||0)>Number(openingProgress(p,'white')?.capped||0)?'black':'white'}catch{return 'white'}
    }
    function markFlow(){
      try{
        const screen=String(state?.screen||'');
        if(nextActionFlowActive&&/^(side|course|training)$/.test(screen))document.documentElement.dataset.cotFlow=screen;
        else document.documentElement.dataset.cotFlow='dashboard';
      }catch{document.documentElement.dataset.cotFlow='dashboard'}
    }
    const stableCss=document.createElement('style');
    stableCss.textContent=`html[data-cot-flow="side"] .cot-activation-hub,html[data-cot-flow="course"] .cot-activation-hub,html[data-cot-flow="training"] .cot-activation-hub{display:none!important}`;
    document.head.appendChild(stableCss);

    // Reports #44/#48/#49: the old Practice DOM-stability guard correctly avoids
    // rebuilding the board DURING a Practice attempt, but it could mistake the
    // existing Guided board for an already-mounted Practice board on the first
    // render. Force exactly one clean boundary render by invalidating the old board
    // instance before entering Practice; later renders remain stable/in-place.
    try{
      if(typeof startPracticeTest==='function'&&!globalThis.__COT_PRACTICE_ENTRY_BOUNDARY_48_49__){
        globalThis.__COT_PRACTICE_ENTRY_BOUNDARY_48_49__=true;
        const entryBaseStartPractice=startPracticeTest;
        startPracticeTest=async function(index){
          try{
            if(document.querySelector('.training')&&state?.board){
              try{state.board.destroy?.()}catch{}
              state.board=null;
            }
          }catch{}
          const out=await entryBaseStartPractice(index);
          try{
            if(state?.screen==='training'&&state?.mode==='test'){
              state.engineBusy=false;
              if(!document.querySelector('#board')||!state?.board)render();
            }
          }catch{}
          return out;
        };
      }
    }catch(err){console.warn('Practice entry boundary fix could not attach',err)}

    async function launchAction(explicitSide){
      const p=loadProfile?.();if(!p)return false;
      const side=focusedSide(p,explicitSide),a=nextAction(p,side);localStorage.setItem(FOCUS_KEY,side);
      nextActionFlowActive=true;
      try{
        state.side=side;state.sessionLength=a.depth;state.level=a.depth;state.variationIndex=a.variation;state.complete=false;
        markFlow();document.querySelector('.cot-activation-hub')?.remove();
        if(a.mode==='rank'){
          if(typeof startRankTest!=='function')throw new Error('startRankTest unavailable');
          await startRankTest();
        }else if(a.mode==='test'){
          if(typeof startPracticeTest!=='function')throw new Error('startPracticeTest unavailable');
          await startPracticeTest(a.variation);
        }else{
          // A brand-new variation has no saved line yet, so startSavedTraining() is
          // intentionally a no-op. Enter the resolved course and activate the exact
          // variation's data-new control (not a text search / retry loop). This uses
          // the product's canonical New Training transition and keeps all chess logic.
          state.screen='course';render();await nextFrame();
          const start=document.querySelector(`[data-new="${a.variation}"]`);
          if(!start)throw new Error('New Training action unavailable');
          start.click();
        }
      }catch(err){
        nextActionFlowActive=false;markFlow();
        try{state.screen='course';render()}catch{}
        console.warn('Direct training launch failed',err);return false;
      }
      const reached=await settle(()=>state?.screen==='training'&&!!document.querySelector('#board')&&!!state?.board,30);
      markFlow();document.querySelector('.cot-activation-hub')?.remove();
      if(!reached){nextActionFlowActive=false;markFlow()}
      return reached;
    }
    globalThis.__COT_LAUNCH_NEXT_ACTION__=launchAction;

    // Capture before Activation V2's old target listeners. This prevents its old
    // recursive text-search driveTo() from running at all.
    document.addEventListener('click',e=>{
      const b=e.target?.closest?.('#cotPrimaryNext,[data-next-side]');if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();
      const side=b.dataset?.nextSide||null;launchAction(side).catch(err=>{nextActionFlowActive=false;markFlow();console.warn('Continue Training navigation failed',err)});
    },true);

    // Reports #49/#44: exit controls must always act on the CURRENT state, even if a
    // stale pre-Practice element survived a prior regression. One delegated handler
    // makes Back to Level / Exit deterministic without depending on old node listeners.
    document.addEventListener('click',e=>{
      const b=e.target?.closest?.('#exit,#menu,#pickerBack');if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();
      nextActionFlowActive=false;
      try{
        state.engineBusy=false;state.complete=false;state.practiceReviewActive=false;state.hintVisible=false;
        state.screen='course';markFlow();render();
      }catch(err){console.warn('Back to Level navigation failed',err)}
    },true);

    // Only hide the hub after Continue/Next Best Action has actually started.
    const rootBaseRender=render;
    render=function(...args){
      const before=String(state?.screen||'');if(!/^(side|course|training)$/.test(before))nextActionFlowActive=false;
      markFlow();const out=rootBaseRender.apply(this,args);markFlow();
      if(nextActionFlowActive&&/^(side|course|training)$/.test(String(state?.screen||'')))queueMicrotask(()=>document.querySelector('.cot-activation-hub')?.remove());
      return out;
    };
    markFlow();
  }
}catch(err){console.warn('Reports #42-#49 root fix could not attach',err)}
