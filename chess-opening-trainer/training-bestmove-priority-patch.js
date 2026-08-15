// Guided Training product rule: D4/C6 are identity anchors only for the first
// repertoire move. After that, normal Guided coaching is Stockfish Top-1 at the
// configured training depth. Explicit Explore New Line may still ask the line
// explorer for a strong unused alternative.
try{
  if(!globalThis.__COT_TRAINING_TOP1_PRIORITY_54__){
    globalThis.__COT_TRAINING_TOP1_PRIORITY_54__=true;

    const previousBestRepertoireMove=bestRepertoireMove;
    const entryAnchor=()=>{
      try{
        const hist=state?.chess?.history?.({verbose:true})||[];
        if(state?.side==='white'){
          if(hist.length===0){
            const legal=state.chess.moves({square:'d2',verbose:true}).some(m=>m.to==='d4');
            return legal?{from:'d2',to:'d4',promotion:null}:null;
          }
          return null;
        }
        if(state?.side==='black'){
          const blackMoves=hist.filter(m=>m.color==='b');
          if(blackMoves.length===0){
            const legal=state.chess.moves({square:'c7',verbose:true}).some(m=>m.to==='c6');
            return legal?{from:'c7',to:'c6',promotion:null}:null;
          }
        }
      }catch{}
      return null;
    };

    bestRepertoireMove=async function cotTop1GuidedMove(){
      // Only the explicit line-explorer flow is allowed to select an effectively
      // equal unused continuation. Ordinary Guided Training is never diversified.
      if(state?.exploreStrongUserAlternative){
        return previousBestRepertoireMove();
      }
      const anchor=entryAnchor();
      if(anchor) return anchor;
      const uci=await bestMove();
      return uci?{from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||null}:null;
    };

    // Report #54: do not let the decorative evaluation worker compete with the
    // coach while the next Guided move is still being calculated. The coach keeps
    // full Depth 20; evaluation resumes on the next normal render after the move
    // decision is ready.
    const evalEngine=globalThis.__COT_EVAL_ENGINE_SERVICE__;
    if(evalEngine?.evaluate && !evalEngine.__cotCoachPriorityWrapped){
      evalEngine.__cotCoachPriorityWrapped=true;
      const rawEvaluate=evalEngine.evaluate.bind(evalEngine);
      evalEngine.evaluate=async function(...args){
        try{
          if(state?.screen==='training'&&state?.mode==='guided'&&state?.engineBusy&&!state?.guideMove){
            return null;
          }
        }catch{}
        return rawEvaluate(...args);
      };
    }

    globalThis.__COT_GUIDED_NORMAL_MOVE_POLICY__='entry-anchor-then-stockfish-top1-depth20';
  }
}catch(err){console.warn('Guided Top-1 priority patch could not attach',err)}
