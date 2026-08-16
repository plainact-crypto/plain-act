import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const patch=await readFile(new URL('../variation-depth-progression-patch.js',import.meta.url),'utf8');
const injector=await readFile(new URL('../scripts/inject-training-lines.mjs',import.meta.url),'utf8');
const gameEndFix=await readFile(new URL('../game-end-continuation-fix.js',import.meta.url),'utf8');

test('Depth progression starts at 10 and advances by same variation after five valid passes',()=>{
  assert.match(patch,/const DEPTHS = \[10,15,20,25,30\]/);
  assert.match(patch,/const PASS_TARGET = 5/);
  assert.match(patch,/if\(depth===10\)return true/);
  assert.match(patch,/selectedLinePasses\(lessonAt\(side,prev,index\)\)>=PASS_TARGET/);
  assert.match(patch,/unlockScope:'same-variation-only'/);
});

test('Only Depth 10 creates new variations; deeper depths are continuation-only',()=>{
  assert.match(patch,/variationCreation:'depth-10-only'/);
  assert.match(patch,/if\(depth>10&&DEPTHS\.includes\(depth\)\)return originalStartNewTraining\(index,true\)/);
  assert.match(patch,/Continue Variation \$\{index\+1\}/);
  assert.match(patch,/cot-hidden-depth-action/);
  assert.match(patch,/Qualified from Depth \$\{previousDepth\(depth\)\} · continue this line/);
});

test('Only Depth 10 is initially open; deeper course unlocks after any prior-depth variation reaches 5/5',()=>{
  assert.match(patch,/function depthUnlocked\(side,depth\)/);
  assert.match(patch,/lessonsAt\(side,prev\)\.some\(lesson=>selectedLinePasses\(lesson\)>=PASS_TARGET\)/);
  assert.match(patch,/depthUnlock:'any-previous-depth-variation-at-5-of-5'/);
  assert.match(patch,/cot-course-depth-locked/);
  assert.match(patch,/data-cot-depth-locked/);
  assert.match(patch,/Finish at least one Depth/);
});

test('Inside an unlocked deeper depth only the same qualified variation is trainable',()=>{
  assert.match(patch,/function variationUnlocked\(side,depth,index\)/);
  assert.match(patch,/selectedLinePasses\(lessonAt\(side,prev,index\)\)>=PASS_TARGET/);
  assert.match(patch,/gateVariationCards/);
  assert.match(patch,/Complete this variation at Depth/);
});

test('Practice in a deeper depth is unavailable until its Guided continuation is saved',()=>{
  assert.match(patch,/function currentDepthHasSavedLine\(side,depth,index\)/);
  assert.match(patch,/!currentDepthHasSavedLine\(state\.side,depth,index\)/);
  assert.match(patch,/Continue Variation \$\{index\+1\} in Guided Training first/);
  assert.match(patch,/practiceButton\.classList\.toggle\('cot-hidden-depth-action',!hasCurrentLine\)/);
});

test('A deeper depth replays the exact saved parent line before extending it',()=>{
  assert.match(patch,/inheritedPrefix:'exact-saved-previous-depth-line'/);
  assert.match(patch,/extension:'after-prefix-add-next-five-trainee-moves'/);
  assert.match(patch,/function inheritedPrefixLine\(\)/);
  assert.match(patch,/function inheritedPrefixStep\(actor\)/);
  assert.match(patch,/const inherited=inheritedPrefixStep\('user'\)/);
  assert.match(patch,/const inherited=inheritedPrefixStep\('engine'\)/);
  assert.match(patch,/type:'inherited-line-prefix'/);
  assert.match(patch,/moveUci\(hist\[i\]\)!==stepUci\(moves\[i\]\)/);
});

test('Passing a depth offers Continue This Line to the next depth',()=>{
  assert.match(patch,/Continue This Line · Depth \$\{next\}/);
  assert.match(patch,/continueSameVariation\(next\|\|GAME_END_DEPTH\)/);
  assert.match(patch,/state\.variationIndex/);
  assert.match(patch,/state\.sessionLength=targetDepth/);
});

test('Depth 30 continues the same line toward a natural game end',()=>{
  assert.match(patch,/finalDepth:'30-then-game-end'/);
  assert.match(patch,/Continue This Line · Play to Game End/);
  assert.match(patch,/const GAME_END_DEPTH = 99/);
  assert.match(patch,/state\?\.chess\?\.isGameOver/);
});

test('Game-end continuation replays the exact saved Depth 30 line before Top-1 extension',()=>{
  assert.match(gameEndFix,/const SOURCE_DEPTH = 30/);
  assert.match(gameEndFix,/game-end-inherited-depth30-prefix/);
  assert.match(gameEndFix,/variationIndex:Number\(state\.variationIndex\|\|0\)/);
  assert.match(gameEndFix,/afterPrefix:'stockfish-top1'/);
  assert.match(gameEndFix,/sameVariation:true/);
  assert.match(gameEndFix,/exactSavedDepth30Prefix:true/);
});

test('Internal game-end safety target is hidden from the player UI',()=>{
  assert.match(gameEndFix,/Level\\s\*99/);
  assert.match(gameEndFix,/continue to game end/);
  assert.match(gameEndFix,/userFacingTarget:'natural-game-end'/);
  assert.match(gameEndFix,/internalSafetyTargetHidden:true/);
});

test('Rank marker requires 5/5 at every formal depth plus natural game end',()=>{
  assert.match(patch,/function allFormalDepthsPassed\(profile,side,index\)/);
  assert.match(patch,/DEPTHS\.every\(depth=>selectedLinePasses/);
  assert.match(patch,/markFullLineGameEnd/);
  assert.match(patch,/naturalGameEnd:true/);
  assert.match(patch,/rankFullLineCompletedCount/);
  assert.match(patch,/same-variation-5of5-at-10-15-20-25-30-plus-natural-game-end/);
});

test('Locked depth is enforced for Guided and Practice entry',()=>{
  assert.match(patch,/startNewTraining=async function/);
  assert.match(patch,/startPracticeTest=async function/);
  assert.match(patch,/Complete this variation at Depth/);
});

test('Progression and game-end fix are injected after strict Guided policy',()=>{
  const strict=injector.indexOf('__COT_GUIDED_STRICT_BEST_FINAL__');
  const progression=injector.indexOf('__COT_VARIATION_DEPTH_PROGRESSION__');
  const gameEnd=injector.indexOf('__COT_GAME_END_CONTINUATION_FIX__');
  assert.ok(strict>=0 && progression>strict && gameEnd>progression);
});
