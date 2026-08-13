// --- Natural wooden chess-piece movement audio ---
// Physical board sounds only: no check/checkmate/success/error game effects.
try{
  if(!globalThis.__WOOD_PIECE_SOUND_PATCH__){
    globalThis.__WOOD_PIECE_SOUND_PATCH__=true;
    let ctx=null,lastFen="",lastHistory=0,lastPlayedAt=0;
    const audioCtx=()=>ctx||(ctx=new (window.AudioContext||window.webkitAudioContext)());
    function woodTap(strength=1,delay=0){
      try{
        const c=audioCtx();
        if(c.state==='suspended') c.resume().catch(()=>{});
        const t=c.currentTime+delay;
        const duration=.055;
        const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate);
        const data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++){
          const x=i/data.length;
          const noise=(Math.random()*2-1);
          const knock=Math.sin(2*Math.PI*(145+Math.random()*18)*i/c.sampleRate);
          data[i]=(noise*.32+knock*.68)*Math.exp(-x*12)*strength;
        }
        const src=c.createBufferSource();src.buffer=buffer;
        const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=620+Math.random()*150;filter.Q.value=.7;
        const gain=c.createGain();gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.16*strength,t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
        src.connect(filter);filter.connect(gain);gain.connect(c.destination);src.start(t);src.stop(t+duration+.01);
      }catch{}
    }
    function playPhysicalMove(move){
      const now=performance.now();if(now-lastPlayedAt<90)return;lastPlayedAt=now;
      const flags=String(move?.flags||'');
      const isCastle=flags.includes('k')||flags.includes('q');
      const isCapture=!!move?.captured||flags.includes('c')||flags.includes('e');
      if(isCastle){woodTap(.92,0);woodTap(.78,.115);return;}
      if(isCapture){woodTap(.68,0);woodTap(1,.075);return;}
      woodTap(.9,0);
    }
    // Browsers require a user gesture before audio can start. Prime it silently.
    const prime=()=>{try{const c=audioCtx();if(c.state==='suspended')c.resume().catch(()=>{})}catch{}};
    addEventListener('pointerdown',prime,{passive:true});addEventListener('keydown',prime,{passive:true});
    setInterval(()=>{
      try{
        const g=(typeof game!=='undefined'&&game?.history)?game:(state?.game?.history?state.game:(state?.chess?.history?state.chess:(globalThis.game?.history?globalThis.game:(globalThis.chess?.history?globalThis.chess:null))));
        if(!g)return;
        const fen=g.fen?.()||'';const hist=g.history?.({verbose:true})||[];
        if(!lastFen){lastFen=fen;lastHistory=hist.length;return;}
        if(fen!==lastFen){
          if(hist.length>lastHistory){playPhysicalMove(hist[hist.length-1]);}
          lastFen=fen;lastHistory=hist.length;
        }
      }catch{}
    },80);
  }
}catch(err){console.warn('Wood piece audio could not attach',err)}
