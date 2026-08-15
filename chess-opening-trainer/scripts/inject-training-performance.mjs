import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath=resolve('src/main.js');
const patchPath=resolve('training-performance-audio-patch.js');
const brokerPath=resolve('guided-single-search-broker.js');
const exactQualityPath=resolve('exact-best-quality-patch.js');
const marker='__COT_TRAINING_PERFORMANCE_AUDIO_FIX__';
const brokerMarker='__COT_GUIDED_SINGLE_SEARCH_BROKER__';
const exactQualityMarker='__COT_EXACT_BEST_QUALITY__';
const legacyMarker='// --- Natural wooden chess-piece movement audio ---';
const legacyQualityMarker='// P0 Trust Fix: conservative Guided move-quality classification.';

let main=await readFile(mainPath,'utf8');
if(!main.includes(marker)){
  const patch=await readFile(patchPath,'utf8');
  if(!patch.includes(marker))throw new Error('Training performance patch marker missing.');
  const at=main.indexOf(legacyMarker);
  if(at<0)throw new Error('Legacy wood/mobile patch anchor missing; refusing unsafe late injection.');
  // Keep the performance patch before legacy observers so they remain disabled.
  main=`${main.slice(0,at)}\n${patch}\n\n${main.slice(at)}`;
}

// Report #55: install exact Top-1 classifier BEFORE the legacy classifier executes.
// It sets the legacy trust-fix guard, so the old <=20cp-as-Best implementation never attaches.
if(!main.includes(exactQualityMarker)){
  const exactQuality=await readFile(exactQualityPath,'utf8');
  if(!exactQuality.includes(exactQualityMarker))throw new Error('Exact Best classifier marker missing.');
  const qualityAt=main.indexOf(legacyQualityMarker);
  if(qualityAt<0)throw new Error('Legacy move-quality anchor missing; refusing unsafe injection.');
  main=`${main.slice(0,qualityAt)}\n${exactQuality}\n\n${main.slice(qualityAt)}`;
}

if(!main.includes(brokerMarker)){
  const broker=await readFile(brokerPath,'utf8');
  if(!broker.includes(brokerMarker))throw new Error('Guided single-search broker marker missing.');
  main += `\n\n${broker}\n`;
}

await writeFile(mainPath,main,'utf8');
console.log('Training performance, exact Best classifier and Guided single-search broker injected.');
