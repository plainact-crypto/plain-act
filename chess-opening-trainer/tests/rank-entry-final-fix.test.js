import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../rank-entry-final-fix.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('full-line unlock bypasses legacy five-round requirement without persisting fake progress',()=>{
  assert.match(patch,/authoritativeUnlock:'one-full-line-completed'/);
  assert.match(patch,/legacyFiveRoundBootstrap:'temporary-memory-only'/);
  assert.match(patch,/syntheticProgressPersisted:false/);
  assert.match(patch,/saveProfile=\(\)=>synthetic/);
  assert.match(patch,/saveProfile=realSaveProfile/);
});

test('internal 99 is applied only after Rank actually entered',()=>{
  const entered=patch.indexOf("const entered=state?.mode==='rank'");
  const cap=patch.lastIndexOf('state.sessionLength=INTERNAL_GAME_CAP');
  assert.ok(entered>=0 && cap>entered);
  assert.match(patch,/Never leak the old 99 safety cap into the course UI/);
  assert.match(patch,/hideInternal99:true/);
});

test('Rank entry fix is injected last',()=>{
  const rank=injector.indexOf('__COT_ONE_GAME_RANK_LADDER__');
  const final=injector.indexOf('__COT_RANK_ENTRY_FINAL_FIX__');
  assert.ok(rank>=0 && final>rank);
});
