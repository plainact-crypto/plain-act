// Report #55: exact move-quality trust policy.
// BEST means the played UCI move exactly equals Stockfish Top-1 for the pre-move FEN.
// Reuse the Guided single-search broker so classification adds no extra Stockfish search.
(function installExactBestMoveQuality(){
  try{
    globalThis.__COT_MOVE_QUALITY_TRUST_FIX__=true; // disable legacy <=20cp-as-Best classifier
    if(globalThis.__COT_EXACT_BEST_QUALITY__) return;
    globalThis.__COT_EXACT_BEST_QUALITY__=true;

    const symbols={best:['★','cot-q-best'],good:['✓','cot-q-good'],inaccuracy:['?!','cot-q-inaccuracy'],mistake:['?','cot-q-mistake'],blunder:['??','cot-q-blunder']};
    const style=document.createElement('style');
    style.textContent=`.cot-quality-symbol{position:fixed!important;z-index:18000!important;pointer-events:none!important;width:28px!important;height:28px!important;border:2px solid rgba(255,255,255,.94)!important;border-radius:50%!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font:900 13px/1 system-ui!important;box-shadow:0 3px 10px rgba(0,0,0,.52)!important;transform:translate(-50%,-122%)!important}.cot-q-best{background:#81b64c!important}.cot-q-good{background:#96af8b!important}.cot-q-inaccuracy{background:#f0c15c!important;color:#151515!important}.cot-q-mistake{background:#e6912c!important}.cot-q-blunder{background:#b33430!important}`;
    document.head.appendChild(style);

    const cpOf=r=>{if(!r)return null;const cp=Number(r.cp);if(Number.isFinite(cp))return cp;const mate=Number(r.mate);return Number.isFinite(mate)?(mate>0?100000:-100000):null};
    const moverCp=(fen,r,color)=>{const cp=cpOf(r);if(cp==null)return null;const turn=String(fen||'').split(/\s+/)[1]||'w';const white=turn==='w'?cp:-cp;return color==='w'?white:-white};
    const lossClass=loss=>loss<=70?'good':loss<=140?'inaccuracy':loss<=300?'mistake':'blunder';
    const playedUci=m=>`${m.from}${m.to}${m.promotion||''}`;
    const pack=fen=>{const f=globalThis.__COT_GUIDED_SEARCH_PACK__;return typeof f==='function'?f(fen,false):Promise.resolve(null)};
    const bestUci=p=>p?.bestmove||p?.lines?.[0]?.uci||null;
    const line0=p=>p?.lines?.[0]||null;

    const squarePosition=sq=>{const b=document.querySelector('#board');if(!b||!sq)return null;const r=b.getBoundingClientRect();if(r.width<50)return null;const f=sq.charCodeAt(0)-97,rank=Number(sq[1]),black=state?.side==='black',col=black?7-f:f,row=black?rank-1:8-rank;return{x:r.left+(col+.68)*(r.width/8),y:r.top+(row+.23)*(r.height/8)}};
    const timers={w:null,b:null};
    function show(move,key){try{const color=move.color;document.querySelector(`#cotMoveQualitySymbol-${color}`)?.remove();if(timers[color])clearTimeout(timers[color]);const pos=squarePosition(move.to);if(!pos)return;const [txt,cls]=symbols[key];const el=document.createElement('div');el.id=`cotMoveQualitySymbol-${color}`;el.className=`cot-quality-symbol ${cls}`;el.textContent=txt;el.setAttribute('aria-label',key);el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;document.body.appendChild(el);timers[color]=setTimeout(()=>el.remove(),3000)}catch{}}

    async function classify(beforeFen,afterFen,move){
      const beforePack=await pack(beforeFen);
      const exact=bestUci(beforePack);
      if(exact && playedUci(move)===exact) return 'best';
      const afterPack=await pack(afterFen);
      const before=moverCp(beforeFen,line0(beforePack),move.color),after=moverCp(afterFen,line0(afterPack),move.color);
      if(before==null||after==null)return 'good';
      return lossClass(Math.max(0,before-after));
    }

    let lastLen=-1,lastFen='',busy=false;
    const detect=()=>{try{if(state?.screen!=='training'||state?.mode!=='guided'){lastLen=-1;lastFen='';return}const fen=state?.chess?.fen?.()||'',hist=state?.chess?.history?.({verbose:true})||[];if(lastLen<0){lastLen=hist.length;lastFen=fen;return}if(!busy&&hist.length===lastLen+1&&lastFen){const before=lastFen,after=fen,move={...hist.at(-1)};busy=true;Promise.resolve(classify(before,after,move)).then(k=>{if(state?.screen==='training'&&state?.mode==='guided')show(move,k)}).finally(()=>busy=false)}lastLen=hist.length;lastFen=fen}catch{}};
    const baseRender=render;
    render=function(...args){const out=baseRender(...args);queueMicrotask(detect);return out};
    queueMicrotask(detect);
    globalThis.__COT_BEST_LABEL_POLICY__='exact-stockfish-top1-uci-only';
  }catch(err){console.warn('Exact Best classifier could not attach',err)}
})();
