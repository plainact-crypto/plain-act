// Guided Training move-quality symbols for BOTH sides.
// Every move is graded after it is played by the independent evaluation engine.
// Symbols only; no words; no side receives a pre-assigned grade.
(function installSymbolOnlyMoveQualityMarkers(){
  try{
    if(globalThis.__COT_SYMBOL_ONLY_MOVE_QUALITY__) return;
    globalThis.__COT_SYMBOL_ONLY_MOVE_QUALITY__=true;

    const style=document.createElement('style');
    style.textContent=`
      .cot-move-quality-badge{
        width:24px!important;height:24px!important;min-width:24px!important;
        padding:0!important;border:2px solid rgba(255,255,255,.92)!important;
        border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;
        color:#fff!important;font:900 12px/1 system-ui,-apple-system,Segoe UI,sans-serif!important;
        box-shadow:0 2px 8px rgba(0,0,0,.48)!important;white-space:nowrap!important;
        transform:translate(-50%,-118%)!important;pointer-events:none!important;z-index:17500!important;
      }
      .cot-quality-best{background:#7a5cff!important}
      .cot-quality-excellent{background:#20b26b!important}
      .cot-quality-good{background:#38a3db!important}
      .cot-quality-inaccuracy{background:#e5b93f!important;color:#151515!important}
      .cot-quality-mistake{background:#e78532!important}
      .cot-quality-blunder{background:#d84c4c!important}
      @media(max-width:700px){.cot-move-quality-badge{width:21px!important;height:21px!important;min-width:21px!important;font-size:10px!important}}
    `;
    document.head.appendChild(style);

    const symbolMap={
      best:{symbol:'★',cls:'cot-quality-best'},
      excellent:{symbol:'✓',cls:'cot-quality-excellent'},
      good:{symbol:'●',cls:'cot-quality-good'},
      inaccuracy:{symbol:'?!',cls:'cot-quality-inaccuracy'},
      mistake:{symbol:'?',cls:'cot-quality-mistake'},
      blunder:{symbol:'??',cls:'cot-quality-blunder'}
    };
    const classify=loss=>{
      const x=Math.max(0,Number(loss)||0);
      if(x<=10) return 'best';
      if(x<=25) return 'excellent';
      if(x<=60) return 'good';
      if(x<=120) return 'inaccuracy';
      if(x<=250) return 'mistake';
      return 'blunder';
    };
    const evalWhite=(fen,result)=>{
      if(!result) return null;
      const cp=Number(result.cp);
      if(!Number.isFinite(cp)) return null;
      const turn=String(fen||'').split(/\s+/)[1]||'w';
      return turn==='w'?cp:-cp;
    };
    const squarePosition=square=>{
      const board=document.querySelector('#board');
      if(!board||!square) return null;
      const r=board.getBoundingClientRect();
      if(r.width<50||r.height<50) return null;
      const file=square.charCodeAt(0)-97;
      const rank=Number(square[1]);
      if(file<0||file>7||rank<1||rank>8) return null;
      const black=state?.side==='black';
      const col=black?7-file:file;
      const row=black?rank-1:8-rank;
      return {x:r.left+(col+.68)*(r.width/8),y:r.top+(row+.28)*(r.height/8)};
    };

    let lastLen=-1;
    let lastFen='';
    let qualitySeq=0;
    let active={square:null,key:null};

    const clear=()=>{try{document.querySelector('#cotMoveQualityBadge')?.remove()}catch{}};
    const place=(square,key)=>{
      clear();
      if(state?.screen!=='training'||state?.mode!=='guided') return;
      const p=squarePosition(square);if(!p)return;
      const spec=symbolMap[key]||symbolMap.good;
      const b=document.createElement('div');
      b.id='cotMoveQualityBadge';
      b.className=`cot-move-quality-badge ${spec.cls}`;
      b.textContent=spec.symbol;
      b.setAttribute('aria-label',key);
      b.title='';
      b.style.left=`${p.x}px`;b.style.top=`${p.y}px`;
      document.body.appendChild(b);
      active={square,key};
    };

    async function grade(beforeFen,afterFen,mover,to,seq){
      try{
        const engine=globalThis.__COT_EVAL_ENGINE_SERVICE__;
        if(!engine?.evaluate||!beforeFen||!afterFen||!mover||!to) return;
        let waited=0;
        while(state?.engineBusy&&waited<3500){await new Promise(r=>setTimeout(r,60));waited+=60}
        if(seq!==qualitySeq) return;
        const beforeResult=await engine.evaluate(beforeFen);
        if(seq!==qualitySeq) return;
        const afterResult=await engine.evaluate(afterFen);
        if(seq!==qualitySeq) return;
        const beforeWhite=evalWhite(beforeFen,beforeResult);
        const afterWhite=evalWhite(afterFen,afterResult);
        if(beforeWhite==null||afterWhite==null) return;
        const beforeMover=mover==='w'?beforeWhite:-beforeWhite;
        const afterMover=mover==='w'?afterWhite:-afterWhite;
        const loss=Math.max(0,beforeMover-afterMover);
        place(to,classify(loss));
      }catch(err){console.warn('Move-quality grading failed',err)}
    }

    function watchMoves(){
      try{
        if(state?.screen!=='training'||state?.mode!=='guided'){
          lastLen=-1;lastFen='';active={square:null,key:null};clear();return;
        }
        const fen=state?.chess?.fen?.()||'';
        const hist=state?.chess?.history?.({verbose:true})||[];
        if(lastLen<0){lastLen=hist.length;lastFen=fen;clear();return}
        if(hist.length>lastLen&&lastFen){
          const last=hist[hist.length-1];
          const beforeFen=lastFen;
          const afterFen=fen;
          const seq=++qualitySeq;
          active={square:null,key:null};clear();
          grade(beforeFen,afterFen,last?.color,last?.to,seq);
        }
        lastLen=hist.length;
        lastFen=fen;
      }catch{}
    }

    const originalRender=render;
    render=function(...args){
      const out=originalRender(...args);
      queueMicrotask(watchMoves);
      requestAnimationFrame(watchMoves);
      return out;
    };
    window.addEventListener('resize',()=>{if(active.square&&active.key) place(active.square,active.key)},{passive:true});
    window.addEventListener('scroll',()=>{if(active.square&&active.key) place(active.square,active.key)},{passive:true});
    watchMoves();
  }catch(err){console.warn('Symbol-only move quality markers could not attach',err)}
})();
