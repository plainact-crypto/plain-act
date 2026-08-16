// Rank unlock after one full trained variation reaches a natural game end.
// Result is intentionally irrelevant: white win, black win, or draw all count.
try {
  if (!globalThis.__COT_GAME_END_RANK_UNLOCK__) {
    globalThis.__COT_GAME_END_RANK_UNLOCK__ = true;

    const DEPTHS=[10,15,20,25,30];
    const PASS_TARGET=5;
    const GAME_END_DEPTH=99;
    const previousRender=render;
    let recording=false;

    function selectedLine(lesson){
      const lines=Array.isArray(lesson?.lines)?lesson.lines:[];
      if(!lines.length)return null;
      const i=Math.max(0,Math.min(Number(lesson?.selectedLineIndex||0),lines.length-1));
      return lines[i]||null;
    }
    function passes(profile,side,depth,index){
      let lesson=null;
      try{lesson=ensureLevelProgress(profile,side,depth)?.lessons?.[index]||null}catch{return 0}
      const line=selectedLine(lesson);
      const value=Number(line?.practice?.passes);
      if(Number.isFinite(value))return Math.max(0,Math.min(PASS_TARGET,value));
      return Math.max(0,Math.min(PASS_TARGET,Number(lesson?.passes||0)));
    }
    function eligible(profile,side,index){
      return DEPTHS.every(depth=>passes(profile,side,depth,index)>=PASS_TARGET);
    }
    function terminal(){
      try{return Boolean(state?.chess?.isGameOver?.())}catch{return false}
    }
    function outcome(){
      try{
        if(state.chess.isCheckmate?.()){
          const turn=String(state.chess.fen?.()||'').split(/\s+/)[1];
          return turn==='w'?'black-win':'white-win';
        }
        if(state.chess.isDraw?.()||state.chess.isStalemate?.()||state.chess.isThreefoldRepetition?.()||state.chess.isInsufficientMaterial?.())return 'draw';
      }catch{}
      return 'game-ended';
    }
    function isGameEndTraining(){
      return state?.screen==='training'&&state?.mode==='guided'&&Number(state?.sessionLength)===GAME_END_DEPTH;
    }
    function recordIfComplete(){
      if(recording||!isGameEndTraining()||!terminal())return false;
      const side=state?.side==='black'?'black':'white';
      const index=Number(state?.variationIndex||0);
      let profile;
      try{profile=loadProfile()}catch{return false}
      if(!profile||!eligible(profile,side,index))return false;
      const existing=profile?.fullLineCompletions?.[side]?.[String(index)];
      if(existing?.completed)return true;
      recording=true;
      try{
        profile.fullLineCompletions=profile.fullLineCompletions||{};
        profile.fullLineCompletions[side]=profile.fullLineCompletions[side]||{};
        profile.fullLineCompletions[side][String(index)]={
          completed:true,
          completedAt:new Date().toISOString(),
          variationIndex:index,
          requiredDepths:[...DEPTHS],
          passesPerDepth:PASS_TARGET,
          naturalGameEnd:true,
          result:outcome(),
          resultRequired:false
        };
        for(const depth of DEPTHS){
          try{
            const lp=ensureLevelProgress(profile,side,depth);
            lp.rankFullLineCompletedCount=Math.max(1,Number(lp.rankFullLineCompletedCount||0));
            lp.rankUnlocked=true;
          }catch{}
        }
        saveProfile(profile);
        state.cotFullLineCompleted=true;
        state.status='Full variation complete — Rank Test unlocked.';
        return true;
      }finally{recording=false}
    }

    render=function(...args){
      const out=previousRender(...args);
      queueMicrotask(()=>{try{recordIfComplete()}catch{}});
      return out;
    };
    const timer=setInterval(()=>{try{if(recordIfComplete())clearInterval(timer)}catch{}},300);

    globalThis.__COT_GAME_END_RANK_RULES__={
      prerequisite:'same-variation-5of5-at-10-15-20-25-30',
      completion:'one-natural-game-end',
      acceptedResults:['white-win','black-win','draw'],
      resultRequired:false,
      rankUnlockAfterFullVariations:1
    };
  }
}catch(err){console.warn('Game-end Rank unlock patch could not attach',err)}
