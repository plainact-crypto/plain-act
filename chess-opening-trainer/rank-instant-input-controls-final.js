// Final Rank interaction contract: never block piece input on Depth-20 benchmarking.
// Benchmarking starts in the background on every user turn; scoring waits for it only
// after the legal move is already visible on the board. Also adds Offer Draw / Resign.
try {
  if (!globalThis.__COT_RANK_INSTANT_INPUT_CONTROLS_FINAL__) {
    globalThis.__COT_RANK_INSTANT_INPUT_CONTROLS_FINAL__ = true;

    const previousPrepareRankUserTurn = prepareRankUserTurn;
    const previousScoreRankMoveAndContinue = scoreRankMoveAndContinue;
    const previousRenderTraining = renderTraining;
    const previousStartRankTest = startRankTest;
    const previousFinishRankTest = finishRankTest;

    let benchmark = null;
    let finishingByControl = false;
    const isLiveRank = () => state?.mode === 'rank' && state?.screen === 'training' && !state?.complete;
    const userColor = () => state?.side === 'black' ? 'b' : 'w';
    const fenNow = () => { try { return state?.chess?.fen?.() || ''; } catch { return ''; } };

    function evalToUserScore(result, fen) {
      if (!result) throw new Error('No Rank evaluation');
      const cp = result.cp === null || result.cp === undefined ? null : Number(result.cp);
      const mate = result.mate === null || result.mate === undefined ? null : Number(result.mate);
      if ((cp === null || !Number.isFinite(cp)) && (mate === null || !Number.isFinite(mate))) throw new Error('Invalid Rank evaluation');
      const turn = String(fen || '').split(/\s+/)[1] || 'w';
      const whiteFactor = turn === 'w' ? 1 : -1;
      const whiteScore = mate !== null && Number.isFinite(mate)
        ? whiteFactor * (mate > 0 ? 100000 : -100000)
        : whiteFactor * cp;
      return state.side === 'black' ? -whiteScore : whiteScore;
    }

    function startBenchmark(fen) {
      if (!fen) return null;
      if (benchmark?.fen === fen) return benchmark;
      const promise = Promise.all([
        Promise.resolve().then(() => engineService.bestMove(fen)),
        Promise.resolve().then(() => engineService.evaluate(fen))
      ]).then(([best, evaluation]) => ({ best, score: evalToUserScore(evaluation, fen) }));
      benchmark = { fen, promise };
      promise.then(result => {
        if (!isLiveRank() || fenNow() !== fen) return;
        state.rankBestMove = result.best || state.rankBestMove || null;
        state.rankBeforeScore = result.score;
        const status = document.querySelector('.status');
        if (status && /Your move/i.test(status.textContent || '')) status.textContent = 'Your move — play normally';
      }).catch(err => console.warn('Background Rank benchmark failed', err));
      return benchmark;
    }

    // The critical fix: do not hold state.engineBusy=true while the benchmark runs.
    // A legal drag/click is accepted immediately; the existing scorer waits afterward.
    prepareRankUserTurn = async function(...args) {
      if (!isLiveRank()) return previousPrepareRankUserTurn(...args);
      if (state.chess.isGameOver()) { await finishRankRound(); return; }
      if (state.chess.turn() !== userColor()) return previousPrepareRankUserTurn(...args);

      const fen = fenNow();
      state.engineBusy = false;
      state.status = 'Your move — play normally';
      state.statusError = false;
      try { render(); } catch {}
      startBenchmark(fen);
      return;
    };

    scoreRankMoveAndContinue = async function(...args) {
      if (!isLiveRank()) return previousScoreRankMoveAndContinue(...args);
      const review = state.rankPendingReview || {};
      const beforeFen = review.fenBefore || benchmark?.fen || '';
      let active = benchmark?.fen === beforeFen ? benchmark : null;
      if (!active && beforeFen) active = startBenchmark(beforeFen);
      if (active) {
        try {
          // Yield a frame first so the accepted move paints immediately.
          await new Promise(resolve => requestAnimationFrame(() => resolve()));
          const result = await active.promise;
          state.rankBestMove = result.best || state.rankBestMove || null;
          state.rankBeforeScore = result.score;
        } catch (err) {
          console.error('Rank benchmark failed after move', err);
          state.engineBusy = true;
          state.status = 'Rank evaluation failed — restart this Rank Test. No score was saved.';
          state.statusError = true;
          try { render(); } catch {}
          return;
        }
      }
      benchmark = null;
      return previousScoreRankMoveAndContinue(...args);
    };

    startRankTest = async function(...args) {
      benchmark = null;
      finishingByControl = false;
      return previousStartRankTest(...args);
    };

    function finishWithForcedOutcome(outcome) {
      if (finishingByControl || !isLiveRank()) return;
      finishingByControl = true;
      state.rankForcedOutcome = outcome;
      const chess = state.chess;
      const saved = {};
      try {
        saved.isGameOver = chess.isGameOver;
        saved.isCheckmate = chess.isCheckmate;
        saved.turn = chess.turn;
        chess.isGameOver = () => true;
        chess.isCheckmate = () => outcome === 'loss';
        chess.turn = () => outcome === 'loss' ? userColor() : (typeof saved.turn === 'function' ? saved.turn.call(chess) : userColor());
        previousFinishRankTest();
      } finally {
        try { chess.isGameOver = saved.isGameOver; chess.isCheckmate = saved.isCheckmate; chess.turn = saved.turn; } catch {}
        setTimeout(() => { finishingByControl = false; }, 0);
      }
    }

    async function offerDraw(button) {
      if (!isLiveRank() || state.chess.turn() !== userColor()) return;
      const old = button.textContent;
      button.disabled = true;
      button.textContent = 'Offering…';
      try {
        const fen = fenNow();
        const b = startBenchmark(fen);
        const result = b ? await b.promise : null;
        // The opponent accepts when it is not clearly better than the player.
        // Positive score = player advantage; strongly negative = opponent advantage.
        const accepted = !result || Number(result.score) >= -50;
        if (accepted) {
          state.status = 'Draw offer accepted.';
          state.statusError = false;
          finishWithForcedOutcome('draw');
          return;
        }
        state.status = 'Draw offer declined — play continues.';
        state.statusError = false;
        const status = document.querySelector('.status');
        if (status) status.textContent = state.status;
      } catch (err) {
        console.warn('Draw offer evaluation failed', err);
        state.status = 'Draw offer declined — play continues.';
        const status = document.querySelector('.status');
        if (status) status.textContent = state.status;
      } finally {
        if (isLiveRank()) { button.disabled = false; button.textContent = old; }
      }
    }

    function addRankControls() {
      if (!isLiveRank() || document.querySelector('#cotRankGameControls')) return;
      const restart = document.querySelector('#restart');
      const exit = document.querySelector('#exit');
      const anchor = restart?.parentElement || exit?.parentElement || document.querySelector('.status')?.parentElement;
      if (!anchor) return;
      const controls = document.createElement('div');
      controls.id = 'cotRankGameControls';
      controls.innerHTML = '<button type="button" data-rank-draw>Offer Draw</button><button type="button" data-rank-resign>Resign</button>';
      anchor.insertAdjacentElement('afterend', controls);
      const draw = controls.querySelector('[data-rank-draw]');
      const resign = controls.querySelector('[data-rank-resign]');
      draw?.addEventListener('click', () => offerDraw(draw));
      resign?.addEventListener('click', () => {
        if (!isLiveRank()) return;
        if (window.confirm('Resign this Rank game?')) {
          state.status = 'You resigned.';
          state.statusError = false;
          finishWithForcedOutcome('loss');
        }
      });
    }

    renderTraining = function(...args) {
      const out = previousRenderTraining(...args);
      if (isLiveRank()) queueMicrotask(addRankControls);
      return out;
    };

    const style = document.createElement('style');
    style.textContent = '#cotRankGameControls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}#cotRankGameControls button{padding:10px 12px;border:1px solid #394754;border-radius:9px;background:#151d24;color:#dce5ea;font-weight:800;cursor:pointer}#cotRankGameControls button:hover{border-color:#c8ff5a}#cotRankGameControls button:disabled{opacity:.55;cursor:wait}';
    document.head.appendChild(style);

    globalThis.__COT_RANK_INSTANT_INPUT_RULES__ = {
      inputWaitsForBenchmark: false,
      movePaintsBeforeScoringWait: true,
      benchmarkDepth: 20,
      benchmarkMultiPv: 1,
      copiedTrainingLine: false,
      trainingDataUsedDuringRank: false,
      naturalGameReportRequired: true,
      offerDraw: true,
      resign: true
    };
  }
} catch (err) {
  console.warn('Rank instant input/controls final fix could not attach', err);
}
