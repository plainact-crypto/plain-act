import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const mainPath=resolve('src/main.js');
let source=await readFile(mainPath,'utf8');

const legacyDepthList=/\[\s*5\s*,\s*10\s*,\s*15\s*,\s*20\s*,\s*25\s*,\s*30\s*\]/g;
const matches=source.match(legacyDepthList)?.length||0;
const hasLegacyDefault=/sessionLength\s*:\s*5\b/.test(source);

if(matches===0&&!hasLegacyDefault){
  console.log('Depth 5 is already retired from final trainer source.');
  process.exit(0);
}

source=source.replace(legacyDepthList,'[10,15,20,25,30]');
source=source.replace(/sessionLength\s*:\s*5\b/g,'sessionLength:10');

if(legacyDepthList.test(source))throw new Error('Legacy Depth 5 progression list remains after migration.');
if(/sessionLength\s*:\s*5\b/.test(source))throw new Error('Default sessionLength still points to Depth 5.');

await writeFile(mainPath,source,'utf8');
console.log(`Depth 5 removed from progression (${matches} depth-list references migrated); default Depth is 10.`);
