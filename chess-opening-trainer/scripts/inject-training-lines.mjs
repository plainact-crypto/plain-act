import { readFile, writeFile } from "node:fs/promises";

const mainPath=new URL("../src/main.js",import.meta.url);
const patchPath=new URL("../training-lines-patch.js",import.meta.url);
const strictPath=new URL("../guided-strict-best-final.js",import.meta.url);
const intelligencePath=new URL("../training-position-intelligence.js",import.meta.url);
let main=await readFile(mainPath,"utf8");
const patch=await readFile(patchPath,"utf8");
const strict=await readFile(strictPath,"utf8");
const intelligence=await readFile(intelligencePath,"utf8");
if(!main.includes("__COT_INDEPENDENT_TRAINING_LINES__")) main+=`\n${patch}\n`;
if(!main.includes("__COT_GUIDED_STRICT_BEST_FINAL__")) main+=`\n${strict}\n`;
if(!main.includes("__COT_TRAINING_POSITION_INTELLIGENCE__")) main+=`\n${intelligence}\n`;
await writeFile(mainPath,main);
