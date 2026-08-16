import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../rank-entry-final-fix.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Rank entry is open to every player without persisting compatibility data',()=>{
  assert.match(patch,/authoritativeUnlock:'none-every-player-can-enter'/);
  assert.match(patch,/firstRank:1800/);
  assert.match(patch,/legacyFiveRoundBootstrap:'temporary-memory-only'/);
  assert.match(patch,/syntheticProgressPersisted:false/);
  assert.match(patch,/saveProfile=\(\)=>synthetic/);
  assert.match(patch,/saveProfile=realSaveProfile/);
});

test('legacy internal cap is applied only after Rank actually enters and is hidden',()=>{
  const entered=patch.indexOf("const entered=state?.mode==='rank'");
  const cap=patch.lastIndexOf('state.sessionLength=INTERNAL_GAME_CAP');
  assert.ok(entered>=0 && cap>entered);
  assert.match(patch,/hideInternal99:true/);
  assert.match(patch,/Available now · First Rank 1800/);
});

test('Rank entry fix is injected after the ladder',()=>{
  const rank=injector.indexOf('__COT_ONE_GAME_RANK_LADDER__');
  const final=injector.indexOf('__COT_RANK_ENTRY_FINAL_FIX__');
  assert.ok(rank>=0 && final>rank);
});
