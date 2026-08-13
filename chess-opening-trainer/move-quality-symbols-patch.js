// Guided Training move-quality symbols: evaluate BOTH sides after each move using the
// independent evaluation engine. Symbols only; no words. The engine decides every grade.
(function installGuidedMoveQualitySymbols(){
  try{
    if(globalThis.__COT_GUIDED_MOVE_QUALITY_SYMBOLS__) return;
    globalThis.__COT_GUIDED_MOVE_QUALITY_SYMBOLS__=true;

    const style=document.createElement('style');
    style.textContent=`
      #cotMoveQualityBadge{display:none!important}
      .cot-quality-symbol{
        position:fixed;z-index:17500;pointer-events:none;
        min-width:24px;height:24px;padding:0 5px;border-radius:999px;
        display:flex;align-items:center;justify-content:center;
        font:900 15px/1 system-ui,-apple-system,Segoe UI,sans-serif;
        border:2px solid rgba(255,255,255,.92);
        box-shadow:0 2px 8px rgba(0,0,0,.45);
        transform:translate(-50%,-105%);
      }
      .cot-quality-best{background:#7a5cff;color:#fff}
      .cot-quality-excellent{background:#20b26b;color:#fff}
      .cot-quality-good{background:#38a3db;color:#fff}
      .cot-quality-inaccuracy{background:#f0a43a;color:#111}
      .cot-quality-mistake{background:#e66a3c;color:#fff}
      .cot-quality-blunder{background:#d64545;color:#fff}
      @media(max-width:700px){.cot-quality-symbol{min-width:20px;height:20px;font-size:12px;padding:0 4px}}
    `;
    document.head.appendChild(style);

    const symbols={
      best:{text:'★',cls:'cot-quality-best'},
      excellent:{text:'✓',cls:'cot-quality-excellent'},
      good:{text:'●',cls:'cot-quality-good'},
      inaccuracy:{text:'?!',cls:'cot-quality-inaccuracy'},
      mistake:{text:'?',cls:'cot-quality-mistake'},
      blunder:{text:'??',cls:'cot-quality-blunder'}
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
    const squareXY=(square)=>{
      const board=document.querySelector('#board');
      if(!board||!square) return null;
      const r=board.getBoundingClientRect();
      if(r.width<50||r.height<50) return null;
      const file=square.charCodeAt(0)-97;
      const rank=Number(square[1]);
      const black=state?.side==='black';
      const col=black?7-file:file;
      const row=black?rank-1:8-rank;
      return {
        x:r.left+(col+.68)*(r.width/8),
        y:r.top+(row+.28)*(r.height/8)
      };
    };
    let badge=null;
    let lastFen='';
    let lastHistLen=-1;
    let seq=0;

    const clear=()=>{try{badge?.remove()}catch{};badge=null;document.querySelector('#cotMoveQualityBadge')?.remove()};
    const place=(square,key)=>{
      clear();
      if(state?.screen!=='training'||state?.mode!=='guided') return;
      const p=squareXY(square); if(!p) return;
      const info=symbols[key]||symbols.good;
      const b=document.createElement('div');
      b.className=`cot-quality-symbol ${info.cls}`;
      b.setAttribute('aria-label',key);
      b.textContent=info.text;
      b.style.left=`${p.x}px`; b.style.top=`${p.y}px`;
      document.body.appendChild(b); badge=b;
    };

    async function gradeMove(beforeFen,afterFen,mover,to,mySeq){
      try{
        const engine=globalThis.__COT_EVAL_ENGINE_SERVICE__;
        if(!engine?.evaluate) return;
        let waited=0;
        while(state?.engineBusy&&waited<3500){await new Promise(r=>setTimeout(r,60));waited+=60}
        if(mySeq!==seq) return;
        const [beforeResult,afterResult]=await Promise.all([
          engine.evaluate(beforeFen),
          engine.evaluate(afterFen)
        ]);
        if(mySeq!==seq) return;
        const beforeWhite=evalWhite(beforeFen,beforeResult);
        const afterWhite=evalWhite(afterFen,afterResult);
        if(beforeWhite==null||afterWhite==null) return;
        const beforeMover=mover==='w'?beforeWhite:-beforeWhite;
        const afterMover=mover==='w'?afterWhite:-afterWhite;
        const loss=Math.max(0,beforeMover-afterMover);
        place(to,classify(loss));
      }catch(err){console.warn('Move-quality symbol grading failed',err)}
    }

    function inspect(){
      try{
        if(state?.screen!=='training'||state?.mode!=='guided'){
          lastFen='';lastHistLen=-1;clear();return;
        }
        document.querySelector('#cotMoveQualityBadge')?.remove();
        const fen=state?.chess?.fen?.()||'';
        const hist=state?.chess?.history?.({verbose:true})||[];
        if(lastHistLen<0){lastHistLen=hist.length;lastFen=fen;return}
        if(hist.length>lastHistLen && lastFen){
          const last=hist[hist.length-1];
          const beforeFen=lastFen;
          const afterFen=fen;
          const mySeq=++seq;
          clear();
          gradeMove(beforeFen,afterFen,last?.color,last?.to,mySeq);
        }
        lastHistLen=hist.length;
        lastFen=fen;
      }catch{}
    }

    const originalRender=render;
    render=function(...args){
      const out=originalRender(...args);
      queueMicrotask(inspect);
      requestAnimationFrame(inspect);
      return out;
    };
    window.addEventListener('resize',()=>{try{if(badge) inspect()}catch{}},{passive:true});
    window.addEventListener('scroll',()=>{try{if(badge) inspect()}catch{}},{passive:true});
    inspect();
  }catch(err){console.warn('Guided move-quality symbols patch could not attach',err)}
})();
