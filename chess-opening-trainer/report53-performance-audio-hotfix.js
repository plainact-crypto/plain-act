// Report #53 — restore fast board motion and make move audio clearly audible.
// This runs after the main app bundle so it can safely override older UX patches
// without changing engine search depth or chess logic.

const style=document.createElement('style');
style.textContent=`
  .cm-chessboard .piece,
  .cm-chessboard [class*="piece"]{
    transition:transform 140ms cubic-bezier(.2,.8,.2,1)!important;
  }
  body.cot-user-dragging .cm-chessboard .piece,
  body.cot-user-dragging .cm-chessboard [class*="piece"]{
    transition:none!important;
  }
`;
document.head.appendChild(style);

let audioCtx=null;
let primed=false;
let lastSoundAt=0;
const getAudio=()=>audioCtx||(audioCtx=new (window.AudioContext||window.webkitAudioContext)());

function primeAudio(){
  try{
    const c=getAudio();
    if(c.state==='suspended') c.resume().catch(()=>{});
    primed=true;
  }catch{}
}

function loudMoveKnock(){
  if(!primed) return;
  const now=performance.now();
  if(now-lastSoundAt<75) return;
  lastSoundAt=now;
  try{
    const c=getAudio();
    const t=c.currentTime;
    const duration=.075;
    const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate);
    const data=buffer.getChannelData(0);
    const base=145;
    for(let i=0;i<data.length;i++){
      const x=i/data.length;
      const noise=Math.random()*2-1;
      const wood=Math.sin(2*Math.PI*base*i/c.sampleRate)+.42*Math.sin(2*Math.PI*315*i/c.sampleRate);
      data[i]=(noise*.24+wood*.68)*Math.exp(-x*9.2);
    }
    const src=c.createBufferSource();src.buffer=buffer;
    const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=610;filter.Q.value=.7;
    const gain=c.createGain();
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(.72,t+.003);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    src.connect(filter);filter.connect(gain);gain.connect(c.destination);
    src.start(t);src.stop(t+duration+.02);
  }catch{}
}

addEventListener('pointerdown',primeAudio,{passive:true});
addEventListener('keydown',primeAudio,{passive:true});

let boardObserver=null;
let observedBoard=null;
function attachBoardAudio(){
  const board=document.querySelector('#board .cm-chessboard');
  if(!board||board===observedBoard) return;
  boardObserver?.disconnect();
  observedBoard=board;
  boardObserver=new MutationObserver(mutations=>{
    for(const m of mutations){
      if(m.type==='attributes' && (m.attributeName==='transform'||m.attributeName==='class'||m.attributeName==='style')){
        loudMoveKnock();
        return;
      }
      if(m.type==='childList' && (m.addedNodes.length||m.removedNodes.length)){
        loudMoveKnock();
        return;
      }
    }
  });
  boardObserver.observe(board,{subtree:true,childList:true,attributes:true,attributeFilter:['transform','class','style']});
}

const rootObserver=new MutationObserver(()=>queueMicrotask(attachBoardAudio));
rootObserver.observe(document.getElementById('app')||document.body,{subtree:true,childList:true});
attachBoardAudio();
