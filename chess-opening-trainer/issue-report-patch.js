
// --- Verifiable issue reporting patch ---
// Added at deploy time to the chess trainer source. Keeps issue reports
// reviewable without exposing any GitHub token in the browser.
const ISSUE_REPORT_REPO = "plainact-crypto/plain-act";
const ISSUE_ENGINE_TRACE = [];
const ISSUE_TRACE_LIMIT = 160;

function issueTracePush(entry){
  try{
    ISSUE_ENGINE_TRACE.push({ time:new Date().toISOString(), ...entry });
    if(ISSUE_ENGINE_TRACE.length>ISSUE_TRACE_LIMIT){
      ISSUE_ENGINE_TRACE.splice(0, ISSUE_ENGINE_TRACE.length-ISSUE_TRACE_LIMIT);
    }
  }catch{}
}

function issueCurrentGameRecord(){
  let moves=[];
  let fen="Unavailable";
  try{
    fen=state.game?.fen?.() || "Unavailable";
    const history=state.game?.history?.({verbose:true}) || [];
    moves=history.map((m,i)=>({
      ply:i+1,
      side:i%2===0?"white":"black",
      san:m.san || "",
      uci:`${m.from || ""}${m.to || ""}${m.promotion || ""}`,
      from:m.from || "",
      to:m.to || "",
      promotion:m.promotion || "",
      before:m.before || "",
      after:m.after || ""
    }));
  }catch{}
  return {fen,moves};
}

function issueReportPayload(description){
  const game=issueCurrentGameRecord();
  const diagnostics=typeof issueDiagnostics==="function" ? issueDiagnostics() : "Diagnostics unavailable";
  const moveText=game.moves.length
    ? game.moves.map(m=>`${m.ply}. ${m.side} ${m.san} [${m.uci}]${m.after?` | FEN ${m.after}`:""}`).join("\n")
    : "No moves recorded.";
  const traceText=ISSUE_ENGINE_TRACE.length
    ? ISSUE_ENGINE_TRACE.map((x,i)=>`${i+1}. ${JSON.stringify(x)}`).join("\n")
    : "No engine recommendation/search trace recorded.";
  return [
    "## ISSUE DESCRIPTION",
    description.trim(),
    "",
    "## TECHNICAL DETAILS",
    diagnostics,
    "",
    "## FINAL POSITION",
    game.fen,
    "",
    "## COMPLETE GAME RECORD",
    "```text",
    moveText,
    "```",
    "",
    "## ENGINE / SUGGESTION TRACE",
    "```text",
    traceText,
    "```",
    "",
    "## REVIEW NOTE",
    "This report includes the game record and engine trace so the claim can be independently checked before any code change is made."
  ].join("\n");
}

function openIssueReport(){
  document.querySelector("#issueReportModal")?.remove();
  const modal=document.createElement("div");
  modal.id="issueReportModal";
  modal.className="issue-modal";
  modal.innerHTML=`
    <div class="issue-card" role="dialog" aria-modal="true" aria-labelledby="issueReportTitle">
      <h2 id="issueReportTitle">Report Issue</h2>
      <p class="small">Describe what went wrong. The complete game record and analysis trace will be attached automatically so the report can be verified first.</p>
      <label for="issueReportText">What went wrong?</label>
      <textarea id="issueReportText" placeholder="Describe the problem you saw..."></textarea>
      <div class="issue-diagnostics"><strong>Automatic evidence</strong><br>Full move list, final position, mode, side, level, variation and engine/suggestion trace will be included.</div>
      <div class="issue-actions">
        <button type="button" class="button quiet" id="cancelIssueReport">Cancel</button>
        <button type="button" class="button" id="sendIssueReport">Continue to GitHub</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const textarea=modal.querySelector("#issueReportText");
  textarea?.focus();
  modal.querySelector("#cancelIssueReport")?.addEventListener("click",()=>modal.remove());
  modal.addEventListener("click",e=>{ if(e.target===modal) modal.remove(); });
  modal.querySelector("#sendIssueReport")?.addEventListener("click",()=>{
    const description=textarea?.value?.trim() || "";
    if(!description){ textarea?.focus(); return; }
    const title=`Chess Trainer Issue · ${state.side || "unknown"} · Level ${state.level || "?"}`;
    const body=issueReportPayload(description);
    const url=`https://github.com/${ISSUE_REPORT_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.location.href=url;
  });
}

// Record engine recommendations/searches from the central engine service.
try{
  if(engineService && !engineService.__issueTraceWrapped){
    engineService.__issueTraceWrapped=true;
    if(typeof engineService.bestMove==="function"){
      const originalBestMove=engineService.bestMove.bind(engineService);
      engineService.bestMove=async (...args)=>{
        const fen=args?.[0]?.fen || args?.[0] || state.game?.fen?.() || "";
        const result=await originalBestMove(...args);
        issueTracePush({type:"bestMove",fen,result});
        return result;
      };
    }
    if(typeof engineService.topMoves==="function"){
      const originalTopMoves=engineService.topMoves.bind(engineService);
      engineService.topMoves=async (...args)=>{
        const fen=args?.[0]?.fen || args?.[0] || state.game?.fen?.() || "";
        const result=await originalTopMoves(...args);
        issueTracePush({type:"topMoves",fen,result});
        return result;
      };
    }
    if(typeof engineService.evaluate==="function"){
      const originalEvaluate=engineService.evaluate.bind(engineService);
      engineService.evaluate=async (...args)=>{
        const fen=args?.[0]?.fen || args?.[0] || state.game?.fen?.() || "";
        const result=await originalEvaluate(...args);
        issueTracePush({type:"evaluate",fen,result});
        return result;
      };
    }
  }
}catch(err){
  console.warn("Issue trace recorder could not attach",err);
}
