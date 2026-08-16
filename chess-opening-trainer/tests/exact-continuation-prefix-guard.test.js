import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const guard=await readFile(new URL('../exact-continuation-prefix-guard.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('deeper Guided depths inherit the exact same variation parent line',()=>{
  assert.match(guard,/const FORMAL_DEPTHS=\[10,15,20,25,30\]/);
  assert.match(guard,/state\?\.variationIndex/);
  assert.match(guard,/const lesson=lessonAt\(state\.side,parentDepth,index\)/);
  assert.match(guard,/moveUci\(hist\[i\]\)!==stepUci\(line\.moves\[i\]\)/);
  assert.match(guard,/type:'exact-continuation-prefix'/);
});

test('both trainee and opponent are forced through the saved prefix',()=>{
  assert.match(guard,/exactPrefixStep\('user'\)/);
  assert.match(guard,/exactPrefixStep\('engine'\)/);
  assert.match(guard,/__COT_OPPONENT_ENGINE_SERVICE__/);
  assert.match(guard,/service\.bestMove=async function/);
  assert.match(guard,/engineServiceGuard:true/);
});

test('game-end continuation inherits Depth 30 rather than starting a new line',()=>{
  assert.match(guard,/if\(depth===GAME_END_DEPTH\)return 30/);
  assert.match(guard,/gameEndParentDepth:30/);
});

test('continuation guard is injected last',()=>{
  const depth=injector.indexOf('__COT_VARIATION_DEPTH_PROGRESSION__');
  const rank=injector.indexOf('__COT_ONE_GAME_RANK_LADDER__');
  const gameEnd=injector.indexOf('__COT_GAME_END_CONTINUATION_FIX__');
  const guardIndex=injector.indexOf('__COT_EXACT_CONTINUATION_PREFIX_GUARD__');
  assert.ok(depth>=0 && rank>depth && gameEnd>rank && guardIndex>gameEnd);
});
