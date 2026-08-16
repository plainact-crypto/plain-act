// One-game Rank ladder for Chess Opening Trainer.
// Unlocks only after ONE complete variation line has passed 5/5 at Depths
// 10,15,20,25,30 and then reached a natural game end.
// Each Rank attempt is one full game against progressively stronger opponents:
// 1800 -> 2000 -> 2200 -> 2500 -> 2700 -> 3000.
try {
  if (!globalThis.__COT_ONE_GAME_RANK_LADDER__) {
    globalThis.__COT_ONE_GAME_RANK_LADDER__ = true;

    const RANK_LEVELS = [1800,2000,2200,2500,2700,3000];
    const TRAINING_DEPTHS = [10,15,20,25,30];
    const PASS_ACCURACY = 85;
    const FULL_GAME_MOVE_CAP = 99;
    const baseStartRankTest = startRankTest;
    const baseFinishRankTest = finishRankTest;
    const baseRenderTraining = renderTraining;
    const baseRenderRankLadder = render;
    const baseBestMove = bestMove;

    const userColor=()=>state?.side==='white'?'w':'b';
    const profileNow=()=>{try{return loadProfile()}catch{return null}};
    const courseDepth=()=>Number(state?.rankCourseDepth||state?.sessionLength||10);

    function fullLineCount(profile,side){
      if(!profile)return 0;
      let count=0;
      for(const depth of TRAINING_DEPTHS){
        try{count=Math.max(count,Number(ensureLevelProgress(profile,side,depth)?.rankFullLineCompletedCount||0))}catch{}
      }
      return count;
    }

    function ensureLadder(profile,side){
      profile.rankLadder=profile.rankLadder||{};
      const old=profile.rankLadder[side];
      let existing=old&&Number.isFinite(Number(old.bestPassedElo))?old:null;
      if(!existing&&old&&typeof old==='object'){
        const legacy=Object.values(old).filter(x=>x&&typeof x==='object');
        const bestPassedElo=Math.max(0,...legacy.map(x=>Number(x.bestPassedElo||0)));
        const attempts=legacy.reduce((n,x)=>n+Number(x.attempts||0),0);
        const passes=legacy.reduce((n,x)=>n+Number(x.passes||0),0);
        existing={bestPassedElo,attempts,passes,lastResult:legacy.sort((a,b)=>String(b.lastResult?.at||'').localeCompare(String(a.lastResult?.at||'')))[0]?.lastResult||null};
      }
      existing=existing||{};
      const best=Number(existing.bestPassedElo||0);
      const next=RANK_LEVELS.find(x=>x>best)||RANK_LEVELS.at(-1);
      return profile.rankLadder[side]={
        bestPassedElo:best,
        currentElo:Number(existing.currentElo||next),
        attempts:Number(existing.attempts||0),
        passes:Number(existing.passes||0),
        lastResult:existing.lastResult||null
      };
    }

    function targetFor(profile,side){
      const ladder=ensureLadder(profile,side);
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
      if(fullLineCount(profile,state.side)<1){
        state.status='Complete one full variation line first: 5/5 at Depths 10, 15, 20, 25 and 30, then finish the game.';
        state.statusError=false;
        try{render()}catch{}
        return;
      }

      state.rankCourseDepth=depth;
      state.rankTargetElo=targetFor(profile,state.side);
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
      if(passed)return 'Rank cleared. Challenge the next Rank level, or keep expanding your repertoire.';
      if(metrics.outcome==='loss')return 'You lost the game. Complete another full variation line or Practice your current lines more before retrying this Rank.';
      if(metrics.blunders>0)return 'Review your mistakes, Practice the weak line again, then retry this Rank.';
      if(metrics.mistakes>0)return 'Practice your current lines again or complete another full variation line before retrying the Rank Test.';
      return 'Your game was close, but the accuracy target was not reached. Add more Practice or complete another full variation line before retrying.';
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
        const ladder=ensureLadder(profile,state.side);
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

    function fixRankUnlockCopy(){
      const profile=profileNow();
      const unlocked=fullLineCount(profile,state?.side==='black'?'black':'white')>=1;
      document.querySelectorAll('p,.sub,small').forEach(el=>{
        const text=String(el.textContent||'').replace(/\s+/g,' ').trim();
        if(/Complete\s+1\s+different variations? at 5\/5 valid Practice passes to unlock it/i.test(text)){
          el.textContent=unlocked?'Full variation line completed. Rank Ladder unlocked.':'Complete one full variation line: 5/5 at Depths 10 → 15 → 20 → 25 → 30, then finish the game.';
        }
      });
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

    render=function(...args){
      const out=baseRenderRankLadder(...args);
      queueMicrotask(()=>{try{fixRankUnlockCopy();addRankLadderResult()}catch{}});
      return out;
    };

    const style=document.createElement('style');
    style.textContent=`.cot-rank-target{margin:8px 0;padding:8px 10px;border:1px solid #354455;border-radius:10px;background:#0d151d;color:#c8ff5a;font-size:12px;font-weight:900}.cot-rank-ladder-result{margin-top:14px;padding:14px;border:1px solid #354455;border-radius:13px;background:#0c141b;color:#dfe8ed}.cot-rank-ladder-result h3{margin:4px 0 8px;color:#fff}.cot-rank-ladder-result p{margin:5px 0;color:#aebbc5}.cot-rank-ladder-kicker{color:#c8ff5a;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.cot-rank-ladder-next{margin-top:10px;padding-top:9px;border-top:1px solid #293642}`;
    document.head.appendChild(style);

    globalThis.__COT_RANK_LADDER_RULES__={
      levels:[...RANK_LEVELS],
      gamesPerAttempt:1,
      unlockRequirement:'one-full-variation-line-5of5-at-10-15-20-25-30-plus-natural-game-end',
      passAccuracy:PASS_ACCURACY,
      fullGame:true,
      maxRank:3000,
      ladderScope:'opening-side-global'
    };
  }
} catch(err){console.warn('One-game Rank ladder could not attach',err)}
