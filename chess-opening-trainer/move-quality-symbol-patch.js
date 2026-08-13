// Guided Training: symbol-only move quality markers for BOTH sides.
// User moves reuse the existing move-quality analysis; opponent engine moves are best-move selections.
(function installSymbolOnlyMoveQualityMarkers(){
  try{
    if(globalThis.__COT_SYMBOL_ONLY_MOVE_QUALITY__) return;
    globalThis.__COT_SYMBOL_ONLY_MOVE_QUALITY__=true;

    const style=document.createElement('style');
    style.textContent=`
      .cot-move-quality-badge{
        width:24px!important;height:24px!important;min-width:24px!important;
        padding:0!important;border:2px solid rgba(255,255,255,.88)!important;
        border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;
        color:#fff!important;font:900 12px/1 system-ui,-apple-system,Segoe UI,sans-serif!important;
        box-shadow:0 2px 8px rgba(0,0,0,.48)!important;white-space:nowrap!important;
        transform:translate(-50%,-118%)!important;
      }
      .cot-quality-best{background:#20b26b!important}
      .cot-quality-excellent{background:#24a8e0!important}
      .cot-quality-good{background:#74b957!important}
      .cot-quality-inaccuracy{background:#e5b93f!important;color:#151515!important}
      .cot-quality-mistake{background:#e78532!important}
      .cot-quality-blunder{background:#d84c4c!important}
      @media(max-width:700px){.cot-move-quality-badge{width:21px!important;height:21px!important;min-width:21px!important;font-size:10px!important}}
    `;
    document.head.appendChild(style);

    const userColor=()=>state?.side==='black'?'b':'w';
    const symbolMap={
      best:{symbol:'★',cls:'cot-quality-best'},
      excellent:{symbol:'✓',cls:'cot-quality-excellent'},
      good:{symbol:'●',cls:'cot-quality-good'},
      inaccuracy:{symbol:'?!',cls:'cot-quality-inaccuracy'},
      mistake:{symbol:'?',cls:'cot-quality-mistake'},
      blunder:{symbol:'??',cls:'cot-quality-blunder'}
    };

    const inferKey=text=>{
      const t=String(text||'').toLowerCase();
      if(t.includes('blunder')) return 'blunder';
      if(t.includes('mistake')) return 'mistake';
      if(t.includes('inaccuracy')) return 'inaccuracy';
      if(t.includes('excellent')) return 'excellent';
      if(t.includes('good')) return 'good';
      return 'best';
    };

    function squarePosition(square){
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
      return {x:r.left+(col+.5)*(r.width/8),y:r.top+(row+.30)*(r.height/8)};
    }

    function decorateBadge(b,key){
      if(!b) return;
      const spec=symbolMap[key]||symbolMap.best;
      b.classList.remove(...Object.values(symbolMap).map(x=>x.cls));
      b.classList.add(spec.cls);
      b.textContent=spec.symbol;
      b.setAttribute('aria-label',key);
      b.title='';
    }

    function showOpponentBest(square){
      try{
        if(state?.screen!=='training'||state?.mode!=='guided') return;
        const p=squarePosition(square);if(!p)return;
        document.querySelector('#cotMoveQualityBadge')?.remove();
        const b=document.createElement('div');
        b.id='cotMoveQualityBadge';b.className='cot-move-quality-badge cot-quality-best';
        b.textContent='★';b.setAttribute('aria-label','best');
        b.style.left=`${p.x}px`;b.style.top=`${p.y}px`;
        document.body.appendChild(b);
      }catch{}
    }

    // Convert the existing user badge from "★ Best" etc. into symbol-only colored markers.
    let converting=false;
    const convertExisting=()=>{
      if(converting) return;
      converting=true;
      try{
        const b=document.querySelector('#cotMoveQualityBadge');
        if(!b) return;
        const existing=b.getAttribute('aria-label');
        const key=existing&&symbolMap[existing]?existing:inferKey(b.textContent);
        decorateBadge(b,key);
      }finally{converting=false}
    };

    let lastLen=-1;
    function watchMoves(){
      try{
        if(state?.screen!=='training'||state?.mode!=='guided'){
          lastLen=-1;document.querySelector('#cotMoveQualityBadge')?.remove();return;
        }
        const hist=state?.chess?.history?.({verbose:true})||[];
        if(lastLen<0){lastLen=hist.length;convertExisting();return}
        if(hist.length>lastLen){
          const last=hist[hist.length-1];
          document.querySelector('#cotMoveQualityBadge')?.remove();
          if(last?.color!==userColor()) showOpponentBest(last?.to);
          // User marker is created asynchronously by the existing quality analyzer,
          // then converted to a symbol by the MutationObserver below.
        }
        lastLen=hist.length;
        convertExisting();
      }catch{}
    }

    const obs=new MutationObserver(()=>queueMicrotask(()=>{watchMoves();convertExisting()}));
    obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    window.addEventListener('resize',watchMoves,{passive:true});
    window.addEventListener('scroll',watchMoves,{passive:true});
    setInterval(watchMoves,180);
    watchMoves();
  }catch(err){console.warn('Symbol-only move quality markers could not attach',err)}
})();
