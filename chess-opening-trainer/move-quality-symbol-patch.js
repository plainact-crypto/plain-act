// Guided Training move-quality symbols for BOTH sides.
// One queue, one independent evaluation engine, no legacy text badges.
(function installQueuedMoveQualityMarkers(){
  try{
    if(globalThis.__COT_SYMBOL_ONLY_MOVE_QUALITY_QUEUE__) return;
    globalThis.__COT_SYMBOL_ONLY_MOVE_QUALITY_QUEUE__=true;

    const style=document.createElement('style');
    style.textContent=`
      #cotMoveQualityBadge{display:none!important;visibility:hidden!important}
      .cot-quality-symbol{position:fixed!important;z-index:18000!important;pointer-events:none!important;width:27px!important;height:27px!important;min-width:27px!important;padding:0!important;border:2px solid rgba(255,255,255,.94)!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font:900 13px/1 system-ui,-apple-system,Segoe UI,sans-serif!important;box-shadow:0 3px 9px rgba(0,0,0,.5)!important;transform:translate(-50%,-122%)!important;animation:cotQualityIn .12s ease-out}
      @keyframes cotQualityIn{from{opacity:0;transform:translate(-50%,-108%) scale(.75)}to{opacity:1;transform:translate(-50%,-122%) scale(1)}}
      .cot-q-brilliant{background:#1baca6!important}.cot-q-great{background:#5c8bb0!important}.cot-q-best{background:#81b64c!important}.cot-q-excellent{background:#96bc4b!important}.cot-q-good{background:#96af8b!important}.cot-q-inaccuracy{background:#f0c15c!important;color:#151515!important}.cot-q-mistake{background:#e6912c!important}.cot-q-blunder{background:#b33430!important}
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

    const evalForMover=(fen,result,mover)=>{
      if(!result) return null;
      const cp=Number(result.cp);if(!Number.isFinite(cp)) return null;
      const turn=String(fen||'').split(/\s+/)[1]||'w';
      const white=turn==='w'?cp:-cp;
      return mover==='w'?white:-white;
    };
    const uci=m=>m?`${m.from||''}${m.to||''}${m.promotion||''}`:'';
    const pos=square=>{
      const board=document.querySelector('#board');if(!board||!square)return null;
      const r=board.getBoundingClientRect();if(r.width<50||r.height<50)return null;
      const file=square.charCodeAt(0)-97,rank=Number(square[1]);if(file<0||file>7||rank<1||rank>8)return null;
      const black=state?.side==='black',col=black?7-file:file,row=black?rank-1:8-rank;
      return {x:r.left+(col+.68)*(r.width/8),y:r.top+(row+.24)*(r.height/8)};
    };

    let hideTimer=null,active=null;
    const clearSymbol=()=>{try{document.querySelector('#cotMoveQualitySymbol')?.remove()}catch{};if(hideTimer){clearTimeout(hideTimer);hideTimer=null}active=null};
    const show=(square,key)=>{
      clearSymbol();
      if(state?.screen!=='training'||state?.mode!=='guided') return;
      const p=pos(square);if(!p)return;
      const spec=symbols[key]||symbols.good;
      const el=document.createElement('div');el.id='cotMoveQualitySymbol';el.className=`cot-quality-symbol ${spec.cls}`;el.textContent=spec.symbol;el.setAttribute('aria-label',key);el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;document.body.appendChild(el);
      active={square,key};hideTimer=setTimeout(clearSymbol,2500);
    };

    async function classify(item){
      const engine=globalThis.__COT_EVAL_ENGINE_SERVICE__;
      if(!engine?.evaluate) return null;
      let waited=0;while(state?.engineBusy&&waited<2500){await new Promise(r=>setTimeout(r,50));waited+=50}
      const beforeResult=await engine.evaluate(item.beforeFen);
      const afterResult=await engine.evaluate(item.afterFen);
      const before=evalForMover(item.beforeFen,beforeResult,item.move.color);
      const after=evalForMover(item.afterFen,afterResult,item.move.color);
      if(before==null||after==null)return null;
      const loss=Math.max(0,before-after);

      let isBest=false;
      if(loss<=30&&typeof engine.bestMove==='function'){
        try{const best=String(await engine.bestMove(item.beforeFen)||'').trim().split(/\s+/)[0];isBest=!!best&&best===uci(item.move)}catch{}
      }

      if(isBest){
        const san=String(item.move.san||'');
        const forcing=/[x+#=]/.test(san);
        if(forcing&&loss<=5&&before<-120) return 'brilliant';
        if(forcing&&loss<=8) return 'great';
        return 'best';
      }
      if(loss<=25)return 'excellent';
      if(loss<=60)return 'good';
      if(loss<=120)return 'inaccuracy';
      if(loss<=250)return 'mistake';
      return 'blunder';
    }

    const queue=[];let processing=false;
    async function processQueue(){
      if(processing)return;processing=true;
      try{
        while(queue.length){
          const item=queue.shift();
          if(state?.screen!=='training'||state?.mode!=='guided'){queue.length=0;break}
          const key=await classify(item);
          if(key&&state?.screen==='training'&&state?.mode==='guided')show(item.move.to,key);
          await new Promise(r=>setTimeout(r,80));
        }
      }finally{processing=false}
    }

    let lastLen=-1,lastFen='';
    function detect(){
      try{
        document.querySelector('#cotMoveQualityBadge')?.remove();
        if(state?.screen!=='training'||state?.mode!=='guided'){lastLen=-1;lastFen='';queue.length=0;clearSymbol();return}
        const fen=state?.chess?.fen?.()||'';
        const hist=state?.chess?.history?.({verbose:true})||[];
        if(lastLen<0){lastLen=hist.length;lastFen=fen;return}
        if(hist.length===lastLen+1&&lastFen){
          queue.push({beforeFen:lastFen,afterFen:fen,move:{...hist[hist.length-1]}});
          processQueue();
        }else if(hist.length!==lastLen){queue.length=0;clearSymbol()}
        lastLen=hist.length;lastFen=fen;
      }catch{}
    }

    setInterval(detect,45);
    const obs=new MutationObserver(()=>queueMicrotask(detect));obs.observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('resize',()=>{if(active){const a={...active};show(a.square,a.key)}},{passive:true});
    window.addEventListener('scroll',()=>{if(active){const a={...active};show(a.square,a.key)}},{passive:true});
    detect();
  }catch(err){console.warn('Queued move-quality markers could not attach',err)}
})();
