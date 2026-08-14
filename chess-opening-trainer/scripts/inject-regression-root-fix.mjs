import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath=resolve('src/main.js');
const patchPath=resolve('regression-root-fix.js');
const marker='__COT_REPORTS_42_47_ROOT_FIX__';
let main=await readFile(mainPath,'utf8');

if(!main.includes(marker)){
  const patch=await readFile(patchPath,'utf8');
  if(!patch.includes(marker))throw new Error('Reports #42-#47 root fix marker missing.');
  if(!main.includes('__COT_ACTIVATION_ONBOARDING_V2__'))throw new Error('Activation V2 must be injected before reports #42-#47 root fix.');
  await appendFile(mainPath,`\n\n${patch}\n`,'utf8');
  console.log('Reports #42-#47 root fix injected after Activation V2.');
}

// Product progression change: Depth 5 is retired. Apply this AFTER Activation V2
// and the regression patch are present so one source-of-truth migration covers the
// base app, dashboard/activation navigation and Continue Training logic together.
main=await readFile(mainPath,'utf8');
const legacyDepthList=/\[\s*5\s*,\s*10\s*,\s*15\s*,\s*20\s*,\s*25\s*,\s*30\s*\]/g;
const migrated=main.match(legacyDepthList)?.length||0;
if(migrated<3)throw new Error(`Expected multiple Depth 5 progression references, found ${migrated}; refusing partial migration.`);
main=main.replace(legacyDepthList,'[10,15,20,25,30]');
main=main.replace(/sessionLength\s*:\s*5\b/g,'sessionLength:10');
if(legacyDepthList.test(main))throw new Error('Depth 5 progression list remains after final-source migration.');
if(/sessionLength\s*:\s*5\b/.test(main))throw new Error('Default training session still starts at Depth 5.');
await writeFile(mainPath,main,'utf8');
console.log(`Depth 5 retired from final trainer source (${migrated} progression references migrated); default Depth is 10.`);
