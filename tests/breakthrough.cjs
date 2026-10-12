// Regression coverage for quantity based early generator breakthroughs.
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Leijoa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const at = [50, 100, 125, 150, 175, 200,225,250,275,300,325,350,375,400];
const mult = [[10,8,5],[4000,500,80],[32000,4000,640],[256000,32000,5120],[2048000,256000,40960],[16384000,2048000,327680],...Array.from({length:8},(_,k)=>[16384000,2048000,327680].map(n=>n*8**(k+1)))];

(async () => {
  const browser = await playwright.chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let pass = 0;
  try {
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => loaded === true);
    const reset = async () => page.evaluate(() => {
      stopBuyHold(); S = fresh(); S.sp = 0; buyMode = 1; tab = 'gen'; derive(); render(); hud();
    });

    // Every boundary selects the highest reached total multiplier; no multiplication of tiers.
    const boundaries = await page.evaluate(({ at, mult }) => {
      const out = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < at.length; j++) {
        const n = at[j];
        out.push({ i, n, before: breakthroughMul(i, n - 1), after: breakthroughMul(i, n), stage: breakthroughStage(i, n)?.n });
      }
      return out;
    }, { at, mult });
    for (let i = 0; i < 3; i++) for (let j = 0; j < at.length; j++) {
      const x = boundaries[i * at.length + j];
      assert.equal(x.before, j ? mult[j - 1][i] : 1);
      assert.equal(x.after, mult[j][i]);
      assert.ok(x.stage);
      pass++;
    }
    assert.deepEqual(await page.evaluate(() => [3,4,5,6].map(i => [breakthroughMul(i, 200), breakthroughStage(i, 200)])), [[1,null],[1,null],[1,null],[1,null]]); pass++;

    // The authoritative unit, total production, derived bonuses, and untouched late generators agree.
    const formula = await page.evaluate(() => {
      S = fresh(873); S.g = [125, 100, 50, 38, 57, 50, 40,0,0,0];
      S.bought = UPS.map(u => u.id); S.forest.jobs = [{friend:'moss',role:'idle'}, {friend:'peach',role:'tap'}]; derive();
      const units = GENS.map((_, i) => generatorUnitPps(i));
      return { units, base: basePps(), tap: tapVal(), expectedUnits: GENS.map((g,i)=>g.p*D.gm[i]*breakthroughMul(i)*D.all*D.seedMul*workMul('idle')) };
    });
    formula.units.forEach((n,i)=>assert.ok(Math.abs(n-formula.expectedUnits[i])<Math.max(1e-9,n*1e-12))); 
    assert.ok(Math.abs(formula.base-formula.units.reduce((s,n,i)=>s+n*[125,100,50,38,57,50,40,0,0,0][i],0)) < formula.base*1e-12);
    assert.ok(formula.tap>0); pass++;

    // Tap inherits the new production through tapPct, while combo stays fixed at ×1.
    const tapPaths=await page.evaluate(()=>{
      const setup=()=>{endEvent(true);S=fresh(2);S.g=[100,50,0,0,0,0,0,0,0,0];S.bought=['t1','t2'];S.forest.jobs=[{friend:'moss',role:'tap'},{friend:'peach',role:'idle'}];derive();combo=0;tapBuff=1;buffMul=1;buffEnd=0};
      setup();const plainBase=basePps(),plain=tapVal(),plainExpected=((2*1.2*1.15)+plainBase*.01)*1;
      setup();S.forest.preparation='picnic';startEvent(EVENTS[0]);buffMul=7;tapBuff=15;
      const event=evMul(),boostedBase=basePps(),boosted=tapVal(),boostedExpected=((2*1.2*1.15)+boostedBase*.01*7*1.65)*15;
      endEvent(true);
      return {plain,plainExpected,boosted,boostedExpected,event,combo:comboMul()};
    });
    assert.equal(tapPaths.combo,1);assert.equal(tapPaths.event,1.65);
    assert.ok(Math.abs(tapPaths.plain-tapPaths.plainExpected)<1e-9);
    assert.ok(Math.abs(tapPaths.boosted-tapPaths.boostedExpected)<tapPaths.boostedExpected*1e-12);pass++;

    // Live row hint, unit rate and batch offer derive from the same current count and quote.
    await page.evaluate(() => { S=fresh();S.g=[49,99,45,38,57,50,40,0,0,0];S.sp=1e30;buyMode=10;derive();render();hud() });
    for (let i=0;i<3;i++) {
      const row=page.locator(`#gi${i}`);
      assert.equal(await row.locator('.unit-rate').count(),1);
      assert.equal(await row.locator('.breakthrough-hint').count(),1);
      assert.equal(await row.locator('.purchase-breakthrough').count(),1);
      assert.match(await row.locator('.breakthrough-hint').innerText(),/下次/);
      const offer=await row.locator('.purchase-breakthrough').innerText();
      assert.match(offer,/本批達/,JSON.stringify(await page.evaluate(i=>({g:S.g[i],mode:buyMode,q:purchaseQuote(i),computed:purchaseBreakthrough(i,purchaseQuote(i))}),i)));
      const rate=await page.evaluate(i=>({shown:document.querySelector(`#gi${i} .unit-rate`).textContent,expected:`每個 ${fmt(generatorUnitPps(i))}/秒`}),i);
      assert.equal(rate.shown,rate.expected);
      const next=await page.evaluate(i=>{const stage=BREAKTHROUGHS.find(x=>x.at>S.g[i]);return{shown:document.querySelector(`#gi${i} .breakthrough-hint`).textContent,expected:fmt(generatorUnitPps(i,stage.at)*stage.at)}} ,i);
      assert.ok(next.shown.includes(next.expected));
      const after=await page.evaluate(i=>{const n=purchaseQuote(i).count+S.g[i];return{shown:document.querySelector(`#gi${i} .purchase-breakthrough`).textContent,expected:fmt(generatorUnitPps(i,n)*n)}} ,i);
      assert.ok(after.shown.includes(after.expected));
      pass++;
    }
    for(let i=3;i<7;i++){
      assert.equal(await page.locator(`#gi${i} .breakthrough-hint,#gi${i} .purchase-breakthrough`).count(),0);pass++;
    }

    // Distinct bulk purchases can jump across several tiers; both visible estimates use the reached count.
    const multiStage=await page.evaluate(()=>{
      const check=(i,start,count)=>{
        S=fresh();if(i===1)S.g[0]=1;S.g[i]=start;buyMode='max';
        let budget=0;for(let k=0;k<count;k++)budget+=Math.ceil(GENS[i].base*1.15**(start+k));
        S.sp=budget;derive();render();refreshBtns();
        const q=purchaseQuote(i),end=start+q.count,offer=document.querySelector(`#gi${i} .purchase-breakthrough`).textContent;
        return{q:q.count,end,offer,expected:fmt(generatorUnitPps(i,end)*end),hint:breakthroughHint(i)};
      };
      return[check(0,49,151),check(1,49,126)];
    });
    assert.deepEqual(multiStage.map(x=>x.end),[200,175]);
    assert.ok(multiStage.every(x=>x.offer.includes(x.expected)));
    assert.match(multiStage[0].offer,/森之奇蹟/);assert.match(multiStage[1].offer,/綻放/);pass++;

    // The supplied late-game save reaches 100 on all early groups within its 14.87B balance.
    const lateSave=await page.evaluate(()=>{
      S=fresh(873);S.g=[50,51,30,38,57,50,40,0,0,0];S.sp=14.87e9;S.bought=UPS.map(u=>u.id);derive();render();
      const start=S.sp,targets=[100,100,100];
      for(let i=0;i<3;i++){buyMode=targets[i]-S.g[i];if(!buyGenerator(i))throw Error('unaffordable target '+i)}
      const at100=[0,1,2].map(i=>generatorUnitPps(i)*S.g[i]),spent=start-S.sp;
      S.g[0]=125;derive();
      return {g:S.g.slice(0,3),spent,at100,moss125:generatorUnitPps(0)*S.g[0]};
    });
    assert.deepEqual(lateSave.g,[125,100,100]);
    assert.ok(lateSave.spent<14.87e9);
    assert.ok(lateSave.at100[0]>4e7&&lateSave.at100[2]>4e7&&lateSave.at100[1]>3.9e7,JSON.stringify(lateSave));
    assert.ok(Math.abs(lateSave.moss125-4.2384e8)<4.2384e8*1e-6);pass++;

    // Buying across multiple thresholds charges the ordinary per-unit prices and updates output immediately.
    const batch = await page.evaluate(() => {
      S=fresh();S.g=[49,98,30,0,0,0,0,0,0,0];S.sp=1e30;buyMode='max';derive();render();
      const before=S.sp, q=purchaseQuote(0), expected=Array.from({length:q.count},(_,k)=>Math.ceil(15*1.15**(49+k))).reduce((a,b)=>a+b,0);
      const prior=basePps();buyGenerator(0);
      return {count:q.count, expected, spent:before-S.sp, g:S.g.slice(0,2), prior, after:basePps(), hint:document.querySelector('#gi0 .breakthrough-hint').textContent};
    });
    assert.ok(batch.g[0]>=200); assert.equal(batch.g[1],98); assert.ok(Math.abs(batch.spent-batch.expected)<batch.expected*1e-12);
    assert.ok(batch.after>batch.prior*8); assert.match(batch.hint,/永恆/); pass++;

    // Long press crosses the 50 boundary without replacing the row; displayed rate follows count.
    await page.evaluate(() => { S=fresh();S.g[0]=49;S.sp=1e30;buyMode=1;derive();render(); });
    const box=await page.evaluate(()=>{
      const b=document.querySelector('[data-g="0"]');b.scrollIntoView({block:'center'});
      const r=b.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};
    });
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.waitForFunction(()=>S.g[0]>=50);await page.waitForFunction(()=>document.querySelector('#gi0 .unit-rate').textContent===`每個 ${fmt(generatorUnitPps(0))}/秒`);
    const held=await page.evaluate(()=>S.g[0]);await page.mouse.up();await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>S.g[0]),held);assert.match(await page.locator('#gi0 .breakthrough-hint').innerText(),/扎根/);pass++;

    // A pre-feature v3 save at the threshold gains the formula without bonus currency.
    const oldSave=await page.evaluate(() => {
      const old={...fresh(873),g:[100,100,50,38,57,50,40,0,0,0],sp:123456,total:9e9,bought:UPS.map(u=>u.id),last:Date.now(),forest:{...freshForest()}};
      const money=old.sp;applySave(JSON.stringify(old),false);
      return {version:S.version,sp:S.sp,money,units:[0,1,2].map(i=>generatorUnitPps(i)),g:S.g.slice(0,3)};
    });
    assert.equal(oldSave.sp,oldSave.money);assert.deepEqual(oldSave.g,[100,100,50]);
    assert.ok(oldSave.units[0]>0&&oldSave.units[1]>0&&oldSave.units[2]>0);pass++;

    // Export and import preserve the count-based state without compounding multipliers.
    const roundtrip=await page.evaluate(async()=>{
      S.g=[125,100,50,38,57,50,40,0,0,0];derive();const target=JSON.stringify([0,1,2].map(i=>generatorUnitPps(i)));
      let code='';const oldAsk=ask;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async v=>{code=v}}});
      await exportSave();ask=async()=>code;
      try{await importSave()}finally{ask=oldAsk}
      return {same:JSON.stringify([0,1,2].map(i=>generatorUnitPps(i)))===target,g:S.g.slice(0,3)};
    });
    assert.equal(roundtrip.same,true);assert.deepEqual(roundtrip.g,[125,100,50]);pass++;

    // Offline uses the same upgraded base production, capped at eight hours and multiplied by 50%.
    const offline=await page.evaluate(()=>{
      const old={...fresh(873),g:[100,100,50,0,0,0,0,0,0,0],last:Date.now()-3600_000,sp:0,total:0,bought:[],forest:freshForest()};
      const expected=(()=>{S={...fresh(873),g:old.g.slice(),bought:[],forest:freshForest()};derive();return basePps()*3600*.5})();
      applySave(JSON.stringify(old),true);return {delta:S.sp,expected};
    });
    assert.ok(Math.abs(offline.delta-offline.expected)<offline.expected*1e-10);pass++;

    // Real prestige removes this round's quantities while preserving residents and their permanent collection.
    const prestige=await page.evaluate(async()=>{
      S=fresh(2);S.collection=['moss','peach'];S.forest.jobs=[{friend:'moss',role:'idle'},{friend:'peach',role:'tap'}];S.g=[125,100,50,0,0,0,0,0,0,0];S.total=1e9;derive();
      const oldAsk=ask;ask=async()=>true;try{await doPrestige()}finally{ask=oldAsk}
      return {g:S.g.slice(),seeds:S.seeds,collection:S.collection,jobs:S.forest.jobs,mul:breakthroughMul(0)};
    });
    assert.ok(prestige.seeds>2);assert.deepEqual(prestige.g,[0,0,0,0,0,0,0,0,0,0]);assert.equal(prestige.mul,1);
    assert.deepEqual(prestige.collection,['moss','peach']);assert.equal(prestige.jobs[0].friend,'moss');pass++;

    for(const width of [320,390,1280]){
      await page.setViewportSize({width,height:844});
      await page.evaluate(()=>{S.g=[50,51,30,38,57,50,40,0,0,0];S.sp=14.87e9;S.seeds=873;S.bought=UPS.map(u=>u.id);derive();render()});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.ok(await page.locator('#gi0 .breakthrough-hint').evaluate(e=>e.getBoundingClientRect().width>0));pass++;
    }
    assert.deepEqual(errors,[]);pass++;

    // The old ×1 formula must fail the same authoritative assertion used above.
    const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const formulaNeedle="function breakthroughMul(i,count=S.g[i]){return breakthroughStage(i,count)?.m[i]||1}";
    assert.ok(source.includes(formulaNeedle),'authoritative formula mutation anchor changed');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'spore-breakthrough-'));
    try{
      const oldFormula=path.join(dir,'old-formula.html');
      fs.writeFileSync(oldFormula,source.replace(formulaNeedle,"function breakthroughMul(i,count=S.g[i]){return 1}"));
      const mp=await context.newPage();await mp.goto(pathToFileURL(oldFormula).href);await mp.waitForFunction(()=>loaded===true);
      const failed=await mp.evaluate(()=>{try{if(breakthroughMul(0,50)!==10)throw Error('breakthrough formula reverted');return false}catch{return true}});
      assert.equal(failed,true);await mp.close();pass++;

      // Removing the multiplier from the visible unit-rate preview must disagree with the authority.
      const previewNeedle="update('.unit-rate',`每個 ${fmt(generatorUnitPps(i))}/秒`);";
      assert.ok(source.includes(previewNeedle),'unit preview mutation anchor changed');
      const noPreview=path.join(dir,'no-preview-multiplier.html');
      fs.writeFileSync(noPreview,source.replace(previewNeedle,"update('.unit-rate',`每個 ${fmt(GENS[i].p*D.gm[i]*D.all*D.seedMul*workMul('idle'))}/秒`);"));
      const vp=await context.newPage();await vp.goto(pathToFileURL(noPreview).href);await vp.waitForFunction(()=>loaded===true);
      const mismatch=await vp.evaluate(()=>{S=fresh();S.g[0]=50;derive();render();refreshBtns();return document.querySelector('#gi0 .unit-rate').textContent!==`每個 ${fmt(generatorUnitPps(0))}/秒`});
      assert.equal(mismatch,true);await vp.close();pass++;
    }finally{fs.rmSync(dir,{recursive:true,force:true})}
    console.log(`PASS ${pass}; FAIL 0; ×1 formula and missing preview multiplier mutations detected`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
