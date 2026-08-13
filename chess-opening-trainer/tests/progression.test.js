import test from "node:test";
import assert from "node:assert/strict";
import {
  variationCompleted, completedVariationsForLevel, openingProgress,
  rankUnlockProgress, progressionLabel
} from "../src/core/progression.js";

const lesson=passes=>({passes});
const level=(count,passes=5)=>({lessons:Array.from({length:count},()=>lesson(passes))});

test("one successful variation is completed but never opening mastery",()=>{
  const profile={progress:{black:{"10":level(1)}}};
  assert.equal(variationCompleted(lesson(5)),true);
  assert.equal(completedVariationsForLevel(level(1)),1);
  const progress=openingProgress(profile,"black");
  assert.equal(progress.capped,1);
  assert.equal(progress.mastered,false);
  assert.equal(progressionLabel(progress),"Level 0 · Started");
});

test("a variation requires five valid Practice passes",()=>{
  assert.equal(variationCompleted(lesson(1)),false);
  assert.equal(variationCompleted(lesson(4)),false);
  assert.equal(variationCompleted(lesson(5)),true);
});

test("progress advances every five distinct completed variations",()=>{
  const profile={progress:{white:{"5":level(5),"10":level(5),"15":level(5)}}};
  const progress=openingProgress(profile,"white");
  assert.equal(progress.capped,15);
  assert.equal(progress.level,3);
  assert.equal(progress.label,"Proficient");
  assert.equal(progress.mastered,false);
});

test("opening mastery is capped at thirty completed variations",()=>{
  const profile={progress:{white:{"5":level(20),"10":level(20)}}};
  const progress=openingProgress(profile,"white");
  assert.equal(progress.completed,40);
  assert.equal(progress.capped,30);
  assert.equal(progress.level,6);
  assert.equal(progress.label,"Mastered");
  assert.equal(progress.percent,100);
});

test("Rank Test unlocks from five different completed variations",()=>{
  assert.deepEqual(rankUnlockProgress(level(4)),{completed:4,required:5,unlocked:false});
  assert.deepEqual(rankUnlockProgress(level(5)),{completed:5,required:5,unlocked:true});
});
