// --- Rank Test P0 audit fixes: legal input, mobile tap, leakage, completion races ---
try{
  if(!globalThis.__RANK_TEST_P0_PATCH__){
    globalThis.__RANK_TEST_P0_PATCH__=true;

    const rankP0OriginalBoardInput=onBoardInput;
    const rankP0OriginalRenderTraining=renderTraining;
    const rankP0OriginalFinishSession=finishSession;
    const rankP0IsRank=()=>state?.mode==='rank';
    const rankP0UserColor=()=>state?.side==='white'?'w':'b';
    const rankP0Fen=()=>{try{return state?.chess?.fen?.()||''}catch{return ''}};
    let rankP0LastInputKey='';
    let rankP0LastInputAt=0;
    let rankP0TapSelected=null;
    let rankP0TouchStart=null;
    let rankP0SuppressClickUntil=0;
    let rankP0FinishKey='';

    function rankP0Status(text,isError=false){
      state.status=text;
      state.statusError=!!isError;
      const el=document.querySelector('.status');
      if(el){el.textContent=text;el.classList.toggle('error',!!isError)}
    }

    function rankP0Legal(from,to){
      try{return state.chess.moves({square:from,verbose:true}).find(m=>m.to===to)||null}catch{return null}
    }

    // Rank Test must never classify a touch slip or illegal move as an accuracy loss.
    // Also suppress the duplicate validate event some touch browsers emit after pointerup.
    onBoardInput=function(event){
      if(rankP0IsRank() && event?.type===INPUT_EVENT_TYPE.validateMoveInput){
        if(state.engineBusy||state.complete||state.chess.turn()!==rankP0UserColor()) return false;
        const from=event.squareFrom,to=event.squareTo;
        const legal=rankP0Legal(from,to);
        if(!legal){
          rankP0TapSelected=null;
          rankP0Status('Illegal move — try again. It does not affect your Rank score.',false);
          return false;
        }
        const now=performance.now();
        const key=`${rankP0Fen()}|${from}${to}${legal.promotion||''}`;
        if(key===rankP0LastInputKey && now-rankP0LastInputAt<420) return false;
        rankP0LastInputKey=key;rankP0LastInputAt=now;
        rankP0TapSelected=null;
        return rankP0OriginalBoardInput(event);
      }
      return rankP0OriginalBoardInput(event);
    };

    // Hide engine/evaluation information while a Rank attempt is live.
    renderTraining=function(){
      rankP0OriginalRenderTraining();
      if(rankP0IsRank() && !state.complete){
        document.querySelector('.eval-column')?.remove();
        document.querySelectorAll('.stats').forEach(el=>{
          if(/eval|depth|pv|engine/i.test(el.textContent||'')) el.remove();
        });
        document.querySelector('#hint')?.remove();
      }
    };

    // A delayed callback must not finalize the same Rank attempt twice and write Elo/history twice.
    finishSession=function(...args){
      if(!rankP0IsRank()) return rankP0OriginalFinishSession(...args);
      const key=`${state.side}|${state.sessionLength}|${state.rankRound}|${rankP0Fen()}|${state.userMovesDone}`;
      if(state.complete || rankP0FinishKey===key) return;
      rankP0FinishKey=key;
      return rankP0OriginalFinishSession(...args);
    };

    function rankP0SquareAtPoint(clientX,clientY){
      const el=document.querySelector('#board .cm-chessboard')||document.querySelector('#board');
      const r=el?.getBoundingClientRect?.();
      if(!r||r.width<80||r.height<80||clientX<r.left||clientX>r.right||clientY<r.top||clientY>r.bottom) return null;
      const col=Math.max(0,Math.min(7,Math.floor((clientX-r.left)/(r.width/8))));
      const row=Math.max(0,Math.min(7,Math.floor((clientY-r.top)/(r.height/8))));
      const black=state.side==='black';
      const file=black?7-col:col;
      const rank=black?row+1:8-row;
      return `${String.fromCharCode(97+file)}${rank}`;
    }

    function rankP0Highlight(square){
      const layer=document.querySelector('#guide');
      if(!layer) return;
      layer.querySelectorAll('.rank-p0-tap-selected').forEach(x=>x.remove());
      if(!square) return;
      const el=document.createElement('div');
      el.className='guide-square from rank-p0-tap-selected';
      const file=square.charCodeAt(0)-97,rank=+square[1];
      let col,row;
      if(state.side==='black'){col=7-file;row=rank-1}else{col=file;row=8-rank}
      el.style.left=`${col*12.5}%`;el.style.top=`${row*12.5}%`;
      layer.appendChild(el);
    }

    function rankP0Tap(clientX,clientY){
      if(!rankP0IsRank()||state.complete||state.engineBusy||state.chess.turn()!==rankP0UserColor()) return;
      const square=rankP0SquareAtPoint(clientX,clientY);
      if(!square) return;
      const piece=state.chess.get(square);
      if(!rankP0TapSelected){
        if(piece?.color===rankP0UserColor()){
          rankP0TapSelected=square;rankP0Highlight(square);
          rankP0Status(`Selected ${square.toUpperCase()} — tap the destination.`,false);
        }else rankP0Status('Select one of your pieces. No score change.',false);
        return;
      }
      if(piece?.color===rankP0UserColor()){
        rankP0TapSelected=square;rankP0Highlight(square);
        rankP0Status(`Selected ${square.toUpperCase()} — tap the destination.`,false);
        return;
      }
      const from=rankP0TapSelected;
      rankP0TapSelected=null;rankP0Highlight(null);
      const accepted=onBoardInput({type:INPUT_EVENT_TYPE.validateMoveInput,squareFrom:from,squareTo:square});
      if(accepted){try{state.board?.setPosition?.(state.chess.fen(),true)}catch{}}
    }

    const rankP0IsBoardTarget=target=>!!target?.closest?.('.cm-chessboard, #board');
    document.addEventListener('pointerdown',e=>{
      if(!rankP0IsRank()||e.pointerType!=='touch'||!rankP0IsBoardTarget(e.target)) return;
      rankP0TouchStart={x:e.clientX,y:e.clientY,pointerId:e.pointerId};
    },true);
    document.addEventListener('pointerup',e=>{
      if(!rankP0IsRank()||e.pointerType!=='touch'||!rankP0TouchStart||!rankP0IsBoardTarget(e.target)){rankP0TouchStart=null;return}
      const dist=Math.hypot(e.clientX-rankP0TouchStart.x,e.clientY-rankP0TouchStart.y);
      rankP0TouchStart=null;
      if(dist<12){
        rankP0SuppressClickUntil=performance.now()+450;
        e.preventDefault();e.stopImmediatePropagation();rankP0Tap(e.clientX,e.clientY);
      }
    },true);
    document.addEventListener('pointercancel',()=>{rankP0TouchStart=null},true);
    document.addEventListener('click',e=>{
      if(rankP0IsRank()&&performance.now()<rankP0SuppressClickUntil&&rankP0IsBoardTarget(e.target)){
        e.preventDefault();e.stopImmediatePropagation();
      }
    },true);

    // Clear transient attempt-only guards whenever Rank is no longer actively playing.
    setInterval(()=>{
      if(!rankP0IsRank()||state.screen!=='training'){
        rankP0TapSelected=null;rankP0Highlight(null);rankP0FinishKey='';rankP0LastInputKey='';
      }else if(!state.complete && Number(state.userMovesDone||0)===0){
        rankP0FinishKey='';
      }
    },300);

    const rankP0Style=document.createElement('style');
    rankP0Style.textContent='.rank-p0-tap-selected{outline:3px solid #c8ff5a;outline-offset:-3px;background:#c8ff5a33!important}';
    document.head.appendChild(rankP0Style);
  }
}catch(err){console.warn('Rank Test P0 patch could not attach',err)}
