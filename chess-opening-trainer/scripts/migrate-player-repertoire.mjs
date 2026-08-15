import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const d4Replies = [
  'd7d5','g8f6','e7e6','c7c5','c7c6','f7f5','g7g6','b7b6','d7d6','b8c6',
  'e7e5','a7a6','h7h6','a7a5','b7b5','f7f6','g7g5','h7h5','b8a6','g8h6'
];

const storagePath = resolve('src/core/storage.js');
let storage = await readFile(storagePath, 'utf8');

if (!storage.includes('__D4_PLAYER_FIRST_REPLY_MIGRATION__')) {
  const helper = `\n// __D4_PLAYER_FIRST_REPLY_MIGRATION__\nexport const D4_PLAYER_FIRST_REPLIES=${JSON.stringify(d4Replies)};\nfunction emptyD4PlayerLesson(){\n  return {trained:false,passes:0,validPracticeSuccesses:0,attempts:0,invalidAttempts:0,lines:[],selectedLineIndex:0};\n}\nfunction migrateD4PlayerReplies(levelProgress){\n  const oldMoves=Array.isArray(levelProgress.firstMoves)?levelProgress.firstMoves:[];\n  const oldLessons=Array.isArray(levelProgress.lessons)?levelProgress.lessons:[];\n  const exact=oldMoves.length===D4_PLAYER_FIRST_REPLIES.length&&D4_PLAYER_FIRST_REPLIES.every((move,index)=>oldMoves[index]===move);\n  if(exact)return false;\n  const byMove=new Map();\n  oldMoves.forEach((move,index)=>{if(move&&!byMove.has(move)&&oldLessons[index])byMove.set(move,oldLessons[index]);});\n  levelProgress.firstMoves=[...D4_PLAYER_FIRST_REPLIES];\n  levelProgress.lessons=D4_PLAYER_FIRST_REPLIES.map(move=>byMove.get(move)||emptyD4PlayerLesson());\n  return true;\n}\n`;
  const anchor = 'export function ensureLevelProgress';
  if (!storage.includes(anchor)) throw new Error('ensureLevelProgress anchor not found in storage.js');
  storage = storage.replace(anchor, helper + '\n' + anchor);
}

if (!/if\s*\(\s*side\s*===\s*["']white["']\s*\)\s*migrateD4PlayerReplies\(lp\)/.test(storage)) {
  const rankAnchor = 'lp.rankUnlocked=';
  const index = storage.indexOf(rankAnchor);
  if (index < 0) throw new Error('rankUnlocked anchor not found in storage.js');
  storage = storage.slice(0,index) + 'if(side==="white") migrateD4PlayerReplies(lp);\n  ' + storage.slice(index);
}

await writeFile(storagePath, storage, 'utf8');

const mainPath = resolve('src/main.js');
let main = await readFile(mainPath, 'utf8');
main = main.replaceAll('London System','D4 Player');
main = main.replaceAll('Caro-Kann Repertoire','C6 Player');
main = main.replaceAll('Caro-Kann repertoire','C6 Player repertoire');

if (!main.includes('__PLAYER_VARIATION_TITLES__')) {
  const helper = `\n// __PLAYER_VARIATION_TITLES__\nfunction playerMoveLabel(uci){\n  const labels={\n    a7a6:'a6',a7a5:'a5',b7b6:'b6',b7b5:'b5',c7c6:'c6',c7c5:'c5',d7d6:'d6',d7d5:'d5',\n    e7e6:'e6',e7e5:'e5',f7f6:'f6',f7f5:'f5',g7g6:'g6',g7g5:'g5',h7h6:'h6',h7h5:'h5',\n    b8a6:'Na6',b8c6:'Nc6',g8f6:'Nf6',g8h6:'Nh6',\n    a2a3:'a3',a2a4:'a4',b2b3:'b3',b2b4:'b4',c2c3:'c3',c2c4:'c4',d2d3:'d3',d2d4:'d4',\n    e2e3:'e3',e2e4:'e4',f2f3:'f3',f2f4:'f4',g2g3:'g3',g2g4:'g4',h2h3:'h3',h2h4:'h4',\n    b1a3:'Na3',b1c3:'Nc3',g1f3:'Nf3',g1h3:'Nh3'\n  };\n  return labels[String(uci||'').toLowerCase()]||String(uci||'').toUpperCase();\n}\nfunction playerVariationTitle(uci){\n  const move=playerMoveLabel(uci);\n  return state.side==='white'?'1.d4 …'+move:'1.'+move+' …c6';\n}\n`;
  const anchor = 'function renderCourse';
  const at = main.indexOf(anchor);
  if (at >= 0) main = main.slice(0,at) + helper + '\n' + main.slice(at);
  else {
    const fallback = 'function renderTraining';
    const fallbackAt = main.indexOf(fallback);
    if (fallbackAt < 0) throw new Error('Could not find course/training anchor in main.js');
    main = main.slice(0,fallbackAt) + helper + '\n' + main.slice(fallbackAt);
  }
}

const variationMovePattern=/<div class="variation-move">\$\{([^}]+?)\.toUpperCase\(\)\}<\/div>/g;
let variationReplacements=0;
main=main.replace(variationMovePattern,(_match,expr)=>{
  variationReplacements++;
  return '<div class="variation-move">${playerVariationTitle('+expr+')}</div>';
});
if(variationReplacements===0 && !main.includes('playerVariationTitle(')){
  throw new Error('Variation title surface not found in main.js');
}

main=main.replaceAll('20 opponent variations','20 opponent first replies');
main=main.replaceAll('Engine is ranking the 20 legal first variations…','Building the 20 legal opponent first replies…');
main=main.replaceAll('Each level contains 20 opponent variations. The number is the depth of your training line.','Each depth covers the opponent’s 20 legal first replies. Go deeper on any branch as you improve.');
main=main.replaceAll('Each first reply can contain multiple saved training branches.','Each card is one distinct legal first reply from the opponent. Each reply can contain multiple saved training branches.');

await writeFile(mainPath, main, 'utf8');
console.log('D4 Player now owns all 20 legal first replies after 1.d4; D4/C6 Player training titles applied.');
