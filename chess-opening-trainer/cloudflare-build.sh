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

hero_patch = Path('hero-focus-patch.js').read_text()
if 'Current opening focus' not in s:
    s += '\n' + hero_patch + '\n'

# Force the cloud-auth overlay to start regardless of the legacy local-profile startup code.
if 'window.__CLOUD_AUTH_BOOTSTRAP__=true;' not in s:
    s += '\nwindow.__CLOUD_AUTH_BOOTSTRAP__=true; queueMicrotask(()=>initCloudAuth());\n'

# Report #8: candidate-branch evaluations are used while generating lines, but
# they must never overwrite the evaluation shown for the board the user is
# actually looking at. Only an evaluate() call whose FEN still equals the
# current board FEN may update the display-facing evaluation state.
if '__CURRENT_POSITION_EVAL_GUARD__' not in s:
    s += r'''

// --- Current-position evaluation guard (Report #8) ---
try{
  if(!globalThis.__CURRENT_POSITION_EVAL_GUARD__){
    globalThis.__CURRENT_POSITION_EVAL_GUARD__=true;
    let allowCurrentEvalWrite=false;
    const guarded={
      evalCp:Number(state.evalCp||0),
      evalMate:state.evalMate??null,
      evalDepth:Number(state.evalDepth||0),
      evalPv:String(state.evalPv||"")
    };
    const resetValue=(key,value)=>
      (key==="evalCp" && Number(value)===0) ||
      (key==="evalMate" && value==null) ||
      (key==="evalDepth" && Number(value)===0) ||
      (key==="evalPv" && String(value||"")==="");
    for(const key of Object.keys(guarded)){
      Object.defineProperty(state,key,{
        configurable:true,
        enumerable:true,
        get(){return guarded[key]},
        set(value){
          if(allowCurrentEvalWrite || resetValue(key,value)) guarded[key]=value;
        }
      });
    }
    const originalEvaluateForCurrentPosition=engineService.evaluate.bind(engineService);
    engineService.evaluate=async(fen,...args)=>{
      const result=await originalEvaluateForCurrentPosition(fen,...args);
      let currentFen="";
      try{currentFen=state.chess?.fen?.()||state.game?.fen?.()||""}catch{}
      if(fen && currentFen && fen===currentFen){
        allowCurrentEvalWrite=true;
        setTimeout(()=>{allowCurrentEvalWrite=false},0);
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

# Keep Black Caro-Kann-focused without hard-forcing 1...c6 / 2...d5.
# The source archive is unpacked on every Cloudflare build, so patch the
# repertoire module after extraction to preserve this behavior in production.
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

    // Black remains Caro-Kann-focused, but the first two Black moves are not
    // hard-forced. Sensible alternatives/transpositions can be accepted and
    // normal move ranking can guide the line back toward the repertoire.
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
