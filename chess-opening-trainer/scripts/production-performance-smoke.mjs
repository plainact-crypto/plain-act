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
    await page.locator('#cotPrimaryNext').waitFor({state:'visible',timeout:5000});

    const beforeTraining=await page.evaluate(()=>{
      const text=document.body.innerText||'';
      const depth5Control=[...document.querySelectorAll('[data-n],button,a')].some(el=>el.getAttribute('data-n')==='5'||/\bDepth\s*5\b/i.test(el.textContent||''));
      return {depth5Control,textMentions:/\bDepth\s*5\b/i.test(text),guard:Boolean(globalThis.__COT_DEPTH_5_RETIRED__)};
    });
    assert(beforeTraining.guard,`${url}: Depth 5 retirement guard missing`);
    assert(!beforeTraining.depth5Control&&!beforeTraining.textMentions,`${url}: Depth 5 is still exposed before training (${JSON.stringify(beforeTraining)})`);

    const reportTrigger=page.getByRole('button',{name:/Report.*Issue/i}).first();
    await reportTrigger.waitFor({state:'visible',timeout:5000});
    const reportStart=Date.now();await reportTrigger.click({timeout:5000});
    await page.locator('#issueReportModal').waitFor({state:'visible',timeout:1000});
    const reportMs=Date.now()-reportStart;await page.waitForTimeout(150);
    const report=await page.evaluate(()=>({modal:!!document.querySelector('#issueReportModal'),html2canvasRequested:!!document.querySelector('script[data-issue-html2canvas]')}));
    assert(report.modal,`${url}: Report Issue modal did not open`);
    assert(reportMs<300,`${url}: Report Issue interaction took ${reportMs}ms`);
    assert(!report.html2canvasRequested,`${url}: mobile Report Issue still starts html2canvas`);
    await page.locator('#cancelIssueReport').click().catch(()=>page.locator('#issueReportModal').evaluate(el=>el.remove()));

    const launchStart=Date.now();
    await page.locator('#cotPrimaryNext').click();
    await page.waitForTimeout(1200);
    const entryDiag=await page.evaluate(()=>{
      let appState={};
      try{appState={screen:state?.screen||'',mode:state?.mode||'',side:state?.side||'',depth:state?.sessionLength??null,variation:state?.variationIndex??null,profileEmail:state?.profileEmail||'',complete:!!state?.complete,status:String(state?.status||'')}}catch(e){appState={stateError:String(e?.message||e)}}
      const visibleButtons=[...document.querySelectorAll('button,a,[role="button"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}).slice(0,25).map(el=>(el.textContent||'').replace(/\s+/g,' ').trim());
      return {appState,board:!!document.querySelector('#board'),training:!!document.querySelector('.training'),course:!!document.querySelector('.variation-grid,.course-head'),hub:!!document.querySelector('.cot-activation-hub'),flow:document.documentElement.dataset.cotFlow||'',visibleButtons,body:(document.body.innerText||'').replace(/\s+/g,' ').slice(0,1400)};
    });
    console.log(`ENTRY_DIAG ${url} ${JSON.stringify(entryDiag)}`);
    await page.locator('#board').waitFor({state:'visible',timeout:15000});
    await page.waitForTimeout(450);
    const launchMs=Date.now()-launchStart;
    const training=await page.evaluate(()=>{
      const root=document.querySelector('.training');
      const board=document.querySelector('#board');
      const rect=board?.getBoundingClientRect();
      const text=root?.innerText||'';
      return {live:Boolean(root&&board&&rect&&rect.width>240&&rect.height>240),depth10:/\b0\s*\/\s*10\b/.test(text),depth5:/\b0\s*\/\s*5\b/.test(text)||/\bDepth\s*5\b/i.test(text),hasExit:!!document.querySelector('#exit'),flow:document.documentElement.dataset.cotFlow||''};
    });
    assert(training.live,`${url}: Continue Training did not reach a live mobile chessboard (${JSON.stringify(training)})`);
    assert(training.depth10&&!training.depth5,`${url}: first training session is not Depth 10 (${JSON.stringify(training)})`);
    assert(training.hasExit,`${url}: training controls missing Exit`);
    assert(training.flow==='training',`${url}: training flow marker not active (${training.flow})`);

    await page.locator('#exit').click({timeout:3000});
    await page.locator('.variation-grid,.course-head').first().waitFor({state:'visible',timeout:4000});
    const exitState=await page.evaluate(()=>{
      const text=document.body.innerText||'';
      const titles=[...document.querySelectorAll('.variation-move')].map(el=>(el.textContent||'').trim());
      return {training:!!document.querySelector('.training'),course:!!document.querySelector('.variation-grid,.course-head'),depth5:/\bDepth\s*5\b/i.test(text),count:titles.length,unique:new Set(titles).size,hasD5:titles.includes('1.d4 …d5'),hasE5:titles.includes('1.d4 …e5'),titles,flow:document.documentElement.dataset.cotFlow||''};
    });
    assert(!exitState.training&&exitState.course&&!exitState.depth5,`${url}: Exit returned to stale/Depth-5 UI (${JSON.stringify(exitState)})`);
    assert(exitState.count===20&&exitState.unique===20,`${url}: current preset does not expose 20 distinct opponent first replies (${JSON.stringify(exitState)})`);
    assert(exitState.hasD5&&exitState.hasE5,`${url}: current white preset missing required ...d5/...e5 branches (${JSON.stringify(exitState)})`);

    const fatal=errors.filter(x=>!/401|Unauthorized|Failed to fetch|Session expired|JWT/i.test(x));
    assert(fatal.length===0,`${url}: page errors ${fatal.join(' | ')}`);
    console.log(`PASS depth10-production-mobile ${url} replies=${exitState.count} d5=${exitState.hasD5} e5=${exitState.hasE5} report=${reportMs}ms launch=${launchMs}ms`);
    await context.close();
  }
}finally{await browser.close()}
