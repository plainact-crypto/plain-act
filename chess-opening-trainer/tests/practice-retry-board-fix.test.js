import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../practice-retry-board-fix.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Report #52 retry destroys stale board before restarting Practice',()=>{
  assert.match(patch,/__COT_PRACTICE_RETRY_BOARD_FIX_52__/);
  assert.match(patch,/state\.board\s*=\s*null/);
  assert.match(patch,/await startPracticeTest\(variation\)/);
  assert.match(patch,/querySelector\('#board'\)/);
  assert.match(patch,/querySelector\?\.\('\.cm-chessboard'\)/);
});

test('Report #52 retry owns incomplete Practice result transition only',()=>{
  assert.match(patch,/closest\?\.\('#again'\)/);
  assert.match(patch,/state\?\.mode\s*!==\s*'test'/);
  assert.match(patch,/state\?\.complete/);
  assert.match(patch,/if \(completed\) return/);
  assert.match(patch,/stopImmediatePropagation\(\)/);
});

test('Report #52 fix is injected into final trainer source',()=>{
  assert.match(injector,/practice-retry-board-fix\.js/);
  assert.match(injector,/__COT_PRACTICE_RETRY_BOARD_FIX_52__/);
});
