export function moveAccuracyFromLoss(lossCp){
  const loss=Math.max(0,Math.min(600,Number(lossCp||0)));
  return 100*Math.exp(-loss/180);
}

export function avgAccuracy(items){
  if(!items.length) return 0;
  return items.reduce((a,b)=>a+Number(b.accuracy||0),0)/items.length;
}

export function avgLoss(items){
  if(!items.length) return 0;
  return items.reduce((sum,x)=>sum+Number(x.lossCp||0),0)/items.length;
}

export function countLossBand(items,min,max=Infinity){
  return items.filter(x=>{
    const v=Number(x.lossCp||0);
    return v>=min && v<max;
  }).length;
}

export function rankCeiling(level){
  return ({5:1100,10:1350,15:1650,20:2000,25:2400,30:2900})[Number(level)]||1100;
}

export function eloFromRank(savedAcc,freshAcc,level){
  const weighted=savedAcc*.60+freshAcc*.40;
  const floor=600;
  const ceiling=rankCeiling(level);
  const normalized=Math.max(0,Math.min(1,weighted/100));
  const factor=Math.pow(normalized,2.15);
  return {elo:Math.round(floor+(ceiling-floor)*factor),weighted};
}

export function rankPerformanceLabel(accuracy){
  if(accuracy>=97) return "Elite";
  if(accuracy>=92) return "Excellent";
  if(accuracy>=85) return "Strong";
  if(accuracy>=75) return "Developing";
  return "Needs more training";
}

export function fisherYates(items){
  const a=[...items];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
