// Late tiers, new generators, legacy-save padding and real rendering paths.
let playwright;
try { playwright=require('playwright'); } catch { playwright=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Leijoa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const levels=[[125,100,20,20,10,5,40,10,0,0],[200,150,20,20,10,5,40,25,10,0],[300,200,20,20,10,5,40,25,25,10]];
(async()=>{
 const browser=await playwright.chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));let pass=0;
 try{
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>loaded);
  assert.equal(await page.evaluate(()=>GENS.length),10);pass++;
  for(let k=0;k<levels.length;k++){
   const result=await page.evaluate(g=>{
    endEvent(true);S=fresh(873);S.g=g;S.sp=1e25;S.total=1e25;derive();render();hud();
    const all=tierOf(S.g),broken=S.g.slice();broken[0]=100;
    return {all,broken:tierOf(broken),chip:$('tierChip').textContent,finite:Number.isFinite(basePps()),caps:ent.map(a=>a.length),event:nextEvId};
   },levels[k]);
   assert.equal(result.all,k+5);assert.equal(result.broken,4);assert.ok(result.finite);assert.ok(result.caps.slice(7).every(n=>n<=3));
   assert.match(result.chip,new RegExp(['花園王國','雲端菇城','星海森林'][k]));pass++;
  }
  const locked=await page.evaluate(()=>{S=fresh();S.sp=1e30;S.total=1e30;derive();render();return{vis:visibleGens().slice(7),ok:buyGenerator(7),counts:S.g.slice(7)}});
  assert.deepEqual(locked,{vis:[false,false,false],ok:false,counts:[0,0,0]});pass++;
  for(let i=7;i<10;i++){
   const purchase=await page.evaluate(({i,g})=>{
    endEvent(true);S=fresh(873);S.g=g;S.g[i]=0;S.sp=1e18;derive();tab='gen';buyMode=10;render();hud();
    const q=purchaseQuote(i),money=S.sp;buyGenerator(i);
    const before=generatorUnitPps(i),u=UPS.find(u=>u.id==='g'+i),available=availUps().includes(u);
    S.bought.push(u.id);derive();refreshBtns();
    return{quantity:S.g[i],spent:money-S.sp,quote:q.spent,available,ratio:generatorUnitPps(i)/before,shown:document.querySelector('#gi'+i+' .unit-rate').textContent,expected:`每個 ${fmt(generatorUnitPps(i))}/秒`};
   },{i,g:i===7?[100,100,20,20,10,5,40,0,0,0]:levels[i-8]});
   assert.equal(purchase.quantity,10);assert.ok(Math.abs(purchase.spent-purchase.quote)<purchase.quote*1e-9);assert.ok(purchase.available);assert.equal(purchase.ratio,2);assert.equal(purchase.shown,purchase.expected);pass++;
  }
  // New events do not replace the five original achievement requirements.
  const events=await page.evaluate(g=>{
   S=fresh();S.g=g;derive();hud();S.stats.events=[];
   const acts=EVENTS.slice(5).map(def=>{startEvent(def);const result=[ev.id,eventArt(),ev.mul,crowd().every(w=>w.act)];endEvent(true);return result});
   const a=ACHIEVEMENTS.find(a=>a.id==='festivals');return {acts,progress:a.value(),select:EVENTS.filter(e=>e.tier<=gTier).length};
  },levels[2]);
  assert.deepEqual(events.acts.map(a=>a.slice(0,3)),[['blossom','dance',1.5],['cloud','camp',1.5],['starlight','fest',1.5]]);assert.ok(events.acts.every(a=>a[3]));assert.equal(events.progress,0);assert.equal(events.select,8);pass++;
  const balance=await page.evaluate(()=>{S=fresh();S.g=[10,10,10,10,0,0,0,10,10,10];return ACHIEVEMENTS.find(a=>a.id==='balance').value()});assert.equal(balance,4);pass++;
  // A unique legacy sentinel crosses a real reload. Optional fields and resources survive.
  const sentinel=Date.now()%1000000+123;
  await page.evaluate(sentinel=>{
   const old={...fresh(873),g:[50,51,30,38,57,50,40],sp:sentinel,total:9e9,collection:['moss'],achievements:['welcome'],last:Date.now()+60000};
   old.forest.jobs=[{friend:'moss',role:'idle'},null];loaded=false;localStorage.setItem(KEY,JSON.stringify(old));
  },sentinel);
  await page.reload();await page.waitForFunction(()=>loaded);
  const migrated=await page.evaluate(()=>({g:S.g,seeds:S.seeds,collection:S.collection,job:S.forest.jobs[0],finite:Number.isFinite(pps()),sp:S.sp}));
  assert.deepEqual(migrated.g,[50,51,30,38,57,50,40,0,0,0]);assert.equal(migrated.seeds,873);assert.ok(migrated.collection.includes('moss'));assert.equal(migrated.job.friend,'moss');assert.ok(migrated.finite);assert.ok(migrated.sp>=sentinel);pass++;
  // New units, upgrades and event history also survive reload and export/import.
  await page.evaluate(g=>{S.g=g;S.bought=['g7','g8','g9'];S.stats.events=['starlight'];derive();save()},levels[2]);
  await page.reload();await page.waitForFunction(()=>loaded);
  const roundtrip=await page.evaluate(()=>{const before=JSON.stringify([S.g,S.bought,S.stats.events,S.forest]);applySave(JSON.stringify(S),false);return before===JSON.stringify([S.g,S.bought,S.stats.events,S.forest])});assert.ok(roundtrip);pass++;
  for(const bad of ['negative','extra']){
   const rejected=await page.evaluate(bad=>{const before=JSON.stringify(S),raw=JSON.parse(before);if(bad==='negative')raw.g[9]=-1;else raw.g.push(1);try{applySave(JSON.stringify(raw),false);return false}catch{return before===JSON.stringify(S)}},bad);assert.ok(rejected);pass++;
  }
  await page.evaluate(()=>{S.total=1e30;doPrestige()});await page.locator('#mOk').evaluate(b=>b.click());await page.waitForFunction(()=>S.g.every(n=>n===0));
  assert.equal(await page.evaluate(()=>S.g.length),10);assert.equal(await page.evaluate(()=>tierOf(S.g)),0);assert.equal(await page.evaluate(()=>S.forest.jobs[0].friend),'moss');pass++;
  // Canvas scene / new events must execute in both motion modes and every target viewport.
  for(const motion of ['reduce','no-preference']){
   await page.emulateMedia({reducedMotion:motion});await page.reload();await page.waitForFunction(()=>loaded);
   for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:900});
    for(const g of levels){
     await page.evaluate(g=>{endEvent(true);S=fresh(873);S.g=g;S.sp=1e25;derive();tab='gen';render();hud();startEvent(EVENTS[gTier]);},g);
     await page.waitForTimeout(500);
     const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bad:[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>[e.tagName,e.id,e.className])}));assert.ok(overflow.scroll<=overflow.width,JSON.stringify(overflow));pass++;
    }
   }
  }
  await page.setViewportSize({width:390,height:1000});await page.evaluate(()=>endEvent(true));await page.waitForTimeout(2300);
  fs.mkdirSync(path.join(root,'tmp'),{recursive:true});await page.screenshot({path:path.join(root,'tmp/expansion-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);pass++;
  // Restoring the old 200 cap or removing legacy padding must fail the new assertions.
  const source=fs.readFileSync(path.join(root,'index.html'),'utf8'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'spore-expansion-'));
  try{
   const needle="while(next.g.length<GENS.length)next.g.push(0);";assert.ok(source.includes(needle));
   const file=path.join(dir,'no-padding.html');fs.writeFileSync(file,source.replace(needle,''));
   const mp=await context.newPage();await mp.goto(pathToFileURL(file).href);await mp.waitForFunction(()=>loaded);
   const migrated=await mp.evaluate(()=>{applySave(JSON.stringify({...fresh(),g:[1,2,3,4,5,6,7]}),false);return S.g.length});
   assert.notEqual(migrated,10);pass++;
   const capped=await page.evaluate(()=>{const original=BREAKTHROUGHS.slice();BREAKTHROUGHS.splice(6);try{return breakthroughMul(0,225)===131072000}finally{BREAKTHROUGHS.splice(0,BREAKTHROUGHS.length,...original)}});assert.equal(capped,false);pass++;
   await mp.close();
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
  console.log(`PASS ${pass}; FAIL 0; missing legacy padding and old 200 cap mutations detected`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
