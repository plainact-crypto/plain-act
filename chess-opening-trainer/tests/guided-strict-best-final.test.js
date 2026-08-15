import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const policy=await readFile(new URL('../guided-strict-best-final.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('D4/C6 Guided opening route is explicit and short',()=>{
  assert.match(policy,/d4TraineeFirstMove:'d2d4'/);
  assert.match(policy,/c6TraineeFirstBlackMove:'c7c6'/);
  assert.match(policy,/c6TraineeSecondBlackMove:'d7d5'/);
  assert.match(policy,/opponentFirstMove:'forced-by-selected-variation'/);
  assert.match(policy,/opponentSecondMove:'saved-curated-route-when-available-otherwise-top1'/);
});

test('everything after opening route is exact broker Top-1 Depth 20',()=>{
  assert.match(policy,/afterOpeningRoute:'exact-stockfish-top1-depth20-both-sides'/);
  assert.match(policy,/pack\?\.bestmove\|\|pack\?\.lines\?\.\[0\]\?\.uci/);
  assert.match(policy,/type:'stockfish-top1'/);
  assert.match(policy,/depth:20/);
  assert.match(policy,/alternativesAllowedInGuided:false/);
});

test('forced route and Top-1 decisions are auditable separately',()=>{
  assert.match(policy,/type:'forced-opening-route'/);
  assert.match(policy,/bestLabel:'only-if-played-uci-equals-stockfish-top1'/);
});

test('final policy is injected after Training Lines',()=>{
  const training=injector.indexOf('__COT_INDEPENDENT_TRAINING_LINES__');
  const strict=injector.indexOf('__COT_GUIDED_STRICT_BEST_FINAL__');
  assert.ok(training>=0 && strict>training);
});
