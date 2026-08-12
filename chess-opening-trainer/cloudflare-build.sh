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

if 'function openIssueReportLegacy()' not in s:
    patched, count = re.subn(r'function\s+openIssueReport\s*\(\s*\)\s*\{', 'function openIssueReportLegacy(){', s, count=1)
    if count != 1:
        raise SystemExit('Could not locate openIssueReport() for telemetry patch')
    s = patched

issue_patch = Path('issue-report-patch.js').read_text()
if 'const ISSUE_ENGINE_TRACE=[];' not in s:
    s += '\n' + issue_patch + '\n'

auth_patch = Path('cloud-auth-patch.js').read_text()
if 'const SB_URL=' not in s:
    s += '\n' + auth_patch + '\n'

session_navigation_patch = Path('session-navigation-patch.js').read_text()
if '__ISSUE_SESSION_RETRY__' not in s:
    s += '\n' + session_navigation_patch + '\n'

hero_patch = Path('hero-focus-patch.js').read_text()
if 'Current opening focus' not in s:
    s += '\n' + hero_patch + '\n'

mobile_patch = Path('mobile-test-ux-patch.js').read_text()
if '__MOBILE_TEST_UX_PATCH__' not in s:
    s += '\n' + mobile_patch + '\n'

if 'window.__CLOUD_AUTH_BOOTSTRAP__=true;' not in s:
    s += '\nwindow.__CLOUD_AUTH_BOOTSTRAP__=true; queueMicrotask(()=>initCloudAuth());\n'

# Reports #8/#9/#12: display evaluation must come from the actual current game position.
# The earlier guard looked for state.chess/state.game, but the trainer's live board is
# exposed through the module-level `game` object. That made the guard see an empty FEN
# and intentionally return neutral 0 forever. Use every known live-game handle and let
# normal eval setters write only when their request FEN still matches the board.
if '__CURRENT_POSITION_EVAL_GUARD__' not in s:
    s += r'''

// --- Current-position evaluation guard (Reports #8/#9/#12) ---
try{
  if(!globalThis.__CURRENT_POSITION_EVAL_GUARD__){
    globalThis.__CURRENT_POSITION_EVAL_GUARD__=true;
    const guarded={evalCp:0,evalMate:null,evalDepth:0,evalPv:""};
    let guardedFen="";
    const neutral={evalCp:0,evalMate:null,evalDepth:0,evalPv:""};
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
            return;
          }
          const fen=currentBoardFen();
          if(!fen) return;
          guarded[key]=value;
          guardedFen=fen;
        }
      });
    }
    const originalEvaluateForCurrentPosition=engineService.evaluate.bind(engineService);
    engineService.evaluate=async(fen,...args)=>{
      const result=await originalEvaluateForCurrentPosition(fen,...args);
      const currentFen=currentBoardFen();
      if(fen && currentFen && fen===currentFen && result){
        const turn=String(fen).split(/\s+/)[1]||"w";
        const perspective=turn==="w"?1:-1;
        guarded.evalCp=result.cp==null?0:perspective*Number(result.cp||0);
        guarded.evalMate=result.mate==null?null:perspective*Number(result.mate||0);
        guarded.evalDepth=Number(result.depth||0);
        guarded.evalPv=String(result.pv||"");
        guardedFen=currentFen;
      }
      return result;
    };
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

    if(side==="black" && turn==="b" && fullmove<=2) return null;
  }catch{}
  return null;
}

export function isRequiredRepertoireMove'''
s,count=re.subn(pattern,replacement,s,count=1,flags=re.S)
if count!=1:
    raise SystemExit('Could not patch Black opening tolerance in repertoire.js')
p.write_text(s)
PY

npm install --no-audit --no-fund
npm run build
