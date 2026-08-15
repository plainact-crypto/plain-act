// Final Guided opening-route policy.
// Route phase is intentionally tiny and explicit; every move after it is exact Stockfish Top-1 Depth 20.
// This file is injected AFTER Training Lines so no later patch can replace the final decision policy.
try {
  if (!globalThis.__COT_GUIDED_STRICT_BEST_FINAL__) {
    globalThis.__COT_GUIDED_STRICT_BEST_FINAL__ = true;

    const packForFen = globalThis.__COT_GUIDED_SEARCH_PACK__;
    if (typeof packForFen !== 'function') throw new Error('Guided search broker unavailable');

    const toMove = (uci) => uci ? ({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||null}) : null;
    const uciOf = (move) => move ? `${move.from||''}${move.to||''}${move.promotion||''}` : '';
    const legalUci = (uci) => {
      try {
        if(!uci) return false;
        return state.chess.moves({verbose:true}).some(m=>`${m.from}${m.to}${m.promotion||''}`===uci);
      } catch { return false; }
    };
    const history = () => { try{return state?.chess?.history?.({verbose:true})||[]}catch{return[]} };
    const sideMoves = color => history().filter(m=>m.color===color);

    const branchFirstOpponentMove = () => {
      try {
        const profile=loadProfile();
        const lp=ensureLevelProgress(profile,state.side,state.sessionLength);
        return String(lp?.firstMoves?.[state.variationIndex]||'').toLowerCase();
      } catch { return ''; }
    };

    // The second opponent move may stay on an established/opening route even when it is
    // not engine Top-1. Prefer the selected saved line's second opponent move when legal.
    // For a brand-new branch there is no curated second route yet, so Top-1 is used.
    const savedSecondOpponentMove = () => {
      try {
        const profile=loadProfile();
        const lp=ensureLevelProgress(profile,state.side,state.sessionLength);
        const lesson=lp?.lessons?.[state.variationIndex];
        const lines=Array.isArray(lesson?.lines)?lesson.lines:[];
        const selected=Math.max(0,Math.min(Number(lesson?.selectedLineIndex||0),Math.max(0,lines.length-1)));
        const moves=Array.isArray(lines[selected]?.moves)?lines[selected].moves:[];
        const opponentActor=moves.filter(step=>step?.actor==='engine');
        const second=opponentActor[1];
        const uci=second?`${second.from||''}${second.to||''}${second.promotion||''}`:'';
        return legalUci(uci)?uci:'';
      } catch { return ''; }
    };

    function forcedOpeningRouteUci(){
      const hist=history();
      const whiteCount=hist.filter(m=>m.color==='w').length;
      const blackCount=hist.filter(m=>m.color==='b').length;
      const branch=branchFirstOpponentMove();

      if(state?.side==='white'){
        // Trainee identity: White always opens 1.d4.
        if(hist.length===0 && legalUci('d2d4')) return 'd2d4';
        // Variation identity: Black's first move is forced by the selected one of 20 branches.
        if(blackCount===0 && branch && legalUci(branch)) return branch;
        // Optional curated/popular second opponent move for this saved branch.
        if(blackCount===1){const second=savedSecondOpponentMove();if(second)return second;}
        return '';
      }

      if(state?.side==='black'){
        // Variation identity: White's first move is forced by the selected one of 20 branches.
        if(whiteCount===0 && branch && legalUci(branch)) return branch;
        // Trainee identity: Black always answers first with ...c6.
        if(blackCount===0 && legalUci('c7c6')) return 'c7c6';
        // Optional curated/popular second opponent move for this saved branch.
        if(whiteCount===1){const second=savedSecondOpponentMove();if(second)return second;}
        // Trainee identity continuation: Black's second move is always ...d5 when legal.
        if(blackCount===1 && legalUci('d7d5')) return 'd7d5';
        return '';
      }
      return '';
    }

    bestRepertoireMove = async function() {
      if (state?.screen !== 'training' || state?.mode !== 'guided') return null;
      state.exploreStrongUserAlternative = false;

      const forced=forcedOpeningRouteUci();
      if(forced){
        globalThis.__COT_LAST_GUIDED_DECISION__={type:'forced-opening-route',uci:forced,fen:state?.chess?.fen?.()||''};
        return toMove(forced);
      }

      const fen=state?.chess?.fen?.()||'';
      const pack=await packForFen(fen,true);
      const uci=pack?.bestmove||pack?.lines?.[0]?.uci||null;
      globalThis.__COT_LAST_GUIDED_DECISION__={type:'stockfish-top1',uci,depth:20,fen};
      return toMove(uci);
    };

    try { state.exploreStrongUserAlternative=false; } catch {}

    globalThis.__COT_GUIDED_RULES__={
      d4TraineeFirstMove:'d2d4',
      c6TraineeFirstBlackMove:'c7c6',
      c6TraineeSecondBlackMove:'d7d5',
      opponentFirstMove:'forced-by-selected-variation',
      opponentSecondMove:'saved-curated-route-when-available-otherwise-top1',
      afterOpeningRoute:'exact-stockfish-top1-depth20-both-sides',
      alternativesAllowedInGuided:false,
      bestLabel:'only-if-played-uci-equals-stockfish-top1'
    };
  }
} catch (err) {
  console.warn('Final Guided opening-route policy could not attach',err);
}
