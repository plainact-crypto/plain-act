import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath=resolve('src/main.js');
const patchPath=resolve('training-performance-audio-patch.js');
const brokerPath=resolve('guided-single-search-broker.js');
const marker='__COT_TRAINING_PERFORMANCE_AUDIO_FIX__';
const brokerMarker='__COT_GUIDED_SINGLE_SEARCH_BROKER__';
const legacyMarker='// --- Natural wooden chess-piece movement audio ---';

let main=await readFile(mainPath,'utf8');
if(!main.includes(marker)){
  const patch=await readFile(patchPath,'utf8');
  if(!patch.includes(marker))throw new Error('Training performance patch marker missing.');
  const at=main.indexOf(legacyMarker);
  if(at<0)throw new Error('Legacy wood/mobile patch anchor missing; refusing unsafe late injection.');
  main=`${main.slice(0,at)}\n${patch}\n\n${main.slice(at)}`;
}

if(!main.includes(brokerMarker)){
  const broker=await readFile(brokerPath,'utf8');
  if(!broker.includes(brokerMarker))throw new Error('Guided single-search broker marker missing.');
  main += `\n\n${broker}\n`;
}

await writeFile(mainPath,main,'utf8');
console.log('Training performance fix and Guided single-search broker injected.');
