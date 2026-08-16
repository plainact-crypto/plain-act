// Final Rank entry bridge.
// The legacy Rank flow was built around 5 rounds (4 saved + 1 fresh). The current
// product is one full Rank game, unlocked by one fully completed variation line.
// This bridge lets the proven P0 board/scoring bootstrap initialize without
// requiring four unrelated saved variations, while never persisting synthetic data.
try {
  if (!globalThis.__COT_RANK_ENTRY_FINAL_FIX__) {
    globalThis.__COT_RANK_ENTRY_FINAL_FIX__ = true;

    const DEPTHS=[10,15,20,25,30];
    const INTERNAL_GAME_CAP=99;
    const previousStartRankTest=startRankTest;
    const previousRender=render;

    function actualProfile(){try{return loadProfile()}catch{return null}}
    function fullLineUnlocked(profile,side){
      if(!profile)return false;
      for(const depth of DEPTHS){
        try{
          const lp=ensureLevelProgress(profile,side,depth);
          if(Number(lp?.rankFullLineCompletedCount||0)>=1)return true;
        }catch{}
      }
      return false;
    }
    function realDepth(){
      const n=Number(state?.rankCourseDepth||state?.sessionLength||10);
      return DEPTHS.includes(n)?n:10;
    }
    function sourceLesson(profile,side){
      for(const depth of DEPTHS){
        try{
          const lp=ensureLevelProgress(profile,side,depth);
          const lesson=(lp?.lessons||[]).find(x=>Array.isArray(x?.lines)&&x.lines.length);
          if(lesson)return lesson;
        }catch{}
      }
      return null;
    }
    function bootstrapProfile(profile,side,depth){
      const clone=typeof structuredClone==='function'?structuredClone(profile):JSON.parse(JSON.stringify(profile));
      const lp=ensureLevelProgress(clone,side,depth);
      const src=sourceLesson(clone,side);
      if(!src)return clone;
      lp.lessons=Array.isArray(lp.lessons)?lp.lessons:[];
      while(lp.lessons.length<5)lp.lessons.push({passes:0,attempts:0,lines:[]});
      // Satisfy only the legacy bootstrap in this temporary in-memory copy.
      // No synthetic variation is ever saved to the real user profile.
      for(let i=0;i<5;i++){
        const copy=typeof structuredClone==='function'?structuredClone(src):JSON.parse(JSON.stringify(src));
        copy.passes=5;
        copy.validPracticeSuccesses=Math.max(5,Number(copy.validPracticeSuccesses||0));
        lp.lessons[i]=copy;
      }
      lp.rankUnlocked=true;
      return clone;
    }

    startRankTest=async function(...args){
      const profile=actualProfile();
      if(!fullLineUnlocked(profile,state.side))return previousStartRankTest(...args);

      const depth=realDepth();
      state.rankCourseDepth=depth;
      state.sessionLength=depth;

      const synthetic=bootstrapProfile(profile,state.side,depth);
      const realLoadProfile=loadProfile;
      const realSaveProfile=saveProfile;
      let out;
      try{
        loadProfile=()=>synthetic;
        // The bootstrap must never write its duplicated legacy rounds to storage.
        saveProfile=()=>synthetic;
        out=await previousStartRankTest(...args);
      } finally {
        loadProfile=realLoadProfile;
        saveProfile=realSaveProfile;
      }

      const entered=state?.mode==='rank'&&state?.screen==='training'&&Array.isArray(state?.rankRounds)&&state.rankRounds.length>0;
      if(!entered){
        // Never leak the old 99 safety cap into the course UI after a failed start.
        state.sessionLength=depth;
        state.rankCourseDepth=depth;
        state.status='Rank Test could not start — refresh and try again. Your progress is safe.';
        state.statusError=true;
        try{previousRender()}catch{}
        return out;
      }

      // The ladder wrapper may already have reduced this to one round. Enforce it.
      if(state.rankRounds.length>1)state.rankRounds=state.rankRounds.slice(0,1);
      state.sessionLength=INTERNAL_GAME_CAP;
      try{render()}catch{}
      return out;
    };

    function cleanCourseUi(){
      try{
        if(state?.screen==='course'&&Number(state?.sessionLength)===INTERNAL_GAME_CAP){
          state.sessionLength=realDepth();
        }
        const profile=actualProfile();
        const unlocked=fullLineUnlocked(profile,state?.side==='black'?'black':'white');
        document.querySelectorAll('body *').forEach(el=>{
          if(el.children?.length)return;
          const raw=String(el.textContent||'');
          let next=raw.replace(/LEVEL\s*99/gi,'RANK LADDER').replace(/Level\s*99/gi,'Rank Ladder');
          if(/5 games total:\s*4 from your saved training library\s*\+\s*1 fresh engine branch/i.test(next)){
            next='One full game per Rank level · 1800 → 2000 → 2200 → 2500 → 2700 → 3000.';
          }
          if(unlocked&&/^Locked$/i.test(next.trim())&&el.closest?.('.rank-card,.rank-test,.course-rank'))next='Unlocked';
          if(next!==raw)el.textContent=next;
        });
      }catch{}
    }

    render=function(...args){
      const out=previousRender(...args);
      queueMicrotask(cleanCourseUi);
      return out;
    };
    queueMicrotask(cleanCourseUi);

    globalThis.__COT_RANK_ENTRY_RULES__={
      authoritativeUnlock:'one-full-line-completed',
      gamesPerRankAttempt:1,
      legacyFiveRoundBootstrap:'temporary-memory-only',
      syntheticProgressPersisted:false,
      hideInternal99:true
    };
  }
}catch(err){console.warn('Final Rank entry fix could not attach',err)}
