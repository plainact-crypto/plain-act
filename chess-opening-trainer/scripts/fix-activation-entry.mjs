import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath = resolve('src/main.js');
const marker = '__COT_ACTIVATION_ONBOARDING_V2__';
let source = await readFile(mainPath, 'utf8');

if (!source.includes(marker)) throw new Error('Activation V2 marker missing from final source; refusing entry hotfix.');

const count = (needle) => source.split(needle).length - 1;
const driveCountBefore = count('function driveTo(a){');
const markerCountBefore = count(marker);
console.log(`Activation final-source ownership before hotfix: driveTo=${driveCountBefore} marker=${markerCountBefore}`);
if (driveCountBefore !== 1) throw new Error(`Expected exactly one activation driveTo in final source, found ${driveCountBefore}`);

const variationStart = source.indexOf('  function clickVariation(i){');
const driveStart = source.indexOf('  function driveTo(a){', variationStart);
const cardStart = source.indexOf('\n\n  function card(', driveStart);
if (variationStart < 0 || driveStart < 0 || cardStart < 0) throw new Error('Activation navigation functions not found in final source.');

const replacement = `  globalThis.__COT_ACTIVATION_ENTRY_HOTFIX__='direct-v3';
  function clickVariation(i){
    const cards=[...document.querySelectorAll('.variation-card')].filter(visible);
    const card=cards[Number(i||0)];
    const create=card?.querySelector('[data-new]');
    if(visible(create)&&!create.disabled){create.click();return true}
    return false;
  }
  function driveTo(a){
    document.documentElement.dataset.cotActivationEntry='clicked';
    localStorage.setItem(FOCUS_KEY,a.side);
    document.querySelector('#cotOnboarding')?.remove();
    document.querySelector('#cloudAuthGate')?.remove();
    try{
      document.documentElement.dataset.cotActivationEntry='direct-start';
      state.side=a.side;
      state.sessionLength=Math.max(10,Number(a.depth||10));
      state.variationIndex=Math.max(0,Number(a.variation||0));
      state.complete=false;
      if(a.mode==='guided'&&typeof startNewTraining==='function'){
        document.documentElement.dataset.cotActivationEntry='guided-call';
        Promise.resolve(startNewTraining(state.variationIndex,true)).then(()=>{document.documentElement.dataset.cotActivationEntry='guided-resolved'}).catch(err=>{document.documentElement.dataset.cotActivationEntry='guided-rejected';document.documentElement.dataset.cotActivationError=String(err?.message||err);console.warn('Activation Guided entry failed',err)});
        return;
      }
      if(a.mode==='test'&&typeof startPracticeTest==='function'){
        document.documentElement.dataset.cotActivationEntry='practice-call';
        Promise.resolve(startPracticeTest(state.variationIndex)).then(()=>{document.documentElement.dataset.cotActivationEntry='practice-resolved'}).catch(err=>{document.documentElement.dataset.cotActivationEntry='practice-rejected';document.documentElement.dataset.cotActivationError=String(err?.message||err)});
        return;
      }
      document.documentElement.dataset.cotActivationEntry='direct-function-missing';
    }catch(err){document.documentElement.dataset.cotActivationEntry='direct-error';document.documentElement.dataset.cotActivationError=String(err?.message||err);console.warn('Activation direct entry unavailable',err)}
    try{render?.()}catch{}
    const launchVisibleVariation=()=>{
      const cards=[...document.querySelectorAll('.variation-card')].filter(visible);
      const card=cards[Number(a.variation||0)];
      if(!card)return false;
      if(a.mode==='guided'){const button=card.querySelector('[data-new]');if(visible(button)&&!button.disabled){document.documentElement.dataset.cotActivationEntry='fallback-data-new';button.click();return true}}
      if(a.mode==='test'){const button=[...card.querySelectorAll('button')].find(x=>/Practice Test/i.test(x.textContent||'')&&visible(x)&&!x.disabled);if(button){document.documentElement.dataset.cotActivationEntry='fallback-practice';button.click();return true}}
      return false;
    };
    if(launchVisibleVariation())return;
    const side=a.side==='white'?[/London System/i,/\\bWhite\\b/i]:[/Caro-?Kann/i,/\\bBlack\\b/i];
    const depth=[new RegExp(\`(?:Depth|Level|Open)[^\\n]{0,18}\\b\${a.depth}\\b\`,'i'),new RegExp(\`\\b\${a.depth}\\s*moves?\`,'i')];
    const steps=[()=>clickText(side),()=>clickText(depth),()=>a.mode==='rank'?true:(launchVisibleVariation()||clickVariation(a.variation)),()=>a.mode==='rank'?clickText([/Rank Test/i,/Start Rank/i]):true];
    let i=0,tries=0;const tick=()=>{if(i>=steps.length)return;let ok=false;try{ok=steps[i]()}catch{}if(ok){i++;tries=0;setTimeout(tick,130)}else if(++tries<8)setTimeout(tick,180);else{i++;tries=0;setTimeout(tick,120)}};setTimeout(tick,80);
  }`;

source = source.slice(0, variationStart) + replacement + source.slice(cardStart);
if (!source.includes("__COT_ACTIVATION_ENTRY_HOTFIX__='direct-v3'")) throw new Error('Runtime activation hotfix marker missing.');
if (!source.includes('startNewTraining(state.variationIndex,true)')) throw new Error('Direct Guided Training entry missing after hotfix.');
await writeFile(mainPath, source, 'utf8');
console.log(`Activation final-source ownership after hotfix: driveTo=${source.split('function driveTo(a){').length-1} runtimeMarker=${source.includes("__COT_ACTIVATION_ENTRY_HOTFIX__='direct-v3'")}`);
