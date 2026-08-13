// Guided Training move-quality symbols for BOTH sides.
// Every move is graded after it is played by the independent evaluation engine.
// Symbol only, shown briefly above the moved piece. No words ever paint on the board.
(function installSymbolOnlyMoveQualityMarkers(){
  try{
    if(globalThis.__COT_SYMBOL_ONLY_MOVE_QUALITY_V2__) return;
    globalThis.__COT_SYMBOL_ONLY_MOVE_QUALITY_V2__=true;

    const style=document.createElement('style');
    style.textContent=`
      /* Kill the old text badge completely. */
      #cotMoveQualityBadge{display:none!important;visibility:hidden!important}
      .cot-quality-symbol{
        position:fixed!important;z-index:18000!important;pointer-events:none!important;
        width:26px!important;height:26px!important;min-width:26px!important;padding:0!important;
        border:2px solid rgba(255,255,255,.94)!important;border-radius:50%!important;
        display:flex!important;align-items:center!important;justify-content:center!important;
        color:#fff!important;font:900 13px/1 system-ui,-apple-system,Segoe UI,sans-serif!important;
        box-shadow:0 3px 9px rgba(0,0,0,.5)!important;white-space:nowrap!important;
        transform:translate(-50%,-118%)!important;
        animation:cotQualityIn .12s ease-out;
      }
      @keyframes cotQualityIn{from{opacity:0;transform:translate(-50%,-105%) scale(.75)}to{opacity:1;transform:translate(-50%,-118%) scale(1)}}
      .cot-q-brilliant{background:#26c2a3!important}
      .cot-q-great{background:#5c8bb0!important}
      .cot-q-best,.cot-q-excellent{background:#9eba5a!important}
      .cot-q-good{background:#96af8b!important}
      .cot-q-inaccuracy{background:#f0c15c!important;color:#151515!important}
      .cot-q-mistake{background:#e6912c!important}
      .cot-q-blunder{background:#b33430!important}
      @media(max-width:700px){.cot-quality-symbol{width:23px!important;height:23px!important;min-width:23px!important;font-size:11px!important}}
    `;
    document.head.appendChild(style);

    const symbols={
      brilliant:{symbol:'!!',cls:'cot-q-brilliant'},
      great:{symbol:'!',cls:'cot-q-great'},
      best:{symbol:'★',cls:'cot-q-best'},
      excellent:{symbol:'✓',cls:'cot-q-excellent'},
      good:{symbol:'✓',cls:'cot-q-good'},
      inaccuracy:{symbol:'?!',cls:'cot-q-inaccuracy'},
      mistake:{symbol:'?',cls:'cot-q-mistake'},
      blunder:{symbol:'??',cls:'cot-q-blunder'}
    };

    const evalWhite=(fen,result)=>{
      if(!result) return null;
      const cp=Number(result.cp);
      if(!Number.isFinite(cp)) return null;
      const turn=String(fen||'').split(/\s+/)[1]||'w';
      return turn==='w'?cp:-cp;
    };
    const moverEval=(fen,result,mover)=>{
      const w=evalWhite(fen,result);
      return w==null?null:(mover==='w'?w:-w);
    };
    const playedUci=m=>m?`${m.from||''}${m.to||''}${m.promotion||''}`:'';
    const moveFromLine=x=>{
      if(!x) return '';
      if(typeof x==='string') return x.trim().split(/\s+/)[0]||'';
      return String(x.move||x.uci||x.bestMove||x.pv||'').trim().split(/\s+/)[0]||'';
    };
    const scoreFromLine=(x,mover)=>{
      if(!x||typeof x==='string') return null;
      const cp=Number(x.cp);
      if(!Number.isFinite(cp)) return null;
      return mover==='w'?cp:-cp;
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
      return {x:r.left+(col+.67)*(r.width/8),y:r.top+(row+.26)*(r.height/8)};
    };

    let hideTimer=null;
    let active=null;
    const clear=()=>{
      try{document.querySelector('#cotMoveQualitySymbol')?.remove()}catch{}
      if(hideTimer){clearTimeout(hideTimer);hideTimer=null}
      active=null;
    };
    const show=(square,key)=>{
      clear();
      if(state?.screen!=='training'||state?.mode!=='guided') return;
      const p=squarePosition(square);if(!p)return;
      const spec=symbols[key]||symbols.good;
      const el=document.createElement('div');
      el.id='cotMoveQualitySymbol';
      el.className=`cot-quality-symbol ${spec.cls}`;
      el.textContent=spec.symbol;
      el.setAttribute('aria-label',key);
      el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;
      document.body.appendChild(el);
      active={square,key};
      hideTimer=setTimeout(clear,2500);
    };

    // Same grading rules for White and Black. Great is reserved for an engine-best move
    // that is effectively the only strong move (second line materially worse when available).
    async function classifyMove(beforeFen,afterFen,move,seq){
      const engine=globalThis.__COT_EVAL_ENGINE_SERVICE__;
      if(!engine?.evaluate||!beforeFen||!afterFen||!move) return null;
      const mover=move.color;
      const uci=playedUci(move);

      let waited=0;
      while(state?.engineBusy&&waited<3000){await new Promise(r=>setTimeout(r,50));waited+=50}
      if(seq!==gradeSeq) return null;

      const [beforeResult,afterResult]=await Promise.all([
        engine.evaluate(beforeFen),engine.evaluate(afterFen)
      ]);
      if(seq!==gradeSeq) return null;
      const before=moverEval(beforeFen,beforeResult,mover);
      const after=moverEval(afterFen,afterResult,mover);
      if(before==null||after==null) return null;
      const loss=Math.max(0,before-after);

      let bestMove='';
      try{bestMove=String(await engine.bestMove(beforeFen)||'').trim().split(/\s+/)[0]}catch{}
      if(seq!==gradeSeq) return null;
      const isBest=bestMove && uci===bestMove;

      // Great: exact engine best AND clearly unique/critical when MultiPV data is available.
      if(isBest&&typeof engine.topMoves==='function'){
        try{
          const lines=await engine.topMoves(beforeFen,3);
          if(seq!==gradeSeq) return null;
          if(Array.isArray(lines)&&lines.length>1){
            const first=lines.find(x=>moveFromLine(x)===uci)||lines[0];
            const second=lines.find(x=>moveFromLine(x)!==uci);
            const s1=scoreFromLine(first,mover),s2=scoreFromLine(second,mover);
            if(s1!=null&&s2!=null&&s1-s2>=120) return 'great';
          }
        }catch{}
      }

      if(isBest) return 'best';
      if(loss<=25) return 'excellent';
      if(loss<=60) return 'good';
      if(loss<=120) return 'inaccuracy';
      if(loss<=250) return 'mistake';
      return 'blunder';
    }

    let lastLen=-1;
    let lastFen='';
    let gradeSeq=0;

    async function gradeDetectedMove(beforeFen,afterFen,move,seq){
      try{
        const key=await classifyMove(beforeFen,afterFen,move,seq);
        if(seq!==gradeSeq||!key) return;
        show(move.to,key);
      }catch(err){console.warn('Move-quality grading failed',err)}
    }

    function watchMoves(){
      try{
        // Always suppress any legacy word badge, even if its old analyzer recreates it.
        document.querySelector('#cotMoveQualityBadge')?.remove();
        if(state?.screen!=='training'||state?.mode!=='guided'){
          lastLen=-1;lastFen='';gradeSeq++;clear();return;
        }
        const fen=state?.chess?.fen?.()||'';
        const hist=state?.chess?.history?.({verbose:true})||[];
        if(lastLen<0){lastLen=hist.length;lastFen=fen;return}
        if(hist.length===lastLen+1&&lastFen){
          const move=hist[hist.length-1];
          const beforeFen=lastFen,afterFen=fen;
          const seq=++gradeSeq;
          clear();
          gradeDetectedMove(beforeFen,afterFen,move,seq);
        }else if(hist.length!==lastLen){
          // Restart/jump/multiple changes: reset baseline instead of showing a wrong badge.
          gradeSeq++;clear();
        }
        lastLen=hist.length;
        lastFen=fen;
      }catch{}
    }

    // Fast watcher catches user and opponent moves before another move changes the baseline.
    const timer=setInterval(watchMoves,45);
    const obs=new MutationObserver(()=>queueMicrotask(watchMoves));
    obs.observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('resize',()=>{if(active){const a={...active};show(a.square,a.key)}},{passive:true});
    window.addEventListener('scroll',()=>{if(active){const a={...active};show(a.square,a.key)}},{passive:true});
    watchMoves();
  }catch(err){console.warn('Symbol-only move quality markers V2 could not attach',err)}
})();
