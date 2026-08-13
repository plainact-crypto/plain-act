// Guided Training move-quality symbols for BOTH sides.
// Dedicated quality engine + transparent Expected-Points classification.
(function installExpectedPointsMoveQuality(){
  try{
    if(globalThis.__COT_MOVE_QUALITY_EXPECTED_POINTS__) return;
    globalThis.__COT_MOVE_QUALITY_EXPECTED_POINTS__=true;

    const style=document.createElement('style');
    style.textContent=`
      #cotMoveQualityBadge{display:none!important;visibility:hidden!important}
      .cot-quality-symbol{position:fixed!important;z-index:18000!important;pointer-events:none!important;width:28px!important;height:28px!important;min-width:28px!important;padding:0!important;border:2px solid rgba(255,255,255,.94)!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font:900 13px/1 system-ui,-apple-system,Segoe UI,sans-serif!important;box-shadow:0 3px 10px rgba(0,0,0,.52)!important;transform:translate(-50%,-122%)!important;animation:cotQualityIn .12s ease-out}
      @keyframes cotQualityIn{from{opacity:0;transform:translate(-50%,-108%) scale(.75)}to{opacity:1;transform:translate(-50%,-122%) scale(1)}}
      .cot-q-brilliant{background:#1baca6!important}.cot-q-great{background:#5c8bb0!important}.cot-q-best{background:#81b64c!important}.cot-q-excellent{background:#96bc4b!important}.cot-q-good{background:#96af8b!important}.cot-q-inaccuracy{background:#f0c15c!important;color:#151515!important}.cot-q-mistake{background:#e6912c!important}.cot-q-blunder{background:#b33430!important}
      @media(max-width:700px){.cot-quality-symbol{width:24px!important;height:24px!important;min-width:24px!important;font-size:11px!important}}
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

    // Transparent CP -> expected-points curve. Output is 0..1 from mover POV.
    // Classification cutoffs then follow Chess.com's published Expected Points bands.
    const expectedPoints=cp=>{
      const x=Math.max(-1000,Math.min(1000,Number(cp)||0));
      return 1/(1+Math.exp(-0.00368208*x));
    };
    const cpForMover=(fen,result,mover)=>{
      if(!result) return null;
      let cp=Number(result.cp);
      if(!Number.isFinite(cp)){
        const mate=Number(result.mate);
        if(!Number.isFinite(mate)) return null;
        cp=mate>0?1000:-1000;
      }
      const turn=String(fen||'').split(/\s+/)[1]||'w';
      const white=turn==='w'?cp:-cp;
      return mover==='w'?white:-white;
    };
    const lineMove=x=>{
      if(!x) return '';
      if(typeof x==='string') return x.trim().split(/\s+/)[0]||'';
      return String(x.move||x.uci||x.bestMove||x.pv||'').trim().split(/\s+/)[0]||'';
    };
    const lineCp=(fen,x,mover)=>{
      if(!x||typeof x==='string') return null;
      return cpForMover(fen,{cp:x.cp,mate:x.mate},mover);
    };
    const moveUci=m=>m?`${m.from||''}${m.to||''}${m.promotion||''}`:'';

    const squarePosition=square=>{
      const board=document.querySelector('#board');if(!board||!square)return null;
      const r=board.getBoundingClientRect();if(r.width<50||r.height<50)return null;
      const file=square.charCodeAt(0)-97,rank=Number(square[1]);if(file<0||file>7||rank<1||rank>8)return null;
      const black=state?.side==='black',col=black?7-file:file,row=black?rank-1:8-rank;
      return {x:r.left+(col+.68)*(r.width/8),y:r.top+(row+.23)*(r.height/8)};
    };

    const activeByColor={w:null,b:null};
    const timerByColor={w:null,b:null};
    const clearColor=color=>{
      try{document.querySelector(`#cotMoveQualitySymbol-${color}`)?.remove()}catch{}
      if(timerByColor[color]){clearTimeout(timerByColor[color]);timerByColor[color]=null}
      activeByColor[color]=null;
    };
    const show=(square,key,color)=>{
      clearColor(color);
      if(state?.screen!=='training'||state?.mode!=='guided') return;
      const p=squarePosition(square);if(!p)return;
      const spec=symbols[key]||symbols.good;
      const el=document.createElement('div');
      el.id=`cotMoveQualitySymbol-${color}`;el.className=`cot-quality-symbol ${spec.cls}`;el.textContent=spec.symbol;el.setAttribute('aria-label',key);el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;document.body.appendChild(el);
      activeByColor[color]={square,key,color};
      timerByColor[color]=setTimeout(()=>clearColor(color),4000);
    };

    const pieceValues={p:1,n:3,b:3,r:5,q:9,k:0};
    const isGoodSacrifice=item=>{
      try{
        const piece=String(item.move?.piece||'');
        if((pieceValues[piece]||0)<3||typeof Chess!=='function') return false;
        const g=new Chess(item.afterFen);
        const replies=g.moves({verbose:true})||[];
        return replies.some(m=>m.to===item.move.to&&m.captured&&pieceValues[piece]>=3);
      }catch{return false}
    };

    const cache=new Map();
    const engine=()=>globalThis.__COT_MOVE_QUALITY_ENGINE_SERVICE__;
    function prime(fen){
      if(!fen||cache.has(fen)) return cache.get(fen)||null;
      const e=engine();if(!e?.evaluate)return null;
      const promise=(async()=>{
        const evaluation=await e.evaluate(fen);
        let best='';try{best=String(await e.bestMove(fen)||'').trim().split(/\s+/)[0]}catch{}
        let top=[];try{if(typeof e.topMoves==='function')top=await e.topMoves(fen,3)||[]}catch{}
        return {evaluation,best,top};
      })().catch(()=>null);
      cache.set(fen,promise);
      if(cache.size>18){const first=cache.keys().next().value;cache.delete(first)}
      return promise;
    }

    async function classify(item){
      const e=engine();if(!e?.evaluate)return null;
      const beforePack=await (prime(item.beforeFen)||Promise.resolve(null));
      if(!beforePack)return null;
      const afterResult=await e.evaluate(item.afterFen);
      const mover=item.move.color;
      const beforeCp=cpForMover(item.beforeFen,beforePack.evaluation,mover);
      const afterCp=cpForMover(item.afterFen,afterResult,mover);
      if(beforeCp==null||afterCp==null)return null;
      const beforeEP=expectedPoints(beforeCp),afterEP=expectedPoints(afterCp);
      const epLoss=Math.max(0,beforeEP-afterEP);
      const played=moveUci(item.move);
      const isBest=!!beforePack.best&&played===beforePack.best;

      // Brilliant: best/nearly-best, genuine non-pawn material offer, position remains viable,
      // and the player was not already completely winning.
      if((isBest||epLoss<=0.02)&&isGoodSacrifice(item)&&afterEP>=0.40&&beforeEP<=0.90) return 'brilliant';

      // Great: exact best move and clearly critical/unique. Compare against the next engine line.
      if(isBest&&Array.isArray(beforePack.top)&&beforePack.top.length>1){
        const lines=beforePack.top;
        const bestLine=lines.find(x=>lineMove(x)===played)||lines[0];
        const second=lines.find(x=>lineMove(x)!==played);
        const bestCp=lineCp(item.beforeFen,bestLine,mover),secondCp=lineCp(item.beforeFen,second,mover);
        if(bestCp!=null&&secondCp!=null){
          const bestEP=expectedPoints(bestCp),secondEP=expectedPoints(secondCp);
          if(bestEP-secondEP>=0.10||(bestEP>=0.50&&secondEP<0.50)) return 'great';
        }
      }

      if(isBest) return 'best';
      if(epLoss<=0.02) return 'excellent';
      if(epLoss<=0.05) return 'good';
      if(epLoss<=0.10) return 'inaccuracy';
      if(epLoss<=0.20) return 'mistake';
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
          if(key&&state?.screen==='training'&&state?.mode==='guided') show(item.move.to,key,item.move.color);
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
        prime(fen); // pre-analyze the current position before the next move is played.
        if(lastLen<0){lastLen=hist.length;lastFen=fen;return}
        if(hist.length===lastLen+1&&lastFen){
          queue.push({beforeFen:lastFen,afterFen:fen,move:{...hist[hist.length-1]}});
          processQueue();
        }else if(hist.length!==lastLen){queue.length=0}
        lastLen=hist.length;lastFen=fen;
      }catch{}
    }

    setInterval(detect,90);
    const obs=new MutationObserver(()=>queueMicrotask(detect));obs.observe(document.documentElement,{childList:true,subtree:true});
    const reposition=()=>{
      for(const c of ['w','b']){
        const a=activeByColor[c];if(!a)continue;
        const p=squarePosition(a.square),el=document.querySelector(`#cotMoveQualitySymbol-${c}`);
        if(p&&el){el.style.left=`${p.x}px`;el.style.top=`${p.y}px`}
      }
    };
    window.addEventListener('resize',reposition,{passive:true});window.addEventListener('scroll',reposition,{passive:true});
    detect();
  }catch(err){console.warn('Expected-points move-quality system could not attach',err)}
})();

// Final Guided status sizing: one visible line only.
(function lockGuidedStatusToOneLine(){
  try{
    if(globalThis.__COT_GUIDED_STATUS_ONE_LINE__) return;
    globalThis.__COT_GUIDED_STATUS_ONE_LINE__=true;
    const style=document.createElement('style');
    style.textContent=`.cot-guided-status-fixed,.cot-training-status-scroll{height:40px!important;min-height:40px!important;max-height:40px!important;box-sizing:border-box!important;white-space:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;display:flex!important;align-items:center!important;scrollbar-width:thin!important}`;
    document.head.appendChild(style);
    const apply=()=>{
      if(state?.screen!=='training'||state?.mode!=='guided') return;
      const panels=[...document.querySelectorAll('.side-panel,aside')];
      for(const panel of panels){
        for(const el of [...panel.querySelectorAll('div,section,p')]){
          const t=String(el.textContent||'').trim();
          if(!/^(Your move|Opponent move|Engine|Thinking|Loading|Choosing)/i.test(t)) continue;
          if(/Live Position Coach/i.test(t)||/Restart|Exit/i.test(t)) continue;
          const r=el.getBoundingClientRect();if(r.width>180&&r.height>24&&r.height<120){el.classList.add('cot-guided-status-fixed');break}
        }
      }
    };
    const obs=new MutationObserver(()=>queueMicrotask(apply));obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true});apply();
  }catch(err){console.warn('Guided one-line status lock could not attach',err)}
})();
