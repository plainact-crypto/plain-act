// Report #52: Practice retry must always rebuild the live board from a clean instance.
// The completion screen removes the board DOM while state.board can still reference the
// previous attempt. Restarting through that stale instance can leave #board blank.
try {
  if (!globalThis.__COT_PRACTICE_RETRY_BOARD_FIX_52__) {
    globalThis.__COT_PRACTICE_RETRY_BOARD_FIX_52__ = true;

    let retryStarting = false;

    function destroyPracticeBoard() {
      try { state?.board?.destroy?.(); } catch {}
      try { state.board = null; } catch {}
    }

    async function restartCurrentPractice() {
      if (retryStarting || state?.mode !== 'test') return;
      retryStarting = true;
      const variation = Math.max(0, Number(state?.variationIndex || 0));
      try {
        state.engineBusy = false;
        state.complete = false;
        state.practiceReviewActive = false;
        state.hintVisible = false;
        destroyPracticeBoard();

        await startPracticeTest(variation);

        // startPracticeTest owns the chess state. This guard only guarantees that its
        // visual board was mounted after the completion DOM disappeared.
        if (state?.mode === 'test' && state?.screen === 'training') {
          const boardHost = document.querySelector('#board');
          const mounted = !!boardHost?.querySelector?.('.cm-chessboard');
          if (!state.board || !mounted) {
            destroyPracticeBoard();
            render();
          }
        }
      } catch (err) {
        console.error('Practice retry rebuild failed', err);
        state.status = 'Practice could not restart — try again. Your progress is safe.';
        state.statusError = true;
        try { render(); } catch {}
      } finally {
        retryStarting = false;
      }
    }

    // #again is the canonical Practice result retry control. Capture before legacy
    // listeners so exactly one restart owns the transition and board lifecycle.
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('#again');
      if (!button || state?.mode !== 'test' || !state?.complete) return;

      // Once the variation is fully completed, the same legacy control means
      // "Back to Level" rather than retry; leave that navigation untouched.
      let completed = false;
      try {
        const lesson = currentLesson?.();
        const target = typeof PRACTICE_PASSES_PER_VARIATION === 'number' ? PRACTICE_PASSES_PER_VARIATION : 5;
        completed = Number(lesson?.passes || 0) >= target;
      } catch {}
      if (completed) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      restartCurrentPractice();
    }, true);

    globalThis.__COT_RESTART_CURRENT_PRACTICE__ = restartCurrentPractice;
  }
} catch (err) {
  console.warn('Report #52 Practice retry board fix could not attach', err);
}
