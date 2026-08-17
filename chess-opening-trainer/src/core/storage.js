import { normalizeRepertoireSelection } from './repertoire.js';

const PROFILE_EMAIL_KEY="chessTrainerProfileEmail";
const PROFILE_PREFIX="chessTrainerProfile:";

export function normalizeEmail(value){
  return String(value||"").trim().toLowerCase();
}

export function validEmail(value){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function profileKey(email){
  return PROFILE_PREFIX+normalizeEmail(email);
}

export function emptyProfile(email){
  return {
    email:normalizeEmail(email),
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    repertoireSelection:normalizeRepertoireSelection(),
    lines:[],
    openingElo:{white:800,black:800},
    progress:{white:{},black:{}},
    rankHistory:[]
  };
}

export function setRepertoireSelection(profile,side,presetId){
  if(!profile || !['white','black'].includes(side)) return null;
  const next=normalizeRepertoireSelection({
    ...(profile.repertoireSelection||{}),
    [side]:presetId
  });
  profile.repertoireSelection=next;
  return next[side];
}

export function normalizeLesson(lesson={}){
  let lines=Array.isArray(lesson.lines)?lesson.lines.filter(Boolean):[];
  if(!lines.length && lesson.line) lines=[lesson.line];
  return {
    trained:!!lesson.trained || lines.length>0,
    passes:Number(lesson.passes||0),
    attempts:Number(lesson.attempts||0),
    invalidAttempts:Number(lesson.invalidAttempts||0),
    lines,
    selectedLineIndex:Math.max(0,Math.min(Number(lesson.selectedLineIndex||0),Math.max(0,lines.length-1)))
  };
}

export function ensureLevelProgress(profile, side, level){
  profile.progress=profile.progress||{white:{},black:{}};
  profile.progress.white=profile.progress.white||{};
  profile.progress.black=profile.progress.black||{};
  const bucket=profile.progress[side]||(profile.progress[side]={});
  const key=String(level);

  if(!bucket[key]){
    bucket[key]={
      level:Number(level),
      firstMoves:[],
      lessons:Array.from({length:20},()=>normalizeLesson()),
      rankUnlocked:false,
      rankCompleted:false,
      lastRankElo:null
    };
  }

  const lp=bucket[key];
  lp.level=Number(level);
  lp.firstMoves=Array.isArray(lp.firstMoves)?lp.firstMoves:[];
  lp.lessons=Array.isArray(lp.lessons)?lp.lessons:[];
  while(lp.lessons.length<20) lp.lessons.push(normalizeLesson());
  lp.lessons=lp.lessons.slice(0,20).map(normalizeLesson);
  lp.rankUnlocked=lp.lessons.every(x=>x.passes>=5);
  lp.rankCompleted=!!lp.rankCompleted;
  return lp;
}

export function loadProfile(email){
  const clean=normalizeEmail(email);
  if(!clean) return null;
  try{
    const raw=localStorage.getItem(profileKey(clean));
    const p=raw ? JSON.parse(raw) : emptyProfile(clean);
    p.email=clean;
    p.repertoireSelection=normalizeRepertoireSelection(p.repertoireSelection);
    p.lines=Array.isArray(p.lines)?p.lines:[];
    p.openingElo=p.openingElo||{white:800,black:800};
    p.openingElo.white=Number(p.openingElo.white||800);
    p.openingElo.black=Number(p.openingElo.black||800);
    p.progress=p.progress||{white:{},black:{}};
    p.progress.white=p.progress.white||{};
    p.progress.black=p.progress.black||{};
    p.rankHistory=Array.isArray(p.rankHistory)?p.rankHistory:[];
    for(const side of ["white","black"]){
      for(const level of [5,10,15,20,25,30]){
        if(p.progress?.[side]?.[String(level)]) ensureLevelProgress(p,side,level);
      }
    }
    return p;
  }catch{
    return emptyProfile(clean);
  }
}

export function saveProfile(profile){
  if(!profile?.email) return;
  profile.repertoireSelection=normalizeRepertoireSelection(profile.repertoireSelection);
  profile.updatedAt=new Date().toISOString();
  localStorage.setItem(profileKey(profile.email),JSON.stringify(profile));
}

export function setActiveProfileEmail(email){
  const clean=normalizeEmail(email);
  if(!validEmail(clean)) return null;
  localStorage.setItem(PROFILE_EMAIL_KEY,clean);
  const profile=loadProfile(clean);
  saveProfile(profile);
  return clean;
}

export function restoreActiveProfileEmail(){
  const saved=normalizeEmail(localStorage.getItem(PROFILE_EMAIL_KEY)||"");
  return validEmail(saved) ? saved : "";
}

export function clearActiveProfileEmail(){
  localStorage.removeItem(PROFILE_EMAIL_KEY);
}
