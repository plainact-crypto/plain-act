// --- Rank Test P0 audit fixes: legal input, mobile tap, scoring integrity, navigation races ---
try{
  if(!globalThis.__RANK_TEST_P0_PATCH__){
    globalThis.__RANK_TEST_P0_PATCH__=true;

    const rankP0OriginalBoardInput=onBoardInput;
    const rankP0OriginalRenderTraining=renderTraining;
    const rankP0OriginalFinishSession=finishSession;
    const rankP0OriginalStartRankTest=startRankTest;
    const rankP0OriginalFinishRankTest=finishRankTest;
    const rankP0IsRank=()=>state?.mode==='rank';
    const rankP0UserColor=()=>state?.side==='white'?'w':'b';
    const rankP0Fen=()=>{try{return state?.chess?.fen?.()||''}catch{return ''}};
    let rankP0LastInputKey='';
    let rankP0LastInputAt=0;
    let rankP0TapSelected=null;
    let rankP0TouchStart=null;
    let rankP0SuppressClickUntil=0;
    let rankP0FinishKey='';
    let rankP0Epoch=0;
    let rankP0Committed=false;

    const rankP0Invalidate=()=>{rankP0Epoch++;rankP0TapSelected=null;rankP0FinishKey='';rankP0LastInputKey=''};
    const rankP0Active=(epoch,round=null)=>
      epoch===rankP0Epoch && rankP0IsRank() && state.screen==='training' &&
      (round===null||Number(state.rankRound)===Number(round));

    function rankP0Status(text,isError=false){
      state.status=text;
      state.statusError=!!isError;
      const el=document.querySelector('.status');
      if(el){el.textContent=text;el.classList.toggle('error',!!isError)}
    }

    function rankP0Legal(from,to){
      try{return state.chess.moves({square:from,verbose:true}).find(m=>m.to===to)||null}catch{return null}
    }

    async function rankP0EvaluateFen(fen){
      const result=await engineService.evaluate(fen);
      if(!result) throw new Error('No engine evaluation');
      const cp=result.cp===null||result.cp===undefined?null:Number(result.cp);
      const mate=result.mate===null||result.mate===undefined?null:Number(result.mate);
      if((cp===null||!Number.isFinite(cp))&&(mate===null||!Number.isFinite(mate))) throw new Error('Invalid engine evaluation');
      const turn=String(fen||'').split(/\s+/)[1]||'w';
      const whiteFactor=turn==='w'?1:-1;
      let whiteScore;
      if(mate!==null&&Number.isFinite(mate)) whiteScore=whiteFactor*(mate>0?100000:-100000);
      else whiteScore=whiteFactor*cp;
      return state.side==='white'?whiteScore:-whiteScore;
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

    // Start a fresh epoch for every Rank attempt. Old async engine callbacks become inert.
    startRankTest=async function(...args){
      rankP0Invalidate();
      rankP0Committed=false;
      return rankP0OriginalStartRankTest(...args);
    };

    // The UI evaluation guard is intentionally asynchronous and must not be used as
    // the Rank benchmark. Evaluate the exact FEN directly and only then enable input.
    prepareRankUserTurn=async function(){
      const epoch=rankP0Epoch,round=Number(state.rankRound);
      if(!rankP0Active(epoch,round)) return;
      if(state.chess.isGameOver()){await finishRankRound();return}
      state.engineBusy=true;
      state.status='Engine is setting the benchmark…';
      state.statusError=false;
      render();
      try{
        const fen=rankP0Fen();
        const best=await bestMove();
        if(!rankP0Active(epoch,round)||fen!==rankP0Fen()) return;
        const before=await rankP0EvaluateFen(fen);
        if(!rankP0Active(epoch,round)||fen!==rankP0Fen()) return;
        state.rankBestMove=best;
        state.rankBeforeScore=before;
        state.engineBusy=false;
        state.status='Your move — play normally';
        state.statusError=false;
        render();
      }catch(err){
        if(!rankP0Active(epoch,round)) return;
        console.error('Rank benchmark failed',err);
        state.engineBusy=true;
        state.status='Rank evaluation failed — restart this Rank Test. No score was saved.';
        state.statusError=true;
        render();
      }
    };

    startRankRound=async function(){
      const epoch=rankP0Epoch,roundNo=Number(state.rankRound);
      const round=state.rankRounds[roundNo];
      if(!round){finishRankTest();return}
      setupRankRound(round);
      state.status=`Rank round ${roundNo+1}/${state.rankRounds.length}`;
      state.statusError=false;
      render();
      try{await ensureEngine()}catch(err){
        if(rankP0Active(epoch,roundNo)){
          state.engineBusy=true;state.status='Rank engine failed to start — restart the Rank Test.';state.statusError=true;render();
        }
        return;
      }
      if(!rankP0Active(epoch,roundNo)) return;
      await prepareRankUserTurn();
    };

    async function rankP0EngineTurn(epoch,round){
      if(!rankP0Active(epoch,round)||state.chess.isGameOver()||state.chess.turn()===rankP0UserColor()) return true;
      state.engineBusy=true;
      state.status='Opponent is thinking…';
      state.statusError=false;
      render();
      try{
        let uci=null;
        if(state.rankFreshBranchPending){
          uci=await getAlternativeEngineMove();
          if(!rankP0Active(epoch,round)) return false;
          state.rankFreshBranchPending=false;
        }
        if(!uci) uci=await bestMove();
        if(!rankP0Active(epoch,round)) return false;
        if(!uci){
          state.engineBusy=true;state.status='Rank opponent move failed — restart this Rank Test. No score was saved.';state.statusError=true;render();
          return false;
        }
        const m=state.chess.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});
        state.history.push(m.san);
        state.engineBusy=false;
        state.status=`Opponent played ${m.san}`;
        render();
        await new Promise(resolve=>setTimeout(resolve,420));
        return rankP0Active(epoch,round);
      }catch(err){
        if(rankP0Active(epoch,round)){
          console.error('Rank opponent move failed',err);
          state.engineBusy=true;state.status='Rank opponent move failed — restart this Rank Test. No score was saved.';state.statusError=true;render();
        }
        return false;
      }
    }

    scoreRankMoveAndContinue=async function(){
      const epoch=rankP0Epoch,round=Number(state.rankRound);
      if(!rankP0Active(epoch,round)) return;
      const review=state.rankPendingReview||{};
      const fenAfter=rankP0Fen();
      try{
        const after=await rankP0EvaluateFen(fenAfter);
        if(!rankP0Active(epoch,round)||fenAfter!==rankP0Fen()) return;
        const before=Number(state.rankBeforeScore);
        if(!Number.isFinite(before)||!Number.isFinite(after)) throw new Error('Invalid Rank benchmark');
        const rawLoss=Math.max(0,before-after);
        const loss=review.requiredRepertoire?0:rawLoss;
        const item={
          lossCp:loss,
          rawLossCp:rawLoss,
          accuracy:moveAccuracyFromLoss(loss),
          round:state.rankRound,
          fresh:state.rankFresh,
          fenBefore:review.fenBefore||'',
          playedUci:review.playedUci||'',
          playedSan:review.playedSan||'',
          bestUci:review.bestUci||state.rankBestMove||'',
          bestSan:review.bestSan||'',
          requiredRepertoire:!!review.requiredRepertoire,
          gameSanMoves:[...(review.historyBefore||[]),review.playedSan].filter(Boolean),
          issue:review.requiredRepertoire?'Repertoire Move':rankIssueLabel(loss)
        };
        state.rankLosses.push(item);
        if(state.rankFresh) state.rankFreshLosses.push(item); else state.rankSavedLosses.push(item);
        if(!item.requiredRepertoire&&loss>=35&&item.fenBefore) state.rankReviewItems.push({...item});
        state.rankPendingReview=null;
        state.engineBusy=false;

        if(state.userMovesDone>=state.sessionLength||state.chess.isGameOver()){
          await finishRankRound();return;
        }
        const opponentOk=await rankP0EngineTurn(epoch,round);
        if(!opponentOk||!rankP0Active(epoch,round)) return;
        if(state.chess.isGameOver()){await finishRankRound();return}
        await prepareRankUserTurn();
      }catch(err){
        if(!rankP0Active(epoch,round)) return;
        console.error('Rank move scoring failed',err);
        state.rankPendingReview=null;
        state.engineBusy=true;
        state.status='Rank scoring failed — restart this Rank Test. No Elo was saved.';
        state.statusError=true;
        render();
      }
    };

    finishRankRound=async function(){
      const epoch=rankP0Epoch;
      if(!rankP0Active(epoch)) return;
      state.rankRound++;
      if(state.rankRound>=state.rankRounds.length){finishRankTest();return}
      if(!rankP0Active(epoch)) return;
      await startRankRound();
    };

    // Result persistence is idempotent: Elo/history can be written only once per attempt.
    finishRankTest=function(){
      if(rankP0Committed||!rankP0IsRank()||state.screen!=='training') return;
      rankP0Committed=true;
      return rankP0OriginalFinishRankTest();
    };

    // Hide engine/evaluation information while a Rank attempt is live and wire Rank
    // restart/exit so delayed callbacks are invalidated before navigation happens.
    renderTraining=function(){
      rankP0OriginalRenderTraining();
      if(rankP0IsRank()&&!state.complete){
        document.querySelector('.eval-column')?.remove();
        document.querySelectorAll('.stats').forEach(el=>{
          if(/eval|depth|pv|engine/i.test(el.textContent||'')) el.remove();
        });
        document.querySelector('#hint')?.remove();
        const restart=document.querySelector('#restart');
        if(restart){
          restart.onclick=()=>{rankP0Invalidate();startRankTest()};
        }
        const exit=document.querySelector('#exit');
        exit?.addEventListener('click',rankP0Invalidate,{capture:true,once:true});
      }
    };

    // Keep generic emergency completion idempotent too; normal Rank flow uses finishRankTest.
    finishSession=function(...args){
      if(!rankP0IsRank()) return rankP0OriginalFinishSession(...args);
      const key=`${state.side}|${state.sessionLength}|${state.rankRound}|${rankP0Fen()}|${state.userMovesDone}`;
      if(state.complete||rankP0FinishKey===key) return;
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
    window.addEventListener('popstate',rankP0Invalidate,true);
    window.addEventListener('pagehide',rankP0Invalidate,true);

    setInterval(()=>{
      if(!rankP0IsRank()||state.screen!=='training'){
        rankP0TapSelected=null;rankP0Highlight(null);rankP0FinishKey='';rankP0LastInputKey='';
      }else if(!state.complete&&Number(state.userMovesDone||0)===0){rankP0FinishKey=''}
    },300);

    const rankP0Style=document.createElement('style');
    rankP0Style.textContent='.rank-p0-tap-selected{outline:3px solid #c8ff5a;outline-offset:-3px;background:#c8ff5a33!important}';
    document.head.appendChild(rankP0Style);
  }
}catch(err){console.warn('Rank Test P0 patch could not attach',err)}
