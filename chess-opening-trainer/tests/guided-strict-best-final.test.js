import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const policy=await readFile(new URL('../guided-strict-best-final.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Guided keeps only D4/C6 identity anchors then exact broker Top-1',()=>{
  assert.match(policy,/whiteIdentityAnchor: 'd2d4'/);
  assert.match(policy,/blackIdentityAnchor: 'c7c6'/);
  assert.match(policy,/exact-stockfish-top1-depth20-both-sides/);
  assert.match(policy,/pack\?\.bestmove \|\| pack\?\.lines\?\.\[0\]\?\.uci/);
  assert.match(policy,/alternativesAllowedInGuided: false/);
});

test('strict policy is injected after Training Lines',()=>{
  const training=injector.indexOf('__COT_INDEPENDENT_TRAINING_LINES__');
  const strict=injector.indexOf('__COT_GUIDED_STRICT_BEST_FINAL__');
  assert.ok(training>=0 && strict>training);
});
