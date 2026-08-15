// Training-only Position Intelligence MVP.
// Stockfish: Depth 20 / MultiPV 3 candidate memory. Geometry: deterministic FEN delta.
try {
  if (!globalThis.__COT_TRAINING_POSITION_INTELLIGENCE__) {
    globalThis.__COT_TRAINING_POSITION_INTELLIGENCE__ = true;

    const DEPTH = 20;
    const MULTIPV = 3;
    const candidateCache = new Map();
    const candidatePending = new Map();
    let generation = 0;
    let lastActualFen = '';
    let lastHistoryLen = -1;
    let activeDelta = null;
    let activeMarkers = [];
    let scheduled = null;

    globalThis.__COT_TRAINING_CANDIDATE_MEMORY__ = candidateCache;
    globalThis.__COT_TRAINING_INTELLIGENCE_POLICY__ = {
      mode: 'guided-only',
      candidateDepth: DEPTH,
      candidateMultiPv: MULTIPV,
      geometry: 'deterministic-fen-delta-all-changes',
      bestLabel: 'exact-top1-only'
    };

    const files = 'abcdefgh';
    const squares = [];
    for (let r = 1; r <= 8; r++) for (let f = 0; f < 8; f++) squares.push(`${files[f]}${r}`);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const pieceName = (p) => ({p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}[p] || p);
    const colorName = (c) => c === 'w' ? 'White' : 'Black';

    function makeGame(fen) {
      try { return new state.chess.constructor(fen); }
      catch {
        try { const g = new state.chess.constructor(); g.load(fen); return g; }
        catch { return null; }
      }
    }
    function fenWithTurn(fen, color) {
      const parts = String(fen || '').split(/\s+/);
      if (parts.length < 2) return fen;
      parts[1] = color;
      return parts.join(' ');
    }
    function boardPieces(game) {
      const out = new Map();
      try {
        const board = game.board();
        for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
          const p = board[row][col];
          if (!p) continue;
          out.set(`${files[col]}${8-row}`, {type:p.type,color:p.color});
        }
      } catch {}
      return out;
    }
    function addCount(map, square, n=1) { map[square] = (map[square] || 0) + n; }
    function manualAttacks(pieces) {
      const attacks = {w:{},b:{}}, pawns = {w:{},b:{}};
      const dirs = {
        b:[[1,1],[1,-1],[-1,1],[-1,-1]],
        r:[[1,0],[-1,0],[0,1],[0,-1]],
        q:[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]
      };
      const knights=[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
      const kings=[[1,1],[1,0],[1,-1],[0,1],[0,-1],[-1,1],[-1,0],[-1,-1]];
      for (const [sq,p] of pieces) {
        const f=files.indexOf(sq[0]), r=Number(sq[1])-1;
        const push=(ff,rr,isPawn=false)=>{
          if(ff<0||ff>7||rr<0||rr>7)return false;
          const target=`${files[ff]}${rr+1}`;
          addCount(attacks[p.color],target);
          if(isPawn)addCount(pawns[p.color],target);
          return pieces.has(target);
        };
        if(p.type==='p'){
          const dr=p.color==='w'?1:-1;
          push(f-1,r+dr,true);push(f+1,r+dr,true);
        } else if(p.type==='n') knights.forEach(([df,dr])=>push(f+df,r+dr));
        else if(p.type==='k') kings.forEach(([df,dr])=>push(f+df,r+dr));
        else if(dirs[p.type]) for(const [df,dr] of dirs[p.type]){
          let ff=f+df,rr=r+dr;
          while(ff>=0&&ff<8&&rr>=0&&rr<8){const occupied=push(ff,rr);if(occupied)break;ff+=df;rr+=dr;}
        }
      }
      return {attacks,pawns};
    }
    function legalMobility(fen, pieces) {
      const mobility = new Map();
      for (const color of ['w','b']) {
        const game = makeGame(fenWithTurn(fen,color));
        if (!game) continue;
        for (const [sq,p] of pieces) {
          if (p.color !== color) continue;
          try {
            const moves = game.moves({square:sq,verbose:true}) || [];
            mobility.set(sq,new Set(moves.map(m=>m.to)));
          } catch { mobility.set(sq,new Set()); }
        }
      }
      return mobility;
    }
    function snapshot(fen) {
      const game=makeGame(fen); if(!game)return null;
      const pieces=boardPieces(game);
      const maps=manualAttacks(pieces);
      return {fen,pieces,mobility:legalMobility(fen,pieces),attacks:maps.attacks,pawns:maps.pawns};
    }
    const setDiff=(a,b)=>[...(a||new Set())].filter(x=>!(b||new Set()).has(x));
    function compareSnapshots(beforeFen, afterFen, move=null) {
      const before=snapshot(beforeFen), after=snapshot(afterFen); if(!before||!after)return null;
      const pieceChanges=[];
      const opened=new Set(), closed=new Set(), slidingOpened=new Set(), slidingClosed=new Set();
      const visited=new Set();
      const pairs=[];
      if(move?.from&&move?.to){
        const bp=before.pieces.get(move.from), ap=after.pieces.get(move.to);
        if(bp&&ap&&bp.color===ap.color)pairs.push([move.from,move.to,bp]);
        visited.add(move.from);visited.add(move.to);
      }
      for(const [sq,p] of before.pieces){
        if(visited.has(sq))continue;
        const ap=after.pieces.get(sq);
        if(ap&&ap.color===p.color&&ap.type===p.type)pairs.push([sq,sq,p]);
      }
      for(const [from,to,p] of pairs){
        const b=before.mobility.get(from)||new Set(), a=after.mobility.get(to)||new Set();
        const gained=setDiff(a,b), lost=setDiff(b,a);
        gained.forEach(x=>opened.add(x));lost.forEach(x=>closed.add(x));
        if(['b','r','q'].includes(p.type)){gained.forEach(x=>slidingOpened.add(x));lost.forEach(x=>slidingClosed.add(x));}
        if(gained.length||lost.length||a.size!==b.size)pieceChanges.push({piece:`${colorName(p.color)} ${pieceName(p.type)} ${from}${from!==to?`→${to}`:''}`,before:b.size,after:a.size,gained,lost});
      }
      const attackChanges=[], pawnChanges=[];
      const weak={w:new Set(),b:new Set()};
      for(const sq of squares){
        for(const c of ['w','b']){
          const b=before.attacks[c][sq]||0,a=after.attacks[c][sq]||0;
          if(a!==b)attackChanges.push({square:sq,color:c,before:b,after:a,delta:a-b});
          const pb=before.pawns[c][sq]||0,pa=after.pawns[c][sq]||0;
          if(pa!==pb)pawnChanges.push({square:sq,color:c,before:pb,after:pa,delta:pa-pb});
        }
        const wb=before.attacks.w[sq]||0,wa=after.attacks.w[sq]||0, bb=before.attacks.b[sq]||0,ba=after.attacks.b[sq]||0;
        const wpb=before.pawns.w[sq]||0,wpa=after.pawns.w[sq]||0,bpb=before.pawns.b[sq]||0,bpa=after.pawns.b[sq]||0;
        if(wa<wb || ba>bb || wpa<wpb)weak.w.add(sq);
        if(ba<bb || wa>wb || bpa<bpb)weak.b.add(sq);
      }
      const captured=[...before.pieces].filter(([sq,p])=>!after.pieces.has(sq)&&sq!==move?.from).map(([sq,p])=>`${colorName(p.color)} ${pieceName(p.type)} on ${sq}`);
      return {beforeFen,afterFen,move,pieceChanges,opened:[...opened],closed:[...closed],slidingOpened:[...slidingOpened],slidingClosed:[...slidingClosed],attackChanges,pawnChanges,weak:{w:[...weak.w],b:[...weak.b]},captured};
    }
    globalThis.__COT_POSITION_DELTA__ = compareSnapshots;

    function candidateEngine(){return globalThis.__COT_MOVE_QUALITY_ENGINE_SERVICE__||globalThis.__COT_OPPONENT_ENGINE_SERVICE__||globalThis.__COT_USER_ENGINE_SERVICE__||engineService;}
    async function top3(fen){
      if(!fen)return null;
      if(candidateCache.has(fen))return candidateCache.get(fen);
      if(candidatePending.has(fen))return candidatePending.get(fen);
      const e=candidateEngine();
      const raw=e?.search?.bind(e);
      if(!raw)return null;
      const p=Promise.resolve(raw({fen,depth:DEPTH,multiPv:MULTIPV})).then(pack=>{
        const lines=(pack?.lines||[]).slice(0,MULTIPV);
        const result={fen,depth:DEPTH,multiPv:MULTIPV,bestmove:pack?.bestmove||lines[0]?.uci||null,lines};
        candidateCache.set(fen,result);if(candidateCache.size>80)candidateCache.delete(candidateCache.keys().next().value);return result;
      }).catch(()=>null).finally(()=>candidatePending.delete(fen));
      candidatePending.set(fen,p);return p;
    }
    globalThis.__COT_TRAINING_TOP3__ = top3;

    function simulate(fen,uci){
      const g=makeGame(fen);if(!g||!uci)return null;
      try{const m=g.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});return m?{fen:g.fen(),move:m}:null}catch{return null}
    }
    function cpText(line,best){
      if(Number.isFinite(Number(line?.mate)))return `mate ${line.mate}`;
      const cp=Number(line?.cp), bestCp=Number(best?.cp);
      if(!Number.isFinite(cp))return 'eval —';
      const gap=Number.isFinite(bestCp)?Math.max(0,Math.abs(bestCp-cp)):0;
      return `${cp>=0?'+':''}${(cp/100).toFixed(2)}${gap?` · ${gap}cp from #1`:''}`;
    }
    function compactDelta(d){
      if(!d)return '<div class="cot-ti-empty">No geometry delta available.</div>';
      const rows=[];
      if(d.opened.length)rows.push(`<b>Newly reachable:</b> ${d.opened.join(', ')}`);
      if(d.closed.length)rows.push(`<b>Lost access:</b> ${d.closed.join(', ')}`);
      if(d.slidingOpened.length)rows.push(`<b>Opened slider rays:</b> ${d.slidingOpened.join(', ')}`);
      if(d.slidingClosed.length)rows.push(`<b>Closed slider rays:</b> ${d.slidingClosed.join(', ')}`);
      const attacks=d.attackChanges.map(x=>`${x.square} ${x.color==='w'?'W':'B'} ${x.before}→${x.after}`).join(', ');
      if(attacks)rows.push(`<b>Attack-map changes:</b> ${attacks}`);
      const pawns=d.pawnChanges.map(x=>`${x.square} ${x.color==='w'?'W':'B'} ${x.before}→${x.after}`).join(', ');
      if(pawns)rows.push(`<b>Pawn-control changes:</b> ${pawns}`);
      if(d.weak.w.length)rows.push(`<b>White weakened squares:</b> ${d.weak.w.join(', ')}`);
      if(d.weak.b.length)rows.push(`<b>Black weakened squares:</b> ${d.weak.b.join(', ')}`);
      if(d.captured.length)rows.push(`<b>Captured:</b> ${d.captured.join(', ')}`);
      return rows.map(x=>`<div>${x}</div>`).join('') || '<div class="cot-ti-empty">No measurable board-geometry change.</div>';
    }
    function fullActualDelta(d){
      if(!d)return '';
      const pieces=d.pieceChanges.map(p=>`<div><b>${esc(p.piece)}</b>: mobility ${p.before}→${p.after}${p.gained.length?` · gained ${p.gained.join(', ')}`:''}${p.lost.length?` · lost ${p.lost.join(', ')}`:''}</div>`).join('');
      return `<section class="cot-ti-actual"><h4>What changed on the board?</h4>${pieces}${compactDelta(d)}</section>`;
    }
    function candidateCard(line,index,fen,best){
      const uci=line?.uci||'';const sim=simulate(fen,uci);const delta=sim?compareSnapshots(fen,sim.fen,sim.move):null;
      return `<details class="cot-ti-candidate" ${index===0?'open':''}><summary><span>#${index+1} ${esc(uci.toUpperCase())}</span><small>${index===0?'Best Move · ':''}${esc(cpText(line,best))}</small></summary><div class="cot-ti-candidate-body">${compactDelta(delta)}</div></details>`;
    }

    const style=document.createElement('style');
    style.textContent=`
      .cot-ti-panel{margin:12px 0;padding:12px;border:1px solid #2d3944;border-radius:14px;background:#0c1319;color:#dfe7ec;font:12px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
      .cot-ti-panel h3,.cot-ti-panel h4{margin:0 0 8px;color:#fff}.cot-ti-panel .cot-ti-sub{color:#8fa0ad;margin-bottom:9px}.cot-ti-candidate{border-top:1px solid #23313b;padding:7px 0}.cot-ti-candidate summary{display:flex;justify-content:space-between;gap:10px;cursor:pointer;font-weight:800}.cot-ti-candidate summary small{color:#9fb0bb;font-weight:700}.cot-ti-candidate-body{padding:7px 0 2px;color:#cbd6dc}.cot-ti-candidate-body>div,.cot-ti-actual>div{margin:3px 0}.cot-ti-actual{border-top:1px solid #2a3943;margin-top:10px;padding-top:10px}.cot-ti-empty{color:#7f909c}
      .cot-ti-marker{position:fixed;z-index:17000;pointer-events:none;border-radius:50%;transform:translate(-50%,-50%);box-sizing:border-box}.cot-ti-open{border:3px solid rgba(70,220,110,.95);box-shadow:0 0 0 2px rgba(70,220,110,.18)}.cot-ti-weak{border:3px solid rgba(70,150,255,.95);box-shadow:0 0 0 2px rgba(70,150,255,.18)}
      @media(max-width:700px){.cot-ti-panel{font-size:11px}.cot-ti-candidate summary{display:block}.cot-ti-candidate summary small{display:block;margin-top:2px}}
    `;
    document.head.appendChild(style);

    function clearMarkers(){activeMarkers.forEach(el=>el.remove());activeMarkers=[];}
    function squarePoint(square){
      const board=document.querySelector('#board');if(!board)return null;const r=board.getBoundingClientRect();if(r.width<50)return null;
      const file=files.indexOf(square[0]),rank=Number(square[1]);const black=state?.side==='black';const col=black?7-file:file,row=black?rank-1:8-rank;const size=Math.min(r.width,r.height)/8;
      return {x:r.left+(col+.5)*size,y:r.top+(row+.5)*size,size};
    }
    function drawMarkers(){
      clearMarkers();if(!activeDelta||state?.screen!=='training'||state?.mode!=='guided')return;
      const items=[];activeDelta.opened.forEach(s=>items.push([s,'cot-ti-open']));
      const mover=activeDelta.move?.color||'w';const harmed=mover==='w'?'b':'w';(activeDelta.weak?.[harmed]||[]).forEach(s=>items.push([s,'cot-ti-weak']));
      const seen=new Set();
      for(const [sq,cls] of items){const key=`${sq}|${cls}`;if(seen.has(key))continue;seen.add(key);const p=squarePoint(sq);if(!p)continue;const el=document.createElement('div');el.className=`cot-ti-marker ${cls}`;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;el.style.width=el.style.height=`${Math.max(16,p.size*.46)}px`;document.body.appendChild(el);activeMarkers.push(el);}
    }
    window.addEventListener('resize',drawMarkers,{passive:true});window.addEventListener('scroll',drawMarkers,{passive:true});

    function detectActualMove(){
      try{
        if(state?.screen!=='training'||state?.mode!=='guided'){lastActualFen='';lastHistoryLen=-1;activeDelta=null;clearMarkers();return}
        const fen=state.chess.fen(),hist=state.chess.history({verbose:true})||[];
        if(lastHistoryLen<0){lastHistoryLen=hist.length;lastActualFen=fen;return}
        if(hist.length===lastHistoryLen+1&&lastActualFen){const m={...hist.at(-1)};activeDelta=compareSnapshots(lastActualFen,fen,m);drawMarkers();}
        else if(hist.length!==lastHistoryLen){activeDelta=null;clearMarkers();}
        lastHistoryLen=hist.length;lastActualFen=fen;
      }catch{}
    }
    function panelHost(){return document.querySelector('.side-panel, aside, .training-info, .training');}
    async function renderIntelligence(){
      const myGen=++generation;
      try{
        detectActualMove();
        document.querySelector('#cotTrainingIntelligence')?.remove();
        if(state?.screen!=='training'||state?.mode!=='guided'||state?.complete)return;
        const host=panelHost();if(!host)return;
        const fen=state.chess.fen();
        const panel=document.createElement('div');panel.id='cotTrainingIntelligence';panel.className='cot-ti-panel';
        panel.innerHTML=`<h3>Top 3 choices · Depth ${DEPTH}</h3><div class="cot-ti-sub">Calculating the three strongest engine choices and every measurable board change…</div>${fullActualDelta(activeDelta)}`;
        host.appendChild(panel);
        // Coach/opponent decision keeps priority. Candidate analysis starts only when that foreground search is idle.
        let guard=0;while((state?.engineBusy||globalThis.__COT_COACH_DECISION_PENDING__)&&guard++<80)await new Promise(r=>setTimeout(r,75));
        const pack=await top3(fen);if(myGen!==generation||state?.screen!=='training'||state?.mode!=='guided'||state.chess.fen()!==fen)return;
        const lines=pack?.lines||[];const best=lines[0]||null;
        panel.innerHTML=`<h3>Top 3 choices · Depth ${DEPTH}</h3><div class="cot-ti-sub">These are engine candidates. A forced opening-route move can differ and is not labelled Best unless it matches #1.</div>${lines.map((l,i)=>candidateCard(l,i,fen,best)).join('')||'<div class="cot-ti-empty">Candidate analysis unavailable.</div>'}${fullActualDelta(activeDelta)}`;
      }catch{}
    }
    function schedule(){clearTimeout(scheduled);scheduled=setTimeout(renderIntelligence,90);}
    const baseRender=render;
    render=function(...args){const out=baseRender(...args);queueMicrotask(schedule);return out;};
    queueMicrotask(schedule);
  }
} catch (err) { console.warn('Training Position Intelligence could not attach', err); }
