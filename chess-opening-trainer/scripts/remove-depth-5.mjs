import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath=resolve('src/main.js');
let source=await readFile(mainPath,'utf8');

const legacyDepthList=/\[\s*5\s*,\s*10\s*,\s*15\s*,\s*20\s*,\s*25\s*,\s*30\s*\]/g;
const matches=source.match(legacyDepthList)?.length||0;
const hasLegacyDefault=/sessionLength\s*:\s*5\b/.test(source);

source=source.replace(legacyDepthList,'[10,15,20,25,30]');
source=source.replace(/sessionLength\s*:\s*5\b/g,'sessionLength:10');

const runtimeMarker='__COT_DEPTH_5_RETIRED__';
if(!source.includes(runtimeMarker)){
  source += `\n\n// --- Product progression: Depth 5 retired ---\ntry{\n  if(!globalThis.${runtimeMarker}){\n    globalThis.${runtimeMarker}=true;\n    const enforceDepth10=()=>{try{if(Number(state?.sessionLength||0)===5)state.sessionLength=10}catch{}};\n    enforceDepth10();\n    if(typeof render==='function'){\n      const depth10BaseRender=render;\n      render=function(...args){enforceDepth10();return depth10BaseRender.apply(this,args)};\n    }\n  }\n}catch(err){console.warn('Depth 10 start guard could not attach',err)}\n`;
}

if(legacyDepthList.test(source))throw new Error('Legacy Depth 5 progression list remains in user-facing main source after migration.');
if(/sessionLength\s*:\s*5\b/.test(source))throw new Error('User-facing main source still defaults to Depth 5.');
if(!source.includes(runtimeMarker))throw new Error('Depth 10 runtime guard missing.');

await writeFile(mainPath,source,'utf8');
console.log(`Depth 5 retired from user progression (${matches} progression references migrated); runtime default forced to 10.`);
