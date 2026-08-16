import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../src/core/storage.js', import.meta.url);
let source = await readFile(path, 'utf8');
const marker = '__COT_PROGRESS_RESET_2026_08_16__';
if (source.includes(marker)) {
  console.log('One-time progress reset already patched.');
  process.exit(0);
}

const anchor = 'const PROFILE_PREFIX="chessTrainerProfile:";';
if (!source.includes(anchor)) throw new Error('storage.js profile prefix anchor changed');
source = source.replace(anchor, `${anchor}\nconst ${marker}=true;\nconst PROGRESS_RESET_VERSION="2026-08-16-v1";`);

const loadAnchor = `export function loadProfile(email){\n  const clean=normalizeEmail(email);\n  if(!clean) return null;\n  try{`;
const replacement = `export function loadProfile(email){\n  const clean=normalizeEmail(email);\n  if(!clean) return null;\n  try{\n    const resetKey=\`chessTrainerProgressReset:\${PROGRESS_RESET_VERSION}:\${clean}\`;\n    if(!localStorage.getItem(resetKey)){\n      localStorage.removeItem(profileKey(clean));\n      localStorage.setItem(resetKey,new Date().toISOString());\n    }`;
if (!source.includes(loadAnchor)) throw new Error('storage.js loadProfile anchor changed');
source = source.replace(loadAnchor, replacement);

await writeFile(path, source, 'utf8');
console.log('Applied one-time clean-user progress reset.');
