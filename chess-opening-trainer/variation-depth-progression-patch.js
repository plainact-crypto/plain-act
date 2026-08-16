// Per-variation depth progression for D4 Player / C6 Player.
// Depth 10 is the entry point. A variation unlocks its own next depth only after 5/5 valid Practice passes.
try {
  if (!globalThis.__COT_VARIATION_DEPTH_PROGRESSION__) {
    globalThis.__COT_VARIATION_DEPTH_PROGRESSION__ = true;

    const DEPTHS = [10,15,20,25,30];
    const PASS_TARGET = 5;
    const originalStartNewTraining = startNewTraining;
    const originalStartPracticeTest = startPracticeTest;
    const originalRenderDepthProgression = render;

    function profileNow(){ try { return loadProfile(); } catch { return null; } }
    function lessonAt(side, depth, index){
      const profile=profileNow(); if(!profile) return null;
      try { return ensureLevelProgress(profile,side,depth)?.lessons?.[index] || null; } catch { return null; }
    }
    function selectedLinePasses(lesson){
      if(!lesson) return 0;
      const lines=Array.isArray(lesson.lines)?lesson.lines:[];
      const selected=Math.max(0,Math.min(Number(lesson.selectedLineIndex||0),Math.max(0,lines.length-1)));
      const line=lines[selected];
      const linePasses=Number(line?.practice?.passes);
      if(Number.isFinite(linePasses)) return Math.max(0,Math.min(PASS_TARGET,linePasses));
      return Math.max(0,Math.min(PASS_TARGET,Number(lesson.passes||0)));
    }
    function depthIndex(depth){ return DEPTHS.indexOf(Number(depth)); }
    function previousDepth(depth){ const i=depthIndex(depth); return i>0?DEPTHS[i-1]:null; }
    function nextDepth(depth){ const i=depthIndex(depth); return i>=0&&i<DEPTHS.length-1?DEPTHS[i+1]:null; }
    function variationUnlocked(side,depth,index){
      depth=Number(depth);
      if(depth===10) return true;
      const prev=previousDepth(depth); if(!prev) return false;
      return selectedLinePasses(lessonAt(side,prev,index))>=PASS_TARGET;
    }
    function variationProgress(side,depth,index){
      const lesson=lessonAt(side,depth,index);
      return {passes:selectedLinePasses(lesson),unlocked:variationUnlocked(side,depth,index)};
    }

    globalThis.__COT_VARIATION_DEPTH_RULES__={
      depths:[...DEPTHS],
      passTarget:PASS_TARGET,
      entryDepth:10,
      unlockScope:'same-variation-only',
      replayPreviousMoves:true,
      finalDepth:'30-then-game-end'
    };
    globalThis.__COT_VARIATION_DEPTH_UNLOCKED__=variationUnlocked;

    function lockedMessage(depth){
      const prev=previousDepth(depth);
      return prev?`Pass this same variation at Depth ${prev} five times first.`:'Start at Depth 10.';
    }

    startNewTraining=async function(index,...args){
      const depth=Number(state?.sessionLength||10);
      if(DEPTHS.includes(depth)&&!variationUnlocked(state.side,depth,index)){
        state.status=lockedMessage(depth); try{render()}catch{}; return;
      }
      return originalStartNewTraining(index,...args);
    };

    startPracticeTest=async function(index,...args){
      const depth=Number(state?.sessionLength||10);
      if(DEPTHS.includes(depth)&&!variationUnlocked(state.side,depth,index)){
        state.status=lockedMessage(depth); try{render()}catch{}; return;
      }
      return originalStartPracticeTest(index,...args);
    };

    async function continueSameVariation(targetDepth){
      const index=Number(state.variationIndex||0);
      const side=state.side;
      if(targetDepth!==99 && !variationUnlocked(side,targetDepth,index)) return;
      state.complete=false;
      state.mode='guided';
      state.screen='course';
      state.sessionLength=targetDepth;
      try{render()}catch{}
      await Promise.resolve();
      return originalStartNewTraining(index,true);
    }

    function addContinueButton(){
      if(state?.screen!=='training'||state?.mode!=='test'||!state?.complete) return;
      const depth=Number(state.sessionLength);
      if(!DEPTHS.includes(depth)) return;
      const progress=variationProgress(state.side,depth,state.variationIndex);
      if(progress.passes<PASS_TARGET) return;
      const card=document.querySelector('.complete-card'); if(!card||card.querySelector('#cotContinueThisLine')) return;
      const next=nextDepth(depth);
      const button=document.createElement('button');
      button.id='cotContinueThisLine';
      button.className='primary';
      button.style.cssText='width:100%;margin-top:10px';
      button.textContent=next?`Continue This Line · Depth ${next}`:'Continue This Line · Play to Game End';
      const menu=card.querySelector('#menu');
      if(menu) card.insertBefore(button,menu); else card.appendChild(button);
      button.addEventListener('click',()=>continueSameVariation(next||99));
    }

    function gateVariationCards(){
      if(state?.screen!=='course') return;
      const depth=Number(state.sessionLength);
      if(!DEPTHS.includes(depth)) return;
      document.querySelectorAll('.variation-card').forEach((card,index)=>{
        const unlocked=variationUnlocked(state.side,depth,index);
        card.classList.toggle('cot-depth-locked',!unlocked);
        card.querySelectorAll('button').forEach(btn=>{ if(!unlocked){btn.disabled=true;btn.setAttribute('aria-disabled','true')} });
        if(!unlocked && !card.querySelector('.cot-depth-lock-note')){
          const note=document.createElement('div');note.className='cot-depth-lock-note';note.textContent=lockedMessage(depth);card.appendChild(note);
        }
      });
    }

    const style=document.createElement('style');
    style.textContent=`.variation-card.cot-depth-locked{opacity:.58}.variation-card.cot-depth-locked button{cursor:not-allowed}.cot-depth-lock-note{margin-top:8px;padding:8px 10px;border-radius:9px;background:#10171d;border:1px solid #2b3640;color:#9eabb5;font-size:11px;font-weight:700}`;
    document.head.appendChild(style);

    render=function(...args){
      const out=originalRenderDepthProgression(...args);
      queueMicrotask(()=>{try{gateVariationCards();addContinueButton()}catch{}});
      return out;
    };
    queueMicrotask(()=>{try{gateVariationCards();addContinueButton()}catch{}});
  }
} catch(err){ console.warn('Variation depth progression could not attach',err); }
