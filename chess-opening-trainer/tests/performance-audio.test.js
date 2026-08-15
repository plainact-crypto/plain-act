import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../training-performance-audio-patch.js',import.meta.url),'utf8');
const enginePatch=await readFile(new URL('../triple-engine-patch.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-performance.mjs',import.meta.url),'utf8');

test('performance patch disables legacy training observers before they attach',()=>{
  for(const marker of ['__WOOD_PIECE_SOUND_PATCH__','__COT_GUIDED_STATUS_HARD_LOCK__','__MOBILE_BOARD_LAYOUT_GUARD__']) assert.match(patch,new RegExp(marker));
  assert.doesNotMatch(patch,/new MutationObserver/);
  assert.doesNotMatch(patch,/setInterval\s*\(/);
  assert.match(injector,/indexOf\(legacyMarker\)/);
  assert.match(injector,/before legacy observers/);
});

test('mobile issue reporting avoids blocking html2canvas capture',()=>{
  assert.match(patch,/issueCaptureScreenshot=async\(\)=>null/);
  assert.match(patch,/max-width: 820px/);
});

test('training audio uses higher master gain with compression',()=>{
  assert.match(patch,/createDynamicsCompressor/);
  assert.match(patch,/audioMaster\.gain\.value=\.95/);
  assert.match(patch,/Math\.min\(\.60,\.47\*strength\)/);
});

test('board and guided repairs are render lifecycle based',()=>{
  assert.match(patch,/perfBaseRender=render/);
  assert.match(patch,/queueMicrotask/);
  assert.match(patch,/requestAnimationFrame\(repairMobileBoard\)/);
});

test('eval bar never captures the coach engine before four-engine setup',()=>{
  assert.match(patch,/dedicatedEvalEngine=\(\)=>/);
  assert.match(patch,/__COT_EVAL_ENGINE_SERVICE__/);
  assert.doesNotMatch(patch,/const rawEvaluate=evalEngine\?\.evaluate/);
  assert.match(patch,/coachPending\(\)/);
  assert.match(patch,/retryEvalLater/);
});

test('Depth 20 coach has priority over move-quality background searches',()=>{
  assert.match(enginePatch,/TRAINING_DEPTH=20/);
  assert.match(enginePatch,/decisionCache=new Map/);
  assert.match(enginePatch,/__COT_COACH_DECISION_PENDING__/);
  assert.match(enginePatch,/await waitForCoach\(\)/);
  assert.match(enginePatch,/getPack\(fen,depth,1\)/);
});
