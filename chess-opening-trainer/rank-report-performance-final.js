// Final Rank reliability/performance guard for Reports #62/#63.
// Keeps Rank fully independent from training, preserves Rank 1800+ ladder and Depth-20 benchmark,
// guarantees a natural game-over reaches the Rank report, restores the training course after exiting,
// and prevents the legacy full-DOM Rank cleanup from running during board interaction.
try {
  if (!globalThis.__COT_RANK_REPORT_PERFORMANCE_FINAL__) {
    globalThis.__COT_RANK_REPORT_PERFORMANCE_FINAL__ = true;

    const previousRenderTraining = renderTraining;
    const previousRender = render;
    const previousFinishRankRound = finishRankRound;
    const previousFinishRankTest = finishRankTest;
    const NORMAL_COURSE_DEPTH = 10;
    let cleanupSignature = '';
    let finishingNaturalGame = false;
    let restoringCourse = false;

    const isRank = () => state?.mode === 'rank';
    const isLiveRank = () => isRank() && state?.screen === 'training' && !state?.complete;
    const gameOver = () => { try { return !!state?.chess?.isGameOver?.(); } catch { return false; } };

    function targetRankCleanup() {
      if (!isLiveRank()) return;
      const moveCount = Number(state?.userMovesDone || 0);
      const signature = `${state?.rankRound || 0}|${moveCount}|${state?.history?.length || 0}|${state?.status || ''}`;
      if (signature === cleanupSignature) return;
      cleanupSignature = signature;

      // Keep this deliberately small. The old implementation scanned every node in body,
      // including the chessboard SVG/DOM, on every render and caused visible drag/input jank.
      const candidates = document.querySelectorAll('p,span,small,strong,b,.status,.stats,[class*="progress"],[class*="round"]');
      candidates.forEach(el => {
        if (el.children?.length) return;
        const raw = String(el.textContent || '').trim();
        if (/^\d+\s*\/\s*(10|15|20|25|30|99|9007199254740991)$/.test(raw)) {
          el.textContent = `${moveCount} moves played · Full game`;
        } else if (/Rank round\s+1\/1/i.test(raw)) {
          el.textContent = raw.replace(/Rank round\s+1\/1\s*·?/i, 'Full game ·');
        } else if (/^D4 Player$/i.test(raw) || /^C6 Player$/i.test(raw)) {
          el.textContent = 'Rank Test';
        }
      });
      const progress = document.querySelector('progress');
      if (progress) { progress.removeAttribute('max'); progress.removeAttribute('value'); }
    }

    // The previous Rank wrapper queues cleanRankLiveUi(), which performs a full body scan.
    // Suppress only that named microtask while preserving every other queued callback.
    renderTraining = function(...args) {
      if (!isLiveRank()) return previousRenderTraining(...args);
      const realQueueMicrotask = globalThis.queueMicrotask;
      if (typeof realQueueMicrotask !== 'function') {
        const out = previousRenderTraining(...args);
        targetRankCleanup();
        return out;
      }
      globalThis.queueMicrotask = function(callback) {
        if (callback?.name === 'cleanRankLiveUi') return;
        return realQueueMicrotask(callback);
      };
      try {
        const out = previousRenderTraining(...args);
        realQueueMicrotask(targetRankCleanup);
        return out;
      } finally {
        globalThis.queueMicrotask = realQueueMicrotask;
      }
    };

    async function finishNaturalRankGame() {
      if (finishingNaturalGame || !isRank() || !gameOver()) return;
      finishingNaturalGame = true;
      try {
        // Rank is exactly one full game. Do not depend on legacy round/depth counters.
        if (Array.isArray(state?.rankRounds) && state.rankRounds.length) state.rankRound = state.rankRounds.length;
        previousFinishRankTest();
      } finally {
        setTimeout(() => { finishingNaturalGame = false; }, 0);
      }
    }

    finishRankRound = async function(...args) {
      if (isRank() && gameOver()) {
        await finishNaturalRankGame();
        return;
      }
      return previousFinishRankRound(...args);
    };

    function restoreCourseAfterRankExit() {
      if (restoringCourse || state?.screen !== 'course' || state?.mode !== 'rank' || !gameOver()) return false;
      restoringCourse = true;
      try {
        const priorSide = state?.rankTrainingSideBeforeChoice;
        if (priorSide === 'white' || priorSide === 'black') state.side = priorSide;
        state.rankChosenColor = null;
        state.rankTrainingSideBeforeChoice = null;
        state.rankCourseDepth = Number(state?.rankCourseDepth || NORMAL_COURSE_DEPTH);
        state.sessionLength = state.rankCourseDepth;
        state.mode = 'guided';
        state.complete = false;
        cleanupSignature = '';
      } finally {
        restoringCourse = false;
      }
      return true;
    }

    render = function(...args) {
      const out = previousRender(...args);
      queueMicrotask(() => {
        try {
          // Fail-safe: a checkmate/draw must never remain stuck on the live board without a report.
          if (isLiveRank() && gameOver()) finishNaturalRankGame();
          if (restoreCourseAfterRankExit()) previousRender();
        } catch (err) {
          console.warn('Rank report/performance final guard failed', err);
        }
      });
      return out;
    };

    globalThis.__COT_RANK_REPORT_PERFORMANCE_RULES__ = {
      copiedTrainingLine: false,
      trainingDataUsedDuringRank: false,
      naturalGameOverAlwaysShowsReport: true,
      restoreTrainingProgressAfterReportExit: true,
      rankBenchmarkDepth: 20,
      rankBenchmarkMultiPv: 1,
      gameplayDomPolicy: 'no-full-body-scan-during-live-rank'
    };
  }
} catch (err) {
  console.warn('Rank report/performance final fix could not attach', err);
}
