#!/usr/bin/env bash
set -euo pipefail

cat source.b64.* > /tmp/chess-source.b64
base64 -d /tmp/chess-source.b64 > /tmp/chess-source.zip
unzip -o /tmp/chess-source.zip -d . || true

python - <<'PY'
from pathlib import Path
import re

p=Path('src/main.js')
s=p.read_text()
if 'const APP_BASE =' not in s:
    s=s.replace('const app = document.querySelector("#app");','const app = document.querySelector("#app");\nconst APP_BASE = import.meta.env.BASE_URL || "/";')
s=s.replace('assetsUrl:"/cm-chessboard/"','assetsUrl:`${APP_BASE}cm-chessboard/`')
s=s.replace('assetsUrl:"/cm-chessboard/assets/"','assetsUrl:`${APP_BASE}cm-chessboard/`')

# Report #33: completion belongs to one variation; mastery belongs to breadth
# across distinct completed variations. The shared progression module is the
# sole source of thresholds for Dashboard, course cards, Practice and Rank.
progression_import='''import {
  PRACTICE_PASSES_PER_VARIATION, MASTERY_VARIATION_CAP,
  variationCompleted, completedVariationsForLevel, openingProgress,
  rankUnlockProgress, progressionLabel, prestigeProgressText
} from "./core/progression.js";'''
if 'from "./core/progression.js";' in s and progression_import not in s:
    s=re.sub(r'import \{[^}]*\} from "\./core/progression\.js";',progression_import,s,count=1,flags=re.S)
elif progression_import not in s:
    anchor='} from "./core/rank.js";'
    if anchor not in s:
        raise SystemExit('Could not add progression imports to main.js')
    s=s.replace(anchor,anchor+'\n'+progression_import,1)

old='''function masteredCount(profile,side,level){
  const lp=ensureLevelProgress(profile,side,level);
  return lp.lessons.filter(x=>x.passes>=5).length;
}'''
new='''function completedVariationCount(profile,side,level){
  return completedVariationsForLevel(ensureLevelProgress(profile,side,level));
}'''
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('Could not replace legacy masteredCount()')

s=s.replace('const done=masteredCount(p,side,n);','const done=completedVariationCount(p,side,n);')
s=s.replace('<div class="level-count-sub">${done===20?"mastered":"variations mastered"}</div>','<div class="level-count-sub">completed variations</div>')

old='''  const elo=Math.round(p.openingElo?.[side]||800);
  return `'''
new='''  const elo=Math.round(p.openingElo?.[side]||800);
  const mastery=openingProgress(p,side);
  return `'''
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('Could not add opening progression summary')

old='''        <div class="profile-elo">
          <span>Opening Elo</span>
          <strong>${elo}</strong>
        </div>'''
new='''        <div class="profile-elo">
          <span>Opening Elo</span>
          <strong>${elo}</strong>
        </div>
        <div class="profile-elo progression-status">
          <span>${progressionLabel(mastery)}</span>
          <strong>${mastery.capped}/${MASTERY_VARIATION_CAP}</strong>
          <small>${prestigeProgressText(mastery)}</small>
          ${mastery.mastered?`<small>${mastery.prestige.metrics.practiceSuccesses} verified Practice wins · ${Math.round(mastery.prestige.metrics.consistency)}% consistency · ${mastery.prestige.metrics.rankTests} Rank Tests · ${Math.round(mastery.prestige.metrics.rankPerformance)}% Rank performance</small>`:""}
          ${mastery.prestige?.title?.startsWith("Opening ")?`<small>Product training title · not a FIDE title</small>`:""}
        </div>'''
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('Could not render opening progression summary')

s=s.replace('const done=lp.lessons.filter(x=>x.passes>=5).length;','const done=completedVariationsForLevel(lp);')
s=s.replace('<strong>Level ${n}</strong><span>${done}/20 mastered</span>','<strong>Depth ${n}</strong><span>${done}/20 completed</span>')
s=s.replace('Open Level ${state.sessionLength}','Open Depth ${state.sessionLength}')
s=s.replace('Practice progress</span><strong>${lesson.passes}/5','Practice progress</span><strong>${lesson.passes}/${PRACTICE_PASSES_PER_VARIATION}')
s=s.replace('required 5/5 valid passes','required ${PRACTICE_PASSES_PER_VARIATION}/${PRACTICE_PASSES_PER_VARIATION} valid passes')
s=s.replace('const mastered=lp.lessons.filter(x=>x.passes>=5).length;','const completed=completedVariationsForLevel(lp);')
s=s.replace('<div class="course-score"><strong>${mastered}/20</strong><span>mastered</span></div>','<div class="course-score"><strong>${completed}/20</strong><span>completed</span></div>')
s=s.replace('const mastered=lesson.passes>=5;','const completed=variationCompleted(lesson);')
s=s.replace('<article class="variation-card ${mastered?"mastered":""}">','<article class="variation-card ${completed?"mastered":""}">')
s=s.replace('<div class="variation-top"><span>Variation ${i+1}</span><strong>${lesson.passes}/5</strong></div>','<div class="variation-top"><span>Variation ${i+1}</span><strong>${lesson.passes}/${PRACTICE_PASSES_PER_VARIATION}</strong></div>')
s=s.replace('${mastered?"Mastered ✓":lines.length?"Saved lines ready for practice":"Create the first training line"}','${completed?"Completed ✓":lesson.passes>0?`Learning · ${lesson.passes}/${PRACTICE_PASSES_PER_VARIATION} valid passes`:lines.length?"Saved lines ready for practice":"Create the first training line"}')
if '${mastered?"Mastered' in s:
    raise SystemExit('Legacy single-variation Mastered label remains in main.js')
s=s.replace('const mastered=lp.lessons.filter(x=>x.passes>=5).length;','const completed=completedVariationsForLevel(lp);')

old='''  const lp=ensureLevelProgress(p,state.side,state.sessionLength);
  const mastered=lp.lessons.filter(x=>x.passes>=5).length;
  layout(`'''
new='''  const lp=ensureLevelProgress(p,state.side,state.sessionLength);
  const completed=completedVariationsForLevel(lp);
  const rankProgress=rankUnlockProgress(lp);
  lp.rankUnlocked=rankProgress.unlocked;
  layout(`'''
if old in s:
    s=s.replace(old,new,1)
elif 'const rankProgress=rankUnlockProgress(lp);' not in s:
    old2='''  const lp=ensureLevelProgress(p,state.side,state.sessionLength);
  const completed=completedVariationsForLevel(lp);

  layout(`'''
    if old2 not in s:
        raise SystemExit('Could not add course Rank progression')
    s=s.replace(old2,new,1)

s=s.replace('Master all 20 first variations at 5/5 valid Practice passes to unlock it.','Complete ${rankProgress.required} different variations at ${PRACTICE_PASSES_PER_VARIATION}/${PRACTICE_PASSES_PER_VARIATION} valid Practice passes to unlock it. (${rankProgress.completed}/${rankProgress.required})')
s=s.replace('lesson.passes=Math.min(5,lesson.passes+1);','lesson.passes=Math.min(PRACTICE_PASSES_PER_VARIATION,lesson.passes+1);')
s=s.replace('lp.rankUnlocked=lp.lessons.every(x=>x.passes>=5);','lp.rankUnlocked=rankUnlockProgress(lp).unlocked;')
s=s.replace('${lesson?.passes||0}/5 valid passes','${lesson?.passes||0}/${PRACTICE_PASSES_PER_VARIATION} valid passes')
s=s.replace('(lesson?.passes||0)>=5?"Back to Level":"Try Again"','variationCompleted(lesson)?"Back to Level":"Try Again"')

old='''    }else{
      lesson.passes=Math.min(PRACTICE_PASSES_PER_VARIATION,lesson.passes+1);
    }
    lp.rankUnlocked=rankUnlockProgress(lp).unlocked;'''
new='''    }else{
      lesson.passes=Math.min(PRACTICE_PASSES_PER_VARIATION,lesson.passes+1);
      lesson.validPracticeSuccesses=Math.max(Number(lesson.validPracticeSuccesses||0),lesson.passes-1)+1;
    }
    lp.rankUnlocked=rankUnlockProgress(lp).unlocked;'''
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('Could not add lifetime verified Practice success tracking')

old='''function renderTraining(){
  layout(`'''
new='''function renderTraining(){
  const trainingProgress=openingProgress(loadProfile(),state.side);
  layout(`'''
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('Could not add shared progression to Training surfaces')
s=s.replace('''${state.mode!=="rank"?` · Variation ${state.variationIndex+1}/20`:` · Rank round ${state.rankRound+1}/${state.rankRounds.length}`}</div>''','''${state.mode!=="rank"?` · Variation ${state.variationIndex+1}/20`:` · Rank round ${state.rankRound+1}/${state.rankRounds.length}`} · ${progressionLabel(trainingProgress)}</div>''')
if 'progressionLabel(trainingProgress)' not in s:
    raise SystemExit('Could not render prestige in Practice/Rank metadata')

s=s.replace('''function completeHTML(){
  if(state.mode==="rank") return "";
  const lesson=currentLesson();''','''function completeHTML(){
  if(state.mode==="rank") return "";
  const lesson=currentLesson();
  const completionProgress=openingProgress(loadProfile(),state.side);''')
s=s.replace('''<p class="sub">${state.userMovesDone} moves · ${state.mistakes} mistakes${state.mode==="test"?` · ${lesson?.passes||0}/${PRACTICE_PASSES_PER_VARIATION} valid passes`:""}</p>''','''<p class="sub">${state.userMovesDone} moves · ${state.mistakes} mistakes${state.mode==="test"?` · ${lesson?.passes||0}/${PRACTICE_PASSES_PER_VARIATION} valid passes`:""}</p>
  <p class="sub">${progressionLabel(completionProgress)} · ${prestigeProgressText(completionProgress)}</p>''')
if 'progressionLabel(completionProgress)' not in s:
    raise SystemExit('Could not render prestige in Practice completion')

# Reports #6/#14: repertoire-first guidance must never choose a materially worse move
# just to stay inside the scripted move pool. Compare the strongest repertoire candidate
# with the unrestricted engine best move from the same position; if the repertoire move
# concedes more than 1.20 pawns, use the safe engine move for that tactical position.
if 'REPERTOIRE_SAFETY_MARGIN_CP' not in s:
    pattern=r'''async function bestRepertoireMove\(\)\{.*?\n\}\n\nasync function prepareUserTurn'''
    replacement='''const REPERTOIRE_SAFETY_MARGIN_CP=120;
async function bestRepertoireMove(){
  const candidates=repertoireCandidates();
  if(!candidates.length){
    const best=await bestMove();
    return best?{from:best.slice(0,2),to:best.slice(2,4),promotion:best[4]||null}:null;
  }

  let best=null;
  for(const candidate of candidates){
    const result=await evaluateCandidate(candidate);
    if(!best || result.score>best.score) best=result;
  }

  const unrestricted=await bestMove();
  if(unrestricted){
    const fallback={from:unrestricted.slice(0,2),to:unrestricted.slice(2,4),promotion:unrestricted[4]||null};
    const fallbackResult=await evaluateCandidate(fallback);
    if(!best || fallbackResult.score>best.score+REPERTOIRE_SAFETY_MARGIN_CP){
      return fallback;
    }
  }
  return best?.candidate||null;
}

async function prepareUserTurn'''
    s,count=re.subn(pattern,replacement,s,count=1,flags=re.S)
    if count!=1:
        raise SystemExit('Could not patch repertoire safety valve in main.js')

old_black_force='''  // Black: always begin ...c6, then ...d5.
  if(state.side==="black" && hist.length===0){
    return {from:"c7",to:"c6",label:"Caro-Kann repertoire: c6"};
  }

  if(state.side==="black" && hist.length===1){
    const pawn = state.chess.get("d7");
    if(pawn?.type==="p" && pawn.color==="b"){
      const legal = state.chess.moves({square:"d7",verbose:true}).some(m=>m.to==="d5");
      if(legal) return {from:"d7",to:"d5",label:"Caro-Kann repertoire: d5"};
    }
  }
'''
if old_black_force in s:
    s=s.replace(old_black_force,'''  // Black opening family is selected positionally by repertoireAnchorForFen().
''',1)
elif 'Black opening family is selected positionally' not in s and 'Black opening moves are selected by the repertoire evaluator' not in s:
    raise SystemExit('Could not patch old Black opening force in main.js')

if 'function openIssueReportLegacy()' not in s:
    patched, count = re.subn(r'function\s+openIssueReport\s*\(\s*\)\s*\{', 'function openIssueReportLegacy(){', s, count=1)
    if count != 1:
        raise SystemExit('Could not locate openIssueReport() for telemetry patch')
    s = patched

for patch_file, marker in [
    ('issue-report-patch.js','const ISSUE_ENGINE_TRACE=[];'),
    ('triple-engine-patch.js','__COT_TRIPLE_ENGINE_ARCHITECTURE__'),
    ('guided-single-search-broker.js','__COT_GUIDED_SINGLE_SEARCH_BROKER__'),
    ('cloud-auth-patch.js','const SB_URL='),
    ('auth-confirmation-patch.js','__AUTH_CONFIRMATION_RECOVERY_PATCH__'),
    ('session-navigation-patch.js','__ISSUE_SESSION_RETRY__'),
    ('hero-focus-patch.js','Current opening focus'),
    ('move-quality-symbol-patch.js','__COT_SYMBOL_ONLY_MOVE_QUALITY__'),
    ('mobile-test-ux-patch.js','__MOBILE_TEST_UX_PATCH__'),
    ('rank-test-p0-patch.js','__RANK_TEST_P0_PATCH__'),
    ('wood-piece-sound-patch.js','__WOOD_PIECE_SOUND_PATCH__'),
    ('training-lines-patch.js','__COT_INDEPENDENT_TRAINING_LINES__')
]:
    patch=Path(patch_file).read_text()
    if marker not in s:
        s += '\n' + patch + '\n'

if 'window.__CLOUD_AUTH_BOOTSTRAP__=true;' not in s:
    s += '\nwindow.__CLOUD_AUTH_BOOTSTRAP__=true; queueMicrotask(()=>initCloudAuth());\n'

if '__CURRENT_POSITION_EVAL_GUARD__' not in s:
    s += r'''

// --- Current-position evaluation guard (Reports #8/#9/#12/#13) ---
try{
  if(!globalThis.__CURRENT_POSITION_EVAL_GUARD__){
    globalThis.__CURRENT_POSITION_EVAL_GUARD__=true;
    const guarded={evalCp:0,evalMate:null,evalDepth:0,evalPv:""};
    const neutral={evalCp:0,evalMate:null,evalDepth:0,evalPv:""};
    let guardedFen="";
    let pendingFen="";
    let evalSeq=0;
    const currentBoardFen=()=>{
      try{
        const g=(typeof game!=="undefined"&&game?.fen)?game:(state?.game?.fen?state.game:(state?.chess?.fen?state.chess:(globalThis.game?.fen?globalThis.game:(globalThis.chess?.fen?globalThis.chess:null))));
        return g?.fen?.()||"";
      }catch{return ""}
    };
    const isReset=(key,value)=>
      (key==="evalCp" && Number(value)===0) ||
      (key==="evalMate" && value==null) ||
      (key==="evalDepth" && Number(value)===0) ||
      (key==="evalPv" && String(value||"")==="");
    for(const key of Object.keys(guarded)){
      Object.defineProperty(state,key,{
        configurable:true,
        enumerable:true,
        get(){
          const fen=currentBoardFen();
          return guardedFen && fen===guardedFen ? guarded[key] : neutral[key];
        },
        set(value){
          if(isReset(key,value)){
            guarded[key]=neutral[key];
            guardedFen="";
          }
        }
      });
    }
    const evalEngine=globalThis.__COT_EVAL_ENGINE_SERVICE__||engineService;
    const originalEvaluate=evalEngine.evaluate.bind(evalEngine);
    async function publish(fen){
      if(!fen||fen===guardedFen||fen===pendingFen)return;
      pendingFen=fen;
      const seq=++evalSeq;
      try{
        const result=await originalEvaluate(fen,20);
        if(seq!==evalSeq||currentBoardFen()!==fen)return;
        if(!result){guardedFen=fen;return}
        const turn=String(fen).split(/\s+/)[1]||"w",perspective=turn==="w"?1:-1;
        guarded.evalCp=result.cp==null?0:perspective*Number(result.cp||0);
        guarded.evalMate=result.mate==null?null:perspective*Number(result.mate||0);
        guarded.evalDepth=Number(result.depth||0);
        guarded.evalPv=String(result.pv||"");
        guardedFen=fen;
        try{render()}catch{}
      }catch(e){console.warn("Current-position evaluation failed",e)}
      finally{if(pendingFen===fen)pendingFen=""}
    }
    setInterval(()=>{
      try{
        if(state?.screen!=="training"||state?.mode!=="guided")return;
        const fen=currentBoardFen();
        if(fen&&fen!==guardedFen&&fen!==pendingFen)publish(fen)
      }catch{}
    },350);
  }
}catch(err){console.warn("Current position eval guard failed",err)}
'''

p.write_text(s)
PY

npm test
npm run build
