// Three-engine training architecture (Report #29 follow-up)
// Engine A: user's training side / repertoire recommendations.
// Engine B: opponent move generation.
// Engine C: evaluation bar only.
(function installTripleEngineArchitecture(){
  try{
    if(globalThis.__COT_TRIPLE_ENGINE_ARCHITECTURE__) return;
    globalThis.__COT_TRIPLE_ENGINE_ARCHITECTURE__=true;
    if(!engineService || typeof engineService.constructor!=='function') return;

    const userEngine=engineService;
    const opponentEngine=new engineService.constructor();
    const evaluationEngine=new engineService.constructor();

    globalThis.__COT_USER_ENGINE_SERVICE__=userEngine;
    globalThis.__COT_OPPONENT_ENGINE_SERVICE__=opponentEngine;
    globalThis.__COT_EVAL_ENGINE_SERVICE__=evaluationEngine;

    const sideCode=()=>state?.side==='black'?'b':'w';
    const fenFromArgs=(args)=>{
      try{
        const first=args?.[0];
        if(typeof first==='string' && first.includes('/')) return first;
        if(first?.fen && typeof first.fen==='function') return first.fen();
        if(first?.fen && typeof first.fen==='string') return first.fen;
        return state?.chess?.fen?.()||'';
      }catch{return ''}
    };
    const engineForFen=(fen)=>{
      const turn=String(fen||'').split(/\s+/)[1]||'';
      return turn && turn!==sideCode()?opponentEngine:userEngine;
    };
    const trace=(role,name,fen,result)=>{
      try{
        if(typeof issueTracePush==='function') issueTracePush({type:name,engineRole:role,fen,result});
      }catch{}
    };

    for(const name of ['bestMove','topMoves','evaluate']){
      if(typeof userEngine[name]!=='function' || typeof opponentEngine[name]!=='function') continue;
      const userCall=userEngine[name].bind(userEngine); // preserves existing issue-report wrapper
      const opponentCall=opponentEngine[name].bind(opponentEngine);
      userEngine[name]=async(...args)=>{
        const fen=fenFromArgs(args);
        const selected=engineForFen(fen);
        if(selected===opponentEngine){
          const result=await opponentCall(...args);
          trace('opponent',name,fen,result);
          return result;
        }
        return userCall(...args);
      };
    }

    // Evaluation engine remains completely outside move-selection routing.
    // The current-position evaluation guard calls this instance directly.
    try{
      for(const name of ['bestMove','topMoves','evaluate']){
        if(typeof evaluationEngine[name]!=='function') continue;
        const raw=evaluationEngine[name].bind(evaluationEngine);
        evaluationEngine[name]=async(...args)=>{
          const fen=fenFromArgs(args);
          const result=await raw(...args);
          trace('evaluation',name,fen,result);
          return result;
        };
      }
    }catch{}

    globalThis.__COT_ENGINE_ROLES__={
      user:'training-side',
      opponent:'opponent-side',
      evaluation:'evaluation-bar-only'
    };
  }catch(err){
    console.warn('Triple engine architecture could not attach',err);
  }
})();
