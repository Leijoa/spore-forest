let playwright;
try { playwright=require('playwright'); } catch { playwright=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Leijoa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await playwright.chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let checks=0;
 try{
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForFunction(()=>loaded);
  await page.evaluate(()=>{S=fresh();derive();hud();});
  assert.match(await page.locator('#wishCard').textContent(),/等待新朋友/);checks++;
  await page.evaluate(()=>{S.g[0]=10;S.g[1]=10;S.sp=10000;S.total=10000;derive();hud();renderWish(true)});
  await page.locator('[data-wish-route="earn"]').evaluate(e=>e.click());
  assert.equal(await page.evaluate(()=>S.wishes[0].progress),0);checks++;
  const progress=await page.evaluate(()=>{earn(100);return S.wishes[0].progress});assert.equal(progress,100);checks++;
  await page.locator('[data-wish-cancel]').evaluate(e=>e.click());await page.locator('#mOk').evaluate(e=>e.click());
  await page.waitForFunction(()=>S.wishes[0]===null);checks++;
  await page.locator('[data-wish-route="buy"]').evaluate(e=>e.click());
  await page.evaluate(()=>{advanceWish('buy',1,1);if(S.wishes[0].progress!==0)throw Error('wrong generator counted');});checks++;
  for(let i=0;i<3;i++)await page.locator('#panel [data-g="0"]').evaluate(e=>e.click());
  assert.equal(await page.evaluate(()=>S.wishes[0].status),'ready');checks++;
  const readyWrites=await page.evaluate(()=>{const original=save;let writes=0;save=()=>writes++;try{advanceWish('buy',1,0);return writes}finally{save=original}});
  assert.equal(readyWrites,0);checks++;
  const claimDelta=await page.evaluate(async()=>{
   const before=S.total,b=document.querySelector('[data-wish-reward="spores"]');b.click();b.click();document.querySelector('#mOk').click();await Promise.resolve();return S.total-before;
  });assert.equal(claimDelta,60);checks++;
  assert.equal(await page.evaluate(()=>S.wishes[0].reward),'spores');checks++;
  await page.locator('[data-t="album"]').evaluate(e=>e.click());assert.match(await page.locator('.memory').textContent(),/第一次一起迎接鄰居/);checks++;
  await page.locator('[data-wish-route="earn"]').evaluate(e=>e.click());
  await page.evaluate(()=>{earn(1000)});
  await page.locator('[data-wish-reward="sticker"]').evaluate(e=>e.click());await page.locator('#mOk').evaluate(e=>e.click());
  await page.waitForFunction(()=>S.wishes[1].status==='claimed');checks++;
  await page.locator('[data-friend="peach"]').evaluate(e=>e.click());assert.equal(await page.locator('.memory svg').count(),1);checks++;
  await page.locator('[data-wish-route="earn"]').evaluate(e=>e.click());await page.evaluate(()=>earn(200));
  await page.evaluate(()=>{S.total=1e6;doPrestige()});await page.locator('#mOk').evaluate(e=>e.click());
  await page.waitForFunction(()=>S.seeds>0);assert.equal(await page.evaluate(()=>S.wishes[2]),null);checks++;
  assert.deepEqual(await page.evaluate(()=>S.wishes.slice(0,2).map(w=>w.reward)),['spores','sticker']);checks++;
  await page.locator('[data-wish-route="earn"]').evaluate(e=>e.click());
  await page.evaluate(()=>{
   S.g[0]=10;S.last=Date.now()-3600*1000;
   const code=JSON.stringify(S);applySave(code,true);
  });assert.equal(await page.evaluate(()=>S.wishes[2].status),'ready');checks++;
  await page.evaluate(()=>{S.total=1e6;doPrestige()});await page.locator('#mOk').evaluate(e=>e.click());
  await page.waitForFunction(()=>S.seeds>1);assert.equal(await page.evaluate(()=>S.wishes[2].status),'ready');checks++;
  await page.evaluate(()=>save());await page.reload();await page.waitForFunction(()=>loaded);
  assert.equal(await page.evaluate(()=>S.wishes[2].status),'ready');checks++;
  const roundtrip=await page.evaluate(()=>{const before=JSON.stringify(S.wishes);const code=btoa(unescape(encodeURIComponent(JSON.stringify(S))));applySave(decodeURIComponent(escape(atob(code))),false);return JSON.stringify(S.wishes)===before});assert.ok(roundtrip);checks++;
  const invalid=await page.evaluate(()=>{
   const before=JSON.stringify(S),bad=JSON.parse(before);bad.wishes[2].reward='sticker';let rejected=false;
   try{applySave(JSON.stringify(bad),false)}catch{rejected=true}return rejected&&JSON.stringify(S)===before;
  });assert.ok(invalid);checks++;
  for(const change of [{progress:-1},{path:'unknown'},{status:'claimed',reward:null}]){
   const protectedImport=await page.evaluate(change=>{const before=JSON.stringify(S),bad=JSON.parse(before);Object.assign(bad.wishes[2],change);let rejected=false;try{applySave(JSON.stringify(bad),false)}catch{rejected=true}return rejected&&JSON.stringify(S)===before},change);
   assert.ok(protectedImport);checks++;
  }
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:844});
   await page.locator('#wishDetails').evaluate(e=>e.open=true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks++;
  }
  await page.locator('[data-wish-reward="sticker"]').evaluate(e=>e.click());await page.locator('#mOk').evaluate(e=>e.click());
  await page.waitForFunction(()=>currentWish()===-1);checks++;
  assert.match(await page.locator('#wishCard').textContent(),/三個願望都完成/);checks++;
  await page.locator('#btnReset').evaluate(e=>e.click());await page.locator('#mOk').evaluate(e=>e.click());
  await page.waitForFunction(()=>S.wishes.every(w=>w===null));checks++;
  const migrated=await page.evaluate(()=>{
   const old={...fresh(),version:1,collection:['moss'],sp:123,seeds:7};delete old.wishes;
   applySave(JSON.stringify(old),false);return {version:S.version,sp:S.sp,seeds:S.seeds,wishes:S.wishes};
  });assert.deepEqual(migrated,{version:2,sp:123,seeds:7,wishes:[null,null,null]});checks++;
  assert.deepEqual(errors,[]);checks++;
  // Restore the same defect class: remove the claimed/ready guard, then
  // replay an earn event and prove a claimed reward record is corrupted.
  const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const mutant=source.replace("!w||w.status!=='active'||w.path!==path", "!w||w.path!==path");
  assert.notEqual(mutant,source);
  const mutantPage=await context.newPage();await mutantPage.setContent(mutant);
  const protectedRecord=await mutantPage.evaluate(()=>{
   S.wishes[0]={path:'earn',progress:300,status:'claimed',reward:'spores'};
   earn(1);return S.wishes[0].status;
  });
  // A claimed first record is skipped; target a completed pending record.
  const pending=await mutantPage.evaluate(()=>{S.wishes[1]={path:'earn',progress:1000,status:'ready',reward:null};let writes=0;save=()=>{writes++};earn(1);return writes});
  assert.equal(protectedRecord,'claimed');assert.ok(pending>0);checks++;
  await mutantPage.close();
  console.log(`PASS ${checks}; FAIL 0; ready-event guard mutation detected`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
