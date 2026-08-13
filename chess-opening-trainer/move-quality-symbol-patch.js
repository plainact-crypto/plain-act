// Guided Training move-quality symbols for BOTH sides.
// Dedicated quality engine + best-reply continuation review.
(function installExpectedPointsMoveQuality(){
  try{
    if(globalThis.__COT_MOVE_QUALITY_EXPECTED_POINTS__) return;
    globalThis.__COT_MOVE_QUALITY_EXPECTED_POINTS__=true;

    const QUALITY_DEPTH=16;
    const CONTINUATION_DEPTH=14;

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
    const moveUci=m=>m?`${m.from||''}${m.to||''}${m.promotion||''}`:'';
    const pieceValues={p:1,n:3,b:3,r:5,q:9,k:0};

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

    const cache=new Map();
    const engine=()=>globalThis.__COT_MOVE_QUALITY_ENGINE_SERVICE__;
    const fenAfterUci=(fen,uci)=>{
      try{
        if(typeof Chess!=='function'||!fen||!uci||uci.length<4)return '';
        const g=new Chess(fen);
        const m=g.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});
        return m?g.fen():'';
      }catch{return ''}
    };
    const median=values=>{
      const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
      if(!a.length)return null;
      const m=Math.floor(a.length/2);
      return a.length%2?a[m]:(a[m-1]+a[m])/2;
    };

    function prime(fen){
      if(!fen||cache.has(fen)) return cache.get(fen)||null;
      const e=engine();if(!e?.evaluate)return null;
      const promise=(async()=>{
        const evaluation=await e.evaluate(fen,QUALITY_DEPTH);
        let best='';try{best=String(await e.bestMove(fen,QUALITY_DEPTH)||'').trim().split(/\s+/)[0]}catch{}
        let top=[];try{if(typeof e.topMoves==='function')top=await e.topMoves(fen,3,CONTINUATION_DEPTH)||[]}catch{}
        return {evaluation,best,top};
      })().catch(()=>null);
      cache.set(fen,promise);
      if(cache.size>18){const first=cache.keys().next().value;cache.delete(first)}
      return promise;
    }

    async function reviewedOutcome(fen,mover){
      const e=engine();if(!e?.evaluate)return null;
      const directResult=await e.evaluate(fen,QUALITY_DEPTH);
      const directCp=cpForMover(fen,directResult,mover);
      let bestReply='';
      try{bestReply=String(await e.bestMove(fen,QUALITY_DEPTH)||'').trim().split(/\s+/)[0]}catch{}
      const replyFen=fenAfterUci(fen,bestReply);
      let replyResult=null,replyCp=null,continuation='',continuationFen='',continuationResult=null,continuationCp=null;
      if(replyFen){
        replyResult=await e.evaluate(replyFen,QUALITY_DEPTH);
        replyCp=cpForMover(replyFen,replyResult,mover);
        try{continuation=String(await e.bestMove(replyFen,CONTINUATION_DEPTH)||'').trim().split(/\s+/)[0]}catch{}
        continuationFen=fenAfterUci(replyFen,continuation);
        if(continuationFen){
          continuationResult=await e.evaluate(continuationFen,CONTINUATION_DEPTH);
          continuationCp=cpForMover(continuationFen,continuationResult,mover);
        }
      }
      const stableCp=median([directCp,replyCp,continuationCp]);
      return {stableCp,directCp,replyCp,continuationCp,bestReply,replyFen,continuation,continuationFen,directResult,replyResult,continuationResult};
    }

    const measurableSacrifice=(item,review)=>{
      try{
        const movedValue=pieceValues[String(item.move?.piece||'')]||0;
        const capturedValue=pieceValues[String(item.move?.captured||'')]||0;
        if(movedValue<3) return {isSac:false,net:0};
        const reply=String(review?.bestReply||'');
        if(!reply||reply.slice(2,4)!==item.move.to) return {isSac:false,net:0};
        const net=Math.max(0,movedValue-capturedValue);
        return {isSac:net>=1.5,net};
      }catch{return {isSac:false,net:0}}
    };

    async function criticalBestMoveGap(item,beforePack,playedAfterEP){
      try{
        if(!Array.isArray(beforePack.top)||beforePack.top.length<2)return false;
        const played=moveUci(item.move);
        const alternatives=beforePack.top.map(x=>String(typeof x==='string'?x:(x?.move||x?.uci||x?.bestMove||'')).trim().split(/\s+/)[0]).filter(Boolean).filter(x=>x!==played);
        const second=alternatives[0];if(!second)return false;
        const altFen=fenAfterUci(item.beforeFen,second);if(!altFen)return false;
        const altReview=await reviewedOutcome(altFen,item.move.color);if(altReview?.stableCp==null)return false;
        const altEP=expectedPoints(altReview.stableCp);
        return (playedAfterEP-altEP>=0.10)||(playedAfterEP>=0.50&&altEP<0.50);
      }catch{return false}
    }

    async function classify(item){
      const e=engine();if(!e?.evaluate)return null;
      const beforePack=await (prime(item.beforeFen)||Promise.resolve(null));
      if(!beforePack)return null;
      const mover=item.move.color;
      const beforeCp=cpForMover(item.beforeFen,beforePack.evaluation,mover);
      if(beforeCp==null)return null;

      // Review the played move through the opponent's best reply and one continuation ply.
      // This avoids grading from a shallow snapshot immediately after the move.
      const review=await reviewedOutcome(item.afterFen,mover);
      if(review?.stableCp==null)return null;
      const beforeEP=expectedPoints(beforeCp),afterEP=expectedPoints(review.stableCp);
      const epLoss=Math.max(0,beforeEP-afterEP);
      const played=moveUci(item.move);
      const isBest=!!beforePack.best&&played===beforePack.best;

      const sacrifice=measurableSacrifice(item,review);
      if((isBest||epLoss<=0.02)&&sacrifice.isSac&&afterEP>=0.40&&beforeEP<=0.90) return 'brilliant';
      if(isBest&&await criticalBestMoveGap(item,beforePack,afterEP)) return 'great';
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
        prime(fen);
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
