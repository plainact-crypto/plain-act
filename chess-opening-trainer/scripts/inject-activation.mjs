import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath = resolve('src/main.js');
const patchPath = resolve('activation-onboarding-v2.js');
const marker = '__COT_ACTIVATION_ONBOARDING_V2__';

const main = await readFile(mainPath, 'utf8');
if (main.includes(marker)) { console.log('Activation onboarding V2 patch already present.'); process.exit(0); }
let patch = await readFile(patchPath, 'utf8');
if (!patch.includes(marker)) throw new Error('Activation V2 patch marker missing.');

const oldDepths = `  const DEPTHS=[5,10,15,20,25,30];`;
const newDepths = `  const DEPTHS=[10,15,20,25,30];`;
if (!patch.includes(oldDepths)) throw new Error('Activation V2 depth source changed; refusing unsafe injection.');
patch = patch.replace(oldDepths, newDepths);

const oldLifecycle = `  let scheduled=false,lastMode='';
  function refresh(){scheduled=false;if(document.querySelector('#cloudAuthGate'))track('landing_view',{},true);if(!uid())return;showOnboarding();renderHub();sessionNext();let mode='';try{mode=\`${'${state?.screen||\'\'}:${state?.mode||\'\'}'}\`}catch{}if(mode!==lastMode){lastMode=mode;milestones()}}
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(refresh,40)}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  track('landing_view',{},true);if(uid()){returned();setTimeout(refresh,250)}`;
const newLifecycle = `  let scheduled=false,lastMode='';
  function refresh(){scheduled=false;if(document.querySelector('#cloudAuthGate'))track('landing_view',{},true);if(!uid())return;document.querySelector('#cotOnboarding')?.remove();renderHub();sessionNext();let mode='';try{mode=\`${'${state?.screen||\'\'}:${state?.mode||\'\'}'}\`}catch{}if(mode!==lastMode){lastMode=mode;milestones()}}
  function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(refresh)}
  try{if(typeof render==='function'&&!globalThis.__COT_ACTIVATION_RENDER_HOOK__){globalThis.__COT_ACTIVATION_RENDER_HOOK__=true;const baseRender=render;render=function(...args){const out=baseRender.apply(this,args);schedule();return out}}}catch{}
  track('landing_view',{},true);if(uid())returned();`;
if (!patch.includes(oldLifecycle)) throw new Error('Activation V2 lifecycle source changed; refusing unsafe injection.');
patch = patch.replace(oldLifecycle, newLifecycle);

const oldButtons = `  const buttons=()=>[...document.querySelectorAll('button,[role="button"],a')].filter(visible);`;
const newButtons = `  const buttons=()=>[...document.querySelectorAll('button,[role="button"],a')].filter(el=>visible(el)&&!el.closest('.cot-activation-hub'));`;
if (!patch.includes(oldButtons)) throw new Error('Activation V2 navigation button source changed; refusing unsafe injection.');
patch = patch.replace(oldButtons, newButtons);

const oldVariation = `  function clickVariation(i){const re=new RegExp(\`Variation\\\\s*${'${i+1}'}(?:\\\\D|$)\`,'i');const el=buttons().find(x=>re.test(String(x.textContent||'')));if(el){el.click();return true}const card=[...document.querySelectorAll('article,section,div')].find(x=>re.test(String(x.textContent||''))&&x.querySelector('button'));const b=card?.querySelector('button');if(visible(b)){b.click();return true}return false}`;
const newVariation = `  function clickVariation(i){const re=new RegExp(\`Variation\\\\s*${'${i+1}'}(?:\\\\D|$)\`,'i');const el=buttons().find(x=>re.test(String(x.textContent||'')));if(el){el.click();return true}const card=[...document.querySelectorAll('article,section,div')].filter(x=>!x.closest('.cot-activation-hub')).find(x=>re.test(String(x.textContent||''))&&x.querySelector('button'));const b=card?.querySelector('button');if(visible(b)&&!b.closest('.cot-activation-hub')){b.click();return true}return false}`;
if (!patch.includes(oldVariation)) throw new Error('Activation V2 variation navigation source changed; refusing unsafe injection.');
patch = patch.replace(oldVariation, newVariation);

const oldProgress = `<div class=\"cot-opening-progress\">${'${card(p,\'white\',focus===\'white\')}${card(p,\'black\',focus===\'black\')}'}</div>`;
const newProgress = `<details class=\"cot-progress-details\"><summary>View opening progress</summary><div class=\"cot-opening-progress\">${'${card(p,\'white\',focus===\'white\')}${card(p,\'black\',focus===\'black\')}'}</div></details>`;
if (!patch.includes(oldProgress)) throw new Error('Activation V2 opening progress source changed; refusing unsafe injection.');
patch = patch.replace(oldProgress, newProgress);

const cssAnchor = '  document.head.appendChild(css);';
const hierarchyCss = `  css.textContent += \`\n  #app>.cot-activation-hub{order:-10000!important;grid-column:1/-1!important;width:100%!important;align-self:start!important}\n  .cot-progress-details{border-top:1px solid #263543;margin-top:4px;padding-top:12px}\n  .cot-progress-details summary{cursor:pointer;color:#cbd5df;font-weight:850;font-size:13px;list-style:none}\n  .cot-progress-details summary::-webkit-details-marker{display:none}\n  .cot-progress-details summary:after{content:' ↓';color:#c8ff5a}.cot-progress-details[open] summary:after{content:' ↑'}\n  @media(max-width:760px){.cot-activation-hub{margin-top:6px!important}.cot-next-card{padding:15px}.cot-journey{display:flex!important;gap:5px!important;overflow:hidden}.cot-journey span{flex:1;min-width:0;padding:7px 3px!important;font-size:10px!important;white-space:nowrap}}\n  \`;\n  document.head.appendChild(css);`;
if (!patch.includes(cssAnchor)) throw new Error('Activation V2 CSS anchor changed; refusing unsafe injection.');
patch = patch.replace(cssAnchor, hierarchyCss);
if (/new MutationObserver\(schedule\)/.test(patch)) throw new Error('Activation V2 global observer regression remains after transform.');
await appendFile(mainPath, `\n\n${patch}\n`, 'utf8');
console.log('Activation V2 injected with Depth 5 retired, onboarding skipped, dashboard-first reset flow, and hub-safe training navigation.');
