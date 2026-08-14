import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath=resolve('src/main.js');
const patchPath=resolve('regression-root-fix.js');
const marker='__COT_REPORTS_42_47_ROOT_FIX__';
let main=await readFile(mainPath,'utf8');
if(main.includes(marker)){
  console.log('Reports #42-#47 root fix already present.');
  process.exit(0);
}
const patch=await readFile(patchPath,'utf8');
if(!patch.includes(marker))throw new Error('Reports #42-#47 root fix marker missing.');
if(!main.includes('__COT_ACTIVATION_ONBOARDING_V2__'))throw new Error('Activation V2 must be injected before reports #42-#47 root fix.');
await appendFile(mainPath,`\n\n${patch}\n`,'utf8');
console.log('Reports #42-#47 root fix injected after Activation V2.');
