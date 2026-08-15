// Independent Training Lines inside one first-move branch.
try{
  if(!globalThis.__COT_INDEPENDENT_TRAINING_LINES__){
    globalThis.__COT_INDEPENDENT_TRAINING_LINES__=true;
    const PASS_TARGET=5;
    const originalRender=render;
    const originalSaveCompletedGuidedLine=saveCompletedGuidedLine;
    const originalStartNewTraining=startNewTraining;
    const originalStartPracticeTest=startPracticeTest;
    const originalBestRepertoireMove=bestRepertoireMove;

    function activeLesson(index=state.variationIndex){
      const profile=loadProfile();
      return ensureLevelProgress(profile,state.side,state.sessionLength).lessons[index];
    }
    function normalizeLineProgress(line,lesson,index){
      if(!line)return null;
      if(!line.practice){
        const migrate=index===0;
        line.practice={
          passes:migrate?Math.min(PASS_TARGET,Number(lesson?.passes||0)):0,
          attempts:migrate?Number(lesson?.attempts||0):0,
          invalidAttempts:migrate?Number(lesson?.invalidAttempts||0):0,
          validPracticeSuccesses:migrate?Math.max(Number(lesson?.validPracticeSuccesses||0),Number(lesson?.passes||0)):0,
          history:[]
        };
      }
      line.practice.passes=Math.max(0,Math.min(PASS_TARGET,Number(line.practice.passes||0)));
      line.practice.attempts=Math.max(0,Number(line.practice.attempts||0));
      line.practice.invalidAttempts=Math.max(0,Number(line.practice.invalidAttempts||0));
      line.practice.validPracticeSuccesses=Math.max(line.practice.passes,Number(line.practice.validPracticeSuccesses||0));
      line.practice.history=Array.isArray(line.practice.history)?line.practice.history:[];
      return line.practice;
    }
    function normalizeLessonLines(lesson){
      const lines=Array.isArray(lesson?.lines)?lesson.lines:[];
      lines.forEach((line,index)=>normalizeLineProgress(line,lesson,index));
      return lines;
    }
    function selectedLineAndProgress(index=state.variationIndex){
      const lesson=activeLesson(index);
      const lines=normalizeLessonLines(lesson);
      const selected=Math.max(0,Math.min(Number(lesson?.selectedLineIndex||0),Math.max(0,lines.length-1)));
      return {lesson,line:lines[selected]||null,progress:lines[selected]?normalizeLineProgress(lines[selected],lesson,selected):null,selected};
    }
    function syncBranchSummary(lesson){
      const lines=normalizeLessonLines(lesson);
      lesson.passes=lines.reduce((best,line)=>Math.max(best,Number(line.practice?.passes||0)),0);
      lesson.attempts=lines.reduce((sum,line)=>sum+Number(line.practice?.attempts||0),0);
      lesson.invalidAttempts=lines.reduce((sum,line)=>sum+Number(line.practice?.invalidAttempts||0),0);
      lesson.validPracticeSuccesses=lines.reduce((sum,line)=>sum+Number(line.practice?.validPracticeSuccesses||0),0);
    }
    function moveLabel(step){return escapeHtml(step?.san||`${step?.from||''}${step?.to||''}`||'Move')}
    function divergenceRows(lines){
      const rows=[];
      const max=Math.max(0,...lines.map(line=>(line.moves||[]).length));
      for(let ply=1;ply<max;ply++){
        const choices=new Map();
        for(const line of lines){
          const step=line.moves?.[ply]; if(!step)continue;
          const key=`${step.actor}:${step.from}${step.to}${step.promotion||''}`;
          if(!choices.has(key))choices.set(key,{step,count:0});
          choices.get(key).count++;
        }
        if(choices.size>1 || (ply===2&&choices.size)) rows.push({ply,choices:[...choices.values()]});
      }
      return rows.slice(0,8);
    }

    saveCompletedGuidedLine=function(){
      originalSaveCompletedGuidedLine();
      if(!state.profileEmail||state.mode!=="guided")return;
      const profile=loadProfile();
      const lesson=ensureLevelProgress(profile,state.side,state.sessionLength).lessons[state.variationIndex];
      const lines=normalizeLessonLines(lesson);
      const selected=Math.max(0,Math.min(Number(lesson.selectedLineIndex||0),Math.max(0,lines.length-1)));
      if(lines[selected])normalizeLineProgress(lines[selected],lesson,selected);
      syncBranchSummary(lesson); saveProfile(profile);
    };

    startPracticeTest=async function(index){
      const profile=loadProfile();
      const lesson=ensureLevelProgress(profile,state.side,state.sessionLength).lessons[index];
      normalizeLessonLines(lesson); syncBranchSummary(lesson); saveProfile(profile);
      return originalStartPracticeTest(index);
    };

    startNewTraining=async function(index,confirmed=false){
      if(!confirmed && (activeLesson(index)?.lines||[]).length){
        state.variationIndex=index; state.screen="lineExplorer"; render(); return;
      }
      state.exploreStrongUserAlternative=true;
      return originalStartNewTraining(index);
    };

    bestRepertoireMove=async function(){
      if(!state.exploreStrongUserAlternative||state.mode!=="guided")return originalBestRepertoireMove();
      const lesson=activeLesson();
      const used=new Set(normalizeLessonLines(lesson).flatMap(line=>(line.moves||[]).filter(step=>step.actor==="user").map(step=>`${step.from}${step.to}${step.promotion||""}`)));
      const ranked=[];
      for(const candidate of repertoireCandidates()) ranked.push(await evaluateCandidate(candidate));
      ranked.sort((a,b)=>b.score-a.score);
      const best=ranked[0];
      const alternative=ranked.find(result=>{
        const move=result.candidate;
        const uci=`${move.from}${move.to}${move.promotion||""}`;
        return !used.has(uci)&&best.score-result.score<=35;
      });
      state.exploreStrongUserAlternative=false;
      return (alternative||best)?.candidate||originalBestRepertoireMove();
    };

    const originalFinishSession=finishSession;
    finishSession=function(){
      if(state.mode!=="test")return originalFinishSession();
      state.complete=true; state.status="Line complete!";
      const profile=loadProfile();
      const lp=ensureLevelProgress(profile,state.side,state.sessionLength);
      const lesson=lp.lessons[state.variationIndex];
      const lines=normalizeLessonLines(lesson);
      const selected=Math.max(0,Math.min(Number(lesson.selectedLineIndex||0),Math.max(0,lines.length-1)));
      const line=lines[selected]; const progress=normalizeLineProgress(line,lesson,selected);
      if(progress){
        const valid=!state.practiceInvalid&&!state.practiceHintUsed&&state.mistakes===0;
        progress.attempts++;
        if(valid){progress.passes=Math.min(PASS_TARGET,progress.passes+1);progress.validPracticeSuccesses++}
        else progress.invalidAttempts++;
        progress.history.push({at:new Date().toISOString(),valid,hintUsed:!!state.practiceHintUsed,mistakes:Number(state.mistakes||0)});
        if(progress.history.length>50)progress.history=progress.history.slice(-50);
      }
      syncBranchSummary(lesson);
      lp.rankUnlocked=rankUnlockProgress(lp).unlocked;
      saveProfile(profile); render();
    };

    completeHTML=function(){
      if(state.mode==="rank")return "";
      const {progress}=selectedLineAndProgress();
      const valid=state.mode==="test"&&!state.practiceInvalid&&!state.practiceHintUsed&&state.mistakes===0;
      return `<div class="complete"><div class="complete-card"><div class="kicker">Training Line Complete</div><h2>${state.mode==="guided"?"Training complete":valid?"Valid Practice Pass ✓":"Practice attempt complete"}</h2><p class="sub">${state.userMovesDone} moves · ${state.mistakes} mistakes${state.mode==="test"?` · ${progress?.passes||0}/${PASS_TARGET} for this line`:""}</p>${state.mode==="guided"?`<button class="primary" id="test">Practice This Training Line</button>`:`<button class="primary" id="again">Practice This Line Again</button>`}<button class="secondary" style="width:100%;margin-top:10px" id="menu">Back to Branch</button></div></div>`;
    };

    function renderExplorer(){
      const profile=loadProfile(); const lp=ensureLevelProgress(profile,state.side,state.sessionLength);
      const lesson=lp.lessons[state.variationIndex]; const lines=normalizeLessonLines(lesson);
      const first=lp.firstMoves[state.variationIndex]||"—"; const rows=divergenceRows(lines);
      layout(`${profileSummaryHTML()}<section class="saved-picker-card line-explorer"><div class="kicker">${openingName()} · ${playerVariationTitle(first)}</div><h1>Explore a New Line in This Branch</h1><p class="sub">The branch identity stays fixed. Choose a known fork to explore around, or let the coach find the strongest unused continuation.</p><div class="saved-picker-count"><strong>${lines.length}</strong><span>independent training ${lines.length===1?"line":"lines"}</span></div>${rows.length?`<div class="line-forks"><h3>Previously played next-move forks</h3>${rows.map(row=>`<div class="line-fork"><b>${row.choices[0]?.step?.actor==="engine"?"Opponent":"Your"} move · ply ${row.ply+1}</b><div>${row.choices.map(choice=>`<span>${moveLabel(choice.step)} × ${choice.count}</span>`).join("")}</div></div>`).join("")}</div>`:`<div class="no-saved-line">No later fork recorded yet. The coach will create the first alternative from this branch.</div>`}<div class="saved-picker-actions"><button class="primary" id="exploreUnused">Find Strongest New Option</button><button class="secondary" id="exploreBack">Back to Training Lines</button></div><p class="saved-picker-hint">The coach continues with Best Move. When another top engine choice is effectively equal and creates a new correct line, it is preferred over repeating a saved continuation.</p></section>`);
      document.querySelector("#changeEmail")?.addEventListener("click",changeEmail);
      document.querySelector("#exploreUnused")?.addEventListener("click",()=>startNewTraining(state.variationIndex,true));
      document.querySelector("#exploreBack")?.addEventListener("click",()=>openSavedPicker(state.variationIndex));
    }

    function enhanceLineUI(){
      if(state.mode==="test"&&state.complete){
        const again=document.querySelector("#again");
        if(again)again.onclick=()=>startPracticeTest(state.variationIndex);
      }
      document.querySelectorAll(".variation-card").forEach((card,index)=>{
        const lesson=activeLesson(index); const lines=normalizeLessonLines(lesson); if(!lines.length)return;
        const stateEl=card.querySelector(".variation-state");
        if(stateEl)stateEl.innerHTML=lines.map((line,i)=>{const p=normalizeLineProgress(line,lesson,i);return `<span class="line-progress-chip">Line ${i+1}: <b>${p.passes}/${PASS_TARGET}</b></span>`}).join(" ");
        const button=card.querySelector("[data-new]"); if(button)button.textContent="+ Explore New Line in This Branch";
      });
      const picker=document.querySelector(".saved-picker-card:not(.line-explorer)");
      if(picker){
        const {lesson,line,progress,selected}=selectedLineAndProgress();
        const info=picker.querySelector(".saved-picker-info");
        if(info&&line)info.innerHTML=`<div><span>Selected line</span><strong>Line ${selected+1}</strong></div><div><span>Practice for this line</span><strong>${progress.passes}/${PASS_TARGET}</strong></div><div><span>Attempts for this line</span><strong>${progress.attempts}</strong></div>`;
        const button=picker.querySelector("#pickerNew");if(button)button.textContent="+ Explore New Line in This Branch";
        picker.querySelector("#savedPickerSelect")?.addEventListener("change",()=>queueMicrotask(render));
      }
    }

    render=function(){
      if(state.screen==="lineExplorer")return renderExplorer();
      originalRender(); enhanceLineUI();
    };
  }
}catch(error){console.warn("Independent Training Lines could not attach",error)}
