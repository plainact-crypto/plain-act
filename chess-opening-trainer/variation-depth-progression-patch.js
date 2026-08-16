// Per-variation depth progression for D4 Player / C6 Player.
// Depth 10 is the only entry course. A deeper course opens only when at least one
// variation is 5/5 in the previous depth, and only those same qualified variations
// are trainable inside the deeper course.
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
    function lessonsAt(side,depth){
      const profile=profileNow(); if(!profile) return [];
      try { return ensureLevelProgress(profile,side,depth)?.lessons || []; } catch { return []; }
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
    function depthUnlocked(side,depth){
      depth=Number(depth);
      if(depth===10) return true;
      const prev=previousDepth(depth); if(!prev) return false;
      return lessonsAt(side,prev).some(lesson=>selectedLinePasses(lesson)>=PASS_TARGET);
    }
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
      depthUnlock:'any-previous-depth-variation-at-5-of-5',
      unlockScope:'same-variation-only',
      replayPreviousMoves:true,
      finalDepth:'30-then-game-end'
    };
    globalThis.__COT_DEPTH_UNLOCKED__=depthUnlocked;
    globalThis.__COT_VARIATION_DEPTH_UNLOCKED__=variationUnlocked;

    function lockedMessage(depth){
      const prev=previousDepth(depth);
      return prev?`Finish at least one Depth ${prev} variation at 5/5 to unlock Depth ${depth}.`:'Start at Depth 10.';
    }
    function lockedVariationMessage(depth){
      const prev=previousDepth(depth);
      return prev?`Pass this same variation at Depth ${prev} five times first.`:'Start at Depth 10.';
    }

    startNewTraining=async function(index,...args){
      const depth=Number(state?.sessionLength||10);
      if(DEPTHS.includes(depth)&&!variationUnlocked(state.side,depth,index)){
        state.status=lockedVariationMessage(depth); try{render()}catch{}; return;
      }
      return originalStartNewTraining(index,...args);
    };

    startPracticeTest=async function(index,...args){
      const depth=Number(state?.sessionLength||10);
      if(DEPTHS.includes(depth)&&!variationUnlocked(state.side,depth,index)){
        state.status=lockedVariationMessage(depth); try{render()}catch{}; return;
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

    function depthFromText(text){
      const m=String(text||'').replace(/\s+/g,' ').match(/\bDepth\s+(10|15|20|25|30)\b/i);
      return m?Number(m[1]):null;
    }
    function gateDepthNavigation(){
      const side=state?.side==='black'?'black':'white';
      const candidates=[...document.querySelectorAll('button,a,[role="button"]')];
      for(const el of candidates){
        const depth=depthFromText(el.textContent); if(!depth) continue;
        const unlocked=depthUnlocked(side,depth);
        el.classList.toggle('cot-course-depth-locked',!unlocked);
        if(!unlocked){
          el.setAttribute('aria-disabled','true');
          el.setAttribute('data-cot-depth-locked',String(depth));
          if('disabled' in el) el.disabled=true;
          el.title=lockedMessage(depth);
        }else{
          el.removeAttribute('aria-disabled');
          el.removeAttribute('data-cot-depth-locked');
          if('disabled' in el) el.disabled=false;
          if(el.title&&/Finish at least one Depth/.test(el.title)) el.removeAttribute('title');
        }
      }
    }

    function gateVariationCards(){
      if(state?.screen!=='course') return;
      const depth=Number(state.sessionLength);
      if(!DEPTHS.includes(depth)) return;
      document.querySelectorAll('.variation-card').forEach((card,index)=>{
        const unlocked=variationUnlocked(state.side,depth,index);
        card.classList.toggle('cot-depth-locked',!unlocked);
        card.querySelectorAll('button').forEach(btn=>{
          if(!unlocked){btn.disabled=true;btn.setAttribute('aria-disabled','true')}
          else if(btn.hasAttribute('aria-disabled')){btn.disabled=false;btn.removeAttribute('aria-disabled')}
        });
        card.querySelector('.cot-depth-lock-note')?.remove();
        if(!unlocked){
          const note=document.createElement('div');note.className='cot-depth-lock-note';note.textContent=lockedVariationMessage(depth);card.appendChild(note);
        }
      });
    }

    document.addEventListener('click',event=>{
      const target=event.target?.closest?.('[data-cot-depth-locked]');
      if(!target)return;
      event.preventDefault();event.stopImmediatePropagation();
      const depth=Number(target.getAttribute('data-cot-depth-locked'));
      try{state.status=lockedMessage(depth);render()}catch{}
    },true);

    const style=document.createElement('style');
    style.textContent=`
      .cot-course-depth-locked{opacity:.48!important;filter:saturate(.35);cursor:not-allowed!important;position:relative}
      .cot-course-depth-locked::after{content:' 🔒';font-size:.82em}
      .variation-card.cot-depth-locked{opacity:.58}.variation-card.cot-depth-locked button{cursor:not-allowed}.cot-depth-lock-note{margin-top:8px;padding:8px 10px;border-radius:9px;background:#10171d;border:1px solid #2b3640;color:#9eabb5;font-size:11px;font-weight:700}
    `;
    document.head.appendChild(style);

    render=function(...args){
      const out=originalRenderDepthProgression(...args);
      queueMicrotask(()=>{try{gateDepthNavigation();gateVariationCards();addContinueButton()}catch{}});
      return out;
    };
    queueMicrotask(()=>{try{gateDepthNavigation();gateVariationCards();addContinueButton()}catch{}});
  }
} catch(err){ console.warn('Variation depth progression could not attach',err); }
