// One-game Rank ladder for Chess Opening Trainer.
// Unlocks after one completed variation at the active depth and tests one full game
// against progressively stronger opponents: 1800 -> 2000 -> 2200 -> 2500 -> 2700 -> 3000.
try {
  if (!globalThis.__COT_ONE_GAME_RANK_LADDER__) {
    globalThis.__COT_ONE_GAME_RANK_LADDER__ = true;

    const RANK_LEVELS = [1800,2000,2200,2500,2700,3000];
    const PASS_ACCURACY = 85;
    const FULL_GAME_MOVE_CAP = 99;
    const baseStartRankTest = startRankTest;
    const baseFinishRankTest = finishRankTest;
    const baseRenderTraining = renderTraining;
    const baseBestMove = bestMove;

    const userColor=()=>state?.side==='white'?'w':'b';
    const profileNow=()=>{try{return loadProfile()}catch{return null}};
    const courseDepth=()=>Number(state?.rankCourseDepth||state?.sessionLength||10);
    const currentLevelProgress=()=>{try{return ensureLevelProgress(profileNow(),state.side,courseDepth())}catch{return null}};
    const completedAtDepth=()=>{try{return completedVariationsForLevel(currentLevelProgress())}catch{return 0}};

    function ensureLadder(profile,side,depth){
      profile.rankLadder=profile.rankLadder||{};
      profile.rankLadder[side]=profile.rankLadder[side]||{};
      const key=String(depth);
      const existing=profile.rankLadder[side][key]||{};
      const best=Number(existing.bestPassedElo||0);
      const nextIndex=Math.max(0,RANK_LEVELS.findIndex(x=>x>best));
      const resolvedIndex=nextIndex<0?RANK_LEVELS.length-1:nextIndex;
      return profile.rankLadder[side][key]={
        bestPassedElo:best,
        currentElo:Number(existing.currentElo||RANK_LEVELS[resolvedIndex]),
        attempts:Number(existing.attempts||0),
        passes:Number(existing.passes||0),
        lastResult:existing.lastResult||null
      };
    }

    function targetFor(profile,side,depth){
      const ladder=ensureLadder(profile,side,depth);
      const best=Number(ladder.bestPassedElo||0);
      return RANK_LEVELS.find(x=>x>best)||RANK_LEVELS.at(-1);
    }

    function setEngineStrength(enabled,elo){
      try{
        const worker=engineService?.worker;
        if(!worker?.postMessage)return;
        worker.postMessage(`setoption name UCI_LimitStrength value ${enabled?'true':'false'}`);
        if(enabled)worker.postMessage(`setoption name UCI_Elo value ${Math.max(1320,Math.min(3190,Number(elo)||1800))}`);
        worker.postMessage('isready');
      }catch{}
    }

    // Analysis/benchmark searches remain full-strength. Only the opponent move search is Elo-limited.
    bestMove=async function(...args){
      const isRankOpponent=state?.mode==='rank'&&state?.screen==='training'&&!state?.complete&&state?.chess?.turn?.()!==userColor()&&Number(state?.rankTargetElo)>0;
      if(!isRankOpponent)return baseBestMove(...args);
      setEngineStrength(true,state.rankTargetElo);
      try{return await baseBestMove(...args)}
      finally{setEngineStrength(false,state.rankTargetElo)}
    };

    startRankTest=async function(...args){
      const depth=Number(state?.sessionLength||10);
      const profile=profileNow();
      const lp=profile?ensureLevelProgress(profile,state.side,depth):null;
      const completed=lp?completedVariationsForLevel(lp):0;
      if(completed<1){
        state.status='Complete at least one variation at 5/5 Practice before taking this Rank Test.';
        state.statusError=false;
        try{render()}catch{}
        return;
      }

      state.rankCourseDepth=depth;
      state.rankTargetElo=targetFor(profile,state.side,depth);
      state.rankLadderResult=null;
      const out=await baseStartRankTest(...args);

      // Rank Test is exactly one game. Keep only the first prepared round and let it
      // continue until game over (99 user moves is only a safety cap for pathological games).
      if(Array.isArray(state.rankRounds)&&state.rankRounds.length>1)state.rankRounds=state.rankRounds.slice(0,1);
      state.sessionLength=FULL_GAME_MOVE_CAP;
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
      if(passed)return 'Rank cleared. Continue training more variations, or challenge the next Rank level.';
      if(metrics.outcome==='loss')return 'You lost the game. Add another variation at this depth or Practice your current line again before retrying this Rank.';
      if(metrics.blunders>0)return 'Review your mistakes, Practice the weak line again, then retry this Rank.';
      if(metrics.mistakes>0)return 'Practice this line again or learn one more variation before retrying the Rank Test.';
      return 'Your game was close, but the accuracy target was not reached. Train another variation or add more Practice before retrying.';
    }

    finishRankTest=function(...args){
      if(state?.mode!=='rank')return baseFinishRankTest(...args);
      const depth=courseDepth();
      const target=Number(state.rankTargetElo||1800);
      const metrics=resultMetrics();
      const passed=metrics.outcome!=='loss'&&metrics.accuracy>=PASS_ACCURACY&&metrics.mistakes===0&&metrics.blunders===0;

      // Restore the real training depth while the existing P0 persistence logic writes
      // Rank history / Opening Elo. The 99-move value is only for the live one-game loop.
      const liveLength=state.sessionLength;
      state.sessionLength=depth;
      const out=baseFinishRankTest(...args);
      state.sessionLength=liveLength;

      try{
        const profile=profileNow();
        const ladder=ensureLadder(profile,state.side,depth);
        ladder.attempts++;
        if(passed){
          ladder.passes++;
          ladder.bestPassedElo=Math.max(Number(ladder.bestPassedElo||0),target);
        }
        ladder.currentElo=passed?(RANK_LEVELS.find(x=>x>ladder.bestPassedElo)||RANK_LEVELS.at(-1)):target;
        ladder.lastResult={at:new Date().toISOString(),targetElo:target,passed,accuracy:metrics.accuracy,outcome:metrics.outcome,mistakes:metrics.mistakes,blunders:metrics.blunders};
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
      box.id='cotRankLadderResult';
      box.className='cot-rank-ladder-result';
      box.innerHTML=`<div class="cot-rank-ladder-kicker">Rank Ladder · ${r.targetElo}</div><h3>${r.passed?'Rank cleared ✓':'More training recommended'}</h3><p>${Math.round(r.accuracy)}% accuracy · ${r.outcome} · ${r.mistakes} mistakes · ${r.blunders} blunders</p><p>${r.recommendation}</p><div class="cot-rank-ladder-next">${r.passed&&r.targetElo<3000?`Next challenge: <b>${r.nextElo}</b>`:r.passed?'Maximum Rank challenge cleared: <b>3000</b>':`Retry target: <b>${r.targetElo}</b>`}</div>`;
      host.appendChild(box);
    }

    renderTraining=function(...args){
      const isRank=state?.mode==='rank';
      const savedLength=state?.sessionLength;
      if(isRank&&state.rankCourseDepth)state.sessionLength=state.rankCourseDepth;
      const out=baseRenderTraining(...args);
      if(isRank&&savedLength!==undefined)state.sessionLength=savedLength;
      if(isRank&&!state.complete){
        const status=document.querySelector('.status');
        if(status&&!document.querySelector('#cotRankTarget')){
          const badge=document.createElement('div');badge.id='cotRankTarget';badge.className='cot-rank-target';badge.textContent=`One game · Opponent Rank ${state.rankTargetElo||1800}`;
          status.insertAdjacentElement('afterend',badge);
        }
      }
      queueMicrotask(addRankLadderResult);
      return out;
    };

    const style=document.createElement('style');
    style.textContent=`.cot-rank-target{margin:8px 0;padding:8px 10px;border:1px solid #354455;border-radius:10px;background:#0d151d;color:#c8ff5a;font-size:12px;font-weight:900}.cot-rank-ladder-result{margin-top:14px;padding:14px;border:1px solid #354455;border-radius:13px;background:#0c141b;color:#dfe8ed}.cot-rank-ladder-result h3{margin:4px 0 8px;color:#fff}.cot-rank-ladder-result p{margin:5px 0;color:#aebbc5}.cot-rank-ladder-kicker{color:#c8ff5a;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.cot-rank-ladder-next{margin-top:10px;padding-top:9px;border-top:1px solid #293642}`;
    document.head.appendChild(style);

    globalThis.__COT_RANK_LADDER_RULES__={levels:[...RANK_LEVELS],gamesPerAttempt:1,unlockCompletedVariations:1,passAccuracy:PASS_ACCURACY,fullGame:true,maxRank:3000};
  }
} catch(err){console.warn('One-game Rank ladder could not attach',err)}
