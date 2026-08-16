import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../rank-terminal-report-final.js', import.meta.url), 'utf8');

test('terminal Rank outcomes complete the single round before finishing', () => {
  assert.match(source, /state\.rankRound\s*=\s*state\.rankRounds\.length/);
  assert.match(source, /previousFinishRankTest\(\)/);
  assert.match(source, /rankForcedOutcome/);
});

test('terminal Rank bridge covers resign and accepted draw outcomes through the same report pipeline', () => {
  assert.match(source, /resignShowsFullReport:\s*true/);
  assert.match(source, /acceptedDrawShowsFullReport:\s*true/);
  assert.match(source, /reportPipeline:\s*'same-rank-finish-pipeline'/);
  assert.match(source, /trainingDataUsed:\s*false/);
});
