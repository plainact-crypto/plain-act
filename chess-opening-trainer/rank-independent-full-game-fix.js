// Final Rank Game Contract.
// Rank is independent from Guided/Practice content and training side:
// - available to every player
// - first Rank is 1800, then 2000 -> 2200 -> 2500 -> 2700 -> 3000
// - player chooses White or Black for each Rank session
// - always starts from the standard initial chess position
// - never requires/replays a saved repertoire move
// - ends only on a natural chess game-over condition
// - preserves the existing Rank scoring/report/ladder pipeline
// - reuses one full-strength Depth-20 analysis search per FEN
// - applies Rank Elo to the actual opponent engine service
try {
  if (!globalThis.__COT_RANK_INDEPENDENT_FULL_GAME__) {
    globalThis.__COT_RANK_INDEPENDENT_FULL_GAME__ = true;

    const LIVE_FULL_GAME_LENGTH=Number.MAX_SAFE_INTEGER;
    const RANK_ANALYSIS_DEPTH=20;
    const originalRankSetupRound=setupRankRound;
    const originalRankStartTestFinal=startRankTest;
    const originalRankPrepareUserTurn=prepareRankUserTurn;
    const originalRankScoreContinue=scoreRankMoveAndContinue;
    const originalRankRenderTraining=renderTraining;
    const originalGlobalRender=render;

    const userEngine=globalThis.__COT_USER_ENGINE_SERVICE__||engineService;
    const opponentEngine=globalThis.__COT_OPPONENT_ENGINE_SERVICE__||userEngine;
    const analysisEngine=globalThis.__COT_MOVE_QUALITY_ENGINE_SERVICE__||globalThis.__COT_EVAL_ENGINE_SERVICE__||userEngine;
    const rawAnalysisSearch=analysisEngine?.search?.bind(analysisEngine);
    const originalUserBestMove=userEngine?.bestMove?.bind(userEngine);
    const originalUserEvaluate=userEngine?.evaluate?.bind(userEngine);
    const analysisCache=new Map();

    const isLiveRank=()=>state?.mode==='rank'&&state?.screen==='training'&&!state?.complete;
    const userColor=()=>state?.side==='black'?'b':'w';
    const fenFromArgs=args=>{
      try{
        const first=args?.[0];
        if(typeof first==='string'&&first.includes('/'))return first;
        if(first?.fen&&typeof first.fen==='function')return first.fen();
        if(first?.fen&&typeof first.fen==='string')return first.fen;
        return state?.chess?.fen?.()||'';
      }catch{return ''}
    };
    const initialFen=()=>{
      try{const probe=new Chess();return probe.fen()}
      catch{return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
    };
    const line0=pack=>pack?.lines?.[0]||null;
    const bestUci=pack=>pack?.bestmove||line0(pack)?.uci||null;

    async function rankAnalysisPack(fen){
      if(!rawAnalysisSearch||!fen)return null;
      const key=`${fen}|d${RANK_ANALYSIS_DEPTH}|pv1`;
      if(!analysisCache.has(key)){
        const promise=Promise.resolve().then(()=>rawAnalysisSearch({fen,depth:RANK_ANALYSIS_DEPTH,multiPv:1})).catch(err=>{analysisCache.delete(key);throw err});
        analysisCache.set(key,promise);
        if(analysisCache.size>96)analysisCache.delete(analysisCache.keys().next().value);
      }
      return analysisCache.get(key);
    }

    function setActualOpponentStrength(enabled){
      try{
        const worker=opponentEngine?.worker;
        if(!worker?.postMessage)return;
        const target=Math.max(1320,Math.min(3190,Number(state?.rankTargetElo)||1800));
        worker.postMessage(`setoption name UCI_LimitStrength value ${enabled?'true':'false'}`);
        if(enabled)worker.postMessage(`setoption name UCI_Elo value ${target}`);
        worker.postMessage('isready');
      }catch{}
    }

    if(userEngine&&originalUserBestMove&&originalUserEvaluate&&rawAnalysisSearch){
      userEngine.bestMove=async function(...args){
        if(!isLiveRank())return originalUserBestMove(...args);
        const fen=fenFromArgs(args);
        const turn=String(fen||'').split(/\s+/)[1]||state?.chess?.turn?.();
        if(turn===userColor())return bestUci(await rankAnalysisPack(fen));
        setActualOpponentStrength(true);
        try{return await originalUserBestMove(...args)}finally{setActualOpponentStrength(false)}
      };
      userEngine.evaluate=async function(...args){
        if(!isLiveRank())return originalUserEvaluate(...args);
        return line0(await rankAnalysisPack(fenFromArgs(args)));
      };
    }

    function resetRankGameToInitialPosition(){
      try{
        if(typeof state?.chess?.reset==='function')state.chess.reset();
        else if(typeof state?.chess?.load==='function')state.chess.load(initialFen());
      }catch(err){console.warn('Rank initial-position reset failed',err)}
      state.history=[];
      state.userMovesDone=0;
      state.rankFresh=true;
      state.rankFreshBranchPending=false;
      state.rankPendingReview=null;
      state.rankBestMove=null;
      state.rankBeforeScore=null;
      state.sessionLength=LIVE_FULL_GAME_LENGTH;
      analysisCache.clear();
      try{state.board?.setPosition?.(state.chess.fen(),false)}catch{}
      globalThis.__COT_RANK_GAME_START__={fen:state?.chess?.fen?.()||'',expectedFen:initialFen(),rankColor:state?.side||'white',independent:true,naturalGameEndOnly:true};
    }

    setupRankRound=function(round){
      const out=originalRankSetupRound(round);
      if(state?.mode==='rank')resetRankGameToInitialPosition();
      return out;
    };

    function closeColorPicker(){document.querySelector('#cotRankColorPicker')?.remove()}
    function restoreTrainingSide(){
      if(state?.rankTrainingSideBeforeChoice){state.side=state.rankTrainingSideBeforeChoice}
      state.rankChosenColor=null;
      state.rankTrainingSideBeforeChoice=null;
      closeColorPicker();
    }
    function showColorPicker(startArgs){
      closeColorPicker();
      const target=Number(state?.rankTargetElo)||1800;
      const wrap=document.createElement('div');
      wrap.id='cotRankColorPicker';
      wrap.innerHTML=`<div class="cot-rank-color-card"><div class="cot-rank-color-kicker">Rank Test</div><h2>Choose your color</h2><p>Full game against Rank <b>${target}</b>. Rank is independent from D4/C6 training.</p><div class="cot-rank-color-actions"><button data-color="white">Play White</button><button data-color="black">Play Black</button></div><button class="cot-rank-cancel" data-cancel>Cancel</button></div>`;
      document.body.appendChild(wrap);
      wrap.querySelectorAll('[data-color]').forEach(btn=>btn.addEventListener('click',async()=>{
        const color=btn.dataset.color==='black'?'black':'white';
        state.rankChosenColor=color;
        state.side=color;
        closeColorPicker();
        await originalRankStartTestFinal(...startArgs);
        if(isLiveRank()){
          state.sessionLength=LIVE_FULL_GAME_LENGTH;
          state.rankFresh=true;
          state.rankFreshBranchPending=false;
          try{render()}catch{}
        }
      },{once:true}));
      wrap.querySelector('[data-cancel]')?.addEventListener('click',()=>{restoreTrainingSide();try{render()}catch{}},{once:true});
    }

    startRankTest=async function(...args){
      if(!state.rankChosenColor){
        if(!state.rankTrainingSideBeforeChoice)state.rankTrainingSideBeforeChoice=state?.side||'white';
        // The ladder wrapper calculates the current target; first-ever target is always 1800.
        if(!Number(state?.rankTargetElo))state.rankTargetElo=1800;
        showColorPicker(args);
        return;
      }
      const out=await originalRankStartTestFinal(...args);
      if(isLiveRank()){
        state.sessionLength=LIVE_FULL_GAME_LENGTH;
        state.rankFresh=true;
        state.rankFreshBranchPending=false;
        try{render()}catch{}
      }
      return out;
    };

    prepareRankUserTurn=async function(...args){
      if(isLiveRank()&&!state.chess.isGameOver()&&state.chess.turn()!==userColor()){
        state.engineBusy=true;state.status='Opponent is thinking…';state.statusError=false;
        try{render()}catch{}
        try{
          const uci=await bestMove();
          if(!isLiveRank()||state.chess.isGameOver())return;
          if(!uci)throw new Error('No opponent move');
          const move=state.chess.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});
          if(!move)throw new Error('Illegal opponent move');
          state.history.push(move.san);
          state.rankFreshBranchPending=false;
          state.engineBusy=false;
          state.status=`Opponent played ${move.san}`;
          try{render()}catch{}
          if(state.chess.isGameOver()){await finishRankRound();return}
        }catch(err){
          console.error('Rank opening opponent move failed',err);
          state.engineBusy=true;state.status='Rank opponent move failed — restart this Rank Test. No score was saved.';state.statusError=true;
          try{render()}catch{}
          return;
        }
      }
      return originalRankPrepareUserTurn(...args);
    };

    scoreRankMoveAndContinue=async function(...args){
      if(!isLiveRank())return originalRankScoreContinue(...args);
      state.sessionLength=LIVE_FULL_GAME_LENGTH;
      return originalRankScoreContinue(...args);
    };

    function cleanRankLiveUi(){
      if(!isLiveRank())return;
      const moveCount=Number(state?.userMovesDone||0);
      document.querySelectorAll('body *').forEach(el=>{
        if(el.children?.length)return;
        const raw=String(el.textContent||'').trim();
        if(/^\d+\s*\/\s*(10|15|20|25|30|99|9007199254740991)$/.test(raw))el.textContent=`${moveCount} moves played · Full game`;
        if(/Rank round\s+1\/1/i.test(raw))el.textContent=raw.replace(/Rank round\s+1\/1\s*·?/i,'Full game ·');
        if(/^D4 Player$/i.test(raw)||/^C6 Player$/i.test(raw))el.textContent='Rank Test';
      });
      const progress=document.querySelector('progress');
      if(progress){progress.removeAttribute('max');progress.removeAttribute('value')}
      const exit=document.querySelector('#exit');
      if(exit&&!exit.dataset.cotRankRestore){exit.dataset.cotRankRestore='1';exit.addEventListener('click',restoreTrainingSide,{capture:true})}
    }

    renderTraining=function(...args){const out=originalRankRenderTraining(...args);queueMicrotask(cleanRankLiveUi);return out};
    render=function(...args){
      const out=originalGlobalRender(...args);
      queueMicrotask(()=>{
        try{
          if(state?.screen==='course'&&state?.mode!=='rank'&&state?.rankTrainingSideBeforeChoice)restoreTrainingSide();
        }catch{}
      });
      return out;
    };

    const style=document.createElement('style');
    style.textContent=`#cotRankColorPicker{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;background:#05080cd9;backdrop-filter:blur(8px)}.cot-rank-color-card{width:min(430px,100%);padding:24px;border:1px solid #34414d;border-radius:18px;background:#11181f;color:#e9eff2;box-shadow:0 24px 80px #0008}.cot-rank-color-kicker{font-size:11px;font-weight:950;letter-spacing:.14em;text-transform:uppercase;color:#c8ff5a}.cot-rank-color-card h2{margin:6px 0 8px;font-size:26px}.cot-rank-color-card p{margin:0 0 18px;color:#aebbc5;line-height:1.5}.cot-rank-color-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cot-rank-color-actions button{padding:14px;border:1px solid #465563;border-radius:12px;background:#1b242c;color:#fff;font-weight:900;cursor:pointer}.cot-rank-color-actions button:hover{border-color:#c8ff5a}.cot-rank-cancel{width:100%;margin-top:10px;padding:11px;border:0;background:transparent;color:#8e9aa4;cursor:pointer}`;
    document.head.appendChild(style);

    globalThis.__COT_RANK_GAME_RULES__={
      firstRank:1800,
      levels:[1800,2000,2200,2500,2700,3000],
      startPosition:'standard-initial-fen',
      trainingDataUsedDuringGame:false,
      inheritedFromTraining:[],
      playerChoosesColor:true,
      savedLineReplay:false,
      requiredRepertoireMoves:false,
      freshBranchAlternative:false,
      termination:'natural-chess-game-over-only',
      report:'existing-rank-full-report-after-game-over',
      opponentMovesFirstWhenUserIsBlack:true,
      benchmark:{depth:RANK_ANALYSIS_DEPTH,multiPv:1,sharedSearchPerFen:true,fullStrength:true},
      opponentStrength:'actual-opponent-engine-rank-elo'
    };
  }
}catch(err){console.warn('Independent full-game Rank fix could not attach',err)}
