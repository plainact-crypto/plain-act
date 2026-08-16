import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../rank-independent-full-game-fix.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Rank gameplay starts from the standard initial position and discards training-line state',()=>{
  assert.match(patch,/state\.chess\.reset\(\)/);
  assert.match(patch,/state\.history=\[\]/);
  assert.match(patch,/state\.userMovesDone=0/);
  assert.match(patch,/state\.rankFresh=true/);
  assert.match(patch,/state\.rankFreshBranchPending=false/);
  assert.match(patch,/trainingDataUsedDuringGame:false/);
  assert.match(patch,/savedLineReplay:false/);
});

test('Rank is a natural full game rather than a training move target',()=>{
  assert.match(patch,/LIVE_FULL_GAME_LENGTH = Number\.MAX_SAFE_INTEGER/);
  assert.match(patch,/naturalGameEndOnly:true/);
  assert.match(patch,/termination:'natural-chess-game-over-only'/);
  assert.match(patch,/moves played · Full game/);
});

test('Black-side Rank player receives the opponent White move first',()=>{
  assert.match(patch,/state\.chess\.turn\(\)!==userColor\(\)/);
  assert.match(patch,/const uci=await bestMove\(\)/);
  assert.match(patch,/opponentMovesFirstWhenUserIsBlack:true/);
});

test('final independent Rank contract is injected after the legacy entry bridge',()=>{
  const entry=injector.indexOf('__COT_RANK_ENTRY_FINAL_FIX__');
  const independent=injector.indexOf('__COT_RANK_INDEPENDENT_FULL_GAME__');
  assert.ok(entry>=0 && independent>entry);
  assert.match(injector,/rank-independent-full-game-fix\.js/);
});
