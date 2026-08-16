// Final Rank Game Contract.
// Rank is independent from Guided/Practice content after unlock:
// - always starts from the standard initial chess position
// - inherits only the player's opening side (White/Black)
// - never requires/replays a saved repertoire move
// - ends only on a natural chess game-over condition
// - preserves the existing Rank scoring/report/ladder pipeline
// - reuses one full-strength Depth-20 analysis search per FEN
// - applies Rank Elo to the actual opponent engine service
try {
  if (!globalThis.__COT_RANK_INDEPENDENT_FULL_GAME__) {
    globalThis.__COT_RANK_INDEPENDENT_FULL_GAME__ = true;

    const LIVE_FULL_GAME_LENGTH = Number.MAX_SAFE_INTEGER;
    const RANK_ANALYSIS_DEPTH = 20;
    const originalRankSetupRound = setupRankRound;
    const originalRankStartTestFinal = startRankTest;
    const originalRankPrepareUserTurn = prepareRankUserTurn;
    const originalRankScoreContinue = scoreRankMoveAndContinue;
    const originalRankRenderTraining = renderTraining;

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
      try {
        const probe=new Chess();
        return probe.fen();
      } catch {
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
    };
    const line0=pack=>pack?.lines?.[0]||null;
    const bestUci=pack=>pack?.bestmove||line0(pack)?.uci||null;

    async function rankAnalysisPack(fen){
      if(!rawAnalysisSearch||!fen)return null;
      const key=`${fen}|d${RANK_ANALYSIS_DEPTH}|pv1`;
      if(!analysisCache.has(key)){
        const promise=Promise.resolve()
          .then(()=>rawAnalysisSearch({fen,depth:RANK_ANALYSIS_DEPTH,multiPv:1}))
          .catch(err=>{analysisCache.delete(key);throw err});
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

    // Rank benchmark analysis remains full-strength Depth 20, but Best + Evaluation
    // for the same user-turn FEN share one search. Opponent move generation keeps the
    // target Rank Elo and is deliberately separate from benchmark analysis.
    if(userEngine&&originalUserBestMove&&originalUserEvaluate&&rawAnalysisSearch){
      userEngine.bestMove=async function(...args){
        if(!isLiveRank())return originalUserBestMove(...args);
        const fen=fenFromArgs(args);
        const turn=String(fen||'').split(/\s+/)[1]||state?.chess?.turn?.();
        if(turn===userColor())return bestUci(await rankAnalysisPack(fen));
        setActualOpponentStrength(true);
        try{return await originalUserBestMove(...args)}
        finally{setActualOpponentStrength(false)}
      };
      userEngine.evaluate=async function(...args){
        if(!isLiveRank())return originalUserEvaluate(...args);
        return line0(await rankAnalysisPack(fenFromArgs(args)));
      };
    }

    function resetRankGameToInitialPosition(){
      try {
        if(typeof state?.chess?.reset==='function') state.chess.reset();
        else if(typeof state?.chess?.load==='function') state.chess.load(initialFen());
      } catch(err){
        console.warn('Rank initial-position reset failed',err);
      }
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
      globalThis.__COT_RANK_GAME_START__={
        fen:state?.chess?.fen?.()||'',
        expectedFen:initialFen(),
        side:state?.side||'white',
        independent:true,
        naturalGameEndOnly:true
      };
    }

    // Let the proven P0 setup initialize board/input state, then erase every saved-line
    // gameplay artifact. The prepared legacy round is only an internal entry bridge.
    setupRankRound=function(round){
      const out=originalRankSetupRound(round);
      if(state?.mode==='rank') resetRankGameToInitialPosition();
      return out;
    };

    // The entry bridge may restore a legacy depth/99 after startRankRound returns.
    // Force live Rank back to an uncapped full-game contract.
    startRankTest=async function(...args){
      const out=await originalRankStartTestFinal(...args);
      if(isLiveRank()){
        state.sessionLength=LIVE_FULL_GAME_LENGTH;
        state.rankFresh=true;
        state.rankFreshBranchPending=false;
        try{render()}catch{}
      }
      return out;
    };

    // Fresh games always begin with White. If the user is the Black-side player,
    // make the Rank opponent's first move before benchmarking the user's turn.
    prepareRankUserTurn=async function(...args){
      if(isLiveRank()&&!state.chess.isGameOver()&&state.chess.turn()!==userColor()){
        state.engineBusy=true;
        state.status='Opponent is thinking…';
        state.statusError=false;
        try{render()}catch{}
        try {
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
          if(state.chess.isGameOver()){
            await finishRankRound();
            return;
          }
        } catch(err){
          console.error('Rank opening opponent move failed',err);
          state.engineBusy=true;
          state.status='Rank opponent move failed — restart this Rank Test. No score was saved.';
          state.statusError=true;
          try{render()}catch{}
          return;
        }
      }
      return originalRankPrepareUserTurn(...args);
    };

    // The P0 scorer has a legacy userMovesDone >= sessionLength guard. Give it an
    // effectively unbounded length while it runs so only chess.isGameOver() can finish
    // the Rank game. This is never displayed as a target and never used for passing.
    scoreRankMoveAndContinue=async function(...args){
      if(!isLiveRank())return originalRankScoreContinue(...args);
      state.sessionLength=LIVE_FULL_GAME_LENGTH;
      return originalRankScoreContinue(...args);
    };

    function cleanRankLiveUi(){
      if(!isLiveRank())return;
      // Rank is not a 10/15/20/25/30-move training task. Remove any inherited target.
      const moveCount=Number(state?.userMovesDone||0);
      document.querySelectorAll('body *').forEach(el=>{
        if(el.children?.length)return;
        const raw=String(el.textContent||'').trim();
        if(/^\d+\s*\/\s*(10|15|20|25|30|99|9007199254740991)$/.test(raw)){
          el.textContent=`${moveCount} moves played · Full game`;
        }
        if(/Rank round\s+1\/1/i.test(raw)){
          el.textContent=raw.replace(/Rank round\s+1\/1\s*·?/i,'Full game ·');
        }
      });
      const progress=document.querySelector('progress');
      if(progress){progress.removeAttribute('max');progress.removeAttribute('value')}
    }

    renderTraining=function(...args){
      const out=originalRankRenderTraining(...args);
      queueMicrotask(cleanRankLiveUi);
      return out;
    };

    globalThis.__COT_RANK_GAME_RULES__={
      startPosition:'standard-initial-fen',
      trainingDataUsedDuringGame:false,
      inheritedFromTraining:['player-side-only'],
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
