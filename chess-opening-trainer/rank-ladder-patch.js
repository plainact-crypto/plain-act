// Global one-game Rank ladder for Chess Opening Trainer.
// Rank is independent from training progress and opening side.
// Every player starts at 1800 and advances through:
// 1800 -> 2000 -> 2200 -> 2500 -> 2700 -> 3000.
try {
  if (!globalThis.__COT_ONE_GAME_RANK_LADDER__) {
    globalThis.__COT_ONE_GAME_RANK_LADDER__ = true;

    const RANK_LEVELS=[1800,2000,2200,2500,2700,3000];
    const PASS_ACCURACY=85;
    const FULL_GAME_MOVE_CAP=99;
    const baseStartRankTest=startRankTest;
    const baseFinishRankTest=finishRankTest;
    const baseRenderTraining=renderTraining;
    const baseRenderRankLadder=render;
    const baseBestMove=bestMove;

    const userColor=()=>state?.side==='black'?'b':'w';
    const profileNow=()=>{try{return loadProfile()}catch{return null}};
    const courseDepth=()=>Number(state?.rankCourseDepth||10);

    function ensureLadder(profile){
      if(!profile)return {bestPassedElo:0,currentElo:1800,attempts:0,passes:0,lastResult:null};
      profile.rankLadder=profile.rankLadder||{};
      let existing=profile.rankLadder.global||null;
      if(!existing){
        // One-time migration: preserve the best historical result from either old side ladder.
        const candidates=['white','black'].map(k=>profile.rankLadder?.[k]).filter(x=>x&&typeof x==='object');
        const bestPassedElo=Math.max(0,...candidates.map(x=>Number(x.bestPassedElo||0)));
        const attempts=candidates.reduce((n,x)=>n+Number(x.attempts||0),0);
        const passes=candidates.reduce((n,x)=>n+Number(x.passes||0),0);
        const lastResult=candidates.map(x=>x.lastResult).filter(Boolean).sort((a,b)=>String(b?.at||'').localeCompare(String(a?.at||'')))[0]||null;
        existing={bestPassedElo,attempts,passes,lastResult};
      }
      const best=Number(existing.bestPassedElo||0);
      const next=RANK_LEVELS.find(x=>x>best)||RANK_LEVELS.at(-1);
      profile.rankLadder.global={
        bestPassedElo:best,
        currentElo:Number(existing.currentElo||next||1800),
        attempts:Number(existing.attempts||0),
        passes:Number(existing.passes||0),
        lastResult:existing.lastResult||null
      };
      return profile.rankLadder.global;
    }

    function targetFor(profile){
      const ladder=ensureLadder(profile);
      const best=Number(ladder.bestPassedElo||0);
      return RANK_LEVELS.find(x=>x>best)||RANK_LEVELS.at(-1);
    }

    function setEngineStrength(enabled,elo){
      try{
        const actualOpponent=globalThis.__COT_OPPONENT_ENGINE_SERVICE__||engineService;
        const worker=actualOpponent?.worker;
        if(!worker?.postMessage)return;
        worker.postMessage(`setoption name UCI_LimitStrength value ${enabled?'true':'false'}`);
        if(enabled)worker.postMessage(`setoption name UCI_Elo value ${Math.max(1320,Math.min(3190,Number(elo)||1800))}`);
        worker.postMessage('isready');
      }catch{}
    }

    bestMove=async function(...args){
      const isRankOpponent=state?.mode==='rank'&&state?.screen==='training'&&!state?.complete&&state?.chess?.turn?.()!==userColor()&&Number(state?.rankTargetElo)>0;
      if(!isRankOpponent)return baseBestMove(...args);
      setEngineStrength(true,state.rankTargetElo);
      try{return await baseBestMove(...args)}finally{setEngineStrength(false,state.rankTargetElo)}
    };

    startRankTest=async function(...args){
      const profile=profileNow();
      state.rankCourseDepth=10; // internal legacy compatibility only; not a gameplay target.
      state.rankTargetElo=targetFor(profile);
      state.rankLadderResult=null;
      const out=await baseStartRankTest(...args);
      if(Array.isArray(state.rankRounds)&&state.rankRounds.length>1)state.rankRounds=state.rankRounds.slice(0,1);
      if(state?.mode==='rank'&&state?.screen==='training')state.sessionLength=FULL_GAME_MOVE_CAP;
      try{render()}catch{}
      return out;
    };

    function gameOutcome(){
      try{
        if(!state.chess?.isGameOver?.())return 'unfinished';
        if(state.chess.isCheckmate?.())return state.chess.turn()===userColor()?'loss':'win';
        return 'draw';
      }catch{return 'unfinished'}
    }

    function resultMetrics(){
      const items=Array.isArray(state.rankLosses)?state.rankLosses:[];
      const accuracy=items.length?items.reduce((s,x)=>s+Math.max(0,Math.min(100,Number(x?.accuracy)||0)),0)/items.length:0;
      const mistakes=items.filter(x=>Number(x?.lossCp)>=100&&Number(x?.lossCp)<300).length;
      const blunders=items.filter(x=>Number(x?.lossCp)>=300).length;
      return {accuracy,mistakes,blunders,outcome:gameOutcome()};
    }

    function recommendation(metrics,passed){
      if(passed)return 'Rank cleared. Challenge the next Rank level.';
      if(metrics.outcome==='loss')return 'Review the game report and retry this Rank when ready.';
      if(metrics.blunders>0)return 'Review the blunders in this game, then retry this Rank.';
      if(metrics.mistakes>0)return 'Review the mistakes in this game, then retry this Rank.';
      return 'Review the game report and retry this Rank when ready.';
    }

    finishRankTest=function(...args){
      if(state?.mode!=='rank')return baseFinishRankTest(...args);
      const target=Number(state.rankTargetElo||1800);
      const metrics=resultMetrics();
      const passed=metrics.outcome!=='loss'&&metrics.accuracy>=PASS_ACCURACY&&metrics.mistakes===0&&metrics.blunders===0;
      const liveLength=state.sessionLength;
      state.sessionLength=courseDepth();
      const out=baseFinishRankTest(...args);
      state.sessionLength=liveLength;
      try{
        const profile=profileNow();
        const ladder=ensureLadder(profile);
        ladder.attempts++;
        if(passed){ladder.passes++;ladder.bestPassedElo=Math.max(Number(ladder.bestPassedElo||0),target)}
        ladder.currentElo=passed?(RANK_LEVELS.find(x=>x>ladder.bestPassedElo)||RANK_LEVELS.at(-1)):target;
        ladder.lastResult={at:new Date().toISOString(),targetElo:target,passed,accuracy:metrics.accuracy,outcome:metrics.outcome,mistakes:metrics.mistakes,blunders:metrics.blunders,color:state.side==='black'?'black':'white'};
        saveProfile(profile);
        state.rankLadderResult={...ladder.lastResult,nextElo:ladder.currentElo,bestPassedElo:ladder.bestPassedElo,recommendation:recommendation(metrics,passed)};
      }catch(err){console.warn('Rank ladder result could not be saved',err)}
      try{render()}catch{}
      return out;
    };

    function addRankLadderResult(){
      if(state?.mode!=='rank'||!state?.complete||!state.rankLadderResult)return;
      const r=state.rankLadderResult;
      const host=document.querySelector('.complete-card,.rank-result,.results-card,main');
      if(!host||host.querySelector('#cotRankLadderResult'))return;
      const box=document.createElement('section');
      box.id='cotRankLadderResult';box.className='cot-rank-ladder-result';
      box.innerHTML=`<div class="cot-rank-ladder-kicker">Rank Ladder · ${r.targetElo}</div><h3>${r.passed?'Rank cleared ✓':'Rank not cleared'}</h3><p>${Math.round(r.accuracy)}% accuracy · ${r.outcome} · ${r.mistakes} mistakes · ${r.blunders} blunders</p><p>${r.recommendation}</p><div class="cot-rank-ladder-next">${r.passed&&r.targetElo<3000?`Next challenge: <b>${r.nextElo}</b>`:r.passed?'Maximum Rank challenge cleared: <b>3000</b>':`Retry target: <b>${r.targetElo}</b>`}</div>`;
      host.appendChild(box);
    }

    function fixRankCopy(){
      // Report #61: course copy never needs a full DOM scan during a live game.
      if(state?.screen!=='course')return;
      document.querySelectorAll('p,.sub,small,button').forEach(el=>{
        const raw=String(el.textContent||'').replace(/\s+/g,' ').trim();
        if(/Complete .*variation|Practice passes to unlock|Rank Ladder unlocked|Locked/i.test(raw)&&/rank|variation|practice|locked/i.test(raw)){
          if(/variation|practice|locked/i.test(raw))el.textContent='Rank Test is available to every player · Starts at 1800.';
        }
      });
    }

    renderTraining=function(...args){
      const out=baseRenderTraining(...args);
      if(state?.mode==='rank'&&!state.complete){
        const status=document.querySelector('.status');
        if(status&&!document.querySelector('#cotRankTarget')){
          const badge=document.createElement('div');badge.id='cotRankTarget';badge.className='cot-rank-target';badge.textContent=`Full game · Opponent Rank ${state.rankTargetElo||1800}`;
          status.insertAdjacentElement('afterend',badge);
        }
      }
      if(state?.complete)queueMicrotask(addRankLadderResult);
      return out;
    };

    render=function(...args){
      const out=baseRenderRankLadder(...args);
      if(state?.screen==='course')queueMicrotask(()=>{try{fixRankCopy()}catch{}});
      if(state?.mode==='rank'&&state?.complete)queueMicrotask(()=>{try{addRankLadderResult()}catch{}});
      return out;
    };

    const style=document.createElement('style');
    style.textContent=`.cot-rank-target{margin:8px 0;padding:8px 10px;border:1px solid #354455;border-radius:10px;background:#0d151d;color:#c8ff5a;font-size:12px;font-weight:900}.cot-rank-ladder-result{margin-top:14px;padding:14px;border:1px solid #354455;border-radius:13px;background:#0c141b;color:#dfe8ed}.cot-rank-ladder-result h3{margin:4px 0 8px;color:#fff}.cot-rank-ladder-result p{margin:5px 0;color:#aebbc5}.cot-rank-ladder-kicker{color:#c8ff5a;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.cot-rank-ladder-next{margin-top:10px;padding-top:9px;border-top:1px solid #293642}`;
    document.head.appendChild(style);

    globalThis.__COT_RANK_LADDER_RULES__={levels:[...RANK_LEVELS],firstRank:1800,gamesPerAttempt:1,unlockRequirement:'none',passAccuracy:PASS_ACCURACY,fullGame:true,maxRank:3000,ladderScope:'global-user-rank',liveRenderCopyScan:false};
  }
}catch(err){console.warn('Global Rank ladder could not attach',err)}
