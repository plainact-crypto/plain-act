import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../rank-independent-full-game-fix.js',import.meta.url),'utf8');
const ladder=await readFile(new URL('../rank-ladder-patch.js',import.meta.url),'utf8');
const entry=await readFile(new URL('../rank-entry-final-fix.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Rank gameplay starts from the standard initial position and discards training-line state',()=>{
  assert.match(patch,/state\.chess\.reset\(\)/);
  assert.match(patch,/state\.history=\[\]/);
  assert.match(patch,/state\.userMovesDone=0/);
  assert.match(patch,/state\.rankFresh=true/);
  assert.match(patch,/state\.rankFreshBranchPending=false/);
  assert.match(patch,/trainingDataUsedDuringGame:false/);
  assert.match(patch,/savedLineReplay:false/);
  assert.match(patch,/inheritedFromTraining:\[\]/);
});

test('Rank is available without Practice or training unlock',()=>{
  assert.match(entry,/authoritativeUnlock:'none-every-player-can-enter'/);
  assert.match(ladder,/unlockRequirement:'none'/);
  assert.match(ladder,/firstRank:1800/);
});

test('Rank ladder is global and begins at 1800',()=>{
  assert.match(ladder,/RANK_LEVELS=\[1800,2000,2200,2500,2700,3000\]/);
  assert.match(ladder,/rankLadder\.global/);
  assert.match(ladder,/ladderScope:'global-user-rank'/);
  assert.match(patch,/levels:\[1800,2000,2200,2500,2700,3000\]/);
});

test('player chooses White or Black independently for Rank',()=>{
  assert.match(patch,/Choose your color/);
  assert.match(patch,/data-color="white"/);
  assert.match(patch,/data-color="black"/);
  assert.match(patch,/playerChoosesColor:true/);
  assert.match(patch,/state\.rankChosenColor=color/);
});

test('Rank is a natural full game rather than a training move target',()=>{
  assert.match(patch,/LIVE_FULL_GAME_LENGTH=Number\.MAX_SAFE_INTEGER/);
  assert.match(patch,/naturalGameEndOnly:true/);
  assert.match(patch,/termination:'natural-chess-game-over-only'/);
  assert.match(patch,/moves played · Full game/);
});

test('Black-side Rank player receives the opponent White move first',()=>{
  assert.match(patch,/state\.chess\.turn\(\)!==userColor\(\)/);
  assert.match(patch,/const uci=await bestMove\(\)/);
  assert.match(patch,/opponentMovesFirstWhenUserIsBlack:true/);
});

test('Rank benchmark keeps Depth 20 but shares one analysis search per FEN',()=>{
  assert.match(patch,/RANK_ANALYSIS_DEPTH=20/);
  assert.match(patch,/rawAnalysisSearch\(\{fen,depth:RANK_ANALYSIS_DEPTH,multiPv:1\}\)/);
  assert.match(patch,/analysisCache=new Map\(\)/);
  assert.match(patch,/sharedSearchPerFen:true/);
  assert.match(patch,/fullStrength:true/);
});

test('Rank Elo is applied to the actual opponent engine service',()=>{
  assert.match(patch,/__COT_OPPONENT_ENGINE_SERVICE__/);
  assert.match(patch,/setoption name UCI_LimitStrength/);
  assert.match(patch,/setoption name UCI_Elo/);
  assert.match(patch,/opponentStrength:'actual-opponent-engine-rank-elo'/);
});

test('final independent Rank contract is injected after the legacy entry bridge',()=>{
  const entryIndex=injector.indexOf('__COT_RANK_ENTRY_FINAL_FIX__');
  const independent=injector.indexOf('__COT_RANK_INDEPENDENT_FULL_GAME__');
  assert.ok(entryIndex>=0 && independent>entryIndex);
  assert.match(injector,/rank-independent-full-game-fix\.js/);
});
