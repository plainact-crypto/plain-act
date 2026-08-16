import test from "node:test";
import assert from "node:assert/strict";
import {
  variationCompleted, completedVariationsForLevel, openingProgress,
  rankUnlockProgress, progressionLabel, verifiedPerformance, prestigeProgressText
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
  const profile={progress:{white:{"10":level(5),"15":level(5),"20":level(5)}}};
  const progress=openingProgress(profile,"white");
  assert.equal(progress.capped,15);
  assert.equal(progress.level,3);
  assert.equal(progress.label,"Proficient");
  assert.equal(progress.mastered,false);
});

test("opening mastery is capped at thirty completed variations",()=>{
  const profile={progress:{white:{"10":level(20),"15":level(20)}}};
  const progress=openingProgress(profile,"white");
  assert.equal(progress.completed,40);
  assert.equal(progress.capped,30);
  assert.equal(progress.level,6);
  assert.equal(progress.label,"Mastered");
  assert.equal(progress.percent,100);
});

test("Rank Test unlocks from one completed variation",()=>{
  assert.deepEqual(rankUnlockProgress(level(0)),{completed:0,required:1,unlocked:false});
  assert.deepEqual(rankUnlockProgress(level(1)),{completed:1,required:1,unlocked:true});
});

function prestigeProfile({successes,attempts,rankTests,rankPerformance}){
  const lessons=Array.from({length:30},(_,index)=>({
    passes:5,
    validPracticeSuccesses:index===0?successes-145:5,
    attempts:index===0?attempts-29:1
  }));
  return {
    progress:{white:{"10":{lessons}}},
    rankHistory:Array.from({length:rankTests},()=>({side:"white",weightedAccuracy:rankPerformance}))
  };
}

test("verified performance ignores raw plays, hints, and the other opening side",()=>{
  const profile=prestigeProfile({successes:180,attempts:200,rankTests:1,rankPerformance:80});
  profile.rankHistory.push({side:"black",weightedAccuracy:100},{side:"white",weightedAccuracy:"bad"});
  profile.rawPlayCount=100000;
  assert.deepEqual(verifiedPerformance(profile,"white"),{
    practiceSuccesses:180,
    practiceAttempts:200,
    consistency:90,
    rankTests:1,
    rankPerformance:80
  });
});

test("Mastered remains 30/30 and does not automatically grant a prestige title",()=>{
  const progress=openingProgress(prestigeProfile({successes:150,attempts:150,rankTests:0,rankPerformance:0}),"white");
  assert.equal(progress.mastered,true);
  assert.equal(progressionLabel(progress),"Mastered");
  assert.equal(progress.prestige.next.title,"Opening CM");
});

test("product prestige titles require every documented performance floor",()=>{
  const cm=openingProgress(prestigeProfile({successes:180,attempts:220,rankTests:1,rankPerformance:75}),"white");
  assert.equal(progressionLabel(cm),"Opening CM");
  const shortOnConsistency=openingProgress(prestigeProfile({successes:225,attempts:266,rankTests:3,rankPerformance:82}),"white");
  assert.equal(progressionLabel(shortOnConsistency),"Opening CM");
  const gm=openingProgress(prestigeProfile({successes:330,attempts:350,rankTests:8,rankPerformance:92}),"white");
  assert.equal(progressionLabel(gm),"Opening GM");
});

test("GM Stars require both thirty extra Practice wins and one extra Rank Test",()=>{
  const noStar=openingProgress(prestigeProfile({successes:359,attempts:380,rankTests:9,rankPerformance:94}),"white");
  assert.equal(progressionLabel(noStar),"Opening GM");
  const starOne=openingProgress(prestigeProfile({successes:360,attempts:380,rankTests:9,rankPerformance:94}),"white");
  assert.equal(progressionLabel(starOne),"Opening GM ★1");
  const capped=openingProgress(prestigeProfile({successes:2000,attempts:2050,rankTests:100,rankPerformance:99}),"white");
  assert.equal(progressionLabel(capped),"Opening GM ★20");
  assert.equal(prestigeProgressText(capped),"Maximum prestige · Opening GM ★20");
});
