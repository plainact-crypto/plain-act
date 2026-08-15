// Practice Hint product rule:
// - Practice Test: hints are always available, including multiple hints in one attempt.
// - Using any hint makes that attempt practice-only; it must NOT add a valid pass.
// - Rank Test: no hint control at all.
try{
  if(!globalThis.__COT_PRACTICE_HINT_POLICY__){
    globalThis.__COT_PRACTICE_HINT_POLICY__=true;

    const hintPolicyOriginalStartPracticeTest=startPracticeTest;
    const hintPolicyOriginalRenderTraining=renderTraining;

    startPracticeTest=async function(...args){
      state.practiceHintUsed=false;
      state.practiceInvalid=false;
      state.hintVisible=false;
      return hintPolicyOriginalStartPracticeTest(...args);
    };

    const hintPolicyFen=()=>{try{return state?.chess?.fen?.()||''}catch{return ''}};

    function markPracticeHintUsed(){
      if(state?.mode!=='test'||state?.complete) return;
      state.practiceHintUsed=true;
      state.practiceInvalid=true;
      state.hintVisible=true;
      try{state.practiceTestAssistedFens?.add?.(hintPolicyFen())}catch{}
      try{drawGuide?.()}catch{}
      state.status='Hint shown — keep going. This attempt is practice only and will not count toward 5/5.';
      state.statusError=true;
      const status=document.querySelector('.status');
      if(status){
        status.textContent=state.status;
        status.classList.add('error');
      }
    }

    function ensurePracticeHint(){
      if(state?.mode!=='test'||state?.complete) return;
      let hint=document.querySelector('#hint');
      if(!hint){
        const restart=document.querySelector('#restart');
        const row=restart?.parentElement;
        if(row){
          hint=document.createElement('button');
          hint.id='hint';
          hint.className='secondary';
          hint.textContent='Hint — Show Move';
          row.insertBefore(hint,restart);
        }
      }
      if(!hint) return;
      hint.hidden=false;
      hint.disabled=false;
      hint.removeAttribute('aria-disabled');
      hint.style.display='';
      if(hint.dataset.practiceHintPolicy!=='1'){
        hint.dataset.practiceHintPolicy='1';
        hint.addEventListener('click',()=>{
          markPracticeHintUsed();
          // Some legacy handlers disable the button after one use. Practice hints are unlimited.
          queueMicrotask(()=>{
            const current=document.querySelector('#hint');
            if(current && state?.mode==='test' && !state?.complete){
              current.disabled=false;
              current.hidden=false;
              current.removeAttribute('aria-disabled');
              current.style.display='';
              markPracticeHintUsed();
            }
          });
        },true);
      }
    }

    renderTraining=function(...args){
      const result=hintPolicyOriginalRenderTraining(...args);
      if(state?.mode==='rank'){
        document.querySelector('#hint')?.remove();
        return result;
      }
      if(state?.mode==='test') ensurePracticeHint();
      return result;
    };
  }
}catch(err){console.warn('Practice Hint policy patch could not attach',err)}
