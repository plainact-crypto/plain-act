import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const patch=readFileSync(new URL("../training-lines-patch.js",import.meta.url),"utf8");

test("each saved training line owns independent Practice state",()=>{
  assert.match(patch,/line\.practice=/);
  assert.match(patch,/progress\.passes=Math\.min\(PASS_TARGET,progress\.passes\+1\)/);
  assert.match(patch,/progress\.history\.push/);
});

test("completed lines remain replayable and branch CTA explores a new line",()=>{
  assert.match(patch,/Practice This Line Again/);
  assert.match(patch,/Explore New Line in This Branch/);
  assert.match(patch,/Find Strongest New Option/);
  assert.match(patch,/best\.score-result\.score<=35/);
  assert.match(patch,/!used\.has\(uci\)/);
});

test("branch summary preserves existing Rank logic",()=>{
  assert.match(patch,/lesson\.passes=lines\.reduce/);
  assert.match(patch,/lp\.rankUnlocked=rankUnlockProgress\(lp\)\.unlocked/);
});
