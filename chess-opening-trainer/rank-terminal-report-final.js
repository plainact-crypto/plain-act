// Final terminal-outcome bridge for Rank Test.
// Resign / accepted draw must complete the single Rank round and open the same
// full report pipeline used by checkmate/draw. This is independent of training.
try {
  if (!globalThis.__COT_RANK_TERMINAL_REPORT_FINAL__) {
    globalThis.__COT_RANK_TERMINAL_REPORT_FINAL__ = true;

    const previousRenderTraining = renderTraining;
    const previousFinishRankTest = finishRankTest;
    let finalizing = false;
    let lastTerminalKey = '';

    const forcedOutcome = () => {
      const value = String(state?.rankForcedOutcome || '').toLowerCase();
      return value === 'loss' || value === 'draw' || value === 'win' ? value : '';
    };
    const isPendingTerminalRank = () =>
      state?.mode === 'rank' && state?.screen === 'training' && !state?.complete && !!forcedOutcome();

    function terminalKey() {
      let fen = '';
      try { fen = state?.chess?.fen?.() || ''; } catch {}
      return `${forcedOutcome()}|${fen}|${state?.history?.length || 0}|${state?.rankTargetElo || 1800}`;
    }

    function forceFullRankReport() {
      if (finalizing || !isPendingTerminalRank()) return;
      const key = terminalKey();
      if (key === lastTerminalKey) return;
      lastTerminalKey = key;
      finalizing = true;
      try {
        // The old result renderer expects the single round to be complete.
        // Rank now has exactly one full game, so terminal controls complete it here.
        if (Array.isArray(state?.rankRounds) && state.rankRounds.length) {
          state.rankRound = state.rankRounds.length;
        } else {
          state.rankRound = 1;
        }
        state.engineBusy = false;
        state.rankFreshBranchPending = false;
        state.rankPendingReview = null;

        previousFinishRankTest();

        // The Rank ladder wrapper should have produced the completed result. If an
        // older legacy renderer still leaves the board live, render once more after
        // the round counter has been normalized so its completion branch can run.
        if (!state.complete && state?.mode === 'rank' && state?.screen === 'training') {
          previousFinishRankTest();
        }
      } catch (err) {
        console.error('Rank terminal report finalization failed', err);
        state.status = 'Rank result could not open — your game result is preserved. Refresh and open Rank Test again.';
        state.statusError = true;
        try { render(); } catch {}
      } finally {
        finalizing = false;
      }
    }

    renderTraining = function(...args) {
      const out = previousRenderTraining(...args);
      if (isPendingTerminalRank()) queueMicrotask(forceFullRankReport);
      return out;
    };

    render = (function(previousRender) {
      return function(...args) {
        const out = previousRender(...args);
        if (isPendingTerminalRank()) queueMicrotask(forceFullRankReport);
        return out;
      };
    })(render);

    globalThis.__COT_RANK_TERMINAL_REPORT_RULES__ = {
      resignShowsFullReport: true,
      acceptedDrawShowsFullReport: true,
      terminalOutcomeCompletesSingleRound: true,
      reportPipeline: 'same-rank-finish-pipeline',
      trainingDataUsed: false
    };
  }
} catch (err) {
  console.warn('Rank terminal report final bridge could not attach', err);
}
