import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../game-end-rank-unlock-patch.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Rank unlock requires one full variation through every formal depth',()=>{
  assert.match(patch,/const DEPTHS=\[10,15,20,25,30\]/);
  assert.match(patch,/const PASS_TARGET=5/);
  assert.match(patch,/DEPTHS\.every\(depth=>passes\(profile,side,depth,index\)>=PASS_TARGET\)/);
});

test('Game-end completion is result agnostic',()=>{
  assert.match(patch,/acceptedResults:\['white-win','black-win','draw'\]/);
  assert.match(patch,/resultRequired:false/);
  assert.match(patch,/state\?\.chess\?\.isGameOver/);
  assert.match(patch,/naturalGameEnd:true/);
});

test('One completed full variation unlocks Rank',()=>{
  assert.match(patch,/rankFullLineCompletedCount=Math\.max\(1/);
  assert.match(patch,/lp\.rankUnlocked=true/);
  assert.match(patch,/rankUnlockAfterFullVariations:1/);
});

test('Result-agnostic unlock patch is injected last',()=>{
  const guard=injector.indexOf('__COT_EXACT_CONTINUATION_PREFIX_GUARD__');
  const unlock=injector.indexOf('__COT_GAME_END_RANK_UNLOCK__');
  assert.ok(guard>=0 && unlock>guard);
});
