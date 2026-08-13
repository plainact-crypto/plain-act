// Disable the legacy Guided polish block before auth-confirmation-patch loads.
globalThis.__COT_GUIDED_POLISH_30__=true;

// Four-engine training architecture.
// Engine A: user's training side / repertoire recommendations.
// Engine B: opponent move generation.
// Engine C: evaluation bar only.
// Engine D: move-quality classification only.
(function installFourEngineArchitecture(){
  try{
    if(globalThis.__COT_TRIPLE_ENGINE_ARCHITECTURE__) return;
    globalThis.__COT_TRIPLE_ENGINE_ARCHITECTURE__=true;
    if(!engineService || typeof engineService.constructor!=='function') return;

    const userEngine=engineService;
    const opponentEngine=new engineService.constructor();
    const evaluationEngine=new engineService.constructor();
    const qualityEngine=new engineService.constructor();

    globalThis.__COT_USER_ENGINE_SERVICE__=userEngine;
    globalThis.__COT_OPPONENT_ENGINE_SERVICE__=opponentEngine;
    globalThis.__COT_EVAL_ENGINE_SERVICE__=evaluationEngine;
    globalThis.__COT_MOVE_QUALITY_ENGINE_SERVICE__=qualityEngine;

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
      try{if(typeof issueTracePush==='function') issueTracePush({type:name,engineRole:role,fen,result})}catch{}
    };

    for(const name of ['bestMove','topMoves','evaluate']){
      if(typeof userEngine[name]!=='function'||typeof opponentEngine[name]!=='function') continue;
      const userCall=userEngine[name].bind(userEngine);
      const opponentCall=opponentEngine[name].bind(opponentEngine);
      userEngine[name]=async(...args)=>{
        const fen=fenFromArgs(args);
        const selected=engineForFen(fen);
        if(selected===opponentEngine){
          const result=await opponentCall(...args);trace('opponent',name,fen,result);return result;
        }
        return userCall(...args);
      };
    }

    for(const name of ['bestMove','topMoves','evaluate']){
      if(typeof evaluationEngine[name]!=='function') continue;
      const raw=evaluationEngine[name].bind(evaluationEngine);
      evaluationEngine[name]=async(...args)=>{
        const fen=fenFromArgs(args);
        if(name==='evaluate'&&state?.screen==='training'&&state?.mode!=='guided'){
          trace('evaluation-suppressed',name,fen,null);return null;
        }
        const result=await raw(...args);trace('evaluation',name,fen,result);return result;
      };
    }

    // Live move-quality searches are cached by FEN. The old grader asks evaluate/bestMove/topMoves
    // repeatedly for the same position; this layer makes those calls reuse one Stockfish search
    // instead of building a backlog several moves long.
    const qualityCache=new Map();
    const rawSearch=qualityEngine.search.bind(qualityEngine);
    const getPack=async(fen,depth=12,multiPv=3)=>{
      const safeDepth=Math.min(12,Math.max(8,Number(depth)||12));
      const count=Math.max(3,Number(multiPv)||1);
      const key=fen;
      if(!qualityCache.has(key)){
        const promise=rawSearch({fen,depth:safeDepth,multiPv:count}).then(result=>{
          trace('move-quality-search','search',fen,result);
          return result;
        });
        qualityCache.set(key,promise);
        if(qualityCache.size>24) qualityCache.delete(qualityCache.keys().next().value);
      }
      return qualityCache.get(key);
    };

    qualityEngine.evaluate=async(fen,depth=12)=>{
      const pack=await getPack(fen,depth,3);
      const result=pack?.lines?.[0]||null;
      trace('move-quality','evaluate',fen,result);
      return result;
    };
    qualityEngine.bestMove=async(fen,depth=12)=>{
      const pack=await getPack(fen,depth,3);
      const result=pack?.bestmove||pack?.lines?.[0]?.uci||null;
      trace('move-quality','bestMove',fen,result);
      return result;
    };
    qualityEngine.topMoves=async(fen,count=3,depth=12)=>{
      const pack=await getPack(fen,depth,Math.max(3,count));
      const result=(pack?.lines||[]).map(x=>x.uci).filter(Boolean).slice(0,count);
      trace('move-quality','topMoves',fen,result);
      return result;
    };

    globalThis.__COT_ENGINE_ROLES__={
      user:'training-side',
      opponent:'opponent-side',
      evaluation:'evaluation-bar-only',
      quality:'move-quality-only-cached'
    };
  }catch(err){console.warn('Four-engine architecture could not attach',err)}
})();
