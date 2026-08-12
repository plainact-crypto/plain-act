export class AnalysisEngine {
  constructor(workerUrl=`${import.meta.env.BASE_URL || "/"}stockfish/stockfish-18-lite-single.js`){
    this.workerUrl=workerUrl;
    this.worker=null;
    this.readyPromise=null;
    this.queue=Promise.resolve();
  }

  async ready(){
    if(this.worker && this.readyPromise) return this.readyPromise;
    this.worker=new Worker(this.workerUrl);
    this.readyPromise=new Promise((resolve,reject)=>{
      let uciOk=false;
      const timer=setTimeout(()=>reject(new Error("Engine readiness timeout")),12000);

      const onMessage=(event)=>{
        const line=typeof event.data==="string"?event.data:"";
        if(line==="uciok"){
          uciOk=true;
          this.worker.postMessage("isready");
        }else if(line==="readyok" && uciOk){
          clearTimeout(timer);
          this.worker.removeEventListener("message",onMessage);
          resolve();
        }
      };
      this.worker.addEventListener("message",onMessage);
      this.worker.addEventListener("error",(e)=>{
        clearTimeout(timer);
        reject(e);
      },{once:true});
      this.worker.postMessage("uci");
    });
    return this.readyPromise;
  }

  _enqueue(task){
    const run=this.queue.then(task,task);
    this.queue=run.catch(()=>{});
    return run;
  }

  async search({fen,depth=16,multiPv=1,onInfo=null}){
    return this._enqueue(async()=>{
      await this.ready();
      return new Promise((resolve,reject)=>{
        const rows=new Map();
        let bestmove=null;
        const worker=this.worker;
        const timer=setTimeout(()=>{
          cleanup();
          reject(new Error("Engine search timeout"));
        },30000);

        const cleanup=()=>{
          clearTimeout(timer);
          worker.removeEventListener("message",onMessage);
        };

        const onMessage=(event)=>{
          const line=typeof event.data==="string"?event.data:"";
          if(!line) return;
          if(line.startsWith("info ")){
            const mp=Number(line.match(/\bmultipv\s+(\d+)/)?.[1]||1);
            const dp=Number(line.match(/\bdepth\s+(\d+)/)?.[1]||0);
            const cp=line.match(/\bscore\s+cp\s+(-?\d+)/);
            const mate=line.match(/\bscore\s+mate\s+(-?\d+)/);
            const pv=line.match(/\bpv\s+(.+)$/)?.[1]||"";
            const uci=pv.split(/\s+/)[0]||"";
            const info={multipv:mp,depth:dp,cp:cp?Number(cp[1]):null,mate:mate?Number(mate[1]):null,pv,uci};
            const prev=rows.get(mp);
            if(!prev || dp>=prev.depth) rows.set(mp,info);
            onInfo?.(info);
          }else if(line.startsWith("bestmove ")){
            bestmove=line.split(/\s+/)[1];
            cleanup();
            const list=[...rows.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
            resolve({bestmove:bestmove==="(none)"?null:bestmove,lines:list});
          }
        };

        worker.addEventListener("message",onMessage);
        worker.postMessage(`setoption name MultiPV value ${Math.max(1,Number(multiPv||1))}`);
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth}`);
      });
    });
  }

  async bestMove(fen,depth=16,onInfo=null){
    const result=await this.search({fen,depth,multiPv:1,onInfo});
    return result.bestmove;
  }

  async topMoves(fen,count=3,depth=10){
    const result=await this.search({fen,depth,multiPv:count});
    const ucis=result.lines.map(x=>x.uci).filter(Boolean);
    if(result.bestmove && !ucis.includes(result.bestmove)) ucis.unshift(result.bestmove);
    return [...new Set(ucis)].slice(0,count);
  }

  async evaluate(fen,depth=12){
    const result=await this.search({fen,depth,multiPv:1});
    return result.lines[0]||null;
  }
}
