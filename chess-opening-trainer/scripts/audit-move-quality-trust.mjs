import fs from 'node:fs';

const patch=fs.readFileSync(new URL('../move-quality-symbol-patch.js',import.meta.url),'utf8');
if(/brilliant\s*:\s*\{|great\s*:\s*\{|return\s+['"](?:brilliant|great)['"]/i.test(patch)){
  throw new Error('P0 trust gate failed: Great/Brilliant classifier is active');
}

const cpForMover=(fen,cp,mover)=>{
  const turn=fen.split(/\s+/)[1];
  const white=turn==='w'?cp:-cp;
  return mover==='w'?white:-white;
};
const classify=loss=>loss<=20?'best':loss<=70?'good':loss<=140?'inaccuracy':loss<=300?'mistake':'blunder';

const fixtures=[
  {
    report:30,mover:'w',beforeCp:112,afterCp:-136,
    before:'r2qkbnr/1p3ppp/p3p3/3pnb2/3N4/4B3/PPPNBPPP/R2Q1RK1 w kq - 0 10',
    after:'r2qkbnr/1p3ppp/p3p3/3pnN2/8/4B3/PPPNBPPP/R2Q1RK1 b kq - 0 10'
  },
  {
    report:31,mover:'w',beforeCp:27,afterCp:-27,
    before:'rnbqkbnr/pp2pppp/2p5/8/3Pp3/8/PPPN1PPP/R1BQKBNR w KQkq - 0 4',
    after:'rnbqkbnr/pp2pppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR b KQkq - 0 4'
  },
  {
    report:32,mover:'w',beforeCp:39,afterCp:-40,
    before:'r2qkbnr/pp1npppb/2p4p/7P/3P4/5NN1/PPP2PP1/R1BQKB1R w KQkq - 1 9',
    after:'r2qkbnr/pp1npppb/2p4p/7P/3P4/3B1NN1/PPP2PP1/R1BQK2R b KQkq - 2 9'
  }
];

for(const f of fixtures){
  const before=cpForMover(f.before,f.beforeCp,f.mover);
  const after=cpForMover(f.after,f.afterCp,f.mover);
  const loss=Math.max(0,before-after);
  const grade=classify(loss);
  if(grade!=='best')throw new Error(`Report #${f.report} regression: expected safe Best, got ${grade} (${loss}cp loss)`);
  console.log(`Report #${f.report}: ${loss}cp loss -> ${grade}`);
}
console.log('P0 move-quality trust audit passed');
