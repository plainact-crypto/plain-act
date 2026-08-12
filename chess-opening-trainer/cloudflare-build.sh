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

startup_patterns = [
    'state.profileEmail="";\nstate.profileLoaded=false;\nrender();',
    'state.profileEmail = "";\nstate.profileLoaded = false;\nrender();'
]
replaced=False
for pattern in startup_patterns:
    if pattern in s:
        s=s.replace(pattern,'queueMicrotask(()=>initCloudAuth());',1)
        replaced=True
        break
if not replaced and 'queueMicrotask(()=>initCloudAuth());' not in s:
    raise SystemExit('Could not locate startup email gate for cloud auth patch')
p.write_text(s)

p=Path('src/core/engine.js')
s=p.read_text().replace('constructor(workerUrl="/stockfish/stockfish-18-lite-single.js"){','constructor(workerUrl=`${import.meta.env.BASE_URL || "/"}stockfish/stockfish-18-lite-single.js`){')
p.write_text(s)
PY

npm install --no-audit --no-fund
npm run build
