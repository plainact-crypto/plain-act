// --- Training performance + mobile report + audio regression fix ---
// Replaces legacy global DOM observers / polling with render/FEN-driven work only.
try{
  if(!globalThis.__COT_TRAINING_PERFORMANCE_AUDIO_FIX__){
    globalThis.__COT_TRAINING_PERFORMANCE_AUDIO_FIX__=true;

    // Prevent legacy heavy implementations from attaching later.
    globalThis.__WOOD_PIECE_SOUND_PATCH__=true;
    globalThis.__COT_GUIDED_STATUS_HARD_LOCK__=true;
    globalThis.__MOBILE_BOARD_LAYOUT_GUARD__=true;

    // Report #44 root cause: the legacy current-position guard used a 350ms
    // interval. In Practice/Rank evaluation is intentionally suppressed, so the
    // null result never marked the FEN as handled and the interval retried forever.
    // Own the guard here before the legacy block loads and make it FEN/render driven.
    globalThis.__CURRENT_POSITION_EVAL_GUARD__=true;
    const guardedEval={evalCp:0,evalMate:null,evalDepth:0,evalPv:""};
    const neutralEval={evalCp:0,evalMate:null,evalDepth:0,evalPv:""};
    let guardedEvalFen="",pendingEvalFen="",evalSeq=0;
    const currentBoardFen=()=>{
      try{
        const g=(state?.game?.fen?state.game:(state?.chess?.fen?state.chess:(typeof game!=="undefined"&&game?.fen?game:null)));
        return g?.fen?.()||"";
      }catch{return ""}
    };
    const evalReset=(key,value)=>
      (key==="evalCp"&&Number(value)===0)||(key==="evalMate"&&value==null)||
      (key==="evalDepth"&&Number(value)===0)||(key==="evalPv"&&String(value||"")==="");
    try{
      for(const key of Object.keys(guardedEval)){
        Object.defineProperty(state,key,{
          configurable:true,enumerable:true,
          get(){const fen=currentBoardFen();return guardedEvalFen&&fen===guardedEvalFen?guardedEval[key]:neutralEval[key]},
          set(value){if(evalReset(key,value)){guardedEval[key]=neutralEval[key];guardedEvalFen=""}}
        });
      }
    }catch{}
    const evalEngine=(()=>{try{return globalThis.__COT_EVAL_ENGINE_SERVICE__||engineService}catch{return null}})();
    const rawEvaluate=evalEngine?.evaluate?.bind(evalEngine)||null;
    async function publishCurrentFen(fen){
      if(!fen||fen===guardedEvalFen||fen===pendingEvalFen)return;
      // Practice and Rank deliberately have no evaluation bar. Mark this exact
      // position handled without touching the engine, so there is nothing to retry.
      if(state?.screen!=="training"||state?.mode==="test"||state?.mode==="rank"){
        Object.assign(guardedEval,neutralEval);guardedEvalFen=fen;pendingEvalFen="";return;
      }
      if(!rawEvaluate){guardedEvalFen=fen;return}
      const seq=++evalSeq;pendingEvalFen=fen;
      try{
        const result=await rawEvaluate(fen);
        if(seq!==evalSeq||currentBoardFen()!==fen)return;
        if(!result){Object.assign(guardedEval,neutralEval);guardedEvalFen=fen;return}
        const turn=String(fen).split(/\s+/)[1]||"w",perspective=turn==="w"?1:-1;
        guardedEval.evalCp=result.cp==null?0:perspective*Number(result.cp||0);
        guardedEval.evalMate=result.mate==null?null:perspective*Number(result.mate||0);
        guardedEval.evalDepth=Number(result.depth||0);
        guardedEval.evalPv=String(result.pv||"");
        guardedEvalFen=fen;
        try{render()}catch{}
      }catch(err){
        Object.assign(guardedEval,neutralEval);guardedEvalFen=fen;
        console.warn("Current-position evaluation failed",err);
      }finally{if(pendingEvalFen===fen)pendingEvalFen=""}
    }
    function syncEvaluationAfterRender(){
      try{
        const fen=currentBoardFen();
        if(!fen){guardedEvalFen="";pendingEvalFen="";return}
        if(fen!==guardedEvalFen&&fen!==pendingEvalFen)publishCurrentFen(fen);
      }catch{}
    }

    // Mobile issue reports must open immediately. Full-page html2canvas capture was
    // starting as soon as the modal opened and could stall low/mid-range phones.
    try{
      if(matchMedia('(max-width: 820px), (pointer: coarse)').matches && typeof issueCaptureScreenshot==='function'){
        issueCaptureScreenshot=async()=>null;
      }
    }catch{}

    // Louder wooden move audio with a compressor to avoid clipping on mobile speakers.
    let audioCtx=null,audioMaster=null,lastFen='',lastHistory=0,lastPlayedAt=0,primed=false,setupKey='';
    const getAudio=()=>{
      if(audioCtx)return audioCtx;
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return null;
      audioCtx=new Ctx();
      const compressor=audioCtx.createDynamicsCompressor();
      compressor.threshold.value=-12;compressor.knee.value=18;compressor.ratio.value=5;compressor.attack.value=.002;compressor.release.value=.12;
      audioMaster=audioCtx.createGain();audioMaster.gain.value=.95;
      compressor.connect(audioMaster);audioMaster.connect(audioCtx.destination);audioMaster.__input=compressor;
      return audioCtx;
    };
    const primeAudio=()=>{try{const c=getAudio();if(c?.state==='suspended')c.resume().catch(()=>{});primed=true}catch{}};
    addEventListener('pointerdown',primeAudio,{passive:true});addEventListener('keydown',primeAudio,{passive:true});
    function woodTap(strength=1,delay=0,tone=620,duration=.065){
      try{
        const c=getAudio();if(!c||!audioMaster)return;if(c.state==='suspended')c.resume().catch(()=>{});
        const t=c.currentTime+delay,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0),base=140+Math.random()*22;
        for(let i=0;i<data.length;i++){const x=i/data.length,noise=Math.random()*2-1,knock=Math.sin(2*Math.PI*base*i/c.sampleRate)+.32*Math.sin(2*Math.PI*(base*2.05)*i/c.sampleRate);data[i]=(noise*.24+knock*.62)*Math.exp(-x*10)*strength}
        const src=c.createBufferSource();src.buffer=buffer;const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=tone+Math.random()*95;filter.Q.value=.62;
        const gain=c.createGain(),peak=Math.min(.60,.47*strength);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.08,peak),t+.003);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
        src.connect(filter);filter.connect(gain);gain.connect(audioMaster.__input);src.start(t);src.stop(t+duration+.015);
      }catch{}
    }
    const setupRattle=()=>{[0,.045,.095,.15].forEach((d,i)=>woodTap(.42+i*.06,d,690+i*55,.05));woodTap(.72,.22,500,.075)};
    function playMove(move,g){
      const now=performance.now();if(now-lastPlayedAt<55)return;lastPlayedAt=now;
      const flags=String(move?.flags||''),castle=flags.includes('k')||flags.includes('q'),capture=!!move?.captured||flags.includes('c')||flags.includes('e');let check=false;try{check=!!(g?.isCheck?.()||g?.inCheck?.())}catch{}
      if(check){if(capture)woodTap(.82,0,700,.05);woodTap(1.26,capture?.065:0,430,.085);return}if(castle){woodTap(1.05,0,610,.06);woodTap(.98,.105,555,.07);return}if(capture){woodTap(.76,0,780,.048);woodTap(1.12,.06,510,.075);return}woodTap(1.12,0,610,.068);
    }
    const liveGame=()=>{try{return state?.game?.history?state.game:(state?.chess?.history?state.chess:(typeof game!=='undefined'&&game?.history?game:null))}catch{return null}};
    function syncAudioAfterRender(){
      try{
        if(state?.screen!=='training'||document.visibilityState!=='visible')return;const g=liveGame();if(!g)return;const fen=g.fen?.()||'',hist=g.history?.({verbose:true})||[];
        const key=`${state?.mode||''}|${state?.side||''}|${state?.sessionLength||state?.level||''}|${state?.variationIndex??''}`;
        if(primed&&hist.length===0&&setupKey!==key){setupKey=key;setupRattle()}if(!lastFen){lastFen=fen;lastHistory=hist.length;return}if(fen!==lastFen){if(hist.length>lastHistory)playMove(hist[hist.length-1],g);lastFen=fen;lastHistory=hist.length}
      }catch{}
    }

    const guidedDesired=()=>{try{const user=state?.side==='black'?'b':'w';return state?.chess?.turn?.()===user?'Your move':'Opponent move'}catch{return 'Your move'}};
    function normalizeGuidedStatus(){try{if(state?.screen!=='training'||state?.mode!=='guided')return;const status=document.querySelector('.training .status,.side-panel .status');if(status){status.textContent=guidedDesired();status.classList.remove('error')}}catch{}}
    function repairMobileBoard(){
      try{
        if(state?.screen!=='training'||innerWidth>820)return;const area=document.querySelector('.training .board-area'),shell=document.querySelector('.training .board-shell'),board=document.querySelector('.training #board');if(!area||!shell||!board)return;
        const evalColumn=area.querySelector('.eval-column');if(state?.mode==='test'||state?.mode==='rank'||!evalColumn){area.style.setProperty('display','grid','important');area.style.setProperty('grid-template-columns','minmax(0,1fr)','important');area.style.setProperty('width','100%','important');shell.style.setProperty('grid-column','1 / -1','important');shell.style.setProperty('width','100%','important');shell.style.setProperty('max-width','720px','important');board.style.setProperty('width','100%','important');board.style.setProperty('aspect-ratio','1 / 1','important')}
      }catch{}
    }

    const perfBaseRender=render;
    render=function(...args){
      try{if(state?.screen==='training'&&state?.mode==='guided'){state.status=guidedDesired();state.statusError=false}}catch{}
      const out=perfBaseRender.apply(this,args);
      queueMicrotask(()=>{normalizeGuidedStatus();syncAudioAfterRender();syncEvaluationAfterRender()});
      if(state?.screen==='training'&&innerWidth<=820)requestAnimationFrame(repairMobileBoard);
      return out;
    };
    let resizeQueued=false;const queueRepair=()=>{if(resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;repairMobileBoard()})};
    addEventListener('resize',queueRepair,{passive:true});addEventListener('orientationchange',queueRepair,{passive:true});
  }
}catch(err){console.warn('Training performance/audio fix could not attach',err)}
