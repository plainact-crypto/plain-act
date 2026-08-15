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

    // A position may trigger several renders/callers before the first search resolves.
    // Reuse one Top-1 Depth-20 search instead of starting duplicate coach searches.
    const decisionCache=new Map();
    const cachedDecision=async(key,call)=>{
      if(!key) return call();
      if(!decisionCache.has(key)){
        const p=Promise.resolve().then(call).catch(err=>{decisionCache.delete(key);throw err});
        decisionCache.set(key,p);
        if(decisionCache.size>48) decisionCache.delete(decisionCache.keys().next().value);
      }
      return decisionCache.get(key);
    };

    for(const name of ['bestMove','topMoves','evaluate']){
      if(typeof userEngine[name]!=='function'||typeof opponentEngine[name]!=='function') continue;
      const userCall=userEngine[name].bind(userEngine);
      const opponentCall=opponentEngine[name].bind(opponentEngine);
      userEngine[name]=async(...args)=>{
        const fen=fenFromArgs(args);
        const selected=engineForFen(fen);
        const strongArgs=forceTrainingStrength(name,args);
        const role=selected===opponentEngine?'opponent-max-strength':'coach-max-strength';
        const invoke=async()=>{
          const result=selected===opponentEngine?await opponentCall(...strongArgs):await userCall(...strongArgs);
          trace(role,name,fen,result);
          return result;
        };
        if(name==='bestMove'&&state?.screen==='training'&&state?.mode==='guided'){
          return cachedDecision(`${role}|${fen}|${TRAINING_DEPTH}`,invoke);
        }
        return invoke();
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
        // The coach always wins CPU priority. Never start a decorative evaluation
        // while a Guided move decision is pending.
        if(name==='evaluate'&&state?.screen==='training'&&state?.mode==='guided'&&
          (state?.engineBusy||globalThis.__COT_COACH_DECISION_PENDING__)){
          trace('evaluation-deferred-for-coach',name,fen,null);return null;
        }
        const strongArgs=forceTrainingStrength(name,args);
        const result=await raw(...strongArgs);trace('evaluation-depth-20',name,fen,result);return result;
      };
    }

    // Move-quality is useful feedback, but it must never delay the next coaching move.
    // Wait briefly and then wait for the coach to become idle before doing background work.
    const qualityCache=new Map();
    const rawSearch=qualityEngine.search.bind(qualityEngine);
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const waitForCoach=async()=>{
      if(state?.screen!=='training'||state?.mode!=='guided') return;
      await sleep(280);
      let guard=0;
      while((state?.engineBusy||globalThis.__COT_COACH_DECISION_PENDING__)&&guard++<100){
        await sleep(80);
      }
    };
    const getPack=async(fen,depth=20,multiPv=1)=>{
      const safeDepth=Math.min(20,Math.max(8,Number(depth)||20));
      const count=Math.max(1,Number(multiPv)||1);
      const key=`${fen}|${safeDepth}|${count}`;
      if(!qualityCache.has(key)){
        const promise=(async()=>{
          await waitForCoach();
          const result=await rawSearch({fen,depth:safeDepth,multiPv:count});
          trace('move-quality-search','search',fen,result);
          return result;
        })();
        qualityCache.set(key,promise);
        if(qualityCache.size>32) qualityCache.delete(qualityCache.keys().next().value);
      }
      return qualityCache.get(key);
    };

    qualityEngine.evaluate=async(fen,depth=20)=>{
      const pack=await getPack(fen,depth,1);
      const result=pack?.lines?.[0]||null;
      trace('move-quality','evaluate',fen,result);
      return result;
    };
    qualityEngine.bestMove=async(fen,depth=20)=>{
      const pack=await getPack(fen,depth,1);
      const result=pack?.bestmove||pack?.lines?.[0]?.uci||null;
      trace('move-quality','bestMove',fen,result);
      return result;
    };
    qualityEngine.topMoves=async(fen,count=3,depth=20)=>{
      const wanted=Math.max(1,Number(count)||1);
      const pack=await getPack(fen,depth,wanted);
      const result=(pack?.lines||[]).map(x=>x.uci).filter(Boolean).slice(0,wanted);
      trace('move-quality','topMoves',fen,result);
      return result;
    };

    globalThis.__COT_ENGINE_ROLES__={
      user:'training-side-max-strength-best-move-depth-20-priority',
      opponent:'opponent-side-max-strength-best-move-depth-20-priority',
      evaluation:'evaluation-bar-depth-20-deferred-behind-coach',
      quality:'move-quality-deferred-cached-single-pv'
    };
  }catch(err){console.warn('Four-engine architecture could not attach',err)}
})();

// Product rule: D4/C6 are the repertoire identity entry move only. Once that one
// identity move has been made, normal Guided Training must use Stockfish Top-1.
// Do not let repertoireAnchorForFen() force London/Caro setup moves after entry.
try{
  if(typeof bestRepertoireMove==='function'){
    bestRepertoireMove=async function maxStrengthBestRepertoireMove(){
      try{
        const hist=state?.chess?.history?.({verbose:true})||[];
        if(state?.side==='white'&&hist.length===0){
          const legal=state.chess.moves({square:'d2',verbose:true}).some(m=>m.to==='d4');
          if(legal) return {from:'d2',to:'d4',promotion:null};
        }
        if(state?.side==='black'){
          const blackMoves=hist.filter(m=>m.color==='b');
          if(blackMoves.length===0){
            const legal=state.chess.moves({square:'c7',verbose:true}).some(m=>m.to==='c6');
            if(legal) return {from:'c7',to:'c6',promotion:null};
          }
        }
      }catch{}
      const best=await bestMove();
      return best?{from:best.slice(0,2),to:best.slice(2,4),promotion:best[4]||null}:null;
    };
    globalThis.__COT_GUIDED_NORMAL_MOVE_POLICY__='D4/C6-entry-only-then-stockfish-top1-depth20';
  }
}catch(err){console.warn('Max-strength Guided best-move override could not attach',err)}

// Mark the exact interval in which the user is waiting for the coach decision.
// Background evaluators inspect this flag and stay idle until the decision is ready.
try{
  if(typeof prepareUserTurn==='function'&&!globalThis.__COT_COACH_PRIORITY_WRAPPED__){
    globalThis.__COT_COACH_PRIORITY_WRAPPED__=true;
    const originalPrepareUserTurn=prepareUserTurn;
    prepareUserTurn=async function(...args){
      globalThis.__COT_COACH_DECISION_PENDING__=true;
      try{return await originalPrepareUserTurn(...args)}
      finally{globalThis.__COT_COACH_DECISION_PENDING__=false}
    };
  }
}catch(err){console.warn('Coach decision priority wrapper could not attach',err)}

// Practice Hint product rule:
// Practice Test keeps hints available for the whole attempt. Any hint makes that attempt
// practice-only and therefore it cannot add one of the 5 required valid passes.
// Rank Test remains the only mode where hints are removed completely.
try{
  if(!globalThis.__COT_PRACTICE_HINT_POLICY__){
    globalThis.__COT_PRACTICE_HINT_POLICY__=true;

    const hintPolicyOriginalStartPracticeTest=startPracticeTest;
    const hintPolicyOriginalRenderTraining=renderTraining;

    startPracticeTest=async function(...args){
      state.practiceHintUsed=false;
      state.practiceInvalid=false;
      state.hintVisible=false;
      return hintPolicyOriginalStartPracticeTest(...args);
    };

    const hintPolicyFen=()=>{try{return state?.chess?.fen?.()||''}catch{return ''}};

    function markPracticeHintUsed(){
      if(state?.mode!=='test'||state?.complete) return;
      state.practiceHintUsed=true;
      state.practiceInvalid=true;
      state.hintVisible=true;
      try{state.practiceTestAssistedFens?.add?.(hintPolicyFen())}catch{}
      try{drawGuide?.()}catch{}
      state.status='Hint shown — keep going. This attempt is practice only and will not count toward 5/5.';
      state.statusError=true;
      const status=document.querySelector('.status');
      if(status){
        status.textContent=state.status;
        status.classList.add('error');
      }
    }

    function ensurePracticeHint(){
      if(state?.mode!=='test'||state?.complete) return;
      let hint=document.querySelector('#hint');
      if(!hint){
        const restart=document.querySelector('#restart');
        const row=restart?.parentElement;
        if(row){
          hint=document.createElement('button');
          hint.id='hint';
          hint.className='secondary';
          hint.textContent='Hint — Show Move';
          row.insertBefore(hint,restart);
        }
      }
      if(!hint) return;
      hint.hidden=false;
      hint.disabled=false;
      hint.removeAttribute('aria-disabled');
      hint.style.display='';
      if(hint.dataset.practiceHintPolicy!=='1'){
        hint.dataset.practiceHintPolicy='1';
        hint.addEventListener('click',()=>{
          markPracticeHintUsed();
          // Legacy handlers may disable the button after one use. Practice hints stay reusable.
          queueMicrotask(()=>{
            const current=document.querySelector('#hint');
            if(current && state?.mode==='test' && !state?.complete){
              current.disabled=false;
              current.hidden=false;
              current.removeAttribute('aria-disabled');
              current.style.display='';
              markPracticeHintUsed();
            }
          });
        },true);
      }
    }

    renderTraining=function(...args){
      const result=hintPolicyOriginalRenderTraining(...args);
      if(state?.mode==='rank'){
        document.querySelector('#hint')?.remove();
        return result;
      }
      if(state?.mode==='test') ensurePracticeHint();
      return result;
    };
  }
}catch(err){console.warn('Practice Hint policy patch could not attach',err)}