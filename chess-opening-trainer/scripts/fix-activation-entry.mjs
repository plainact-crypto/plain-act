import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath = resolve('src/main.js');
const marker = '__COT_ACTIVATION_ONBOARDING_V2__';
let source = await readFile(mainPath, 'utf8');

if (!source.includes(marker)) {
  throw new Error('Activation V2 marker missing from final source; refusing entry hotfix.');
}

const variationStart = source.indexOf('  function clickVariation(i){');
const driveStart = source.indexOf('  function driveTo(a){', variationStart);
const cardStart = source.indexOf('\n\n  function card(', driveStart);
if (variationStart < 0 || driveStart < 0 || cardStart < 0) {
  throw new Error('Activation navigation functions not found in final source.');
}

const replacement = `  function clickVariation(i){
    const cards=[...document.querySelectorAll('.variation-card')].filter(visible);
    const card=cards[Number(i||0)];
    const create=card?.querySelector('[data-new]');
    if(visible(create)&&!create.disabled){create.click();return true}
    return false;
  }
  function driveTo(a){
    localStorage.setItem(FOCUS_KEY,a.side);
    document.querySelector('#cotOnboarding')?.remove();
    document.querySelector('#cloudAuthGate')?.remove();

    // Stable P0 path: enter the same application functions used by course controls.
    // This runs inside the final main module, so lexical state/start functions are available.
    try{
      state.side=a.side;
      state.sessionLength=Math.max(10,Number(a.depth||10));
      state.variationIndex=Math.max(0,Number(a.variation||0));
      state.complete=false;
      if(a.mode==='guided'&&typeof startNewTraining==='function'){
        Promise.resolve(startNewTraining(state.variationIndex,true)).catch(err=>console.warn('Activation Guided entry failed',err));
        return;
      }
      if(a.mode==='test'&&typeof startPracticeTest==='function'){
        Promise.resolve(startPracticeTest(state.variationIndex)).catch(err=>console.warn('Activation Practice entry failed',err));
        return;
      }
    }catch(err){console.warn('Activation direct entry unavailable',err)}

    // DOM fallback for Rank or defensive compatibility with future course refactors.
    try{render?.()}catch{}
    const launchVisibleVariation=()=>{
      const cards=[...document.querySelectorAll('.variation-card')].filter(visible);
      const card=cards[Number(a.variation||0)];
      if(!card)return false;
      if(a.mode==='guided'){
        const button=card.querySelector('[data-new]');
        if(visible(button)&&!button.disabled){button.click();return true}
      }
      if(a.mode==='test'){
        const button=[...card.querySelectorAll('button')].find(x=>/Practice Test/i.test(x.textContent||'')&&visible(x)&&!x.disabled);
        if(button){button.click();return true}
      }
      return false;
    };
    if(launchVisibleVariation())return;
    const side=a.side==='white'?[/London System/i,/\\bWhite\\b/i]:[/Caro-?Kann/i,/\\bBlack\\b/i];
    const depth=[new RegExp(\`(?:Depth|Level|Open)[^\\n]{0,18}\\b\${a.depth}\\b\`,'i'),new RegExp(\`\\b\${a.depth}\\s*moves?\`,'i')];
    const steps=[
      ()=>clickText(side),
      ()=>clickText(depth),
      ()=>a.mode==='rank'?true:(launchVisibleVariation()||clickVariation(a.variation)),
      ()=>a.mode==='rank'?clickText([/Rank Test/i,/Start Rank/i]):true
    ];
    let i=0,tries=0;
    const tick=()=>{
      if(i>=steps.length)return;
      let ok=false;try{ok=steps[i]()}catch{}
      if(ok){i++;tries=0;setTimeout(tick,130)}
      else if(++tries<8)setTimeout(tick,180);
      else{i++;tries=0;setTimeout(tick,120)}
    };
    setTimeout(tick,80);
  }`;

source = source.slice(0, variationStart) + replacement + source.slice(cardStart);

if (!source.includes('startNewTraining(state.variationIndex,true)')) {
  throw new Error('Direct Guided Training entry missing after hotfix.');
}
if (!source.includes("querySelector('[data-new]')")) {
  throw new Error('Exact Guided Training CTA fallback missing after hotfix.');
}

await writeFile(mainPath, source, 'utf8');
console.log('Final-source activation entry hotfix installed: Continue Training enters Guided/Practice through application state with exact CTA fallback.');
