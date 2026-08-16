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

test('Rank unlock requires one complete variation line through every depth and game end',()=>{
  assert.match(patch,/const TRAINING_DEPTHS = \[10,15,20,25,30\]/);
  assert.match(patch,/fullLineCount\(profile,state\.side\)<1/);
  assert.match(patch,/5\/5 at Depths 10, 15, 20, 25 and 30, then finish the game/);
  assert.match(patch,/one-full-variation-line-5of5-at-10-15-20-25-30-plus-natural-game-end/);
});

test('Rank ladder progression is global per opening side, not duplicated per depth',()=>{
  assert.match(patch,/function ensureLadder\(profile,side\)/);
  assert.match(patch,/profile\.rankLadder\[side\]=\{/);
  assert.match(patch,/ladderScope:'opening-side-global'/);
});

test('Opponent strength is separated from full-strength benchmark analysis',()=>{
  assert.match(patch,/UCI_LimitStrength/);
  assert.match(patch,/UCI_Elo/);
  assert.match(patch,/Analysis\/benchmark searches remain full-strength/);
  assert.match(patch,/state\?\.chess\?\.turn\?\.\(\)!==userColor\(\)/);
});

test('Rank result recommends more training after loss or large errors',()=>{
  assert.match(patch,/You lost the game\. Complete another full variation line/);
  assert.match(patch,/Review your mistakes, Practice the weak line again/);
  assert.match(patch,/Practice your current lines again or complete another full variation line/);
  assert.match(patch,/Rank cleared\. Challenge the next Rank level/);
});

test('Rank ladder is injected last after depth progression',()=>{
  const depth=injector.indexOf('__COT_VARIATION_DEPTH_PROGRESSION__');
  const rank=injector.indexOf('__COT_ONE_GAME_RANK_LADDER__');
  assert.ok(depth>=0 && rank>depth);
});
