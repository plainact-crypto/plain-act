// Mobile test UX fixes for Reports #10 and #11.
try{
  if(!globalThis.__MOBILE_TEST_UX_PATCH__){
    globalThis.__MOBILE_TEST_UX_PATCH__=true;

    const style=document.createElement('style');
    style.textContent=`
      .cm-chessboard .piece,
      .cm-chessboard [class*="piece"]{
        transition: transform 520ms cubic-bezier(.2,.8,.2,1) !important;
      }
      body.cot-user-dragging .cm-chessboard .piece,
      body.cot-user-dragging .cm-chessboard [class*="piece"]{
        transition:none !important;
      }
      .cot-mobile-test-note{
        position:fixed;left:50%;bottom:18px;transform:translateX(-50%);
        z-index:99999;background:rgba(20,20,20,.94);color:#fff;
        padding:9px 12px;border-radius:10px;font:600 12px/1.25 system-ui,sans-serif;
        box-shadow:0 8px 28px rgba(0,0,0,.25);pointer-events:none;
      }
    `;
    document.head.appendChild(style);

    const isBoardTarget=(target)=>!!target?.closest?.('.cm-chessboard');
    const isMobileTouch=()=>navigator.maxTouchPoints>0 || matchMedia('(pointer:coarse)').matches;
    let touchStart=null;
    let suppressClickUntil=0;
    let noteShown=false;

    const showDragNote=()=>{
      if(noteShown) return;
      noteShown=true;
      const n=document.createElement('div');
      n.className='cot-mobile-test-note';
      n.textContent='Test mode: drag the piece to move — a simple touch will not count as a move.';
      document.body.appendChild(n);
      setTimeout(()=>n.remove(),2200);
    };

    document.addEventListener('pointerdown',(e)=>{
      if(!isBoardTarget(e.target)) return;
      document.body.classList.add('cot-user-dragging');
      if(e.pointerType==='touch' && isMobileTouch() && state?.mode==='test'){
        touchStart={x:e.clientX,y:e.clientY,t:performance.now()};
      }
    },true);

    document.addEventListener('pointerup',(e)=>{
      if(!isBoardTarget(e.target)){
        document.body.classList.remove('cot-user-dragging');
        touchStart=null;
        return;
      }
      document.body.classList.remove('cot-user-dragging');
      if(e.pointerType==='touch' && touchStart && state?.mode==='test'){
        const dx=e.clientX-touchStart.x, dy=e.clientY-touchStart.y;
        const dist=Math.hypot(dx,dy);
        if(dist<12){
          suppressClickUntil=performance.now()+450;
          e.preventDefault();
          e.stopImmediatePropagation();
          showDragNote();
        }
      }
      touchStart=null;
    },true);

    document.addEventListener('pointercancel',()=>{
      document.body.classList.remove('cot-user-dragging');
      touchStart=null;
    },true);

    document.addEventListener('click',(e)=>{
      if(performance.now()<suppressClickUntil && isBoardTarget(e.target) && state?.mode==='test'){
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },true);
  }
}catch(err){console.warn('Mobile test UX patch could not attach',err)}
