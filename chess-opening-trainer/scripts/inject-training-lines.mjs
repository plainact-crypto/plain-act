import { readFile, writeFile } from "node:fs/promises";

const mainPath=new URL("../src/main.js",import.meta.url);
const patchPath=new URL("../training-lines-patch.js",import.meta.url);
let main=await readFile(mainPath,"utf8");
const patch=await readFile(patchPath,"utf8");
if(!main.includes("__COT_INDEPENDENT_TRAINING_LINES__")) main+=`\n${patch}\n`;
await writeFile(mainPath,main);
