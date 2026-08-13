export const PRACTICE_PASSES_PER_VARIATION=5;
export const MASTERY_VARIATION_STEP=5;
export const MASTERY_VARIATION_CAP=30;

const LEVELS=[5,10,15,20,25,30];
const LABELS=["New","Developing","Practiced","Proficient","Advanced","Expert","Mastered"];

export function variationCompleted(lesson){
  return Number(lesson?.passes||0)>=PRACTICE_PASSES_PER_VARIATION;
}

export function completedVariationsForLevel(levelProgress){
  return (levelProgress?.lessons||[]).filter(variationCompleted).length;
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
  return {
    completed,
    capped,
    level,
    label:mastered?"Mastered":capped>0&&level===0?"Started":LABELS[level],
    mastered,
    nextTarget,
    remaining:Math.max(0,nextTarget-capped),
    percent:capped/MASTERY_VARIATION_CAP*100
  };
}

export function rankUnlockProgress(levelProgress){
  const completed=completedVariationsForLevel(levelProgress);
  return {
    completed,
    required:MASTERY_VARIATION_STEP,
    unlocked:completed>=MASTERY_VARIATION_STEP
  };
}

export function progressionLabel(progress){
  if(progress.mastered) return "Mastered";
  if(progress.capped===0) return "New";
  return `Level ${progress.level} · ${progress.label}`;
}
