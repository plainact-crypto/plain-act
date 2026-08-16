export const PRACTICE_PASSES_PER_VARIATION=5;
export const MASTERY_VARIATION_STEP=5;
export const MASTERY_VARIATION_CAP=30;

const LEVELS=[10,15,20,25,30];
const LABELS=["New","Developing","Practiced","Proficient","Advanced","Expert","Mastered"];
export const PRESTIGE_TIERS=[
  {key:"opening-cm",title:"Opening CM",practiceSuccesses:180,consistency:80,rankTests:1,rankPerformance:75},
  {key:"opening-fm",title:"Opening FM",practiceSuccesses:225,consistency:85,rankTests:3,rankPerformance:82},
  {key:"opening-im",title:"Opening IM",practiceSuccesses:270,consistency:90,rankTests:5,rankPerformance:88},
  {key:"opening-gm",title:"Opening GM",practiceSuccesses:330,consistency:93,rankTests:8,rankPerformance:92}
];
export const GM_STAR_CAP=20;

export function variationCompleted(lesson){
  return Number(lesson?.passes||0)>=PRACTICE_PASSES_PER_VARIATION;
}

export function completedVariationsForLevel(levelProgress){
  return (levelProgress?.lessons||[]).filter(variationCompleted).length;
}

function finite(value,fallback=0){
  const number=Number(value);
  return Number.isFinite(number)?number:fallback;
}

export function verifiedPerformance(profile,side){
  const bucket=profile?.progress?.[side]||{};
  let practiceSuccesses=0;
  let practiceAttempts=0;
  for(const level of LEVELS){
    for(const lesson of bucket[String(level)]?.lessons||[]){
      const passes=Math.max(0,finite(lesson?.passes));
      practiceSuccesses+=Math.max(passes,finite(lesson?.validPracticeSuccesses,passes));
      practiceAttempts+=Math.max(0,finite(lesson?.attempts));
    }
  }
  const consistency=practiceAttempts?Math.min(100,practiceSuccesses/practiceAttempts*100):0;
  const rankResults=(profile?.rankHistory||[]).filter(result=>
    result?.side===side && Number.isFinite(Number(result?.weightedAccuracy))
  );
  const rankPerformance=rankResults.length
    ? rankResults.reduce((sum,result)=>sum+Math.max(0,Math.min(100,Number(result.weightedAccuracy))),0)/rankResults.length
    : 0;
  return {practiceSuccesses,practiceAttempts,consistency,rankTests:rankResults.length,rankPerformance};
}

function satisfies(metrics,tier){
  return metrics.practiceSuccesses>=tier.practiceSuccesses &&
    metrics.consistency>=tier.consistency &&
    metrics.rankTests>=tier.rankTests &&
    metrics.rankPerformance>=tier.rankPerformance;
}

export function openingPrestige(profile,side,mastered){
  const metrics=verifiedPerformance(profile,side);
  if(!mastered) return {key:null,title:null,stars:0,metrics,next:PRESTIGE_TIERS[0]};

  let tier=null;
  for(const candidate of PRESTIGE_TIERS){
    if(satisfies(metrics,candidate)) tier=candidate;
    else break;
  }
  if(!tier) return {key:"mastered",title:"Mastered",stars:0,metrics,next:PRESTIGE_TIERS[0]};

  let stars=0;
  if(tier.key==="opening-gm"){
    const practiceStars=Math.floor((metrics.practiceSuccesses-tier.practiceSuccesses)/30);
    const rankStars=metrics.rankTests-tier.rankTests;
    stars=Math.max(0,Math.min(GM_STAR_CAP,practiceStars,rankStars));
  }
  const title=stars?`${tier.title} ★${stars}`:tier.title;
  const tierIndex=PRESTIGE_TIERS.findIndex(candidate=>candidate.key===tier.key);
  const next=tier.key==="opening-gm"
    ? stars<GM_STAR_CAP?{
        key:`opening-gm-star-${stars+1}`,
        title:`Opening GM ★${stars+1}`,
        practiceSuccesses:tier.practiceSuccesses+30*(stars+1),
        consistency:tier.consistency,
        rankTests:tier.rankTests+stars+1,
        rankPerformance:tier.rankPerformance
      }:null
    :PRESTIGE_TIERS[tierIndex+1];
  return {key:tier.key,title,stars,metrics,next};
}

export function openingProgress(profile,side){
  const bucket=profile?.progress?.[side]||{};
  const completed=LEVELS.reduce((total,level)=>{
    return total+completedVariationsForLevel(bucket[String(level)]);
  },0);
  const capped=Math.min(MASTERY_VARIATION_CAP,completed);
  const level=Math.min(6,Math.floor(capped/MASTERY_VARIATION_STEP));
  const mastered=capped>=MASTERY_VARIATION_CAP;
  const nextTarget=mastered?MASTERY_VARIATION_CAP:Math.min(MASTERY_VARIATION_CAP,(level+1)*MASTERY_VARIATION_STEP);
  const prestige=openingPrestige(profile,side,mastered);
  return {
    completed,
    capped,
    level,
    label:mastered?"Mastered":capped>0&&level===0?"Started":LABELS[level],
    mastered,
    nextTarget,
    remaining:Math.max(0,nextTarget-capped),
    percent:capped/MASTERY_VARIATION_CAP*100,
    prestige
  };
}

// Rank is not unlocked by one 5/5 stage. The variation-depth progression layer
// writes rankFullLineCompletedCount only after a single variation has passed
// 10/15/20/25/30 at 5/5 and then reached a natural game end.
export function rankUnlockProgress(levelProgress){
  const completed=Math.max(0,finite(levelProgress?.rankFullLineCompletedCount,0));
  return {
    completed,
    required:1,
    unlocked:completed>=1
  };
}

export function progressionLabel(progress){
  if(progress.prestige?.title) return progress.prestige.title;
  if(progress.mastered) return "Mastered";
  if(progress.capped===0) return "New";
  return `Level ${progress.level} · ${progress.label}`;
}

export function prestigeProgressText(progress){
  if(!progress.mastered) return `${progress.remaining} variations to next level`;
  const prestige=progress.prestige;
  if(!prestige?.next) return "Maximum prestige · Opening GM ★20";
  const metrics=prestige.metrics;
  const next=prestige.next;
  const gaps=[];
  if(metrics.practiceSuccesses<next.practiceSuccesses) gaps.push(`${next.practiceSuccesses-metrics.practiceSuccesses} Practice wins`);
  if(metrics.consistency<next.consistency) gaps.push(`${Math.ceil(next.consistency-metrics.consistency)}% consistency`);
  if(metrics.rankTests<next.rankTests) gaps.push(`${next.rankTests-metrics.rankTests} Rank Tests`);
  if(metrics.rankPerformance<next.rankPerformance) gaps.push(`${Math.ceil(next.rankPerformance-metrics.rankPerformance)}% Rank performance`);
  return gaps.length?`${next.title}: ${gaps.join(" · ")}`:`${next.title} ready`;
}
