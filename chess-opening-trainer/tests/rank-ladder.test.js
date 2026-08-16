import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../rank-ladder-patch.js',import.meta.url),'utf8');
const independent=await readFile(new URL('../rank-independent-full-game-fix.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Rank ladder is one full game and spans 1800 to 3000',()=>{
  assert.match(patch,/RANK_LEVELS\s*=\s*\[1800,2000,2200,2500,2700,3000\]/);
  assert.match(patch,/firstRank:1800/);
  assert.match(patch,/gamesPerAttempt:1/);
  assert.match(patch,/fullGame:true/);
  assert.match(patch,/maxRank:3000/);
  assert.match(patch,/state\.rankRounds=state\.rankRounds\.slice\(0,1\)/);
});

test('Rank has no training, Practice, variation, or depth unlock requirement',()=>{
  assert.match(patch,/unlockRequirement:'none'/);
  assert.match(patch,/Rank Test is available to every player · Starts at 1800/);
  assert.doesNotMatch(patch,/fullLineCount\(profile,state\.side\)<1/);
  assert.doesNotMatch(patch,/one-full-variation-line-5of5/);
});

test('Rank ladder progression is global per user, not per opening side or depth',()=>{
  assert.match(patch,/function ensureLadder\(profile\)/);
  assert.match(patch,/profile\.rankLadder\.global/);
  assert.match(patch,/ladderScope:'global-user-rank'/);
  assert.doesNotMatch(patch,/profile\.rankLadder\[side\]=/);
});

test('Opponent Rank strength is separate from full-strength Depth-20 benchmark analysis',()=>{
  assert.match(patch,/__COT_OPPONENT_ENGINE_SERVICE__/);
  assert.match(patch,/UCI_LimitStrength/);
  assert.match(patch,/UCI_Elo/);
  assert.match(independent,/RANK_ANALYSIS_DEPTH=20/);
  assert.match(independent,/fullStrength:true/);
  assert.match(independent,/sharedSearchPerFen:true/);
});

test('Rank result advice is based on the game itself, never a training prerequisite',()=>{
  assert.match(patch,/Review the game report and retry this Rank when ready/);
  assert.match(patch,/Review the blunders in this game/);
  assert.match(patch,/Review the mistakes in this game/);
  assert.match(patch,/Rank cleared\. Challenge the next Rank level/);
  assert.doesNotMatch(patch,/Complete another full variation line/);
});

test('Rank ladder is injected after depth progression and before final independent game contract',()=>{
  const depth=injector.indexOf('__COT_VARIATION_DEPTH_PROGRESSION__');
  const rank=injector.indexOf('__COT_ONE_GAME_RANK_LADDER__');
  const independentIndex=injector.indexOf('__COT_RANK_INDEPENDENT_FULL_GAME__');
  assert.ok(depth>=0 && rank>depth && independentIndex>rank);
});
