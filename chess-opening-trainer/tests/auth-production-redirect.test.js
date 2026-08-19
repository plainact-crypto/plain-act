import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch = await readFile(new URL('../activation-funnel-fix.js', import.meta.url), 'utf8');

test('signup confirmation is forced back to the production trainer', () => {
  assert.match(patch, /PROD_AUTH_REDIRECT\s*=\s*['"]https:\/\/chess-opening-trainer-3jh\.pages\.dev\/['"]/);
  assert.match(patch, /\/\\\/auth\\\/v1\\\/signup/);
  assert.match(patch, /searchParams\.set\(['"]redirect_to['"],\s*PROD_AUTH_REDIRECT\)/);
  assert.match(patch, /requestArgs\s*=\s*\[url\.toString\(\),\s*\.\.\.args\.slice\(1\)\]/);
});

test('activation tracking inspects the rewritten signup request', () => {
  assert.match(patch, /nativeFetch\(\.\.\.requestArgs\)/);
  assert.match(patch, /String\(requestArgs\[0\]\?\.url \|\| requestArgs\[0\] \|\| ''\)/);
  assert.match(patch, /signup_completed/);
});
