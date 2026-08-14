import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch = await readFile(new URL('../activation-onboarding-patch.js', import.meta.url), 'utf8');
const injector = await readFile(new URL('../scripts/inject-activation.mjs', import.meta.url), 'utf8');

const requiredEvents = [
  'landing_view','signup_started','signup_completed','onboarding_completed',
  'first_training_started','first_variation_completed','practice_started',
  'rank_started','returned_user'
];

test('activation analytics covers the complete beta funnel', () => {
  for (const event of requiredEvents) assert.match(patch, new RegExp(`['\"]${event}['\"]`));
  assert.match(patch, /activation_events/);
  assert.match(patch, /anonymous_id/);
  assert.match(patch, /session_id/);
});

test('first-time onboarding exposes one short journey and repertoire choice', () => {
  assert.match(patch, /60-second setup/);
  assert.match(patch, /London System/);
  assert.match(patch, /Caro-Kann/);
  for (const step of ['Learn','Practice','Pass','Rank','Next Level']) assert.match(patch, new RegExp(step));
  assert.match(patch, /Start my first Guided Training/);
});

test('dashboard activation hub exposes progress and next action', () => {
  assert.match(patch, /Your next best action/);
  assert.match(patch, /Continue Training/);
  assert.match(patch, /completed variations/);
  assert.match(patch, /Opening Elo/);
  assert.match(patch, /Rank Test unlocked/);
  assert.match(patch, /valid passes/);
});

test('activation patch is idempotently injected into generated source', () => {
  assert.match(injector, /__COT_ACTIVATION_ONBOARDING__/);
  assert.match(injector, /main\.includes\(marker\)/);
  assert.match(injector, /appendFile/);
});
