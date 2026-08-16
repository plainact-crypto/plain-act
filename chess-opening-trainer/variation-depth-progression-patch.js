// Per-variation depth progression for D4 Player / C6 Player.
// Depth 10 is the only place where new variations are created. Deeper depths are
// continuation-only: only a variation passed 5/5 at the previous depth is available,
// and it must replay the exact saved parent line before adding the next five moves.
// Rank unlock requires one COMPLETE line: 10 -> 15 -> 20 -> 25 -> 30 all at 5/5,
// then a natural game end.
try {
  if (!globalThis.__COT_VARIATION_DEPTH_PROGRESSION__) {
    globalThis.__COT_VARIATION_DEPTH_PROGRESSION__ = true;

    const DEPTHS = [10,15,20,25,30];
    const PASS_TARGET = 5;
    const GAME_END_DEPTH = 99;
    const originalStartNewTraining = startNewTraining;
    const originalStartPracticeTest = startPracticeTest;
    const originalFinishSessionDepthProgression = finishSession;
    const originalRenderDepthProgression = render;
    const originalDepthBestRepertoireMove = bestRepertoireMove;
    const originalDepthBestMove = bestMove;

    function profileNow(){ try { return loadProfile(); } catch { return null; } }
    function lessonFromProfile(profile,side,depth,index){
      if(!profile)return null;
      try{return ensureLevelProgress(profile,side,depth)?.lessons?.[index]||null}catch{return null}
    }
    function lessonAt(side,depth,index){ return lessonFromProfile(profileNow(),side,depth,index); }
    function lessonsAt(side,depth){
      const profile=profileNow(); if(!profile) return [];
      try{return ensureLevelProgress(profile,side,depth)?.lessons||[]}catch{return []}
    }
    function selectedLine(lesson){
      if(!lesson)return null;
      const lines=Array.isArray(lesson.lines)?lesson.lines:[];
      if(!lines.length)return null;
      const selected=Math.max(0,Math.min(Number(lesson.selectedLineIndex||0),lines.length-1));
      return lines[selected]||null;
    }
    function selectedLinePasses(lesson){
      if(!lesson)return 0;
      const line=selectedLine(lesson);
      const linePasses=Number(line?.practice?.passes);
      if(Number.isFinite(linePasses))return Math.max(0,Math.min(PASS_TARGET,linePasses));
      return Math.max(0,Math.min(PASS_TARGET,Number(lesson.passes||0)));
    }
    function depthIndex(depth){return DEPTHS.indexOf(Number(depth))}
    function previousDepth(depth){const i=depthIndex(depth);return i>0?DEPTHS[i-1]:null}
    function nextDepth(depth){const i=depthIndex(depth);return i>=0&&i<DEPTHS.length-1?DEPTHS[i+1]:null}
    function depthUnlocked(side,depth){
      depth=Number(depth);
      if(depth===10)return true;
      const prev=previousDepth(depth);if(!prev)return false;
      return lessonsAt(side,prev).some(lesson=>selectedLinePasses(lesson)>=PASS_TARGET);
    }
    function variationUnlocked(side,depth,index){
      depth=Number(depth);
      if(depth===10)return true;
      const prev=previousDepth(depth);if(!prev)return false;
      return selectedLinePasses(lessonAt(side,prev,index))>=PASS_TARGET;
    }
    function variationProgress(side,depth,index){
      const lesson=lessonAt(side,depth,index);
      return {passes:selectedLinePasses(lesson),unlocked:variationUnlocked(side,depth,index)};
    }
    function currentDepthHasSavedLine(side,depth,index){
      const lesson=lessonAt(side,depth,index);
      return Boolean(selectedLine(lesson)?.moves?.length);
    }
    function allFormalDepthsPassed(profile,side,index){
      return DEPTHS.every(depth=>selectedLinePasses(lessonFromProfile(profile,side,depth,index))>=PASS_TARGET);
    }
    function fullLineRecord(profile,side,index){return profile?.fullLineCompletions?.[side]?.[String(index)]||null}
    function fullLineCompleted(profile,side,index){return allFormalDepthsPassed(profile,side,index)&&Boolean(fullLineRecord(profile,side,index)?.completed)}
    function fullLineCompletedCount(profile,side){let count=0;for(let index=0;index<20;index++)if(fullLineCompleted(profile,side,index))count++;return count}
    function syncRankMetadata(profile,side){
      if(!profile)return 0;
      const count=fullLineCompletedCount(profile,side);
      for(const depth of DEPTHS){const lp=ensureLevelProgress(profile,side,depth);lp.rankFullLineCompletedCount=count;lp.rankUnlocked=count>=1}
      return count;
    }
    function markFullLineGameEnd(side,index){
      const profile=profileNow();
      if(!profile||!allFormalDepthsPassed(profile,side,index))return false;
      profile.fullLineCompletions=profile.fullLineCompletions||{};
      profile.fullLineCompletions[side]=profile.fullLineCompletions[side]||{};
      profile.fullLineCompletions[side][String(index)]={completed:true,completedAt:new Date().toISOString(),variationIndex:index,requiredDepths:[...DEPTHS],passesPerDepth:PASS_TARGET,naturalGameEnd:true};
      syncRankMetadata(profile,side);saveProfile(profile);return true;
    }

    function stepUci(step){return step?`${step.from||''}${step.to||''}${step.promotion||''}`:''}
    function moveUci(move){return move?`${move.from||''}${move.to||''}${move.promotion||''}`:''}
    function legalUci(uci){try{return !!uci&&state.chess.moves({verbose:true}).some(move=>moveUci(move)===uci)}catch{return false}}
    function inheritedPrefixLine(){
      const depth=Number(state?.sessionLength||10);
      if(state?.screen!=='training'||state?.mode!=='guided'||!DEPTHS.includes(depth)||depth===10)return null;
      const prev=previousDepth(depth);if(!prev)return null;
      const lesson=lessonAt(state.side,prev,Number(state.variationIndex||0));
      if(selectedLinePasses(lesson)<PASS_TARGET)return null;
      const line=selectedLine(lesson);
      return Array.isArray(line?.moves)&&line.moves.length?line:null;
    }
    function inheritedPrefixStep(actor){
      const line=inheritedPrefixLine();if(!line)return null;
      const moves=line.moves;let hist=[];
      try{hist=state.chess.history({verbose:true})||[]}catch{return null}
      for(let i=0;i<hist.length&&i<moves.length;i++){if(moveUci(hist[i])!==stepUci(moves[i]))return null}
      if(hist.length>=moves.length)return null;
      const step=moves[hist.length];
      if(!step||step.actor!==actor)return null;
      return legalUci(stepUci(step))?step:null;
    }

    bestRepertoireMove=async function(...args){
      const inherited=inheritedPrefixStep('user');
      if(inherited){
        const uci=stepUci(inherited);
        globalThis.__COT_LAST_GUIDED_DECISION__={type:'inherited-line-prefix',uci,fromDepth:previousDepth(state.sessionLength),toDepth:Number(state.sessionLength),fen:state?.chess?.fen?.()||''};
        return {from:inherited.from,to:inherited.to,promotion:inherited.promotion||null};
      }
      return originalDepthBestRepertoireMove(...args);
    };
    bestMove=async function(...args){
      const inherited=inheritedPrefixStep('engine');
      if(inherited){
        const uci=stepUci(inherited);
        globalThis.__COT_LAST_GUIDED_DECISION__={type:'inherited-line-prefix',uci,fromDepth:previousDepth(state.sessionLength),toDepth:Number(state.sessionLength),fen:state?.chess?.fen?.()||''};
        return uci;
      }
      return originalDepthBestMove(...args);
    };

    globalThis.__COT_VARIATION_DEPTH_RULES__={
      depths:[...DEPTHS],passTarget:PASS_TARGET,entryDepth:10,
      variationCreation:'depth-10-only',
      depthUnlock:'any-previous-depth-variation-at-5-of-5',
      unlockScope:'same-variation-only',replayPreviousMoves:true,
      inheritedPrefix:'exact-saved-previous-depth-line',
      extension:'after-prefix-add-next-five-trainee-moves',
      finalDepth:'30-then-game-end',
      rankUnlock:'same-variation-5of5-at-10-15-20-25-30-plus-natural-game-end'
    };
    globalThis.__COT_DEPTH_UNLOCKED__=depthUnlocked;
    globalThis.__COT_VARIATION_DEPTH_UNLOCKED__=variationUnlocked;
    globalThis.__COT_FULL_LINE_COMPLETED__=(side,index)=>fullLineCompleted(profileNow(),side,index);
    globalThis.__COT_FULL_LINE_COMPLETED_COUNT__=side=>fullLineCompletedCount(profileNow(),side);

    function lockedMessage(depth){const prev=previousDepth(depth);return prev?`Finish at least one Depth ${prev} variation at 5/5 to unlock Depth ${depth}.`:'Start at Depth 10.'}
    function lockedVariationMessage(depth){const prev=previousDepth(depth);return prev?`Complete this variation at Depth ${prev} first.`:'Start at Depth 10.'}

    startNewTraining=async function(index,...args){
      const depth=Number(state?.sessionLength||10);
      if(DEPTHS.includes(depth)&&!variationUnlocked(state.side,depth,index)){
        state.status=lockedVariationMessage(depth);try{render()}catch{};return;
      }
      // Only Depth 10 can create/explore a new variation. Deeper depths always continue
      // the already-qualified parent variation and bypass the "new line" explorer.
      if(depth>10&&DEPTHS.includes(depth))return originalStartNewTraining(index,true);
      return originalStartNewTraining(index,...args);
    };

    startPracticeTest=async function(index,...args){
      const depth=Number(state?.sessionLength||10);
      if(DEPTHS.includes(depth)&&!variationUnlocked(state.side,depth,index)){
        state.status=lockedVariationMessage(depth);try{render()}catch{};return;
      }
      // Practice at a deeper depth exists only after its Guided continuation has actually
      // been saved at that depth. A parent-depth pass alone is not enough to Practice it.
      if(depth>10&&DEPTHS.includes(depth)&&!currentDepthHasSavedLine(state.side,depth,index)){
        state.status=`Continue Variation ${index+1} in Guided Training first.`;try{render()}catch{};return;
      }
      return originalStartPracticeTest(index,...args);
    };

    async function continueSameVariation(targetDepth){
      const index=Number(state.variationIndex||0),side=state.side;
      if(targetDepth!==GAME_END_DEPTH&&!variationUnlocked(side,targetDepth,index))return;
      if(targetDepth===GAME_END_DEPTH){const profile=profileNow();if(!profile||!allFormalDepthsPassed(profile,side,index))return}
      state.complete=false;state.mode='guided';state.screen='course';state.sessionLength=targetDepth;
      try{render()}catch{};await Promise.resolve();
      return originalStartNewTraining(index,true);
    }

    finishSession=function(...args){
      const side=state?.side,index=Number(state?.variationIndex||0);
      const gameEndContinuation=state?.mode==='guided'&&Number(state?.sessionLength)===GAME_END_DEPTH;
      let naturalGameEnd=false;
      if(gameEndContinuation){try{naturalGameEnd=Boolean(state?.chess?.isGameOver?.())}catch{}}
      const out=originalFinishSessionDepthProgression(...args);
      if(gameEndContinuation&&naturalGameEnd){
        try{if(markFullLineGameEnd(side,index)){state.cotFullLineCompleted=true;state.status='Full variation line complete — Rank Test unlocked.'}}catch(err){console.warn('Full-line completion could not be recorded',err)}
      }
      return out;
    };

    function addContinueButton(){
      if(state?.screen!=='training'||state?.mode!=='test'||!state?.complete)return;
      const depth=Number(state.sessionLength);if(!DEPTHS.includes(depth))return;
      const progress=variationProgress(state.side,depth,state.variationIndex);if(progress.passes<PASS_TARGET)return;
      const card=document.querySelector('.complete-card');if(!card||card.querySelector('#cotContinueThisLine'))return;
      const next=nextDepth(depth),button=document.createElement('button');
      button.id='cotContinueThisLine';button.className='primary';button.style.cssText='width:100%;margin-top:10px';
      button.textContent=next?`Continue This Line · Depth ${next}`:'Continue This Line · Play to Game End';
      const menu=card.querySelector('#menu');if(menu)card.insertBefore(button,menu);else card.appendChild(button);
      button.addEventListener('click',()=>continueSameVariation(next||GAME_END_DEPTH));
    }

    function depthFromText(text){const m=String(text||'').replace(/\s+/g,' ').match(/\bDepth\s+(10|15|20|25|30)\b/i);return m?Number(m[1]):null}
    function gateDepthNavigation(){
      const side=state?.side==='black'?'black':'white';
      for(const el of [...document.querySelectorAll('button,a,[role="button"]')]){
        const depth=depthFromText(el.textContent);if(!depth)continue;
        const unlocked=depthUnlocked(side,depth);el.classList.toggle('cot-course-depth-locked',!unlocked);
        if(!unlocked){el.setAttribute('aria-disabled','true');el.setAttribute('data-cot-depth-locked',String(depth));if('disabled'in el)el.disabled=true;el.title=lockedMessage(depth)}
        else{el.removeAttribute('aria-disabled');el.removeAttribute('data-cot-depth-locked');if('disabled'in el)el.disabled=false;if(el.title&&/Finish at least one Depth/.test(el.title))el.removeAttribute('title')}
      }
    }

    function gateVariationCards(){
      if(state?.screen!=='course')return;
      const depth=Number(state.sessionLength);if(!DEPTHS.includes(depth))return;
      document.querySelectorAll('.variation-card').forEach((card,index)=>{
        const unlocked=variationUnlocked(state.side,depth,index);
        const hasCurrentLine=currentDepthHasSavedLine(state.side,depth,index);
        card.classList.toggle('cot-depth-locked',!unlocked);
        card.querySelector('.cot-depth-lock-note')?.remove();

        const newButton=card.querySelector('[data-new]');
        const practiceButton=[...card.querySelectorAll('button')].find(btn=>/Practice Test/i.test(btn.textContent||''));
        const savedButton=[...card.querySelectorAll('button')].find(btn=>/Saved Training/i.test(btn.textContent||''));

        if(depth===10){
          // Depth 10 retains the original create/explore behavior.
          if(!unlocked)card.querySelectorAll('button').forEach(btn=>{btn.disabled=true;btn.setAttribute('aria-disabled','true')});
          return;
        }

        if(!unlocked){
          card.querySelectorAll('button').forEach(btn=>{btn.disabled=true;btn.setAttribute('aria-disabled','true');btn.classList.add('cot-hidden-depth-action')});
          const note=document.createElement('div');note.className='cot-depth-lock-note';note.textContent=lockedVariationMessage(depth);card.appendChild(note);
          return;
        }

        // Eligible deeper-depth card: there is only a continuation action, never "New Training".
        if(newButton){
          newButton.classList.remove('cot-hidden-depth-action');
          newButton.disabled=false;newButton.removeAttribute('aria-disabled');
          newButton.textContent=`Continue Variation ${index+1}`;
          newButton.onclick=event=>{event.preventDefault();event.stopImmediatePropagation();startNewTraining(index,true)};
        }
        if(practiceButton){
          practiceButton.classList.toggle('cot-hidden-depth-action',!hasCurrentLine);
          practiceButton.disabled=!hasCurrentLine;
          if(hasCurrentLine)practiceButton.removeAttribute('aria-disabled');else practiceButton.setAttribute('aria-disabled','true');
        }
        if(savedButton){
          savedButton.classList.toggle('cot-hidden-depth-action',!hasCurrentLine);
          savedButton.disabled=!hasCurrentLine;
          if(hasCurrentLine)savedButton.removeAttribute('aria-disabled');else savedButton.setAttribute('aria-disabled','true');
        }
        const stateText=card.querySelector('.variation-state');
        if(stateText&&!hasCurrentLine)stateText.textContent=`Qualified from Depth ${previousDepth(depth)} · continue this line`;
      });
    }

    document.addEventListener('click',event=>{
      const target=event.target?.closest?.('[data-cot-depth-locked]');if(!target)return;
      event.preventDefault();event.stopImmediatePropagation();const depth=Number(target.getAttribute('data-cot-depth-locked'));
      try{state.status=lockedMessage(depth);render()}catch{}
    },true);

    const style=document.createElement('style');
    style.textContent=`
      .cot-course-depth-locked{opacity:.48!important;filter:saturate(.35);cursor:not-allowed!important;position:relative}
      .cot-course-depth-locked::after{content:' 🔒';font-size:.82em}
      .variation-card.cot-depth-locked{opacity:.48}
      .variation-card.cot-depth-locked button{cursor:not-allowed}
      .cot-hidden-depth-action{display:none!important}
      .cot-depth-lock-note{margin-top:8px;padding:8px 10px;border-radius:9px;background:#10171d;border:1px solid #2b3640;color:#9eabb5;font-size:11px;font-weight:700}
    `;
    document.head.appendChild(style);

    render=function(...args){
      const out=originalRenderDepthProgression(...args);
      queueMicrotask(()=>{try{gateDepthNavigation();gateVariationCards();addContinueButton()}catch{}});
      return out;
    };
    queueMicrotask(()=>{try{gateDepthNavigation();gateVariationCards();addContinueButton()}catch{}});
  }
}catch(err){console.warn('Variation depth progression could not attach',err)}
