// --- Natural wooden chess-piece movement audio ---
// Physical board sounds only: all cues imitate real pieces/board contact.
try{
  if(!globalThis.__WOOD_PIECE_SOUND_PATCH__){
    globalThis.__WOOD_PIECE_SOUND_PATCH__=true;
    let ctx=null,lastFen="",lastHistory=0,lastPlayedAt=0,primed=false,setupPlayedFor="",wasBoardVisible=false;
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
      if(isCheck){
        if(isCapture) woodTap(.72,0,690,.05);
        woodTap(1.38,isCapture?.07:0,430,.085);
        return;
      }
      if(isCastle){woodTap(1.02,0,610,.06);woodTap(.9,.115,560,.07);return;}
      if(isCapture){woodTap(.64,0,790,.045);woodTap(1.18,.072,515,.075);return;}
      woodTap(1.08,0,620,.065);
    }
    const liveGame=()=>{
      try{return (typeof game!=='undefined'&&game?.history)?game:(state?.game?.history?state.game:(state?.chess?.history?state.chess:(globalThis.game?.history?globalThis.game:(globalThis.chess?.history?globalThis.chess:null))))}catch{return null}
    };
    const boardIsVisible=()=>{
      try{
        if(state?.screen!=="training") return false;
        const candidates=[...document.querySelectorAll('.cm-chessboard, chess-board, .board, #board, svg')];
        return candidates.some(el=>{
          const r=el.getBoundingClientRect?.();
          return r&&r.width>240&&r.height>240&&r.bottom>0&&r.top<innerHeight;
        });
      }catch{return false}
    };
    // Browser audio is only unlocked by a real user gesture. Do not play the setup cue here;
    // merely unlock audio. The setup cue waits until the board is actually visible.
    const prime=()=>{try{const c=audioCtx();if(c.state==='suspended')c.resume().catch(()=>{});primed=true}catch{}};
    addEventListener('pointerdown',prime,{passive:true});addEventListener('keydown',prime,{passive:true});
    setInterval(()=>{
      try{
        const g=liveGame();
        const visible=boardIsVisible();
        if(primed&&visible&&!wasBoardVisible){
          const fen=g?.fen?.()||'';
          const sessionKey=`${state?.mode||''}|${state?.side||''}|${state?.level||''}|${state?.variationIndex??''}|${fen}`;
          if(sessionKey!==setupPlayedFor){setupPlayedFor=sessionKey;setTimeout(setupRattle,90);}
        }
        wasBoardVisible=visible;
        if(!g)return;
        const fen=g.fen?.()||'';const hist=g.history?.({verbose:true})||[];
        if(!lastFen){lastFen=fen;lastHistory=hist.length;return;}
        if(fen!==lastFen){
          if(hist.length>lastHistory) playPhysicalMove(hist[hist.length-1],g);
          lastFen=fen;lastHistory=hist.length;
        }
      }catch{}
    },70);
  }
}catch(err){console.warn('Wood piece audio could not attach',err)}

// --- Deterministic Black opening-family lock (Reports #15-#18) ---
// The first two Black training moves must identify the selected repertoire before any
// asynchronous engine ranking can influence guidance. Caro-Kann after 1.e4; Slav shell
// after queen-pawn/flank starts. Later moves return to normal repertoire + safety logic.
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
          const white=hist.filter(m=>m.color==='w');
          const first=white[0];
          const playedC6=black.some(m=>m.from==='c7'&&m.to==='c6');
          const playedD5=black.some(m=>m.from==='d7'&&m.to==='d5');
          let uci=null;
          if(black.length===0){
            uci=(first?.from==='e2'&&first?.to==='e4')?'c7c6':'d7d5';
          }else if(black.length===1){
            if(playedC6&&!playedD5) uci='d7d5';
            else if(playedD5&&!playedC6&&!(first?.from==='e2'&&first?.to==='e4')) uci='c7c6';
          }
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
}catch(err){console.warn('Black opening family lock could not attach',err)}
