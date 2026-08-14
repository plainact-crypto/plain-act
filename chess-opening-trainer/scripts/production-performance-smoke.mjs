import { chromium } from 'playwright';

const targets=(process.env.PRODUCTION_URLS||'https://plainact-crypto.github.io/plain-act/chess-opening-trainer/,https://chess-opening-trainer-3jh.pages.dev').split(',').map(x=>x.trim()).filter(Boolean);
const fakeEmail='performance-smoke@example.invalid';
const fakeUserId='00000000-0000-4000-8000-000000000002';
const assert=(v,m)=>{if(!v)throw new Error(m)};

async function gotoReady(page,url){
  let last;
  for(let i=0;i<12;i++){
    try{
      const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      assert(r?.ok(),`${url} HTTP ${r?.status()}`);
      await page.waitForTimeout(700);
      const ok=await page.evaluate(()=>Boolean(globalThis.__COT_TRAINING_PERFORMANCE_AUDIO_FIX__&&globalThis.__COT_ACTIVATION_ONBOARDING_V2__&&globalThis.__COT_REPORTS_42_47_ROOT_FIX__&&globalThis.__COT_PRACTICE_ENTRY_BOUNDARY_48_49__&&globalThis.__COT_DEPTH_5_RETIRED__));
      if(ok)return;
      last=new Error(`${url}: Depth 10 / reports #42-#49 production markers not deployed yet`);
    }catch(e){last=e}
    await page.waitForTimeout(5000);
  }
  throw last;
}

const browser=await chromium.launch({headless:true});
try{
  for(const url of targets){
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
    await gotoReady(page,url);

    await page.evaluate(({fakeEmail,fakeUserId})=>{
      localStorage.clear();sessionStorage.clear();
      localStorage.setItem('chessTrainerCloudSession',JSON.stringify({access_token:'performance-smoke-invalid-token',user:{id:fakeUserId,email:fakeEmail}}));
      localStorage.setItem('chessTrainerProfileEmail',fakeEmail);
      localStorage.setItem(`chessTrainerProfile:${fakeEmail}`,JSON.stringify({email:fakeEmail,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lines:[],openingElo:{white:800,black:800},progress:{white:{},black:{}},rankHistory:[]}));
      localStorage.setItem(`cotOnboardingCompleted:${fakeUserId}`,new Date().toISOString());
      localStorage.setItem('cotActivationFocus','white');
    },{fakeEmail,fakeUserId});
    await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(1200);
    await page.locator('#cloudAuthGate').evaluate(el=>el.remove()).catch(()=>{});
    await page.evaluate(()=>{try{render?.()}catch{}});
    await page.locator('#cotPrimaryNext').waitFor({state:'visible',timeout:5000});

    const depthState=await page.evaluate(()=>{
      const text=document.body.innerText||'';
      const depth5Control=[...document.querySelectorAll('[data-n],button,a')].some(el=>el.getAttribute('data-n')==='5'||/\bDepth\s*5\b/i.test(el.textContent||''));
      return {depth:Number(state?.sessionLength||0),depth5Control,textMentions:/\bDepth\s*5\b/i.test(text),guard:Boolean(globalThis.__COT_DEPTH_5_RETIRED__)};
    });
    assert(depthState.guard,`${url}: Depth 5 retirement guard missing`);
    assert(depthState.depth===10,`${url}: fresh runtime state still starts at Depth ${depthState.depth}`);
    assert(!depthState.depth5Control&&!depthState.textMentions,`${url}: Depth 5 is still exposed before training (${JSON.stringify(depthState)})`);

    const reportTrigger=page.getByRole('button',{name:/Report.*Issue/i}).first();
    await reportTrigger.waitFor({state:'visible',timeout:5000});
    const before=Date.now();await reportTrigger.click({timeout:5000});
    await page.locator('#issueReportModal').waitFor({state:'visible',timeout:1000});
    const reportMs=Date.now()-before;await page.waitForTimeout(250);
    const report=await page.evaluate(()=>({modal:!!document.querySelector('#issueReportModal'),html2canvasRequested:!!document.querySelector('script[data-issue-html2canvas]')}));
    assert(report.modal,`${url}: Report Issue modal did not open`);
    assert(reportMs<250,`${url}: Report Issue interaction took ${reportMs}ms`);
    assert(!report.html2canvasRequested,`${url}: mobile Report Issue still starts html2canvas`);
    await page.locator('#cancelIssueReport').click().catch(()=>page.locator('#issueReportModal').evaluate(el=>el.remove()));

    await page.locator('#cotPrimaryNext').click();
    await page.locator('#board').waitFor({state:'visible',timeout:15000});
    await page.waitForTimeout(500);
    const nav=await page.evaluate(()=>({screen:state?.screen||null,mode:state?.mode||null,side:state?.side||null,depth:Number(state?.sessionLength||state?.level||0),variation:Number(state?.variationIndex??-1),boardInstance:!!state?.board,hub:!!document.querySelector('.cot-activation-hub'),flow:document.documentElement.dataset.cotFlow||'',practiceBoundary:Boolean(globalThis.__COT_PRACTICE_ENTRY_BOUNDARY_48_49__)}));
    assert(nav.screen==='training',`${url}: Continue Training did not reach training (${JSON.stringify(nav)})`);
    assert(nav.mode==='guided',`${url}: zero-progress Continue did not start New Training (${JSON.stringify(nav)})`);
    assert(nav.side==='white',`${url}: Continue Training lost opening side (${JSON.stringify(nav)})`);
    assert(nav.depth===10,`${url}: new user did not start at Depth 10 (${JSON.stringify(nav)})`);
    assert(nav.variation===0,`${url}: Continue Training lost variation (${JSON.stringify(nav)})`);
    assert(nav.boardInstance,`${url}: training DOM exists without a live board instance (${JSON.stringify(nav)})`);
    assert(nav.practiceBoundary,`${url}: Practice entry boundary fix missing`);
    assert(!nav.hub&&nav.flow==='training',`${url}: Activation hub still participates in training layout (${JSON.stringify(nav)})`);

    const perf=await page.evaluate(async()=>{
      const long=[];let po=null;
      try{po=new PerformanceObserver(list=>{for(const e of list.getEntries())long.push(e.duration)});po.observe({type:'longtask',buffered:true})}catch{}
      const samples=[];
      for(let i=0;i<8;i++){
        const t=performance.now();try{render?.()}catch{}samples.push(performance.now()-t);await new Promise(r=>requestAnimationFrame(r));
      }
      await new Promise(r=>setTimeout(r,300));po?.disconnect();
      const board=document.querySelector('#board'),rect=board?.getBoundingClientRect();
      let workerPosts=0;const rawPost=Worker.prototype.postMessage;
      Worker.prototype.postMessage=function(message,...rest){if(/^(?:position\s+fen|go\s+)/i.test(String(message||'')))workerPosts++;return rawPost.call(this,message,...rest)};
      const oldMode=state.mode;state.mode='test';try{render()}catch{};
      await new Promise(r=>setTimeout(r,1800));
      const idlePracticeWorkerPosts=workerPosts;
      state.mode=oldMode;Worker.prototype.postMessage=rawPost;
      return {board:Boolean(board&&rect&&rect.width>240&&rect.height>240),maxRender:Math.max(...samples),avgRender:samples.reduce((a,b)=>a+b,0)/samples.length,maxLong:long.length?Math.max(...long):0,idlePracticeWorkerPosts,fix:Boolean(globalThis.__COT_TRAINING_PERFORMANCE_AUDIO_FIX__),rootFix:Boolean(globalThis.__COT_REPORTS_42_47_ROOT_FIX__)};
    });
    assert(perf.fix&&perf.rootFix,`${url}: root performance/navigation fix marker disappeared`);
    assert(perf.board,`${url}: performance test did not reach a live mobile chessboard`);
    assert(perf.maxRender<180,`${url}: repeated live-board render blocked ${perf.maxRender.toFixed(1)}ms`);
    assert(perf.maxLong<250,`${url}: long task ${perf.maxLong.toFixed(1)}ms on live mobile training board`);
    assert(perf.idlePracticeWorkerPosts<=1,`${url}: idle Practice sent ${perf.idlePracticeWorkerPosts} engine commands in 1.8s; recurring evaluation loop remains`);

    await page.locator('#exit').click({timeout:3000});
    await page.waitForFunction(()=>state?.screen==='course',{timeout:3000});
    const exitState=await page.evaluate(()=>({screen:state?.screen,training:!!document.querySelector('.training'),course:!!document.querySelector('.variation-grid,.course-head')}));
    assert(exitState.screen==='course'&&!exitState.training&&exitState.course,`${url}: Back to Level/Exit did not leave training cleanly (${JSON.stringify(exitState)})`);

    const fatal=errors.filter(x=>!/401|Unauthorized|Failed to fetch|Session expired|JWT/i.test(x));
    assert(fatal.length===0,`${url}: page errors ${fatal.join(' | ')}`);
    console.log(`PASS depth-10-and-reports-42-49-mobile ${url} report=${reportMs}ms renderMax=${perf.maxRender.toFixed(1)}ms longMax=${perf.maxLong.toFixed(1)}ms idlePracticeEngine=${perf.idlePracticeWorkerPosts} side=${nav.side} depth=${nav.depth} exit=${exitState.screen}`);
    await context.close();
  }
}finally{await browser.close()}
