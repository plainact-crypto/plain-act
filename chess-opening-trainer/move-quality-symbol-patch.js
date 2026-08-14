// P0 Trust Fix: conservative Guided move-quality classification.
// Great/Brilliant are intentionally disabled until a separately verifiable standard exists.
(function installConservativeMoveQuality(){
  try{
    if(globalThis.__COT_MOVE_QUALITY_TRUST_FIX__) return;
    globalThis.__COT_MOVE_QUALITY_TRUST_FIX__=true;
    globalThis.__COT_SYMBOL_ONLY_MOVE_QUALITY__=true;
    globalThis.__COT_GUIDED_MOVE_QUALITY_SYMBOLS__=true;

    const DEPTH=14;
    const symbols={
      best:{symbol:'★',cls:'cot-q-best'},
      good:{symbol:'✓',cls:'cot-q-good'},
      inaccuracy:{symbol:'?!',cls:'cot-q-inaccuracy'},
      mistake:{symbol:'?',cls:'cot-q-mistake'},
      blunder:{symbol:'??',cls:'cot-q-blunder'}
    };
    const style=document.createElement('style');
    style.textContent=`
      #cotMoveQualityBadge{display:none!important;visibility:hidden!important}
      .cot-quality-symbol{position:fixed!important;z-index:18000!important;pointer-events:none!important;width:28px!important;height:28px!important;min-width:28px!important;padding:0!important;border:2px solid rgba(255,255,255,.94)!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font:900 13px/1 system-ui,-apple-system,Segoe UI,sans-serif!important;box-shadow:0 3px 10px rgba(0,0,0,.52)!important;transform:translate(-50%,-122%)!important}
      .cot-q-best{background:#81b64c!important}.cot-q-good{background:#96af8b!important}.cot-q-inaccuracy{background:#f0c15c!important;color:#151515!important}.cot-q-mistake{background:#e6912c!important}.cot-q-blunder{background:#b33430!important}
      @media(max-width:700px){.cot-quality-symbol{width:24px!important;height:24px!important;min-width:24px!important;font-size:11px!important}}
    `;
    document.head.appendChild(style);

    const resultCp=(result)=>{
      if(!result)return null;
      const cp=Number(result.cp);
      if(Number.isFinite(cp))return cp;
      const mate=Number(result.mate);
      if(Number.isFinite(mate))return mate>0?100000:-100000;
      return null;
    };
    const moverCp=(fen,result,mover)=>{
      const cp=resultCp(result);if(cp==null)return null;
      const turn=String(fen||'').split(/\s+/)[1]||'w';
      const whiteCp=turn==='w'?cp:-cp;
      return mover==='w'?whiteCp:-whiteCp;
    };
    const classifyLoss=(lossCp)=>{
      const loss=Math.max(0,Number(lossCp)||0);
      if(loss<=20)return 'best';
      if(loss<=70)return 'good';
      if(loss<=140)return 'inaccuracy';
      if(loss<=300)return 'mistake';
      return 'blunder';
    };
    globalThis.__COT_CLASSIFY_MOVE_LOSS__=classifyLoss;

    const squarePosition=square=>{
      const board=document.querySelector('#board');if(!board||!square)return null;
      const r=board.getBoundingClientRect();if(r.width<50||r.height<50)return null;
      const file=square.charCodeAt(0)-97,rank=Number(square[1]);if(file<0||file>7||rank<1||rank>8)return null;
      const black=state?.side==='black',col=black?7-file:file,row=black?rank-1:8-rank;
      return {x:r.left+(col+.68)*(r.width/8),y:r.top+(row+.23)*(r.height/8)};
    };
    const active={w:null,b:null},timers={w:null,b:null};
    const clearColor=color=>{
      try{document.querySelector(`#cotMoveQualitySymbol-${color}`)?.remove()}catch{}
      if(timers[color]){clearTimeout(timers[color]);timers[color]=null}
      active[color]=null;
    };
    const show=(square,key,color)=>{
      clearColor(color);
      if(state?.screen!=='training'||state?.mode!=='guided')return;
      const p=squarePosition(square);if(!p)return;
      const spec=symbols[key]||symbols.good;
      const el=document.createElement('div');
      el.id=`cotMoveQualitySymbol-${color}`;el.className=`cot-quality-symbol ${spec.cls}`;el.textContent=spec.symbol;el.setAttribute('aria-label',key);el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;document.body.appendChild(el);
      active[color]={square,key};timers[color]=setTimeout(()=>clearColor(color),3000);
    };

    const engine=()=>globalThis.__COT_MOVE_QUALITY_ENGINE_SERVICE__||globalThis.__COT_EVAL_ENGINE_SERVICE__;
    const cache=new Map();
    const evaluate=fen=>{
      if(!fen)return Promise.resolve(null);
      if(!cache.has(fen)){
        const e=engine();
        const p=e?.evaluate?Promise.resolve(e.evaluate(fen,DEPTH)).catch(()=>null):Promise.resolve(null);
        cache.set(fen,p);if(cache.size>40)cache.delete(cache.keys().next().value);
      }
      return cache.get(fen);
    };
    async function classify(item){
      const [beforeResult,afterResult]=await Promise.all([evaluate(item.beforeFen),evaluate(item.afterFen)]);
      const before=moverCp(item.beforeFen,beforeResult,item.move.color);
      const after=moverCp(item.afterFen,afterResult,item.move.color);
      if(before==null||after==null)return null;
      return classifyLoss(Math.max(0,before-after));
    }

    const queue=[];let processing=false;
    async function processQueue(){
      if(processing)return;processing=true;
      try{
        while(queue.length){
          const item=queue.shift();
          if(state?.screen!=='training'||state?.mode!=='guided'){queue.length=0;break}
          const key=await classify(item);
          if(key&&state?.screen==='training'&&state?.mode==='guided')show(item.move.to,key,item.move.color);
        }
      }finally{processing=false}
    }

    let lastLen=-1,lastFen='';
    function detect(){
      try{
        document.querySelector('#cotMoveQualityBadge')?.remove();
        if(state?.screen!=='training'||state?.mode!=='guided'){
          lastLen=-1;lastFen='';queue.length=0;clearColor('w');clearColor('b');return;
        }
        const fen=state?.chess?.fen?.()||'';
        const hist=state?.chess?.history?.({verbose:true})||[];
        evaluate(fen);
        if(lastLen<0){lastLen=hist.length;lastFen=fen;return}
        if(hist.length===lastLen+1&&lastFen){queue.push({beforeFen:lastFen,afterFen:fen,move:{...hist[hist.length-1]}});processQueue()}
        else if(hist.length!==lastLen){queue.length=0}
        lastLen=hist.length;lastFen=fen;
      }catch{}
    }
    setInterval(detect,80);
    new MutationObserver(()=>queueMicrotask(detect)).observe(document.documentElement,{childList:true,subtree:true});
    const reposition=()=>{for(const c of ['w','b']){const a=active[c],el=document.querySelector(`#cotMoveQualitySymbol-${c}`);const p=a?squarePosition(a.square):null;if(p&&el){el.style.left=`${p.x}px`;el.style.top=`${p.y}px`}}};
    window.addEventListener('resize',reposition,{passive:true});window.addEventListener('scroll',reposition,{passive:true});
    detect();
  }catch(err){console.warn('Conservative move-quality system could not attach',err)}
})();

// Report #34: keep a visible chessboard frame on narrow mobile viewports.
// The frame is inset / box-sized so it cannot be clipped by the 384px layout or create horizontal overflow.
(function installMobileBoardFrame(){
  try{
    if(globalThis.__COT_MOBILE_BOARD_FRAME_34__) return;
    globalThis.__COT_MOBILE_BOARD_FRAME_34__=true;
    const style=document.createElement('style');
    style.textContent=`
      @media(max-width:760px){
        #board{
          box-sizing:border-box!important;
          border:2px solid #6f7d89!important;
          border-radius:4px!important;
          overflow:hidden!important;
          background:#6f7d89!important;
        }
        #board>.cm-chessboard,#board .cm-chessboard{
          box-sizing:border-box!important;
          max-width:100%!important;
        }
        .board-shell{box-sizing:border-box!important;max-width:100%!important;overflow:visible!important}
      }
    `;
    document.head.appendChild(style);
  }catch(err){console.warn('Mobile board frame patch could not attach',err)}
})();
