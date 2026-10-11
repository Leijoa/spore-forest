// Historical filename retained; this suite now covers automatic achievements.
let playwright;
try {playwright=require('playwright')} catch {playwright=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Leijoa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await playwright.chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let checks=0;
 try{
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>loaded);
  assert.equal(await page.locator('#wishCard,[data-wish-route],[data-wish-reward]').count(),0);checks++;
  await page.evaluate(()=>{S=fresh();S.g[0]=3;S.total=300;derive();hud()});
  assert.deepEqual(await page.evaluate(()=>S.achievements),['welcome']);checks++;
  assert.equal(await page.evaluate(()=>document.querySelector('#modal').classList.contains('open')),false);checks++;
  assert.ok(await page.locator('#dotalbum').evaluate(e=>e.classList.contains('show')));checks++;
  const once=await page.evaluate(()=>{const before=S.sp,original=save;let writes=0;save=()=>writes++;try{checkAchievements();checkAchievements();return {writes,delta:S.sp-before,unique:new Set(S.achievements).size===S.achievements.length}}finally{save=original}});
  assert.deepEqual(once,{writes:0,delta:0,unique:true});checks++;
  await page.locator('[data-t="album"]').evaluate(e=>e.click());
  assert.equal(await page.locator('.achievement-row').count(),11);checks++;
  assert.ok(!await page.locator('#dotalbum').evaluate(e=>e.classList.contains('show')));checks++;
  assert.equal(await page.locator('.memory svg').count(),1);checks++;
  await page.evaluate(()=>{S.g[0]=10;S.g[1]=10;S.total=3000;hud()});
  assert.ok(await page.evaluate(()=>['welcome','garden','story','home'].every(id=>S.achievements.includes(id))));checks++;
  const response=await page.evaluate(()=>{document.querySelector('#friendPortrait').click();S.stats.gold=20;hud();return document.querySelector('#friendResponse').textContent});
  assert.match(response,/留了一個位置/);checks++;
  assert.equal(await page.locator('#ach-gold').textContent(),'✓ 貼紙已收藏');checks++;
  await page.evaluate(()=>{combo=0;lastTap=0;for(let i=0;i<51;i++)document.querySelector('.stage').dispatchEvent(new PointerEvent('pointerdown',{clientX:100,clientY:200,bubbles:true}));hud()});
  assert.ok(await page.evaluate(()=>S.achievements.includes('combo')));checks++;
  await page.evaluate(()=>{S.g=S.g.map(()=>10);hud()});assert.ok(await page.evaluate(()=>S.achievements.includes('balance')));checks++;
  await page.evaluate(()=>{S.g[0]=100;hud()});assert.ok(await page.evaluate(()=>S.achievements.includes('moss100')));checks++;
  await page.evaluate(()=>{S.g=[20,40,15,15,8,2,10];hud()});assert.ok(await page.evaluate(()=>S.achievements.includes('castle')));checks++;
  const reducedEvent=await page.evaluate(()=>{endEvent(true);gTierReady=true;nextEv=performance.now()-1;tickEvents();return !!ev});assert.ok(reducedEvent);checks++;
  await page.evaluate(()=>{S.stats.events=[];for(const def of EVENTS){startEvent(def);endEvent(true)}hud()});assert.ok(await page.evaluate(()=>S.achievements.includes('festivals')));checks++;
  for(let i=0;i<3;i++){
   await page.evaluate(()=>{S.total=1e6;doPrestige()});await page.locator('#mOk').evaluate(e=>e.click());await page.waitForFunction(n=>S.stats.prestiges===n,i+1);
  }
  assert.ok(await page.evaluate(()=>S.achievements.includes('rebirth')));checks++;
  assert.ok(await page.evaluate(()=>S.achievements.includes('balance')&&S.g.every(n=>n===0)));checks++;
  await page.evaluate(()=>save());await page.reload();await page.waitForFunction(()=>loaded);
  assert.equal(await page.evaluate(()=>S.achievements.length),11);checks++;
  const roundtrip=await page.evaluate(()=>{const before=JSON.stringify(S.achievements),stats=JSON.stringify(S.stats);applySave(JSON.stringify(S),false);return JSON.stringify(S.achievements)===before&&JSON.stringify(S.stats)===stats});assert.ok(roundtrip);checks++;
  for(const bad of [{achievements:['unknown']},{stats:{combo:-1,gold:0,prestiges:0,events:[]}},{version:4}]){
   assert.ok(await page.evaluate(bad=>{const before=JSON.stringify(S);try{applySave(JSON.stringify({...S,...bad}),false);return false}catch{return JSON.stringify(S)===before}},bad));checks++;
  }
  const migration=await page.evaluate(()=>{
   const old={...fresh(),version:2,collection:['moss','peach','elder'],sp:777,total:0,wishes:[{path:'earn',progress:300,status:'claimed',reward:'spores'},{path:'buy',progress:2,status:'ready',reward:null},null]};delete old.achievements;delete old.stats;
   applySave(JSON.stringify(old),false);return {sp:S.sp,version:S.version,achievements:S.achievements,legacy:'wishes' in S};
  });assert.deepEqual(migration,{sp:777,version:3,achievements:['welcome','garden'],legacy:false});checks++;
  await page.evaluate(()=>{tab='album';render()});
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks++}
  await page.locator('#btnReset').evaluate(e=>e.click());await page.locator('#mOk').evaluate(e=>e.click());await page.waitForFunction(()=>S.collection.length===0);
  assert.deepEqual(await page.evaluate(()=>S.achievements),[]);assert.equal(await page.evaluate(()=>S.stats.gold),0);checks++;
  assert.deepEqual(errors,[]);checks++;
  // Repeat the authoritative check after restoring a missing deduplication guard.
  const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const mutant=source.replace("!S.achievements.includes(a.id)&&a.value()>=a.target", "a.value()>=a.target");assert.notEqual(source,mutant);
  const mutantPage=await context.newPage();await mutantPage.setContent(mutant);
  const duplicates=await mutantPage.evaluate(()=>{S=fresh();S.collection=['moss'];S.total=300;checkAchievements();checkAchievements();return S.achievements.length-new Set(S.achievements).size});assert.ok(duplicates>0);checks++;
  await mutantPage.close();
  console.log(`PASS ${checks}; FAIL 0; deduplication guard mutation detected`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
