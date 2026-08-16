// Final continuation guard: a deeper Guided depth must replay the exact saved parent line.
// This attaches after all engine/training patches and also guards the opponent engine service.
try {
  if (!globalThis.__COT_EXACT_CONTINUATION_PREFIX_GUARD__) {
    globalThis.__COT_EXACT_CONTINUATION_PREFIX_GUARD__ = true;
    const FORMAL_DEPTHS=[10,15,20,25,30];
    const GAME_END_DEPTH=99;
    const PASS_TARGET=5;

    const originalGuardBestMove=bestMove;
    const originalGuardBestRepertoireMove=bestRepertoireMove;

    function profileNow(){try{return loadProfile()}catch{return null}}
    function lessonAt(side,depth,index){
      try{return ensureLevelProgress(profileNow(),side,depth)?.lessons?.[index]||null}catch{return null}
    }
    function selectedLine(lesson){
      const lines=Array.isArray(lesson?.lines)?lesson.lines:[];
      if(!lines.length)return null;
      const i=Math.max(0,Math.min(Number(lesson?.selectedLineIndex||0),lines.length-1));
      return lines[i]||null;
    }
    function linePasses(lesson){
      const line=selectedLine(lesson);
      const p=Number(line?.practice?.passes);
      if(Number.isFinite(p))return Math.max(0,Math.min(PASS_TARGET,p));
      return Math.max(0,Math.min(PASS_TARGET,Number(lesson?.passes||0)));
    }
    function parentDepthForSession(){
      const depth=Number(state?.sessionLength||0);
      if(depth===GAME_END_DEPTH)return 30;
      const i=FORMAL_DEPTHS.indexOf(depth);
      return i>0?FORMAL_DEPTHS[i-1]:null;
    }
    function stepUci(step){return step?`${step.from||''}${step.to||''}${step.promotion||''}`:''}
    function moveUci(move){return move?`${move.from||''}${move.to||''}${move.promotion||''}`:''}
    function legalUci(uci){
      try{return !!uci&&state.chess.moves({verbose:true}).some(m=>moveUci(m)===uci)}catch{return false}
    }
    function parentLine(){
      if(state?.screen!=='training'||state?.mode!=='guided')return null;
      const parentDepth=parentDepthForSession();
      if(!parentDepth)return null;
      const index=Number(state?.variationIndex||0);
      const lesson=lessonAt(state.side,parentDepth,index);
      if(parentDepth!==30 && linePasses(lesson)<PASS_TARGET)return null;
      if(parentDepth===30 && Number(state?.sessionLength)!==GAME_END_DEPTH && linePasses(lesson)<PASS_TARGET)return null;
      const line=selectedLine(lesson);
      return Array.isArray(line?.moves)&&line.moves.length?line:null;
    }
    function exactPrefixStep(actor){
      const line=parentLine();
      if(!line)return null;
      let hist=[];
      try{hist=state.chess.history({verbose:true})||[]}catch{return null}
      for(let i=0;i<hist.length&&i<line.moves.length;i++){
        if(moveUci(hist[i])!==stepUci(line.moves[i])){
          globalThis.__COT_CONTINUATION_PREFIX_MISMATCH__={variationIndex:Number(state?.variationIndex||0),sessionLength:Number(state?.sessionLength||0),ply:i+1,expected:stepUci(line.moves[i]),actual:moveUci(hist[i])};
          return null;
        }
      }
      if(hist.length>=line.moves.length)return null;
      const step=line.moves[hist.length];
      if(!step||step.actor!==actor)return null;
      const uci=stepUci(step);
      return legalUci(uci)?step:null;
    }
    function record(step,actor){
      const uci=stepUci(step);
      globalThis.__COT_LAST_GUIDED_DECISION__={type:'exact-continuation-prefix',actor,uci,variationIndex:Number(state?.variationIndex||0),fromDepth:parentDepthForSession(),toDepth:Number(state?.sessionLength||0),fen:state?.chess?.fen?.()||''};
      return uci;
    }

    bestRepertoireMove=async function(...args){
      const step=exactPrefixStep('user');
      if(step){record(step,'user');return {from:step.from,to:step.to,promotion:step.promotion||null}}
      return originalGuardBestRepertoireMove(...args);
    };
    bestMove=async function(...args){
      const step=exactPrefixStep('engine');
      if(step)return record(step,'engine');
      return originalGuardBestMove(...args);
    };

    function wrapEngineService(service,label){
      if(!service||typeof service.bestMove!=='function'||service.__cotExactContinuationWrapped)return;
      const raw=service.bestMove.bind(service);
      service.bestMove=async function(...args){
        const step=exactPrefixStep('engine');
        if(step)return record(step,label||'engine');
        return raw(...args);
      };
      service.__cotExactContinuationWrapped=true;
    }
    wrapEngineService(globalThis.__COT_OPPONENT_ENGINE_SERVICE__,'opponent-engine');
    wrapEngineService(globalThis.__COT_USER_ENGINE_SERVICE__,'user-engine');

    globalThis.__COT_CONTINUATION_PREFIX_POLICY__={
      depths:[15,20,25,30],
      gameEndParentDepth:30,
      scope:'same-variation-exact-saved-parent-line',
      actors:['user','engine'],
      engineServiceGuard:true
    };
  }
}catch(err){console.warn('Exact continuation prefix guard could not attach',err)}
