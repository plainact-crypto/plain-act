// --- Natural wooden chess-piece movement audio ---
try{
  if(!globalThis.__WOOD_PIECE_SOUND_PATCH__){
    globalThis.__WOOD_PIECE_SOUND_PATCH__=true;
    let ctx=null,lastFen="",lastHistory=0,lastPlayedAt=0,primed=false,setupPlayedFor="",visibleSince=0,lastVisibleKey="";
    const audioCtx=()=>ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)());
    function woodTap(strength=1,delay=0,tone=620,duration=.065){
      try{
        const c=audioCtx();
        if(c.state==='suspended') c.resume().catch(()=>{});
        const t=c.currentTime+delay;
        const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate);
        const data=buffer.getChannelData(0);
        const base=135+Math.random()*24;
        for(let i=0;i<data.length;i++){
          const x=i/data.length;
          const noise=(Math.random()*2-1);
          const knock=Math.sin(2*Math.PI*base*i/c.sampleRate)+.34*Math.sin(2*Math.PI*(base*2.13)*i/c.sampleRate);
          data[i]=(noise*.27+knock*.58)*Math.exp(-x*10.5)*strength;
        }
        const src=c.createBufferSource();src.buffer=buffer;
        const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=tone+Math.random()*120;filter.Q.value=.65;
        const gain=c.createGain();gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.245*strength,t+.003);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
        src.connect(filter);filter.connect(gain);gain.connect(c.destination);src.start(t);src.stop(t+duration+.015);
      }catch{}
    }
    function setupRattle(){
      const taps=[0,.035,.074,.118,.17,.224,.286,.355,.432];
      taps.forEach((d,i)=>woodTap(.28+Math.random()*.22,d,720+(i%3)*95,.045));
      woodTap(.62,.515,520,.07);
    }
    function playPhysicalMove(move,g){
      const now=performance.now();if(now-lastPlayedAt<80)return;lastPlayedAt=now;
      const flags=String(move?.flags||'');
      const isCastle=flags.includes('k')||flags.includes('q');
      const isCapture=!!move?.captured||flags.includes('c')||flags.includes('e');
      let isCheck=false;
      try{isCheck=!!(g?.isCheck?.()||g?.inCheck?.())}catch{}
      if(isCheck){if(isCapture) woodTap(.72,0,690,.05);woodTap(1.38,isCapture?.07:0,430,.085);return;}
      if(isCastle){woodTap(1.02,0,610,.06);woodTap(.9,.115,560,.07);return;}
      if(isCapture){woodTap(.64,0,790,.045);woodTap(1.18,.072,515,.075);return;}
      woodTap(1.08,0,620,.065);
    }
    const liveGame=()=>{try{return (typeof game!=='undefined'&&game?.history)?game:(state?.game?.history?state.game:(state?.chess?.history?state.chess:(globalThis.game?.history?globalThis.game:(globalThis.chess?.history?globalThis.chess:null))))}catch{return null}};
    const visibleBoard=()=>{
      try{
        if(state?.screen!=="training" || document.visibilityState!=="visible") return null;
        const candidates=[...document.querySelectorAll('.cm-chessboard, chess-board, .board, #board')];
        for(const el of candidates){
          const r=el.getBoundingClientRect?.();
          const style=getComputedStyle(el);
          if(r&&r.width>240&&r.height>240&&style.visibility!=="hidden"&&style.display!=="none"&&Number(style.opacity||1)>.8&&r.top>=0&&r.bottom<=innerHeight+2) return el;
        }
      }catch{}
      return null;
    };
    const prime=()=>{try{const c=audioCtx();if(c.state==='suspended')c.resume().catch(()=>{});primed=true}catch{}};
    addEventListener('pointerdown',prime,{passive:true});addEventListener('keydown',prime,{passive:true});
    setInterval(()=>{
      try{
        const g=liveGame();const board=visibleBoard();const fen=g?.fen?.()||'';const hist=g?.history?.({verbose:true})||[];
        const sessionKey=`${state?.mode||''}|${state?.side||''}|${state?.level||''}|${state?.variationIndex??''}|${fen}`;
        if(primed&&board&&hist.length===0&&fen){
          if(lastVisibleKey!==sessionKey){lastVisibleKey=sessionKey;visibleSince=performance.now();}
          if(sessionKey!==setupPlayedFor && performance.now()-visibleSince>=450){setupPlayedFor=sessionKey;setupRattle();}
        }else{visibleSince=0;lastVisibleKey="";}
        if(!g)return;
        if(!lastFen){lastFen=fen;lastHistory=hist.length;return;}
        if(fen!==lastFen){if(hist.length>lastHistory) playPhysicalMove(hist[hist.length-1],g);lastFen=fen;lastHistory=hist.length;}
      }catch{}
    },70);
  }
}catch(err){console.warn('Wood piece audio could not attach',err)}

// --- Black opening anchor lock (Reports #15-#20) ---
try{
  if(!globalThis.__BLACK_OPENING_FAMILY_LOCK__ && typeof bestRepertoireMove==='function'){
    globalThis.__BLACK_OPENING_FAMILY_LOCK__=true;
    const unlockedBestRepertoireMove=bestRepertoireMove;
    bestRepertoireMove=async function(...args){
      try{
        const g=state?.chess||state?.game||null;
        if(state?.side==='black'&&g?.history&&g?.moves&&g?.turn?.()==='b'){
          const hist=g.history({verbose:true})||[];
          const black=hist.filter(m=>m.color==='b');
          const playedC6=black.some(m=>m.from==='c7'&&m.to==='c6');
          const playedD5=black.some(m=>m.from==='d7'&&m.to==='d5');
          let uci=null;
          if(black.length===0) uci='c7c6';
          else if(black.length===1&&playedC6&&!playedD5) uci='d7d5';
          if(uci){
            const from=uci.slice(0,2),to=uci.slice(2,4);
            const legal=g.moves({square:from,verbose:true}).some(m=>m.to===to);
            if(legal) return {from,to,promotion:null};
          }
        }
      }catch{}
      return unlockedBestRepertoireMove(...args);
    };
  }
}catch(err){console.warn('Black opening anchor lock could not attach',err)}

// --- Guided turn status hard lock ---
try{
  if(!globalThis.__COT_GUIDED_STATUS_HARD_LOCK__){
    globalThis.__COT_GUIDED_STATUS_HARD_LOCK__=true;
    const style=document.createElement('style');
    style.textContent=`
      .cot-guided-turn-status-hardlock{
        height:40px!important;min-height:40px!important;max-height:40px!important;
        box-sizing:border-box!important;overflow-x:auto!important;overflow-y:hidden!important;
        white-space:nowrap!important;display:flex!important;align-items:center!important;
        flex-wrap:nowrap!important;scrollbar-width:thin!important;scrollbar-gutter:stable!important;
      }
      .cot-guided-turn-status-hardlock *{white-space:nowrap!important;flex-wrap:nowrap!important}
    `;
    document.head.appendChild(style);
    const desired=()=>{
      try{
        const user=state?.side==='black'?'b':'w';
        return state?.chess?.turn?.()===user?'Your move':'Opponent move';
      }catch{return 'Your move'}
    };
    const normalize=()=>{
      try{
        if(state?.screen!=='training'||state?.mode!=='guided') return;
        const wanted=desired();
        for(const panel of document.querySelectorAll('.side-panel,aside')){
          for(const el of panel.querySelectorAll('div,section,p')){
            const text=String(el.textContent||'').trim();
            if(!text) continue;
            if(/Live Position Coach|OPPONENT['’]S IDEA|WHY THIS MOVE|Restart|Exit/i.test(text)) continue;
            if(!/^(Your move|Opponent move|Engine is|Engine |Thinking|Loading|Choosing)/i.test(text)) continue;
            const r=el.getBoundingClientRect();
            if(r.width<150||r.height<24||r.height>160) continue;
            el.classList.add('cot-guided-turn-status-hardlock');
            if(el.textContent!==wanted) el.textContent=wanted;
          }
        }
      }catch{}
    };
    const previousRender=render;
    render=function(...args){
      try{
        if(state?.screen==='training'&&state?.mode==='guided'){
          state.status=desired();
          state.statusError=false;
        }
      }catch{}
      const out=previousRender(...args);
      queueMicrotask(normalize);
      requestAnimationFrame(normalize);
      return out;
    };
    new MutationObserver(()=>queueMicrotask(normalize)).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    normalize();
  }
}catch(err){console.warn('Guided status hard lock could not attach',err)}

// --- Mobile board layout guard (Report #35) ---
try{
  if(!globalThis.__MOBILE_BOARD_LAYOUT_GUARD__){
    globalThis.__MOBILE_BOARD_LAYOUT_GUARD__=true;
    const style=document.createElement('style');
    style.textContent=`
      @media (max-width:820px){
        .training{display:grid!important;grid-template-columns:minmax(0,1fr)!important;width:100%!important;gap:18px!important;align-items:start!important}
        .training>.board-area{display:block!important;width:100%!important;max-width:680px!important;min-width:0!important;margin:0 auto!important;justify-self:stretch!important}
        .training .board-shell,.practice-review-grid .board-shell,.rank-review-grid .board-shell{position:relative!important;display:block!important;width:100%!important;max-width:680px!important;min-width:0!important;height:auto!important;aspect-ratio:1/1!important;margin:0 auto!important;overflow:visible!important}
        .training #board,.practice-review-grid #board,.rank-review-grid #board{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important}
        .training .cm-chessboard,.practice-review-grid .cm-chessboard,.rank-review-grid .cm-chessboard{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important}
        .training>.side-panel,.practice-review-grid>.side-panel,.rank-review-grid>.side-panel{width:100%!important;min-width:0!important;max-width:none!important}
        .training .guide-layer,.practice-review-grid .guide-layer,.rank-review-grid .guide-layer{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;pointer-events:none!important}
      }
    `;
    document.head.appendChild(style);
    let lastRepairKey='';
    const repair=()=>{
      try{
        if(innerWidth>820||state?.screen!=='training') return;
        const shell=document.querySelector('.training .board-shell');
        const board=document.querySelector('.training #board .cm-chessboard')||document.querySelector('.training #board');
        if(!shell||!board) return;
        const sr=shell.getBoundingClientRect(),br=board.getBoundingClientRect();
        if(sr.width>=240&&br.width<Math.min(220,sr.width*.7)){
          const key=`${state?.mode||''}|${state?.side||''}|${state?.sessionLength||''}|${state?.variationIndex??''}|${state?.chess?.fen?.()||''}`;
          if(key!==lastRepairKey){lastRepairKey=key;requestAnimationFrame(()=>{try{render()}catch{}})}
        }
      }catch{}
    };
    addEventListener('resize',()=>setTimeout(repair,80),{passive:true});
    addEventListener('orientationchange',()=>setTimeout(repair,180),{passive:true});
    setInterval(repair,500);
  }
}catch(err){console.warn('Mobile board layout guard could not attach',err)}
