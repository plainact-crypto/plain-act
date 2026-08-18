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
      const ok=await page.evaluate(()=>Boolean(globalThis.__COT_TRAINING_PERFORMANCE_AUDIO_FIX__&&globalThis.__COT_ACTIVATION_ONBOARDING_V2__&&globalThis.__COT_REPORTS_42_47_ROOT_FIX__&&globalThis.__COT_PRACTICE_ENTRY_BOUNDARY_48_49__&&globalThis.__COT_DEPTH_5_RETIRED__&&globalThis.__COT_ACTIVATION_ENTRY_HOTFIX__==='direct-v6'));
      if(ok)return;
      last=new Error(`${url}: current production activation-entry markers not deployed yet`);
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
    const errors=[],consoleEvents=[];
    page.on('pageerror',e=>errors.push(String(e?.message||e)));
    page.on('console',m=>{const t=`${m.type()}: ${m.text()}`;if(/Activation|entry/i.test(t))consoleEvents.push(t)});
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
      return {depth5Control,textMentions:/\bDepth\s*5\b/i.test(text),guard:Boolean(globalThis.__COT_DEPTH_5_RETIRED__),entryHotfix:globalThis.__COT_ACTIVATION_ENTRY_HOTFIX__||''};
    });
    assert(beforeTraining.guard,`${url}: Depth 5 retirement guard missing`);
    assert(beforeTraining.entryHotfix==='direct-v6',`${url}: activation entry hotfix missing (${JSON.stringify(beforeTraining)})`);
    assert(!beforeTraining.depth5Control&&!beforeTraining.textMentions,`${url}: Depth 5 is still exposed before training (${JSON.stringify(beforeTraining)})`);

    const launchStart=Date.now();
    await page.locator('#cotPrimaryNext').click();
    await page.waitForTimeout(1200);
    const entryDiag=await page.evaluate(()=>({hotfix:globalThis.__COT_ACTIVATION_ENTRY_HOTFIX__||'',activationEntry:document.documentElement.dataset.cotActivationEntry||'',activationError:document.documentElement.dataset.cotActivationError||'',board:!!document.querySelector('#board'),training:!!document.querySelector('.training'),flow:document.documentElement.dataset.cotFlow||'',body:(document.body.innerText||'').replace(/\s+/g,' ').slice(0,1200)}));
    console.log(`ENTRY_DIAG ${url} ${JSON.stringify(entryDiag)} console=${JSON.stringify(consoleEvents)}`);
    await page.locator('#board').waitFor({state:'visible',timeout:15000});
    await page.waitForTimeout(450);
    const launchMs=Date.now()-launchStart;
    const training=await page.evaluate(()=>{const root=document.querySelector('.training');const board=document.querySelector('#board');const rect=board?.getBoundingClientRect();const text=root?.innerText||'';return {live:Boolean(root&&board&&rect&&rect.width>240&&rect.height>240),depth10:/\b0\s*\/\s*10\b/.test(text),depth5:/\b0\s*\/\s*5\b/.test(text)||/\bDepth\s*5\b/i.test(text),hasExit:!!document.querySelector('#exit'),flow:document.documentElement.dataset.cotFlow||'',entry:document.documentElement.dataset.cotActivationEntry||''}});
    assert(training.live,`${url}: Continue Training did not reach a live mobile chessboard (${JSON.stringify(training)})`);
    assert(training.depth10&&!training.depth5,`${url}: first training session is not Depth 10 (${JSON.stringify(training)})`);
    assert(training.hasExit,`${url}: training controls missing Exit`);
    assert(training.flow==='training',`${url}: training flow marker not active (${training.flow})`);
    assert(training.entry==='guided-board',`${url}: async guided entry did not verify rendered board (${JSON.stringify(training)})`);
    console.log(`PASS depth10-production-mobile ${url} launch=${launchMs}ms`);
    await context.close();
  }
}finally{await browser.close()}
