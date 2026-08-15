// Guided Training single-search broker.
// One Stockfish Depth-20 / MultiPV-1 search per FEN supplies Top-1 move,
// evaluation and move-quality consumers. Decorative/background consumers do
// not start additional engine searches in Guided mode.
try {
  if (!globalThis.__COT_GUIDED_SINGLE_SEARCH_BROKER__) {
    globalThis.__COT_GUIDED_SINGLE_SEARCH_BROKER__ = true;

    const DEPTH = 20;
    const cache = new Map();
    const pending = new Map();

    const userEngine = globalThis.__COT_USER_ENGINE_SERVICE__ || engineService;
    const opponentEngine = globalThis.__COT_OPPONENT_ENGINE_SERVICE__ || userEngine;
    const evalEngine = globalThis.__COT_EVAL_ENGINE_SERVICE__ || null;
    const qualityEngine = globalThis.__COT_MOVE_QUALITY_ENGINE_SERVICE__ || null;

    const rawUserSearch = userEngine?.search?.bind(userEngine);
    const rawOpponentSearch = opponentEngine?.search?.bind(opponentEngine);
    if (!rawUserSearch || !rawOpponentSearch) throw new Error('Engine search API unavailable');

    const sideCode = () => state?.side === 'black' ? 'b' : 'w';
    const engineRoleForFen = (fen) => {
      const turn = String(fen || '').split(/\s+/)[1] || '';
      return turn && turn !== sideCode() ? 'opponent' : 'coach';
    };
    const rawSearchForFen = (fen) => engineRoleForFen(fen) === 'opponent' ? rawOpponentSearch : rawUserSearch;
    const keyFor = (fen) => `${engineRoleForFen(fen)}|${fen}|d${DEPTH}|pv1`;

    const remember = (key, promise) => {
      pending.set(key, promise);
      promise.finally(() => pending.delete(key));
      return promise;
    };

    async function packForFen(fen) {
      if (!fen) return null;
      const key = keyFor(fen);
      if (cache.has(key)) return cache.get(key);
      if (pending.has(key)) return pending.get(key);

      const run = rawSearchForFen(fen);
      globalThis.__COT_COACH_DECISION_PENDING__ = true;
      const promise = Promise.resolve()
        .then(() => run({ fen, depth: DEPTH, multiPv: 1 }))
        .then((pack) => {
          if (pack) {
            cache.set(key, pack);
            if (cache.size > 160) cache.delete(cache.keys().next().value);
          }
          return pack || null;
        })
        .finally(() => {
          globalThis.__COT_COACH_DECISION_PENDING__ = false;
        });
      return remember(key, promise);
    }

    const fenFromArgs = (args) => {
      try {
        const first = args?.[0];
        if (typeof first === 'string' && first.includes('/')) return first;
        if (first?.fen && typeof first.fen === 'function') return first.fen();
        if (first?.fen && typeof first.fen === 'string') return first.fen;
        return state?.chess?.fen?.() || '';
      } catch { return ''; }
    };
    const line0 = (pack) => pack?.lines?.[0] || null;
    const bestUci = (pack) => pack?.bestmove || line0(pack)?.uci || null;

    async function brokerBestMove(...args) {
      const fen = fenFromArgs(args);
      if (state?.screen !== 'training' || state?.mode !== 'guided') {
        return this.__cotRawBestMove ? this.__cotRawBestMove(...args) : null;
      }
      return bestUci(await packForFen(fen));
    }
    async function brokerEvaluate(...args) {
      const fen = fenFromArgs(args);
      if (state?.screen !== 'training' || state?.mode !== 'guided') {
        return this.__cotRawEvaluate ? this.__cotRawEvaluate(...args) : null;
      }
      return line0(await packForFen(fen));
    }
    async function brokerTopMoves(...args) {
      const fen = fenFromArgs(args);
      const count = Math.max(1, Number(args?.[1]) || 1);
      if (state?.screen !== 'training' || state?.mode !== 'guided') {
        return this.__cotRawTopMoves ? this.__cotRawTopMoves(...args) : [];
      }
      const pack = await packForFen(fen);
      return (pack?.lines || []).map(x => x?.uci).filter(Boolean).slice(0, count);
    }

    function installOn(engine) {
      if (!engine || engine.__cotSingleSearchInstalled) return;
      engine.__cotSingleSearchInstalled = true;
      engine.__cotRawBestMove = engine.bestMove?.bind(engine) || null;
      engine.__cotRawEvaluate = engine.evaluate?.bind(engine) || null;
      engine.__cotRawTopMoves = engine.topMoves?.bind(engine) || null;
      engine.bestMove = brokerBestMove.bind(engine);
      engine.evaluate = brokerEvaluate.bind(engine);
      engine.topMoves = brokerTopMoves.bind(engine);
    }

    installOn(userEngine);
    if (opponentEngine !== userEngine) installOn(opponentEngine);

    // The eval bar and quality classifier share the exact same cached Guided search.
    // They never start their own Stockfish work while Guided is active.
    if (evalEngine) {
      evalEngine.__cotRawEvaluate = evalEngine.evaluate?.bind(evalEngine) || null;
      evalEngine.evaluate = async function(fen, depth = DEPTH) {
        if (state?.screen === 'training' && state?.mode === 'guided') return line0(await packForFen(fen));
        return this.__cotRawEvaluate ? this.__cotRawEvaluate(fen, depth) : null;
      };
    }
    if (qualityEngine) {
      qualityEngine.__cotRawEvaluate = qualityEngine.evaluate?.bind(qualityEngine) || null;
      qualityEngine.__cotRawBestMove = qualityEngine.bestMove?.bind(qualityEngine) || null;
      qualityEngine.__cotRawTopMoves = qualityEngine.topMoves?.bind(qualityEngine) || null;
      qualityEngine.evaluate = async function(fen, depth = DEPTH) {
        if (state?.screen === 'training' && state?.mode === 'guided') return line0(await packForFen(fen));
        return this.__cotRawEvaluate ? this.__cotRawEvaluate(fen, depth) : null;
      };
      qualityEngine.bestMove = async function(fen, depth = DEPTH) {
        if (state?.screen === 'training' && state?.mode === 'guided') return bestUci(await packForFen(fen));
        return this.__cotRawBestMove ? this.__cotRawBestMove(fen, depth) : null;
      };
      qualityEngine.topMoves = async function(fen, count = 1, depth = DEPTH) {
        if (state?.screen === 'training' && state?.mode === 'guided') {
          const pack = await packForFen(fen);
          return (pack?.lines || []).map(x => x?.uci).filter(Boolean).slice(0, Math.max(1, Number(count) || 1));
        }
        return this.__cotRawTopMoves ? this.__cotRawTopMoves(fen, count, depth) : [];
      };
    }

    // D4/C6 are identity anchors only. Every later normal Guided move is Top-1
    // from the broker's single Depth-20 search.
    if (typeof bestRepertoireMove === 'function') {
      const priorBestRepertoireMove = bestRepertoireMove;
      bestRepertoireMove = async function() {
        if (state?.exploreStrongUserAlternative) return priorBestRepertoireMove();
        try {
          const hist = state?.chess?.history?.({ verbose: true }) || [];
          if (state?.side === 'white' && hist.length === 0) {
            const legal = state.chess.moves({ square: 'd2', verbose: true }).some(m => m.to === 'd4');
            if (legal) return { from: 'd2', to: 'd4', promotion: null };
          }
          if (state?.side === 'black' && hist.filter(m => m.color === 'b').length === 0) {
            const legal = state.chess.moves({ square: 'c7', verbose: true }).some(m => m.to === 'c6');
            if (legal) return { from: 'c7', to: 'c6', promotion: null };
          }
        } catch {}
        const fen = state?.chess?.fen?.() || '';
        const uci = bestUci(await packForFen(fen));
        return uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || null } : null;
      };
    }

    globalThis.__COT_GUIDED_SEARCH_PACK__ = packForFen;
    globalThis.__COT_GUIDED_SEARCH_CACHE__ = cache;
    globalThis.__COT_GUIDED_ENGINE_POLICY__ = 'one-depth20-multipv1-search-per-fen';
  }
} catch (err) {
  console.warn('Guided single-search broker could not attach', err);
}
