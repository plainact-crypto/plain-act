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
      const ok=await page.evaluate(()=>Boolean(globalThis.__COT_TRAINING_PERFORMANCE_AUDIO_FIX__&&globalThis.__COT_ACTIVATION_ONBOARDING_V2__));
      if(ok)return;
      last=new Error(`${url}: performance patch not deployed yet`);
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

    const report=await page.evaluate(async()=>{
      const before=performance.now();
      openIssueReport();
      const syncMs=performance.now()-before;
      await new Promise(r=>setTimeout(r,250));
      return {syncMs,modal:!!document.querySelector('#issueReportModal'),html2canvasRequested:!!document.querySelector('script[data-issue-html2canvas]')};
    });
    assert(report.modal,`${url}: Report Issue modal did not open`);
    assert(report.syncMs<80,`${url}: Report Issue blocked main thread for ${report.syncMs.toFixed(1)}ms`);
    assert(!report.html2canvasRequested,`${url}: mobile Report Issue still starts html2canvas`);
    await page.locator('#cancelIssueReport').click().catch(()=>page.locator('#issueReportModal').evaluate(el=>el.remove()));

    await page.locator('#cotPrimaryNext').click();
    await page.waitForTimeout(1400);
    const perf=await page.evaluate(async()=>{
      const long=[];
      let po=null;
      try{po=new PerformanceObserver(list=>{for(const e of list.getEntries())long.push(e.duration)});po.observe({type:'longtask',buffered:true})}catch{}
      const samples=[];
      for(let i=0;i<8;i++){
        const t=performance.now();
        try{render?.()}catch{}
        samples.push(performance.now()-t);
        await new Promise(r=>requestAnimationFrame(r));
      }
      await new Promise(r=>setTimeout(r,300));po?.disconnect();
      return {screen:globalThis.state?.screen||null,board:!!document.querySelector('#board'),maxRender:Math.max(...samples),avgRender:samples.reduce((a,b)=>a+b,0)/samples.length,maxLong:long.length?Math.max(...long):0,legacyPollMarker:Boolean(globalThis.__WOOD_PIECE_SOUND_PATCH__),fix:Boolean(globalThis.__COT_TRAINING_PERFORMANCE_AUDIO_FIX__)};
    });
    assert(perf.fix,`${url}: performance fix marker disappeared`);
    assert(perf.maxRender<180,`${url}: repeated render blocked ${perf.maxRender.toFixed(1)}ms`);
    assert(perf.maxLong<250,`${url}: long task ${perf.maxLong.toFixed(1)}ms during mobile training transition`);
    const fatal=errors.filter(x=>!/401|Unauthorized|Failed to fetch|Session expired|JWT/i.test(x));
    assert(fatal.length===0,`${url}: page errors ${fatal.join(' | ')}`);
    console.log(`PASS mobile-performance ${url} report=${report.syncMs.toFixed(1)}ms renderMax=${perf.maxRender.toFixed(1)}ms longMax=${perf.maxLong.toFixed(1)}ms board=${perf.board}`);
    await context.close();
  }
}finally{await browser.close()}
