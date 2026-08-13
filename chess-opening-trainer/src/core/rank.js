function finiteNumber(value,fallback=0){
  if(value===null||value===undefined||value==='') return fallback;
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}

function boundedAccuracy(value){
  return Math.max(0,Math.min(100,finiteNumber(value,0)));
}

export function moveAccuracyFromLoss(lossCp){
  if(lossCp===null||lossCp===undefined||lossCp==='') return 0;
  const raw=Number(lossCp);
  if(!Number.isFinite(raw)) return 0;
  const loss=Math.max(0,Math.min(600,raw));
  return 100*Math.exp(-loss/180);
}

export function avgAccuracy(items){
  if(!Array.isArray(items)||!items.length) return 0;
  return items.reduce((a,b)=>a+boundedAccuracy(b?.accuracy),0)/items.length;
}

export function avgLoss(items){
  if(!Array.isArray(items)||!items.length) return 0;
  return items.reduce((sum,x)=>sum+Math.max(0,Math.min(600,finiteNumber(x?.lossCp,600))),0)/items.length;
}

export function countLossBand(items,min,max=Infinity){
  if(!Array.isArray(items)||!items.length) return 0;
  const lo=Math.max(0,finiteNumber(min,0));
  const hi=max===Infinity?Infinity:Math.max(lo,finiteNumber(max,Infinity));
  return items.filter(x=>{
    if(x?.lossCp===null||x?.lossCp===undefined||x?.lossCp==='') return false;
    const v=Number(x.lossCp);
    return Number.isFinite(v)&&v>=lo&&v<hi;
  }).length;
}

export function rankCeiling(level){
  return ({5:1100,10:1350,15:1650,20:2000,25:2400,30:2900})[Number(level)]||1100;
}

export function eloFromRank(savedAcc,freshAcc,level){
  const safeSaved=boundedAccuracy(savedAcc);
  const safeFresh=boundedAccuracy(freshAcc);
  const weighted=safeSaved*.60+safeFresh*.40;
  const floor=600;
  const ceiling=rankCeiling(level);
  const normalized=Math.max(0,Math.min(1,weighted/100));
  const factor=Math.pow(normalized,2.15);
  return {elo:Math.round(floor+(ceiling-floor)*factor),weighted};
}

export function rankPerformanceLabel(accuracy){
  const safe=boundedAccuracy(accuracy);
  if(safe>=97) return "Elite";
  if(safe>=92) return "Excellent";
  if(safe>=85) return "Strong";
  if(safe>=75) return "Developing";
  return "Needs more training";
}

export function fisherYates(items){
  const a=Array.isArray(items)?[...items]:[];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
