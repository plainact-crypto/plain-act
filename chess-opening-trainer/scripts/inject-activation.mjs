import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath = resolve('src/main.js');
const patchPath = resolve('activation-onboarding-v2.js');
const marker = '__COT_ACTIVATION_ONBOARDING_V2__';

const main = await readFile(mainPath, 'utf8');
if (main.includes(marker)) {
  console.log('Activation onboarding V2 patch already present.');
  process.exit(0);
}

const patch = await readFile(patchPath, 'utf8');
if (!patch.includes(marker)) throw new Error('Activation V2 patch marker missing.');
await appendFile(mainPath, `\n\n${patch}\n`, 'utf8');
console.log('Activation onboarding V2 patch injected.');
