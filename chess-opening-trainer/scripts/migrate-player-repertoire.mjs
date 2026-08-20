import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Report #71 product contract: a selected opening start is one repertoire
// anchor, not one variation. Its variation set is the opponent's complete
// legal first-reply set for that supported preset. Keep the repertoire model
// general; London/Caro-Kann remain presets rather than product-wide personas.
const presetReplies = {
  london: [
    'd7d5','g8f6','e7e6','c7c5','c7c6','f7f5','g7g6','b7b6','d7d6','b8c6',
    'e7e5','a7a6','h7h6','a7a5','b7b5','f7f6','g7g5','h7h5','b8a6','g8h6'
  ],
  caroKann: [
    'e2e4','d2d4','g1f3','c2c4','g2g3','b2b3','f2f4','b1c3','e2e3','d2d3',
    'a2a3','a2a4','b2b4','c2c3','f2f3','g2g4','h2h3','h2h4','b1a3','g1h3'
  ]
};

const storagePath = resolve('src/core/storage.js');
let storage = await readFile(storagePath, 'utf8');

if (!storage.includes('__REPERTOIRE_FIRST_REPLY_COVERAGE__')) {
  const helper = `\n// __REPERTOIRE_FIRST_REPLY_COVERAGE__\nexport const REPERTOIRE_FIRST_REPLIES=${JSON.stringify(presetReplies)};\nfunction emptyFirstReplyLesson(){\n  return {trained:false,passes:0,validPracticeSuccesses:0,attempts:0,invalidAttempts:0,lines:[],selectedLineIndex:0};\n}\nfunction ensureFirstReplyCoverage(profile,side,levelProgress){\n  const presetId=profile?.repertoireSelection?.[side];\n  const replies=REPERTOIRE_FIRST_REPLIES[presetId];\n  if(!Array.isArray(replies)||!replies.length)return false;\n  const oldMoves=Array.isArray(levelProgress.firstMoves)?levelProgress.firstMoves:[];\n  const oldLessons=Array.isArray(levelProgress.lessons)?levelProgress.lessons:[];\n  const exact=oldMoves.length===replies.length&&replies.every((move,index)=>oldMoves[index]===move);\n  if(exact)return false;\n  const byMove=new Map();\n  oldMoves.forEach((move,index)=>{if(move&&!byMove.has(move)&&oldLessons[index])byMove.set(move,oldLessons[index]);});\n  levelProgress.firstMoves=[...replies];\n  levelProgress.lessons=replies.map(move=>byMove.get(move)||emptyFirstReplyLesson());\n  return true;\n}\n`;
  const anchor = 'export function ensureLevelProgress';
  if (!storage.includes(anchor)) throw new Error('ensureLevelProgress anchor not found in storage.js');
  storage = storage.replace(anchor, helper + '\n' + anchor);
}

if (!storage.includes('ensureFirstReplyCoverage(profile,side,lp);')) {
  const rankAnchor = 'lp.rankUnlocked=';
  const index = storage.indexOf(rankAnchor);
  if (index < 0) throw new Error('rankUnlocked anchor not found in storage.js');
  storage = storage.slice(0,index) + 'ensureFirstReplyCoverage(profile,side,lp);\n  ' + storage.slice(index);
}

await writeFile(storagePath, storage, 'utf8');
console.log('Repertoire first-reply coverage installed: each supported selected start exposes its full 20 legal opponent replies.');
