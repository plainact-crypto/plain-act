import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch = await readFile(new URL('../activation-onboarding-v2.js', import.meta.url), 'utf8');
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

test('production injection removes V2 global DOM observer and couples activation to render', () => {
  assert.match(injector, /__COT_ACTIVATION_RENDER_HOOK__/);
  assert.match(injector, /baseRender\.apply/);
  assert.match(injector, /queueMicrotask\(refresh\)/);
  assert.match(injector, /global observer regression remains/);
  assert.match(injector, /new MutationObserver\\\(schedule\\\)/);
});

test('mobile hierarchy keeps next action above detailed opening progress', () => {
  assert.match(injector, /cot-progress-details/);
  assert.match(injector, /View opening progress/);
  assert.match(injector, /order:-10000/);
  assert.match(injector, /grid-column:1\/\-1/);
});

test('activation V2 regression fix remains idempotently injected', () => {
  assert.match(injector, /__COT_ACTIVATION_ONBOARDING_V2__/);
  assert.match(injector, /main\.includes\(marker\)/);
  assert.match(injector, /appendFile/);
});
