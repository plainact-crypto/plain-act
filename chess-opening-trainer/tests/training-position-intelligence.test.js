import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../training-position-intelligence.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Training candidates are real Depth 20 MultiPV 3 and cached by FEN',()=>{
  assert.match(patch,/const DEPTH = 20/);
  assert.match(patch,/const MULTIPV = 3/);
  assert.match(patch,/raw\(\{fen,depth:DEPTH,multiPv:MULTIPV\}\)/);
  assert.match(patch,/const candidateCache = new Map\(\)/);
  assert.match(patch,/__COT_TRAINING_CANDIDATE_MEMORY__/);
});

test('Position delta computes complete deterministic geometry categories',()=>{
  assert.match(patch,/legalMobility/);
  assert.match(patch,/manualAttacks/);
  assert.match(patch,/pawnChanges/);
  assert.match(patch,/attackChanges/);
  assert.match(patch,/slidingOpened/);
  assert.match(patch,/slidingClosed/);
  assert.match(patch,/White weakened squares/);
  assert.match(patch,/Black weakened squares/);
});

test('Feature is Guided Training only and does not alter move selection',()=>{
  assert.match(patch,/state\?\.mode!==['"]guided['"]/);
  assert.doesNotMatch(patch,/bestRepertoireMove\s*=/);
  assert.doesNotMatch(patch,/startPracticeTest\s*=/);
  assert.doesNotMatch(patch,/startRank/);
});

test('Opening-route caveat preserves exact Best semantics',()=>{
  assert.match(patch,/forced opening-route move can differ and is not labelled Best unless it matches #1/);
  assert.match(patch,/bestLabel: 'exact-top1-only'/);
});

test('Position Intelligence is injected after strict Guided policy',()=>{
  const strict=injector.indexOf('__COT_GUIDED_STRICT_BEST_FINAL__');
  const intel=injector.indexOf('__COT_TRAINING_POSITION_INTELLIGENCE__');
  assert.ok(strict>=0 && intel>strict);
});
