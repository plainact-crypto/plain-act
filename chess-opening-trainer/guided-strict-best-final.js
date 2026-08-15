// Final Guided policy: repertoire identity anchor only, then exact Stockfish Top-1.
// This file is intentionally injected AFTER Training Lines so no later patch can
// replace the coach decision with a repertoire/alternative move.
try {
  if (!globalThis.__COT_GUIDED_STRICT_BEST_FINAL__) {
    globalThis.__COT_GUIDED_STRICT_BEST_FINAL__ = true;

    const packForFen = globalThis.__COT_GUIDED_SEARCH_PACK__;
    if (typeof packForFen !== 'function') throw new Error('Guided search broker unavailable');

    const toMove = (uci) => uci ? ({
      from: uci.slice(0,2),
      to: uci.slice(2,4),
      promotion: uci[4] || null
    }) : null;

    const identityAnchor = () => {
      try {
        const hist = state?.chess?.history?.({verbose:true}) || [];
        if (state?.side === 'white' && hist.length === 0) {
          const legal = state.chess.moves({square:'d2',verbose:true}).some(m=>m.to==='d4');
          if (legal) return {from:'d2',to:'d4',promotion:null};
        }
        if (state?.side === 'black' && hist.filter(m=>m.color==='b').length === 0) {
          const legal = state.chess.moves({square:'c7',verbose:true}).some(m=>m.to==='c6');
          if (legal) return {from:'c7',to:'c6',promotion:null};
        }
      } catch {}
      return null;
    };

    bestRepertoireMove = async function() {
      if (state?.screen !== 'training' || state?.mode !== 'guided') return null;
      state.exploreStrongUserAlternative = false;
      const anchor = identityAnchor();
      if (anchor) return anchor;
      const fen = state?.chess?.fen?.() || '';
      const pack = await packForFen(fen, true);
      const uci = pack?.bestmove || pack?.lines?.[0]?.uci || null;
      return toMove(uci);
    };

    // Training Lines may set this flag while creating a new line. Under the strict
    // coach rule it can no longer alter move selection; new lines must come from a
    // genuinely different position/branch, never from choosing a weaker move.
    try { state.exploreStrongUserAlternative = false; } catch {}

    globalThis.__COT_GUIDED_RULES__ = {
      whiteIdentityAnchor: 'd2d4',
      blackIdentityAnchor: 'c7c6',
      afterAnchor: 'exact-stockfish-top1-depth20-both-sides',
      alternativesAllowedInGuided: false
    };
  }
} catch (err) {
  console.warn('Final strict Guided best-move policy could not attach', err);
}
