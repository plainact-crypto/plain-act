import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../training-delta-sequence-patch.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Guided board-change guide sequences every measured delta for both sides',()=>{
  assert.match(patch,/__COT_TRAINING_DELTA_SEQUENCE__/);
  assert.match(patch,/state\?\.mode!==['"]guided['"]/);
  assert.match(patch,/pieceChanges/);
  assert.match(patch,/attackChanges/);
  assert.match(patch,/pawnChanges/);
  assert.match(patch,/weak\?\.w/);
  assert.match(patch,/weak\?\.b/);
  assert.match(patch,/delta\.move\?\.color===['"]w['"]\?['"]White['"]:['"]Black['"]/);
});

test('Each board-change step gets readable dynamic time and focused markers',()=>{
  assert.match(patch,/Math\.max\(2600,Math\.min\(6000/);
  assert.match(patch,/words\*90\+squares\*180/);
  assert.match(patch,/cot-delta-gain/);
  assert.match(patch,/cot-delta-risk/);
  assert.match(patch,/\.cot-ti-marker\{display:none!important\}/);
  assert.match(patch,/fullDeltaStillVisible:true/);
});

test('Progressive guide is injected after position intelligence',()=>{
  const intelligence=injector.indexOf('__COT_TRAINING_POSITION_INTELLIGENCE__');
  const sequence=injector.indexOf('__COT_TRAINING_DELTA_SEQUENCE__');
  assert.ok(intelligence>=0 && sequence>intelligence);
});
