// Final lineage hard-lock for Guided continuation.
// For Depth 15/20/25/30, replay the qualified line from the SAME variation in the
// immediately previous depth before allowing any new engine choice. For game-end,
// replay Depth 30. This layer is injected last so no later patch can fork the prefix.
try {
  if (!globalThis.__COT_LINEAGE_HARDLOCK__) {
    globalThis.__COT_LINEAGE_HARDLOCK__ = true;

    const DEPTHS = [10,15,20,25,30];
    const GAME_END_DEPTH = 99;
    const PASS_TARGET = 5;
    const previousBestRepertoireMove = bestRepertoireMove;
    const previousBestMove = bestMove;

    function profileNow(){ try { return loadProfile(); } catch { return null; } }
    function lessonAt(side,depth,index){
      const profile=profileNow(); if(!profile)return null;
      try{return ensureLevelProgress(profile,side,depth)?.lessons?.[index]||null}catch{return null}
    }
    function linePasses(line){
      const n=Number(line?.practice?.passes);
      return Number.isFinite(n)?Math.max(0,Math.min(PASS_TARGET,n)):0;
    }
    function qualifiedLine(lesson){
      const lines=Array.isArray(lesson?.lines)?lesson.lines:[];
      if(!lines.length)return null;
      const selected=Math.max(0,Math.min(Number(lesson?.selectedLineIndex||0),lines.length-1));
      const selectedLine=lines[selected]||null;
      if(selectedLine&&linePasses(selectedLine)>=PASS_TARGET)return selectedLine;
      const qualified=lines.filter(line=>linePasses(line)>=PASS_TARGET);
      if(qualified.length){
        qualified.sort((a,b)=>String(b?.createdAt||'').localeCompare(String(a?.createdAt||'')));
        return qualified[0];
      }
      // Recovery-safe fallback: only use the selected line when the lesson itself is
      // explicitly marked passed (legacy/recovered data can carry passes at lesson level).
      if(Number(lesson?.passes||0)>=PASS_TARGET)return selectedLine;
      return null;
    }
    function sourceDepth(){
      const depth=Number(state?.sessionLength||10);
      if(depth===GAME_END_DEPTH)return 30;
      const i=DEPTHS.indexOf(depth);
      return i>0?DEPTHS[i-1]:null;
    }
    function isContinuation(){
      const depth=Number(state?.sessionLength||10);
      return state?.screen==='training'&&state?.mode==='guided'&&(depth===GAME_END_DEPTH||DEPTHS.indexOf(depth)>0);
    }
    function sourceLine(){
      if(!isContinuation())return null;
      const from=sourceDepth(); if(!from)return null;
      return qualifiedLine(lessonAt(state.side,from,Number(state.variationIndex||0)));
    }
    function stepUci(step){return step?`${step.from||''}${step.to||''}${step.promotion||''}`:''}
    function moveUci(move){return move?`${move.from||''}${move.to||''}${move.promotion||''}`:''}
    function prefixStep(actor){
      const line=sourceLine();
      const moves=Array.isArray(line?.moves)?line.moves:[];
      if(!moves.length)return null;
      let hist=[];try{hist=state.chess.history({verbose:true})||[]}catch{return null}
      for(let i=0;i<hist.length&&i<moves.length;i++){
        if(moveUci(hist[i])!==stepUci(moves[i])){
          globalThis.__COT_LINEAGE_MISMATCH__={variationIndex:Number(state.variationIndex||0),sourceDepth:sourceDepth(),targetDepth:Number(state.sessionLength),ply:i,expected:stepUci(moves[i]),actual:moveUci(hist[i])};
          return null;
        }
      }
      if(hist.length>=moves.length)return null;
      const step=moves[hist.length];
      if(!step||step.actor!==actor)return null;
      const uci=stepUci(step);
      try{if(!state.chess.moves({verbose:true}).some(move=>moveUci(move)===uci))return null}catch{return null}
      return step;
    }

    bestRepertoireMove=async function(...args){
      const step=prefixStep('user');
      if(step){
        const uci=stepUci(step);
        globalThis.__COT_LAST_GUIDED_DECISION__={type:'lineage-hardlock-prefix',uci,variationIndex:Number(state.variationIndex||0),fromDepth:sourceDepth(),toDepth:Number(state.sessionLength),fen:state?.chess?.fen?.()||''};
        return {from:step.from,to:step.to,promotion:step.promotion||null};
      }
      return previousBestRepertoireMove(...args);
    };
    bestMove=async function(...args){
      const step=prefixStep('engine');
      if(step){
        const uci=stepUci(step);
        globalThis.__COT_LAST_GUIDED_DECISION__={type:'lineage-hardlock-prefix',uci,variationIndex:Number(state.variationIndex||0),fromDepth:sourceDepth(),toDepth:Number(state.sessionLength),fen:state?.chess?.fen?.()||''};
        return uci;
      }
      return previousBestMove(...args);
    };

    globalThis.__COT_LINEAGE_RULES__={
      sameVariation:true,
      source:'immediately-previous-depth-qualified-line',
      qualifiedPasses:PASS_TARGET,
      exactPrefixReplay:true,
      gameEndSourceDepth:30,
      injectedLast:true
    };
  }
}catch(err){console.warn('Lineage hard-lock could not attach',err)}
