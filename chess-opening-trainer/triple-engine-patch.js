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

    const TRAINING_DEPTH=20;
    const userEngine=engineService;
    const opponentEngine=new engineService.constructor();
    const evaluationEngine=new engineService.constructor();
    const qualityEngine=new engineService.constructor();

    globalThis.__COT_USER_ENGINE_SERVICE__=userEngine;
    globalThis.__COT_OPPONENT_ENGINE_SERVICE__=opponentEngine;
    globalThis.__COT_EVAL_ENGINE_SERVICE__=evaluationEngine;
    globalThis.__COT_MOVE_QUALITY_ENGINE_SERVICE__=qualityEngine;
    globalThis.__COT_TRAINING_DEPTH__=TRAINING_DEPTH;
    globalThis.__COT_TRAINING_BEST_MOVE_ONLY__=true;

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
    const forceTrainingStrength=(name,args)=>{
      const next=[...args];
      if(name==='bestMove') next[1]=TRAINING_DEPTH;
      else if(name==='topMoves'){
        next[1]=1;
        next[2]=TRAINING_DEPTH;
      }else if(name==='evaluate') next[1]=TRAINING_DEPTH;
      return next;
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
        const strongArgs=forceTrainingStrength(name,args);
        if(selected===opponentEngine){
          const result=await opponentCall(...strongArgs);trace('opponent-max-strength',name,fen,result);return result;
        }
        const result=await userCall(...strongArgs);trace('coach-max-strength',name,fen,result);return result;
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
    const getPack=async(fen,depth=20,multiPv=3)=>{
      const safeDepth=Math.min(20,Math.max(8,Number(depth)||20));
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

    qualityEngine.evaluate=async(fen,depth=20)=>{
      const pack=await getPack(fen,depth,3);
      const result=pack?.lines?.[0]||null;
      trace('move-quality','evaluate',fen,result);
      return result;
    };
    qualityEngine.bestMove=async(fen,depth=20)=>{
      const pack=await getPack(fen,depth,3);
      const result=pack?.bestmove||pack?.lines?.[0]?.uci||null;
      trace('move-quality','bestMove',fen,result);
      return result;
    };
    qualityEngine.topMoves=async(fen,count=3,depth=20)=>{
      const pack=await getPack(fen,depth,Math.max(3,count));
      const result=(pack?.lines||[]).map(x=>x.uci).filter(Boolean).slice(0,count);
      trace('move-quality','topMoves',fen,result);
      return result;
    };

    globalThis.__COT_ENGINE_ROLES__={
      user:'training-side-max-strength-best-move',
      opponent:'opponent-side-max-strength-best-move',
      evaluation:'evaluation-bar-only',
      quality:'move-quality-only-cached-depth-20'
    };
  }catch(err){console.warn('Four-engine architecture could not attach',err)}
})();

// Product rule: D4/C6 define the repertoire entry point. After that entry point,
// Guided coaching must never prefer a weaker repertoire candidate over Stockfish's top move.
// The first opponent reply used to identify a selected training branch remains scenario setup;
// every engine-generated continuation inside that branch is Top-1 only.
try{
  if(typeof bestRepertoireMove==='function'){
    bestRepertoireMove=async function maxStrengthBestRepertoireMove(){
      try{
        const anchor=typeof repertoireAnchorForFen==='function'
          ? repertoireAnchorForFen(state.chess,state.side)
          : null;
        if(anchor){
          return {from:anchor.slice(0,2),to:anchor.slice(2,4),promotion:anchor[4]||null};
        }
      }catch{}
      const best=await bestMove();
      return best?{from:best.slice(0,2),to:best.slice(2,4),promotion:best[4]||null}:null;
    };
  }
}catch(err){console.warn('Max-strength Guided best-move override could not attach',err)}
