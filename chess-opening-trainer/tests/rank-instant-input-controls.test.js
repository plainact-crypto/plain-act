import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../rank-instant-input-controls-final.js', import.meta.url), 'utf8');

test('Rank user input is not blocked by benchmark search', () => {
  assert.match(src, /state\.engineBusy\s*=\s*false/);
  assert.match(src, /startBenchmark\(fen\)/);
  assert.match(src, /movePaintsBeforeScoringWait:\s*true/);
  assert.match(src, /inputWaitsForBenchmark:\s*false/);
});

test('Rank benchmark strength remains unchanged', () => {
  assert.match(src, /benchmarkDepth:\s*20/);
  assert.match(src, /benchmarkMultiPv:\s*1/);
});

test('Rank remains independent of training lines', () => {
  assert.match(src, /copiedTrainingLine:\s*false/);
  assert.match(src, /trainingDataUsedDuringRank:\s*false/);
});

test('Rank exposes Offer Draw and Resign controls', () => {
  assert.match(src, /Offer Draw/);
  assert.match(src, /Resign/);
  assert.match(src, /finishWithForcedOutcome\('draw'\)/);
  assert.match(src, /finishWithForcedOutcome\('loss'\)/);
});

test('Rank still requires a post-game report', () => {
  assert.match(src, /naturalGameReportRequired:\s*true/);
});
