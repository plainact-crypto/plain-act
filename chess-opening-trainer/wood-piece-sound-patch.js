// --- Natural wooden chess-piece movement audio ---
// Physical board sounds only: all cues imitate real pieces/board contact.
try{
  if(!globalThis.__WOOD_PIECE_SOUND_PATCH__){
    globalThis.__WOOD_PIECE_SOUND_PATCH__=true;
    let ctx=null,lastFen="",lastHistory=0,lastPlayedAt=0,primed=false,setupPlayedFor="";
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
      // Several irregular light wooden placements, like scattered pieces being set in order.
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
      // Check is not an electronic cue: it is simply a firmer physical placement.
      if(isCheck){
        if(isCapture) woodTap(.72,0,690,.05);
        woodTap(1.38,isCapture?.07:0,430,.085);
        return;
      }
      if(isCastle){woodTap(1.02,0,610,.06);woodTap(.9,.115,560,.07);return;}
      if(isCapture){
        // First contact/lift, then a more distinct replacement of the capturing piece.
        woodTap(.64,0,790,.045);woodTap(1.18,.072,515,.075);return;
      }
      woodTap(1.08,0,620,.065);
    }
    const liveGame=()=>{
      try{return (typeof game!=='undefined'&&game?.history)?game:(state?.game?.history?state.game:(state?.chess?.history?state.chess:(globalThis.game?.history?globalThis.game:(globalThis.chess?.history?globalThis.chess:null))))}catch{return null}
    };
    // Browsers require a gesture before sound. On the first real interaction, also give
    // the starting board its natural "pieces being arranged" cue if no move has been played.
    const prime=()=>{
      try{
        const c=audioCtx();if(c.state==='suspended')c.resume().catch(()=>{});
        if(!primed){
          primed=true;
          const g=liveGame(),hist=g?.history?.({verbose:true})||[],fen=g?.fen?.()||'';
          if(hist.length===0&&fen){setupPlayedFor=fen;setTimeout(setupRattle,35)}
        }
      }catch{}
    };
    addEventListener('pointerdown',prime,{passive:true});addEventListener('keydown',prime,{passive:true});
    setInterval(()=>{
      try{
        const g=liveGame();if(!g)return;
        const fen=g.fen?.()||'';const hist=g.history?.({verbose:true})||[];
        if(!lastFen){lastFen=fen;lastHistory=hist.length;return;}
        if(fen!==lastFen){
          if(hist.length>lastHistory){
            playPhysicalMove(hist[hist.length-1],g);
          }else if(primed&&hist.length===0&&fen&&fen!==setupPlayedFor){
            setupPlayedFor=fen;setTimeout(setupRattle,40);
          }
          lastFen=fen;lastHistory=hist.length;
        }
      }catch{}
    },70);
  }
}catch(err){console.warn('Wood piece audio could not attach',err)}
