// Mobile Practice Test UX: tolerate taps, preserve drag, and keep opponent moves readable.
try{
  if(!globalThis.__MOBILE_TEST_UX_PATCH__){
    globalThis.__MOBILE_TEST_UX_PATCH__=true;

    const style=document.createElement('style');
    style.textContent=`
      .cm-chessboard .piece,
      .cm-chessboard [class*="piece"]{
        transition:transform 520ms cubic-bezier(.2,.8,.2,1)!important;
      }
      body.cot-user-dragging .cm-chessboard .piece,
      body.cot-user-dragging .cm-chessboard [class*="piece"]{
        transition:none!important;
      }
      .cot-mobile-test-note{
        position:fixed;left:50%;bottom:18px;transform:translateX(-50%);
        z-index:99999;background:rgba(20,20,20,.94);color:#fff;
        padding:9px 12px;border-radius:10px;font:600 12px/1.25 system-ui,sans-serif;
        box-shadow:0 8px 28px rgba(0,0,0,.25);pointer-events:none;
      }
    `;
    document.head.appendChild(style);

    const isBoardTarget=(target)=>!!target?.closest?.('.cm-chessboard, #board');
    const isMobileTouch=()=>navigator.maxTouchPoints>0 || matchMedia('(pointer:coarse)').matches;
    let touchStart=null;
    let suppressClickUntil=0;
    let noteShown=false;

    const showTapNote=()=>{
      if(noteShown) return;
      noteShown=true;
      const n=document.createElement('div');
      n.className='cot-mobile-test-note';
      n.textContent='Practice Test: tap a piece then its destination, or drag it normally.';
      document.body.appendChild(n);
      setTimeout(()=>n.remove(),2200);
    };

    document.addEventListener('pointerdown',(e)=>{
      if(!isBoardTarget(e.target)) return;
      document.body.classList.add('cot-user-dragging');
      if(e.pointerType==='touch' && isMobileTouch() && state?.mode==='test'){
        touchStart={x:e.clientX,y:e.clientY,t:performance.now(),pointerId:e.pointerId};
      }
    },true);

    document.addEventListener('pointerup',(e)=>{
      if(!isBoardTarget(e.target)){
        document.body.classList.remove('cot-user-dragging');
        touchStart=null;
        return;
      }
      document.body.classList.remove('cot-user-dragging');
      if(e.pointerType==='touch' && touchStart && state?.mode==='test'){
        const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;
        const dist=Math.hypot(dx,dy);
        if(dist<12){
          suppressClickUntil=performance.now()+450;
          e.preventDefault();
          e.stopImmediatePropagation();
          if(typeof globalThis.__COT_TEST_TAP__==='function'){
            globalThis.__COT_TEST_TAP__(e.clientX,e.clientY);
          }else{
            showTapNote();
          }
        }
      }
      touchStart=null;
    },true);

    document.addEventListener('pointercancel',()=>{
      document.body.classList.remove('cot-user-dragging');
      touchStart=null;
    },true);

    document.addEventListener('click',(e)=>{
      if(performance.now()<suppressClickUntil && isBoardTarget(e.target) && state?.mode==='test'){
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },true);
  }
}catch(err){console.warn('Mobile test UX patch could not attach',err)}
// --- Practice Test P0 audit fixes: legal input, mobile tap, scoring, review, eval, navigation ---
try{
  if(!globalThis.__PRACTICE_TEST_P0_PATCH__){
    globalThis.__PRACTICE_TEST_P0_PATCH__=true;

    const p0OriginalStartPracticeTest=startPracticeTest;
    const p0OriginalBoardInput=onBoardInput;
    const p0OriginalCompleteHTML=completeHTML;
    const p0OriginalRenderTraining=renderTraining;

    const p0UserColor=()=>state.side==='white'?'w':'b';
    const p0TestUserSteps=()=>Math.min(
      Number(state.sessionLength||0),
      (state.trainingLine||[]).filter(step=>step?.actor==='user').length
    );
    const p0MoveUci=(from,to,promotion='')=>`${from}${to}${promotion||''}`;
    const p0ExpectedUci=()=>state.guideMove?`${state.guideMove.from}${state.guideMove.to}`:'';
    const p0FenKey=()=>{try{return state.chess?.fen?.()||''}catch{return ''}};
    const p0Sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

    function p0ResetAttemptState(){
      state.practiceReviewActive=false;
      state.practiceReviewIndex=0;
      state.practiceTestMistakes=[];
      state.practiceTestMistakeFens=new Set();
      state.practiceTestAssistedFens=new Set();
      state.practiceTestFirstTryCorrect=0;
      state.practiceTestDecisionTotal=0;
      state.practiceTestLastRejected='';
      state.practiceTestLastRejectedAt=0;
      state.practiceTapSelected=null;
    }

    startPracticeTest=async function(index){
      p0ResetAttemptState();
      await p0OriginalStartPracticeTest(index);
      if(state.mode==='test') state.practiceTestDecisionTotal=p0TestUserSteps();
    };

    function p0Status(text,isError=false){
      state.status=text;
      state.statusError=!!isError;
      const el=document.querySelector('.status');
      if(el){
        el.textContent=text;
        el.classList.toggle('error',!!isError);
      }
    }

    function p0RecordMistake(from,to,legal){
      const fen=p0FenKey();
      const expected=p0ExpectedUci();
      const played=p0MoveUci(from,to,legal?.promotion||'');
      const now=performance.now();
      const fingerprint=`${fen}|${played}`;
      if(state.practiceTestLastRejected===fingerprint && now-Number(state.practiceTestLastRejectedAt||0)<420){
        return false;
      }
      state.practiceTestLastRejected=fingerprint;
      state.practiceTestLastRejectedAt=now;
      state.practiceTestMistakeFens.add(fen);
      state.practiceTestMistakes.push({
        fenBefore:fen,
        playedUci:played,
        playedSan:moveSanFromFen(fen,played),
        expectedUci:expected,
        expectedSan:expected?moveSanFromFen(fen,expected):'',
        historyBefore:[...(state.history||[])],
        moveNumber:(state.userMovesDone||0)+1
      });
      state.mistakes++;
      state.practiceInvalid=true;
      return true;
    }

    onBoardInput=function(event){
      if(state.mode==='test' && event?.type===INPUT_EVENT_TYPE.validateMoveInput){
        if(state.engineBusy||state.complete||state.chess.turn()!==p0UserColor()) return false;
        const from=event.squareFrom,to=event.squareTo;
        const legal=state.chess.moves({square:from,verbose:true}).find(m=>m.to===to);

        if(!legal){
          state.practiceTapSelected=null;
          p0Status('Illegal move — try again. This does not count as a mistake.',false);
          return false;
        }

        const expected=state.guideMove;
        if(!expected||expected.from!==from||expected.to!==to){
          p0RecordMistake(from,to,legal);
          state.practiceTapSelected=null;
          p0Status('Legal move, but not the learned line. Try the position again.',true);
          return false;
        }

        const fen=p0FenKey();
        const firstTry=!state.practiceTestMistakeFens.has(fen) && !state.practiceTestAssistedFens.has(fen);
        const accepted=p0OriginalBoardInput(event);
        if(accepted && firstTry) state.practiceTestFirstTryCorrect++;
        state.practiceTapSelected=null;
        return accepted;
      }
      return p0OriginalBoardInput(event);
    };

    continueRecordedTest=async function(){
      if(state.screen!=='training'||state.mode!=='test') return;
      while(state.testCursor < state.trainingLine.length){
        const step=state.trainingLine[state.testCursor];
        if(step.actor==='engine'){
          try{
            const move=state.chess.move({from:step.from,to:step.to,promotion:step.promotion||'q'});
            state.history.push(move.san);
            state.testCursor++;
            state.guideMove=null;
            state.hintVisible=false;
            state.status=`Opponent played ${move.san}`;
            state.statusError=false;
            render();
            await p0Sleep(620);
            if(state.screen!=='training'||state.mode!=='test') return;
            continue;
          }catch(e){
            console.error('Recorded engine move failed',step,e);
            state.status='Recorded line could not be replayed.';
            state.statusError=true;
            render();
            return;
          }
        }
        state.guideMove={from:step.from,to:step.to};
        state.status='Your move';
        state.statusError=false;
        state.hintVisible=false;
        render();
        return;
      }
      finishSession();
    };

    function p0Score(){
      const total=Math.max(0,Number(state.practiceTestDecisionTotal||state.userMovesDone||0));
      const correct=Math.max(0,Math.min(total,Number(state.practiceTestFirstTryCorrect||0)));
      const pct=total?Math.round(correct/total*100):0;
      return {total,correct,pct};
    }

    completeHTML=function(){
      if(state.mode!=='test') return p0OriginalCompleteHTML();
      const lesson=currentLesson();
      const validPass=!state.practiceInvalid&&!state.practiceHintUsed&&state.mistakes===0;
      const score=p0Score();
      const reviewCount=(state.practiceTestMistakes||[]).length;
      return `<div class="complete"><div class="complete-card practice-p0-result"><div class="kicker">Practice Test Result</div>
        <h2>${validPass?'Passed ✓':'Practice complete'}</h2>
        <div class="practice-score-grid">
          <div><strong>${score.pct}%</strong><span>first-try score</span></div>
          <div><strong>${score.correct}/${score.total}</strong><span>correct first try</span></div>
          <div><strong>${state.mistakes||0}</strong><span>real mistakes</span></div>
        </div>
        <p class="sub">${state.userMovesDone} moves completed · ${lesson?.passes||0}/5 valid passes${state.practiceHintUsed?' · Hint used':''}</p>
        ${reviewCount?`<button class="primary" id="practiceReviewMistakes">Review Mistakes on Board (${reviewCount})</button>`:''}
        <button class="secondary" style="width:100%;margin-top:10px" id="practiceTrainLine">Back to Training</button>
        <button class="secondary" style="width:100%;margin-top:10px" id="again">${(lesson?.passes||0)>=5?'Back to Level':'Try Again'}</button>
        <button class="secondary" style="width:100%;margin-top:10px" id="menu">Back to Level</button>
      </div></div>`;
    };

    function p0ReviewItem(){
      const items=state.practiceTestMistakes||[];
      if(!items.length) return null;
      state.practiceReviewIndex=Math.max(0,Math.min(Number(state.practiceReviewIndex||0),items.length-1));
      return items[state.practiceReviewIndex];
    }

    function renderPracticeMistakeReview(){
      const item=p0ReviewItem();
      if(!item){state.practiceReviewActive=false;render();return;}
      const items=state.practiceTestMistakes||[];
      layout(`<section class="practice-review-shell">
        <div class="practice-review-head"><div><div class="kicker">Practice Test · Mistake Review</div><h2>Mistake ${state.practiceReviewIndex+1} of ${items.length}</h2></div>
        <button class="secondary" id="practiceReviewBack">Back to Result</button></div>
        <div class="practice-review-grid">
          <div class="board-shell"><div id="board"></div><div class="guide-layer" id="guide"></div></div>
          <aside class="side-panel practice-review-panel">
            <div class="meta">Move ${item.moveNumber||state.practiceReviewIndex+1} · ${openingName()} · Level ${state.sessionLength}</div>
            <div class="practice-review-move wrong"><span>You played</span><strong>${item.playedSan||item.playedUci}</strong><small>${item.playedUci}</small></div>
            <div class="practice-review-move right"><span>Learned move</span><strong>${item.expectedSan||item.expectedUci}</strong><small>${item.expectedUci}</small></div>
            <p class="sub">The board is restored to the position before the mistake so you can compare the move directly.</p>
            <div class="row"><button class="secondary" id="practiceReviewPrev" ${state.practiceReviewIndex===0?'disabled':''}>Previous</button><button class="secondary" id="practiceReviewNext" ${state.practiceReviewIndex>=items.length-1?'disabled':''}>Next</button></div>
            <button class="primary" style="width:100%;margin-top:12px" id="practiceReviewTrain">Train This Line</button>
          </aside>
        </div>
      </section>`);
      try{
        state.board=new Chessboard(document.querySelector('#board'),{
          position:item.fenBefore,
          orientation:state.side==='black'?COLOR.black:COLOR.white,
          assetsUrl:`${APP_BASE}cm-chessboard/`,responsive:true,
          style:{cssClass:'default',showCoordinates:true,animationDuration:180,pieces:{file:'pieces/standard.svg'}}
        });
      }catch(e){console.warn('Practice review board failed',e)}
      state.guideMove={from:item.expectedUci.slice(0,2),to:item.expectedUci.slice(2,4)};
      state.hintVisible=true;
      drawGuide();
      document.querySelector('#practiceReviewBack')?.addEventListener('click',()=>{state.practiceReviewActive=false;state.hintVisible=false;render()});
      document.querySelector('#practiceReviewPrev')?.addEventListener('click',()=>{state.practiceReviewIndex--;render()});
      document.querySelector('#practiceReviewNext')?.addEventListener('click',()=>{state.practiceReviewIndex++;render()});
      document.querySelector('#practiceReviewTrain')?.addEventListener('click',()=>{state.practiceReviewActive=false;state.hintVisible=false;startSavedTraining(state.variationIndex)});
    }

    renderTraining=function(){
      if(state.practiceReviewActive){renderPracticeMistakeReview();return;}
      p0OriginalRenderTraining();
      if(state.mode==='test'){
        document.querySelector('.eval-column')?.remove();
        const stats=document.querySelector('.side-panel .stats');
        if(stats) stats.remove();
        document.querySelector('#practiceReviewMistakes')?.addEventListener('click',()=>{state.practiceReviewActive=true;state.practiceReviewIndex=0;render()});
        document.querySelector('#practiceTrainLine')?.addEventListener('click',()=>startSavedTraining(state.variationIndex));
        document.querySelector('#hint')?.addEventListener('click',()=>{
          try{state.practiceTestAssistedFens.add(p0FenKey())}catch{}
        });
      }
    };

    function p0SquareAtPoint(clientX,clientY){
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

    function p0TapHighlight(square){
      const layer=document.querySelector('#guide');
      if(!layer) return;
      layer.querySelectorAll('.practice-tap-selected').forEach(x=>x.remove());
      if(!square) return;
      const el=document.createElement('div');
      el.className='guide-square from practice-tap-selected';
      const file=square.charCodeAt(0)-97,rank=+square[1];
      let col,row;
      if(state.side==='black'){col=7-file;row=rank-1}else{col=file;row=8-rank}
      el.style.left=`${col*12.5}%`;el.style.top=`${row*12.5}%`;
      layer.appendChild(el);
    }

    globalThis.__COT_TEST_TAP__=function(clientX,clientY){
      if(state.mode!=='test'||state.complete||state.engineBusy||state.chess.turn()!==p0UserColor()) return;
      const square=p0SquareAtPoint(clientX,clientY);
      if(!square) return;
      const piece=state.chess.get(square);
      const selected=state.practiceTapSelected;
      if(!selected){
        if(piece?.color===p0UserColor()){
          state.practiceTapSelected=square;
          p0TapHighlight(square);
          p0Status(`Selected ${square.toUpperCase()} — tap the destination.`,false);
        }else{
          p0Status('Select one of your pieces. No mistake counted.',false);
        }
        return;
      }
      if(piece?.color===p0UserColor()){
        state.practiceTapSelected=square;
        p0TapHighlight(square);
        p0Status(`Selected ${square.toUpperCase()} — tap the destination.`,false);
        return;
      }
      const from=selected;
      state.practiceTapSelected=null;
      p0TapHighlight(null);
      const accepted=onBoardInput({type:INPUT_EVENT_TYPE.validateMoveInput,squareFrom:from,squareTo:square});
      if(accepted){
        try{state.board?.setPosition?.(state.chess.fen(),true)}catch{}
      }
    };

    const p0Style=document.createElement('style');
    p0Style.textContent=`
      .practice-score-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:16px 0}
      .practice-score-grid>div{background:#0c1319;border:1px solid #26333e;border-radius:12px;padding:12px 8px;text-align:center}
      .practice-score-grid strong{display:block;font-size:22px;color:#c8ff5a}.practice-score-grid span{font-size:11px;color:#aab5bf}
      .practice-review-shell{max-width:1180px;margin:0 auto;padding:20px}.practice-review-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}
      .practice-review-grid{display:grid;grid-template-columns:minmax(0,720px) minmax(280px,1fr);gap:22px;align-items:start}.practice-review-move{padding:14px;border-radius:12px;margin:10px 0;background:#0c1319;border:1px solid #2a3540}.practice-review-move span,.practice-review-move small{display:block;color:#9da9b4}.practice-review-move strong{display:block;font-size:24px;margin:4px 0}.practice-review-move.wrong strong{color:#ff9b9b}.practice-review-move.right strong{color:#c8ff5a}
      .practice-tap-selected{outline:3px solid #c8ff5a;outline-offset:-3px;background:#c8ff5a33!important}
      @media(max-width:760px){.practice-score-grid{grid-template-columns:1fr}.practice-review-shell{padding:8px}.practice-review-head{align-items:flex-start}.practice-review-grid{grid-template-columns:1fr;gap:12px}.practice-review-panel{min-height:auto}.practice-review-move strong{font-size:20px}}
    `;
    document.head.appendChild(p0Style);
  }
}catch(err){console.warn('Practice Test P0 patch could not attach',err)}
