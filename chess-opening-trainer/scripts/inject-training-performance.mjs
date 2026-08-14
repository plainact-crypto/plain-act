import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath=resolve('src/main.js');
const patchPath=resolve('training-performance-audio-patch.js');
const marker='__COT_TRAINING_PERFORMANCE_AUDIO_FIX__';
const legacyMarker='// --- Natural wooden chess-piece movement audio ---';

let main=await readFile(mainPath,'utf8');
if(main.includes(marker)){
  console.log('Training performance/audio fix already present.');
  process.exit(0);
}
const patch=await readFile(patchPath,'utf8');
if(!patch.includes(marker))throw new Error('Training performance patch marker missing.');
const at=main.indexOf(legacyMarker);
if(at<0)throw new Error('Legacy wood/mobile patch anchor missing; refusing unsafe late injection.');
main=`${main.slice(0,at)}\n${patch}\n\n${main.slice(at)}`;
await writeFile(mainPath,main,'utf8');
console.log('Training performance/audio fix injected before legacy observers.');
