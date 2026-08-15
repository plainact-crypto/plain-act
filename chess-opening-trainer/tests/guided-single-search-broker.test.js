import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const broker=await readFile(new URL('../guided-single-search-broker.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-performance.mjs',import.meta.url),'utf8');

test('Guided broker uses one Depth-20 MultiPV-1 search per FEN',()=>{
  assert.match(broker,/depth: DEPTH, multiPv: 1/);
  assert.match(broker,/const cache = new Map\(\)/);
  assert.match(broker,/const pending = new Map\(\)/);
  assert.match(broker,/one-depth20-multipv1-search-per-fen/);
});

test('eval and move-quality reuse Guided broker instead of starting new searches',()=>{
  assert.match(broker,/evalEngine\.evaluate = async function/);
  assert.match(broker,/qualityEngine\.evaluate = async function/);
  assert.match(broker,/qualityEngine\.bestMove = async function/);
  assert.match(broker,/packForFen\(fen\)/);
});

test('production performance injector appends the broker',()=>{
  assert.match(injector,/guided-single-search-broker\.js/);
  assert.match(injector,/__COT_GUIDED_SINGLE_SEARCH_BROKER__/);
});
