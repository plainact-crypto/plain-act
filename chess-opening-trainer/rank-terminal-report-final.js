// Guaranteed Rank report for every terminal outcome.
// This no longer depends on the legacy finish renderer to decide whether a report may open.
try {
  if (!globalThis.__COT_RANK_TERMINAL_REPORT_FINAL__) {
    globalThis.__COT_RANK_TERMINAL_REPORT_FINAL__ = true;

    const LEVELS=[1800,2000,2200,2500,2700,3000];
    const PASS_ACCURACY=85;
    const previousRender=render;
    let finalizing=false;
    let committedKey='';

    const isLiveRank=()=>state?.mode==='rank'&&state?.screen==='training'&&!state?.complete;
    const forcedOutcome=()=>{
      const value=String(state?.rankForcedOutcome||'').toLowerCase();
      return ['loss','draw','win'].includes(value)?value:'';
    };
    const naturalOutcome=()=>{
      try{
        if(!state?.chess?.isGameOver?.())return '';
        if(state.chess.isCheckmate?.()){
          const userColor=state?.side==='black'?'b':'w';
          return state.chess.turn()===userColor?'loss':'win';
        }
        return 'draw';
      }catch{return ''}
    };

    function metrics(outcome){
      const items=Array.isArray(state?.rankLosses)?state.rankLosses:[];
      const accuracy=items.length?items.reduce((sum,item)=>sum+Math.max(0,Math.min(100,Number(item?.accuracy)||0)),0)/items.length:0;
      const inaccuracies=items.filter(x=>Number(x?.lossCp)>=35&&Number(x?.lossCp)<100).length;
      const mistakes=items.filter(x=>Number(x?.lossCp)>=100&&Number(x?.lossCp)<300).length;
      const blunders=items.filter(x=>Number(x?.lossCp)>=300).length;
      const passed=outcome!=='loss'&&accuracy>=PASS_ACCURACY&&mistakes===0&&blunders===0;
      return {accuracy,inaccuracies,mistakes,blunders,passed};
    }

    function recommendation(m,outcome){
      if(m.passed)return 'Rank cleared. You are ready for the next Rank challenge.';
      if(outcome==='loss'&&m.blunders)return 'Review the blunders first, especially the positions with the largest evaluation loss, then retry this Rank.';
      if(m.blunders)return 'Reduce the blunders shown below before retrying this Rank.';
      if(m.mistakes)return 'Review the mistakes shown below and retry this Rank when those positions are clear.';
      if(m.accuracy<PASS_ACCURACY)return 'Your game was completed, but accuracy is below the Rank pass target. Review the weaker moves and retry.';
      return 'Review the game report and retry this Rank when ready.';
    }

    function persistResult(outcome,m){
      try{
        const profile=loadProfile()||{};
        profile.rankLadder=profile.rankLadder||{};
        const existing=profile.rankLadder.global||{};
        const target=Number(state?.rankTargetElo||existing.currentElo||1800);
        const best=Number(existing.bestPassedElo||0);
        const attempts=Number(existing.attempts||0)+1;
        const passes=Number(existing.passes||0)+(m.passed?1:0);
        const bestPassedElo=m.passed?Math.max(best,target):best;
        const next=LEVELS.find(x=>x>bestPassedElo)||LEVELS.at(-1);
        const currentElo=m.passed?next:target;
        const lastResult={at:new Date().toISOString(),targetElo:target,passed:m.passed,accuracy:m.accuracy,outcome,mistakes:m.mistakes,blunders:m.blunders,color:state?.side==='black'?'black':'white'};
        profile.rankLadder.global={bestPassedElo,currentElo,attempts,passes,lastResult};
        saveProfile(profile);
        state.rankLadderResult={...lastResult,nextElo:currentElo,bestPassedElo,recommendation:recommendation(m,outcome)};
      }catch(err){console.warn('Guaranteed Rank result persistence failed',err)}
    }

    function mistakeRows(){
      const rows=Array.isArray(state?.rankReviewItems)?state.rankReviewItems:[];
      if(!rows.length)return '<div class="cot-rank-report-empty">No major scored mistakes were captured in this game.</div>';
      return rows.slice(0,12).map((item,index)=>{
        const san=String(item?.playedSan||item?.playedUci||'Move');
        const best=String(item?.bestSan||item?.bestUci||'—');
        const loss=Math.round(Number(item?.lossCp)||0);
        return `<div class="cot-rank-report-row"><span>${index+1}. ${san}</span><span>${String(item?.issue||'Review')}</span><span>Best: ${best}</span><span>-${loss} cp</span></div>`;
      }).join('');
    }

    function backToCourse(){
      document.querySelector('#cotGuaranteedRankReport')?.remove();
      const prior=state?.rankTrainingSideBeforeChoice;
      if(prior==='white'||prior==='black')state.side=prior;
      state.rankChosenColor=null;
      state.rankTrainingSideBeforeChoice=null;
      state.rankForcedOutcome=null;
      state.mode='guided';
      state.screen='course';
      state.complete=false;
      state.engineBusy=false;
      state.sessionLength=Number(state?.rankCourseDepth||10);
      try{previousRender()}catch{}
    }

    function showReport(outcome,m){
      document.querySelector('#cotGuaranteedRankReport')?.remove();
      const r=state.rankLadderResult||{};
      const target=Number(r.targetElo||state?.rankTargetElo||1800);
      const resultLabel=outcome==='win'?'Win':outcome==='draw'?'Draw':'Loss';
      const overlay=document.createElement('div');
      overlay.id='cotGuaranteedRankReport';
      overlay.innerHTML=`<section class="cot-rank-report-card">
        <div class="cot-rank-report-kicker">Rank Test Report · ${target}</div>
        <h2>${m.passed?'Rank Cleared ✓':'Rank Not Cleared'}</h2>
        <div class="cot-rank-report-grid">
          <div><b>${resultLabel}</b><span>Game result</span></div>
          <div><b>${Math.round(m.accuracy)}%</b><span>Accuracy</span></div>
          <div><b>${m.mistakes}</b><span>Mistakes</span></div>
          <div><b>${m.blunders}</b><span>Blunders</span></div>
        </div>
        <div class="cot-rank-report-rec"><strong>Recommendation</strong><p>${recommendation(m,outcome)}</p></div>
        <div class="cot-rank-report-review"><strong>Review My Mistakes</strong>${mistakeRows()}</div>
        <div class="cot-rank-report-next">${m.passed&&target<3000?`Next Rank: <b>${r.nextElo||LEVELS.find(x=>x>target)||3000}</b>`:m.passed?'Maximum Rank cleared: <b>3000</b>':`Retry Rank: <b>${target}</b>`}</div>
        <button type="button" data-rank-report-close>Back to Rank Ladder</button>
      </section>`;
      document.body.appendChild(overlay);
      overlay.querySelector('[data-rank-report-close]')?.addEventListener('click',backToCourse,{once:true});
    }

    function finalizeTerminal(outcome){
      if(finalizing||!outcome||!isLiveRank())return;
      let fen='';try{fen=state?.chess?.fen?.()||''}catch{}
      const key=`${outcome}|${fen}|${state?.history?.length||0}|${state?.rankTargetElo||1800}`;
      if(key===committedKey)return;
      committedKey=key;
      finalizing=true;
      try{
        state.engineBusy=false;
        const m=metrics(outcome);
        persistResult(outcome,m);
        showReport(outcome,m);
        state.complete=true;
        state.rankRound=Array.isArray(state?.rankRounds)&&state.rankRounds.length?state.rankRounds.length:1;
      }finally{finalizing=false}
    }

    // Capture Resign before the legacy handler can leave the UI stuck in "in progress".
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('[data-rank-resign]');
      if(!button||!isLiveRank())return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(window.confirm('Resign this Rank game?')){
        state.rankForcedOutcome='loss';
        state.status='You resigned.';
        finalizeTerminal('loss');
      }
    },true);

    // Accepted draw and natural game-over are finalized independently of legacy round counters.
    render=function(...args){
      const out=previousRender(...args);
      queueMicrotask(()=>{
        try{
          if(!isLiveRank())return;
          const text=String(state?.status||'');
          if(/Draw offer accepted/i.test(text)){state.rankForcedOutcome='draw';finalizeTerminal('draw');return}
          const outcome=naturalOutcome();
          if(outcome)finalizeTerminal(outcome);
        }catch(err){console.warn('Guaranteed Rank report trigger failed',err)}
      });
      return out;
    };

    const style=document.createElement('style');
    style.textContent=`#cotGuaranteedRankReport{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px;background:#05080cec;backdrop-filter:blur(10px)}.cot-rank-report-card{width:min(760px,100%);max-height:90vh;overflow:auto;padding:24px;border:1px solid #3b4a57;border-radius:18px;background:#10171d;color:#eaf1f4;box-shadow:0 28px 90px #000b}.cot-rank-report-kicker{color:#c8ff5a;font-size:11px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.cot-rank-report-card h2{margin:6px 0 18px}.cot-rank-report-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.cot-rank-report-grid>div{padding:14px;border:1px solid #2b3944;border-radius:12px;background:#0b1218}.cot-rank-report-grid b{display:block;font-size:22px}.cot-rank-report-grid span{color:#91a0aa;font-size:11px}.cot-rank-report-rec,.cot-rank-report-review,.cot-rank-report-next{margin-top:14px;padding:14px;border:1px solid #2b3944;border-radius:12px;background:#0b1218}.cot-rank-report-rec p{margin:6px 0 0;color:#b9c5cc}.cot-rank-report-row{display:grid;grid-template-columns:1.2fr .8fr 1.2fr .6fr;gap:8px;padding:8px 0;border-bottom:1px solid #22303a;font-size:12px}.cot-rank-report-empty{padding-top:8px;color:#91a0aa}.cot-rank-report-card button{width:100%;margin-top:16px;padding:13px;border:0;border-radius:11px;background:#c8ff5a;color:#0a0e11;font-weight:950;cursor:pointer}@media(max-width:640px){.cot-rank-report-grid{grid-template-columns:1fr 1fr}.cot-rank-report-row{grid-template-columns:1fr 1fr}}`;
    document.head.appendChild(style);

    globalThis.__COT_RANK_TERMINAL_REPORT_RULES__={
      resignShowsFullReport:true,
      acceptedDrawShowsFullReport:true,
      naturalGameOverShowsFullReport:true,
      reportDoesNotDependOnLegacyFinish:true,
      reportContainsRecommendations:true,
      reportContainsMistakeReview:true,
      ladderResultPersisted:true,
      trainingDataUsed:false
    };
  }
}catch(err){console.warn('Guaranteed Rank report could not attach',err)}
