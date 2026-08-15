// Guided Training progressive board-change sequence.
// Shows each measured delta long enough to read and highlights only the squares for that step.
try {
  if (!globalThis.__COT_TRAINING_DELTA_SEQUENCE__) {
    globalThis.__COT_TRAINING_DELTA_SEQUENCE__ = true;

    let lastFen = '';
    let lastLen = -1;
    let timer = null;
    let token = 0;
    let markers = [];

    const files='abcdefgh';
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const clearMarkers=()=>{markers.forEach(x=>x.remove());markers=[]};
    const clearSequence=()=>{token++;clearTimeout(timer);timer=null;clearMarkers();document.querySelector('#cotDeltaSequence')?.remove()};

    const style=document.createElement('style');
    style.textContent=`
      /* The old intelligence overlay shows every square at once. The progressive guide owns board markers now. */
      .cot-ti-marker{display:none!important}
      .cot-delta-sequence{margin:10px 0 12px;padding:11px 12px;border:1px solid #34424e;border-radius:12px;background:#101922;color:#e7eef3;font:12px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
      .cot-delta-sequence-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}.cot-delta-sequence-head b{color:#fff}.cot-delta-sequence-head span{color:#91a4b1;font-size:11px}
      .cot-delta-sequence-line{font-weight:750;color:#dce7ed;min-height:34px}.cot-delta-sequence-line small{display:block;color:#8fa3af;font-weight:600;margin-top:3px}
      .cot-delta-progress{height:3px;background:#25323c;border-radius:99px;overflow:hidden;margin-top:8px}.cot-delta-progress>i{display:block;height:100%;background:#93c95b;transition:width .22s linear}
      .cot-delta-marker{position:fixed;z-index:17600;pointer-events:none;border-radius:50%;transform:translate(-50%,-50%);box-sizing:border-box}
      .cot-delta-gain{border:4px solid rgba(70,220,110,.98);box-shadow:0 0 0 3px rgba(70,220,110,.18),0 0 16px rgba(70,220,110,.28)}
      .cot-delta-risk{border:4px solid rgba(70,150,255,.98);box-shadow:0 0 0 3px rgba(70,150,255,.18),0 0 16px rgba(70,150,255,.28)}
    `;
    document.head.appendChild(style);

    function squarePoint(square){
      const board=document.querySelector('#board');if(!board)return null;
      const r=board.getBoundingClientRect();if(r.width<50)return null;
      const f=files.indexOf(square?.[0]),rank=Number(square?.[1]);if(f<0||rank<1||rank>8)return null;
      const black=state?.side==='black';const col=black?7-f:f,row=black?rank-1:8-rank;const size=Math.min(r.width,r.height)/8;
      return {x:r.left+(col+.5)*size,y:r.top+(row+.5)*size,size};
    }
    function drawStepMarkers(step){
      clearMarkers();
      const items=[...(step.gain||[]).map(s=>[s,'cot-delta-gain']),...(step.risk||[]).map(s=>[s,'cot-delta-risk'])];
      const seen=new Set();
      for(const [sq,cls] of items){
        const k=`${sq}|${cls}`;if(seen.has(k))continue;seen.add(k);
        const p=squarePoint(sq);if(!p)continue;
        const el=document.createElement('div');el.className=`cot-delta-marker ${cls}`;
        el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;el.style.width=el.style.height=`${Math.max(18,p.size*.5)}px`;
        document.body.appendChild(el);markers.push(el);
      }
    }

    function stepsFromDelta(d){
      if(!d)return [];
      const steps=[];
      for(const p of d.pieceChanges||[]){
        const extra=[];if(p.gained?.length)extra.push(`gained ${p.gained.join(', ')}`);if(p.lost?.length)extra.push(`lost ${p.lost.join(', ')}`);
        steps.push({text:`${p.piece}: mobility ${p.before}→${p.after}${extra.length?' · '+extra.join(' · '):''}`,gain:p.gained||[],risk:p.lost||[]});
      }
      if(d.slidingOpened?.length)steps.push({text:`Opened bishop/rook/queen lines: ${d.slidingOpened.join(', ')}`,gain:d.slidingOpened,risk:[]});
      if(d.slidingClosed?.length)steps.push({text:`Closed bishop/rook/queen lines: ${d.slidingClosed.join(', ')}`,gain:[],risk:d.slidingClosed});
      for(const x of d.attackChanges||[]){
        steps.push({text:`${x.square}: ${x.color==='w'?'White':'Black'} attackers ${x.before}→${x.after}`,gain:x.delta>0?[x.square]:[],risk:x.delta<0?[x.square]:[]});
      }
      for(const x of d.pawnChanges||[]){
        steps.push({text:`${x.square}: ${x.color==='w'?'White':'Black'} pawn control ${x.before}→${x.after}`,gain:x.delta>0?[x.square]:[],risk:x.delta<0?[x.square]:[]});
      }
      if(d.weak?.w?.length)steps.push({text:`White squares weakened by this move: ${d.weak.w.join(', ')}`,gain:[],risk:d.weak.w});
      if(d.weak?.b?.length)steps.push({text:`Black squares weakened by this move: ${d.weak.b.join(', ')}`,gain:[],risk:d.weak.b});
      for(const c of d.captured||[])steps.push({text:`Captured: ${c}`,gain:[],risk:[]});
      return steps;
    }

    function host(){return document.querySelector('#cotTrainingIntelligence')||document.querySelector('.side-panel,aside,.training-info,.training')}
    function durationFor(step){
      const words=String(step?.text||'').trim().split(/\s+/).filter(Boolean).length;
      const squares=(step?.gain?.length||0)+(step?.risk?.length||0);
      return Math.max(2600,Math.min(6000,1900+words*90+squares*180));
    }
    function startSequence(delta){
      clearSequence();
      if(state?.screen!=='training'||state?.mode!=='guided')return;
      const steps=stepsFromDelta(delta);if(!steps.length)return;
      const mount=host();if(!mount)return;
      const box=document.createElement('section');box.id='cotDeltaSequence';box.className='cot-delta-sequence';
      mount.prepend(box);
      const my=++token;
      let i=0;
      const show=()=>{
        if(my!==token||state?.screen!=='training'||state?.mode!=='guided'){clearSequence();return}
        const step=steps[i];if(!step){clearMarkers();box.querySelector('.cot-delta-sequence-line').innerHTML='Board changes complete.<small>The full mathematical delta remains listed below.</small>';box.querySelector('.cot-delta-progress>i').style.width='100%';return}
        const ms=durationFor(step);
        box.innerHTML=`<div class="cot-delta-sequence-head"><b>${delta.move?.color==='w'?'White':'Black'} move — board effect</b><span>${i+1} / ${steps.length}</span></div><div class="cot-delta-sequence-line">${esc(step.text)}<small>Green = newly gained/opened · Blue = lost/weakened</small></div><div class="cot-delta-progress"><i style="width:${((i+1)/steps.length)*100}%"></i></div>`;
        drawStepMarkers(step);
        i++;timer=setTimeout(show,ms);
      };
      show();
    }

    function detect(){
      try{
        if(state?.screen!=='training'||state?.mode!=='guided'){lastFen='';lastLen=-1;clearSequence();return}
        const fen=state.chess.fen(),hist=state.chess.history({verbose:true})||[];
        if(lastLen<0){lastLen=hist.length;lastFen=fen;return}
        if(hist.length===lastLen+1&&lastFen){
          const move={...hist.at(-1)};
          const delta=globalThis.__COT_POSITION_DELTA__?.(lastFen,fen,move);
          if(delta)requestAnimationFrame(()=>startSequence(delta));
        } else if(hist.length!==lastLen) clearSequence();
        lastLen=hist.length;lastFen=fen;
      }catch{}
    }

    const baseRender=render;
    render=function(...args){const out=baseRender(...args);queueMicrotask(detect);return out};
    window.addEventListener('resize',()=>{const box=document.querySelector('#cotDeltaSequence');if(box){/* next timed step redraws exact markers */}}, {passive:true});
    queueMicrotask(detect);

    globalThis.__COT_TRAINING_DELTA_SEQUENCE_POLICY__={perStepMinMs:2600,perStepMaxMs:6000,dynamicByTextAndSquares:true,bothSides:true,fullDeltaStillVisible:true};
  }
} catch(err){console.warn('Training delta sequence could not attach',err)}
