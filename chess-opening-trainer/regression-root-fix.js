// --- Root regression closure for Reports #42-#47 ---
// Deterministic activation navigation + stable course/side lifecycle.
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

    async function launchAction(explicitSide){
      const p=loadProfile?.();if(!p)return false;
      const side=focusedSide(p,explicitSide),a=nextAction(p,side);localStorage.setItem(FOCUS_KEY,side);
      nextActionFlowActive=true;
      try{
        state.side=side;state.sessionLength=a.depth;state.level=a.depth;state.variationIndex=a.variation;state.complete=false;
        // Reports #45/#46 root fix: do not navigate by searching button text.
        // The mode launch functions are the product's actual state transitions, so
        // call them directly with the already resolved side/depth/variation.
        markFlow();document.querySelector('.cot-activation-hub')?.remove();
        if(a.mode==='rank'){
          if(typeof startRankTest!=='function')throw new Error('startRankTest unavailable');
          await startRankTest();
        }else if(a.mode==='test'){
          if(typeof startPracticeTest!=='function')throw new Error('startPracticeTest unavailable');
          await startPracticeTest(a.variation);
        }else{
          if(typeof startSavedTraining!=='function')throw new Error('startSavedTraining unavailable');
          await startSavedTraining(a.variation);
        }
      }catch(err){
        nextActionFlowActive=false;markFlow();
        try{state.screen='course';render()}catch{}
        console.warn('Direct training launch failed',err);return false;
      }
      const reached=await settle(()=>state?.screen==='training'&&!!document.querySelector('#board'),24);
      markFlow();document.querySelector('.cot-activation-hub')?.remove();
      if(!reached){nextActionFlowActive=false;markFlow()}
      return reached;
    }
    globalThis.__COT_LAUNCH_NEXT_ACTION__=launchAction;

    // Capture before Activation V2's old target listeners. This prevents the old
    // recursive text-search driveTo() from running at all.
    document.addEventListener('click',e=>{
      const b=e.target?.closest?.('#cotPrimaryNext,[data-next-side]');if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();
      const side=b.dataset?.nextSide||null;launchAction(side).catch(err=>{nextActionFlowActive=false;markFlow();console.warn('Continue Training navigation failed',err)});
    },true);

    // Only hide the hub after Continue/Next Best Action has actually started.
    // Auth/session restore can legitimately have state.screen='side'; that is still
    // the dashboard context and must keep the primary CTA visible.
    const rootBaseRender=render;
    render=function(...args){
      const before=String(state?.screen||'');if(!/^(side|course|training)$/.test(before))nextActionFlowActive=false;
      markFlow();const out=rootBaseRender.apply(this,args);markFlow();
      if(nextActionFlowActive&&/^(side|course|training)$/.test(String(state?.screen||'')))queueMicrotask(()=>document.querySelector('.cot-activation-hub')?.remove());
      return out;
    };
    markFlow();
  }
}catch(err){console.warn('Reports #42-#47 root fix could not attach',err)}
