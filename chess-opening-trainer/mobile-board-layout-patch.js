// Mobile board layout guard — Report #35
// Prevent the chessboard from collapsing to thumbnail size on narrow screens.
try{
  if(!globalThis.__MOBILE_BOARD_LAYOUT_GUARD__){
    globalThis.__MOBILE_BOARD_LAYOUT_GUARD__=true;
    const style=document.createElement('style');
    style.textContent=`
      @media (max-width: 820px){
        .training{
          display:grid!important;
          grid-template-columns:minmax(0,1fr)!important;
          width:100%!important;
          gap:18px!important;
          align-items:start!important;
        }
        .training > .board-area{
          display:block!important;
          width:100%!important;
          max-width:680px!important;
          min-width:0!important;
          margin:0 auto!important;
          justify-self:stretch!important;
        }
        .training .board-shell,
        .practice-review-grid .board-shell,
        .rank-review-grid .board-shell{
          position:relative!important;
          display:block!important;
          width:100%!important;
          max-width:680px!important;
          min-width:0!important;
          height:auto!important;
          aspect-ratio:1 / 1!important;
          margin:0 auto!important;
          overflow:visible!important;
        }
        .training #board,
        .practice-review-grid #board,
        .rank-review-grid #board{
          position:absolute!important;
          inset:0!important;
          width:100%!important;
          height:100%!important;
          min-width:0!important;
          min-height:0!important;
        }
        .training #board > .cm-chessboard,
        .practice-review-grid #board > .cm-chessboard,
        .rank-review-grid #board > .cm-chessboard,
        .training .cm-chessboard,
        .practice-review-grid .cm-chessboard,
        .rank-review-grid .cm-chessboard{
          width:100%!important;
          height:100%!important;
          max-width:none!important;
          max-height:none!important;
        }
        .training > .side-panel,
        .practice-review-grid > .side-panel,
        .rank-review-grid > .side-panel{
          width:100%!important;
          min-width:0!important;
          max-width:none!important;
        }
        .training .guide-layer,
        .practice-review-grid .guide-layer,
        .rank-review-grid .guide-layer{
          position:absolute!important;
          inset:0!important;
          width:100%!important;
          height:100%!important;
          pointer-events:none!important;
        }
      }
    `;
    document.head.appendChild(style);

    // cm-chessboard measures its host during construction. If an older mobile layout
    // briefly supplied a tiny width, re-render once after the viewport has settled.
    let lastRepairKey='';
    const repair=()=>{
      try{
        if(innerWidth>820 || state?.screen!=='training') return;
        const shell=document.querySelector('.training .board-shell');
        const board=document.querySelector('.training #board .cm-chessboard')||document.querySelector('.training #board');
        if(!shell||!board) return;
        const sr=shell.getBoundingClientRect();
        const br=board.getBoundingClientRect();
        if(sr.width>=240 && br.width<Math.min(220,sr.width*.7)){
          const key=`${state?.mode||''}|${state?.side||''}|${state?.sessionLength||''}|${state?.variationIndex??''}|${state?.chess?.fen?.()||''}`;
          if(key!==lastRepairKey){
            lastRepairKey=key;
            requestAnimationFrame(()=>{try{render()}catch{}});
          }
        }
      }catch{}
    };
    addEventListener('resize',()=>setTimeout(repair,80),{passive:true});
    addEventListener('orientationchange',()=>setTimeout(repair,180),{passive:true});
    setInterval(repair,500);
  }
}catch(err){console.warn('Mobile board layout guard could not attach',err)}
