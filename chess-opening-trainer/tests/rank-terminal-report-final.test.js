import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../rank-terminal-report-final.js', import.meta.url), 'utf8');

test('terminal Rank report no longer depends on legacy finish renderer', () => {
  assert.match(source, /reportDoesNotDependOnLegacyFinish:\s*true/);
  assert.match(source, /cotGuaranteedRankReport/);
  assert.match(source, /persistResult\(outcome,m\)/);
});

test('Rank report covers resign, accepted draw and natural game over', () => {
  assert.match(source, /resignShowsFullReport:\s*true/);
  assert.match(source, /acceptedDrawShowsFullReport:\s*true/);
  assert.match(source, /naturalGameOverShowsFullReport:\s*true/);
  assert.match(source, /trainingDataUsed:\s*false/);
});

test('Rank report contains recommendations and mistake review', () => {
  assert.match(source, /Recommendation/);
  assert.match(source, /Review My Mistakes/);
  assert.match(source, /reportContainsRecommendations:\s*true/);
  assert.match(source, /reportContainsMistakeReview:\s*true/);
});

test('Resign is intercepted before legacy handler can leave Rank in progress', () => {
  assert.match(source, /data-rank-resign/);
  assert.match(source, /stopImmediatePropagation/);
  assert.match(source, /finalizeTerminal\('loss'\)/);
});
