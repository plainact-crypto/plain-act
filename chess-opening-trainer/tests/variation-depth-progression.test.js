import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../variation-depth-progression-patch.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');

test('Depth progression starts at 10 and advances by same variation after five valid passes',()=>{
  assert.match(patch,/const DEPTHS = \[10,15,20,25,30\]/);
  assert.match(patch,/const PASS_TARGET = 5/);
  assert.match(patch,/if\(depth===10\) return true/);
  assert.match(patch,/selectedLinePasses\(lessonAt\(side,prev,index\)\)>=PASS_TARGET/);
  assert.match(patch,/unlockScope:'same-variation-only'/);
});

test('Passing a depth offers Continue This Line to the next depth',()=>{
  assert.match(patch,/Continue This Line · Depth \$\{next\}/);
  assert.match(patch,/continueSameVariation\(next\|\|99\)/);
  assert.match(patch,/state\.variationIndex/);
  assert.match(patch,/state\.sessionLength=targetDepth/);
});

test('Depth 30 continues the same line toward game end',()=>{
  assert.match(patch,/finalDepth:'30-then-game-end'/);
  assert.match(patch,/Continue This Line · Play to Game End/);
});

test('Locked depth is enforced for Guided and Practice entry',()=>{
  assert.match(patch,/startNewTraining=async function/);
  assert.match(patch,/startPracticeTest=async function/);
  assert.match(patch,/Pass this same variation at Depth/);
});

test('Progression patch is injected after strict Guided policy',()=>{
  const strict=injector.indexOf('__COT_GUIDED_STRICT_BEST_FINAL__');
  const progression=injector.indexOf('__COT_VARIATION_DEPTH_PROGRESSION__');
  assert.ok(strict>=0 && progression>strict);
});
