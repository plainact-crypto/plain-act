import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../rank-ladder-patch.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Rank ladder is one game and spans 1800 to 3000',()=>{
  assert.match(patch,/const RANK_LEVELS = \[1800,2000,2200,2500,2700,3000\]/);
  assert.match(patch,/gamesPerAttempt:1/);
  assert.match(patch,/fullGame:true/);
  assert.match(patch,/maxRank:3000/);
  assert.match(patch,/state\.rankRounds=state\.rankRounds\.slice\(0,1\)/);
});

test('Rank unlock requires one completed 5\/5 variation at current depth',()=>{
  assert.match(patch,/if\(completed<1\)/);
  assert.match(patch,/Complete at least one variation at 5\/5 Practice/);
  assert.match(patch,/unlockCompletedVariations:1/);
});

test('Opponent strength is separated from full-strength benchmark analysis',()=>{
  assert.match(patch,/UCI_LimitStrength/);
  assert.match(patch,/UCI_Elo/);
  assert.match(patch,/Analysis\/benchmark searches remain full-strength/);
  assert.match(patch,/state\?\.chess\?\.turn\?\.\(\)!==userColor\(\)/);
});

test('Rank result recommends more training after loss or large errors',()=>{
  assert.match(patch,/You lost the game\. Add another variation/);
  assert.match(patch,/Review your mistakes, Practice the weak line again/);
  assert.match(patch,/Practice this line again or learn one more variation/);
  assert.match(patch,/Rank cleared\. Continue training more variations/);
});

test('Rank ladder is injected last after depth progression',()=>{
  const depth=injector.indexOf('__COT_VARIATION_DEPTH_PROGRESSION__');
  const rank=injector.indexOf('__COT_ONE_GAME_RANK_LADDER__');
  assert.ok(depth>=0 && rank>depth);
});
