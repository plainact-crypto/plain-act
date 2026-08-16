// Final Rank entry bridge.
// Rank is available to every player. The legacy 5-round bootstrap is satisfied
// only in memory so the proven board/scoring flow can initialize; no training
// completion, saved line, or synthetic progress is persisted.
try {
  if (!globalThis.__COT_RANK_ENTRY_FINAL_FIX__) {
    globalThis.__COT_RANK_ENTRY_FINAL_FIX__ = true;

    const INTERNAL_GAME_CAP=99;
    const LEGACY_DEPTH=10;
    const previousStartRankTest=startRankTest;
    const previousRender=render;

    function actualProfile(){try{return loadProfile()}catch{return null}}
    function cloneOf(value){return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}
    function dummyLine(){
      return {
        moves:[
          {actor:'user',from:'d2',to:'d4',promotion:null,san:'d4'},
          {actor:'engine',from:'d7',to:'d5',promotion:null,san:'d5'}
        ],
        practice:{passes:5,attempts:5,invalidAttempts:0,validPracticeSuccesses:5,history:[]}
      };
    }
    function bootstrapProfile(profile,side){
      const base=profile&&typeof profile==='object'?profile:{};
      const clone=cloneOf(base);
      const lp=ensureLevelProgress(clone,side,LEGACY_DEPTH);
      lp.lessons=Array.isArray(lp.lessons)?lp.lessons:[];
      while(lp.lessons.length<5)lp.lessons.push({passes:0,attempts:0,lines:[]});
      for(let i=0;i<5;i++){
        const line=dummyLine();
        lp.lessons[i]={...(lp.lessons[i]||{}),passes:5,attempts:5,validPracticeSuccesses:5,selectedLineIndex:0,lines:[line]};
      }
      lp.rankUnlocked=true;
      return clone;
    }

    startRankTest=async function(...args){
      const realProfile=actualProfile()||{};
      state.rankCourseDepth=LEGACY_DEPTH;
      state.sessionLength=LEGACY_DEPTH;

      const synthetic=bootstrapProfile(realProfile,state.side==='black'?'black':'white');
      const realLoadProfile=loadProfile;
      const realSaveProfile=saveProfile;
      let out;
      try{
        loadProfile=()=>synthetic;
        saveProfile=()=>synthetic; // never persist compatibility-only data.
        out=await previousStartRankTest(...args);
      } finally {
        loadProfile=realLoadProfile;
        saveProfile=realSaveProfile;
      }

      const entered=state?.mode==='rank'&&state?.screen==='training'&&Array.isArray(state?.rankRounds)&&state.rankRounds.length>0;
      if(!entered){
        state.sessionLength=LEGACY_DEPTH;
        state.rankCourseDepth=LEGACY_DEPTH;
        state.status='Rank Test could not start — refresh and try again. Your data is safe.';
        state.statusError=true;
        try{previousRender()}catch{}
        return out;
      }
      if(state.rankRounds.length>1)state.rankRounds=state.rankRounds.slice(0,1);
      state.sessionLength=INTERNAL_GAME_CAP;
      try{render()}catch{}
      return out;
    };

    function cleanCourseUi(){
      try{
        if(state?.screen==='course'&&Number(state?.sessionLength)===INTERNAL_GAME_CAP)state.sessionLength=LEGACY_DEPTH;
        document.querySelectorAll('body *').forEach(el=>{
          if(el.children?.length)return;
          const raw=String(el.textContent||'');
          let next=raw.replace(/LEVEL\s*99/gi,'RANK LADDER').replace(/Level\s*99/gi,'Rank Ladder');
          if(/5 games total:\s*4 from your saved training library\s*\+\s*1 fresh engine branch/i.test(next))next='One full game per Rank level · 1800 → 2000 → 2200 → 2500 → 2700 → 3000.';
          if(/Complete .*variation|Practice passes to unlock|Full variation line completed|^Locked$/i.test(next.trim()))next='Available now · First Rank 1800.';
          if(next!==raw)el.textContent=next;
        });
      }catch{}
    }

    render=function(...args){const out=previousRender(...args);queueMicrotask(cleanCourseUi);return out};
    queueMicrotask(cleanCourseUi);

    globalThis.__COT_RANK_ENTRY_RULES__={
      authoritativeUnlock:'none-every-player-can-enter',
      firstRank:1800,
      gamesPerRankAttempt:1,
      legacyFiveRoundBootstrap:'temporary-memory-only',
      syntheticProgressPersisted:false,
      hideInternal99:true
    };
  }
}catch(err){console.warn('Final Rank entry fix could not attach',err)}
