// --- Root regression closure for Reports #42-#47 ---
// Deterministic activation navigation + stable course/side lifecycle.
try{
  if(!globalThis.__COT_REPORTS_42_47_ROOT_FIX__){
    globalThis.__COT_REPORTS_42_47_ROOT_FIX__=true;
    const DEPTHS=[5,10,15,20,25,30];
    const PASS_TARGET=typeof PRACTICE_PASSES_PER_VARIATION==='number'?PRACTICE_PASSES_PER_VARIATION:5;
    const FOCUS_KEY='cotActivationFocus';
    const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'};
    const safeButtons=()=>[...document.querySelectorAll('#app button,#app [role="button"],#app a')].filter(el=>visible(el)&&!el.closest('.cot-activation-hub,#cotOnboarding,#issueReportModal,#cloudAuthGate'));
    const txt=el=>String(el?.textContent||'').replace(/\s+/g,' ').trim();
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
    function clickOne(re,within=null){const pool=within?[...within.querySelectorAll('button,[role="button"],a')].filter(visible):safeButtons();const b=pool.find(el=>re.test(txt(el)));if(!b)return false;b.click();return true}
    function variationContainer(index){
      const re=new RegExp(`Variation\\s*${index+1}(?:\\D|$)`,'i');
      const nodes=[...document.querySelectorAll('#app article,#app section,#app .variation-card,#app div')].filter(el=>!el.closest('.cot-activation-hub')&&re.test(txt(el))&&el.querySelector('button,[role="button"],a'));
      nodes.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length);return nodes[0]||null;
    }
    function markFlow(){
      try{const screen=String(state?.screen||'');document.documentElement.dataset.cotFlow=/^(side|course|training)$/.test(screen)?screen:'dashboard'}catch{document.documentElement.dataset.cotFlow='dashboard'}
    }
    const stableCss=document.createElement('style');
    stableCss.textContent=`html[data-cot-flow="side"] .cot-activation-hub,html[data-cot-flow="course"] .cot-activation-hub,html[data-cot-flow="training"] .cot-activation-hub{display:none!important}`;
    document.head.appendChild(stableCss);

    async function launchAction(explicitSide){
      const p=loadProfile?.();if(!p)return false;
      const side=focusedSide(p,explicitSide),a=nextAction(p,side);localStorage.setItem(FOCUS_KEY,side);
      // Root fix: enter the destination course from state directly. Do not text-click
      // White/Black/Depth controls and do not poll/retry clicks across the whole DOM.
      try{
        state.side=side;state.sessionLength=a.depth;state.level=a.depth;state.variationIndex=a.variation;state.screen='course';state.complete=false;
        markFlow();document.querySelector('.cot-activation-hub')?.remove();render();
      }catch(err){console.warn('Direct course navigation failed',err);return false}
      await settle(()=>state?.screen==='course',8);

      if(a.mode==='rank'){
        const ok=clickOne(/(?:Start\s+)?Rank Test|Take .*Rank/i);if(!ok)return false;
      }else{
        const card=variationContainer(a.variation);
        const modeRe=a.mode==='test'?/(?:Start\s+)?Practice|Test from memory/i:/(?:Start\s+)?Guided|Guided Training|\bLearn\b|\bTrain\b/i;
        let clicked=card?clickOne(modeRe,card):false;
        if(!clicked&&card){const first=[...card.querySelectorAll('button,[role="button"],a')].find(visible);if(first){first.click();clicked=true;await nextFrame();if(state?.screen!=='training')clicked=clickOne(modeRe)||clicked}}
        if(!clicked)clicked=clickOne(modeRe);
        if(!clicked)return false;
      }
      const reached=await settle(()=>state?.screen==='training',20);
      markFlow();document.querySelector('.cot-activation-hub')?.remove();
      return reached;
    }
    globalThis.__COT_LAUNCH_NEXT_ACTION__=launchAction;

    // Capture before Activation V2's old target listeners. This prevents the old
    // recursive text-search driveTo() from running at all.
    document.addEventListener('click',e=>{
      const b=e.target?.closest?.('#cotPrimaryNext,[data-next-side]');if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();
      const side=b.dataset?.nextSide||null;launchAction(side).catch(err=>console.warn('Continue Training navigation failed',err));
    },true);

    // Keep Activation hub out of side/course/training layout synchronously. The V2
    // render hook may try to reinsert it in a microtask; display:none is already set
    // before paint and this cleanup removes it from DOM entirely.
    const rootBaseRender=render;
    render=function(...args){markFlow();const out=rootBaseRender.apply(this,args);markFlow();if(/^(side|course|training)$/.test(String(state?.screen||'')))queueMicrotask(()=>document.querySelector('.cot-activation-hub')?.remove());return out};
    markFlow();
  }
}catch(err){console.warn('Reports #42-#47 root fix could not attach',err)}
