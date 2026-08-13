// --- Persistent training board across rerenders (Report #27) ---
try{
  if(!globalThis.__PERSISTENT_TRAINING_BOARD_PATCH__){
    globalThis.__PERSISTENT_TRAINING_BOARD_PATCH__=true;
    const persistentOriginalRender=render;

    const inSpecialReview=()=>!!(state?.practiceReviewActive||state?.rankReviewActive);
    const currentFen=()=>{try{return state?.chess?.fen?.()||''}catch{return ''}};

    render=function(...args){
      const canPreserve=state?.screen==='training'&&!state?.complete&&!inSpecialReview();
      const oldShell=canPreserve?document.querySelector('.board-shell'):null;
      const oldBoard=canPreserve?state?.board:null;
      const oldTop=oldShell?.getBoundingClientRect?.().top;
      const oldScrollY=window.scrollY;

      const result=persistentOriginalRender(...args);

      if(canPreserve&&state?.screen==='training'&&!state?.complete&&!inSpecialReview()&&oldShell&&oldBoard){
        const freshShell=document.querySelector('.board-shell');
        if(freshShell&&freshShell!==oldShell){
          const throwawayBoard=state.board;
          freshShell.replaceWith(oldShell);
          state.board=oldBoard;
          try{throwawayBoard?.destroy?.()}catch{}
          try{
            const fen=currentFen();
            if(fen) oldBoard.setPosition?.(fen,true);
          }catch(err){console.warn('Persistent board position update failed',err)}
          try{drawGuide?.()}catch{}

          if(Number.isFinite(oldTop)){
            requestAnimationFrame(()=>{
              if(state?.screen!=='training') return;
              const nowTop=oldShell.getBoundingClientRect().top;
              const delta=nowTop-oldTop;
              if(Math.abs(delta)>0.5) window.scrollTo(0,Math.max(0,oldScrollY+delta));
            });
          }
        }
      }
      return result;
    };

    const s=document.createElement('style');
    s.textContent=`
      .board-shell,#board,.cm-chessboard{overflow-anchor:none}
      .board-shell{contain:layout paint}
      .training .status,.training .status-line,.training .training-status{min-height:1.5em}
    `;
    document.head.appendChild(s);
  }
}catch(err){console.warn('Persistent training board patch could not attach',err)}
