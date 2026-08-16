// Final continuation guard: after Depth 30, continue the exact same saved variation
// to a natural game end. The internal safety target must never appear as a user-facing level.
try {
  if (!globalThis.__COT_GAME_END_CONTINUATION_FIX__) {
    globalThis.__COT_GAME_END_CONTINUATION_FIX__ = true;

    const GAME_END_DEPTH = 99;
    const SOURCE_DEPTH = 30;
    const PASS_TARGET = 5;
    const previousBestRepertoireMove = bestRepertoireMove;
    const previousBestMove = bestMove;
    const previousRender = render;

    function profileNow(){ try { return loadProfile(); } catch { return null; } }
    function sourceLesson(){
      const profile=profileNow();
      if(!profile)return null;
      try{return ensureLevelProgress(profile,state.side,SOURCE_DEPTH)?.lessons?.[Number(state.variationIndex||0)]||null}catch{return null}
    }
    function selectedLine(lesson){
      const lines=Array.isArray(lesson?.lines)?lesson.lines:[];
      if(!lines.length)return null;
      const selected=Math.max(0,Math.min(Number(lesson?.selectedLineIndex||0),lines.length-1));
      return lines[selected]||null;
    }
    function passes(lesson){
      const line=selectedLine(lesson);
      const value=Number(line?.practice?.passes);
      if(Number.isFinite(value))return Math.max(0,Math.min(PASS_TARGET,value));
      return Math.max(0,Math.min(PASS_TARGET,Number(lesson?.passes||0)));
    }
    function stepUci(step){return step?`${step.from||''}${step.to||''}${step.promotion||''}`:''}
    function moveUci(move){return move?`${move.from||''}${move.to||''}${move.promotion||''}`:''}
    function isGameEndContinuation(){return state?.screen==='training'&&state?.mode==='guided'&&Number(state?.sessionLength)===GAME_END_DEPTH}
    function sourcePrefixStep(actor){
      if(!isGameEndContinuation())return null;
      const lesson=sourceLesson();
      if(passes(lesson)<PASS_TARGET)return null;
      const line=selectedLine(lesson);
      const moves=Array.isArray(line?.moves)?line.moves:[];
      if(!moves.length)return null;
      let hist=[];
      try{hist=state.chess.history({verbose:true})||[]}catch{return null}
      for(let i=0;i<hist.length&&i<moves.length;i++){
        if(moveUci(hist[i])!==stepUci(moves[i]))return null;
      }
      if(hist.length>=moves.length)return null;
      const step=moves[hist.length];
      if(!step||step.actor!==actor)return null;
      const uci=stepUci(step);
      try{
        if(!state.chess.moves({verbose:true}).some(move=>moveUci(move)===uci))return null;
      }catch{return null}
      return step;
    }

    bestRepertoireMove=async function(...args){
      const inherited=sourcePrefixStep('user');
      if(inherited){
        const uci=stepUci(inherited);
        globalThis.__COT_LAST_GUIDED_DECISION__={type:'game-end-inherited-depth30-prefix',uci,fromDepth:SOURCE_DEPTH,to:'game-end',variationIndex:Number(state.variationIndex||0),fen:state?.chess?.fen?.()||''};
        return {from:inherited.from,to:inherited.to,promotion:inherited.promotion||null};
      }
      return previousBestRepertoireMove(...args);
    };

    bestMove=async function(...args){
      const inherited=sourcePrefixStep('engine');
      if(inherited){
        const uci=stepUci(inherited);
        globalThis.__COT_LAST_GUIDED_DECISION__={type:'game-end-inherited-depth30-prefix',uci,fromDepth:SOURCE_DEPTH,to:'game-end',variationIndex:Number(state.variationIndex||0),fen:state?.chess?.fen?.()||''};
        return uci;
      }
      return previousBestMove(...args);
    };

    function cleanGameEndUi(){
      if(!isGameEndContinuation()||!document?.body)return;
      try{
        const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
        const nodes=[];let node;
        while((node=walker.nextNode()))nodes.push(node);
        for(const textNode of nodes){
          const raw=textNode.nodeValue||'';
          let next=raw;
          next=next.replace(/Level\s*99\b/gi,'Play to Game End');
          next=next.replace(/\b(\d+)\s*\/\s*99\b/g,'$1 moves · continue to game end');
          next=next.replace(/\bDepth\s*99\b/gi,'Game End');
          if(next!==raw)textNode.nodeValue=next;
        }
      }catch{}
    }

    render=function(...args){
      const out=previousRender(...args);
      queueMicrotask(cleanGameEndUi);
      return out;
    };
    queueMicrotask(cleanGameEndUi);

    globalThis.__COT_GAME_END_CONTINUATION_RULES__={
      sourceDepth:SOURCE_DEPTH,
      sameVariation:true,
      exactSavedDepth30Prefix:true,
      afterPrefix:'stockfish-top1',
      userFacingTarget:'natural-game-end',
      internalSafetyTargetHidden:true
    };
  }
}catch(err){console.warn('Game-end continuation fix could not attach',err)}
