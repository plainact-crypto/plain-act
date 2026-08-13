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
    ('cloud-auth-patch.js','const SB_URL='),
    ('auth-confirmation-patch.js','__AUTH_CONFIRMATION_RECOVERY_PATCH__'),
    ('session-navigation-patch.js','__ISSUE_SESSION_RETRY__'),
    ('hero-focus-patch.js','Current opening focus'),
    ('mobile-test-ux-patch.js','__MOBILE_TEST_UX_PATCH__'),
    ('wood-piece-sound-patch.js','__WOOD_PIECE_SOUND_PATCH__')
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
    const rawEvaluate=engineService.evaluate.bind(engineService);
    async function publishCurrentFen(fen){
      if(!fen || fen===guardedFen || fen===pendingFen) return;
      const seq=++evalSeq;
      pendingFen=fen;
      try{
        const result=await rawEvaluate(fen);
        const now=currentBoardFen();
        if(seq!==evalSeq || now!==fen || !result) return;
        const turn=String(fen).split(/\s+/)[1]||"w";
        const perspective=turn==="w"?1:-1;
        guarded.evalCp=result.cp==null?0:perspective*Number(result.cp||0);
        guarded.evalMate=result.mate==null?null:perspective*Number(result.mate||0);
        guarded.evalDepth=Number(result.depth||0);
        guarded.evalPv=String(result.pv||"");
        guardedFen=fen;
        try{render()}catch{}
      }catch(err){
        console.warn("Current-position evaluation failed",err);
      }finally{
        if(pendingFen===fen) pendingFen="";
      }
    }
    setInterval(()=>{
      const fen=currentBoardFen();
      if(!fen){guardedFen="";pendingFen="";return;}
      if(fen!==guardedFen && fen!==pendingFen) publishCurrentFen(fen);
    },350);
  }
}catch(err){console.warn("Current-position evaluation guard could not attach",err)}
'''

p.write_text(s)

p=Path('src/core/engine.js')
s=p.read_text().replace('constructor(workerUrl="/stockfish/stockfish-18-lite-single.js"){','constructor(workerUrl=`${import.meta.env.BASE_URL || "/"}stockfish/stockfish-18-lite-single.js`){')
p.write_text(s)

p=Path('src/core/repertoire.js')
s=p.read_text()
pattern=r'''export function repertoireAnchorForFen\(chess,side\)\{.*?\n\}\n\nexport function isRequiredRepertoireMove'''
replacement='''export function repertoireAnchorForFen(chess,side){
  try{
    const fen=chess.fen();
    const parts=fen.split(" ");
    const turn=parts[1];
    const fullmove=Number(parts[5]||1);

    if(side==="white"){
      if(turn==="w" && fullmove===1) return "d2d4";
      return null;
    }

    if(side==="black" && turn==="b"){
      const history=chess.history({verbose:true})||[];
      const blackMoves=history.filter(m=>m.color==="b");
      const whiteMoves=history.filter(m=>m.color==="w");
      const firstWhite=whiteMoves[0];
      const whitePlayedE4=whiteMoves.some(m=>m.from==="e2"&&m.to==="e4");
      const blackPlayedC6=blackMoves.some(m=>m.from==="c7"&&m.to==="c6");
      const blackPlayedD5=blackMoves.some(m=>m.from==="d7"&&m.to==="d5");

      if(blackMoves.length===0){
        if(firstWhite?.from==="e2"&&firstWhite?.to==="e4") return "c7c6";
        return "d7d5";
      }
      if(blackMoves.length===1){
        if(blackPlayedC6 && !blackPlayedD5) return "d7d5";
        if(blackPlayedD5 && !blackPlayedC6 && !whitePlayedE4) return "c7c6";
      }
    }
  }catch{}
  return null;
}

export function isRequiredRepertoireMove'''
s,count=re.subn(pattern,replacement,s,count=1,flags=re.S)
if count!=1:
    raise SystemExit('Could not patch Black opening family lock in repertoire.js')
p.write_text(s)
PY

npm install --no-audit --no-fund
npm run build