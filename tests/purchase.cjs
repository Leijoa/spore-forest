let playwright;
try{playwright=require('playwright')}catch{playwright=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/Leijoa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await playwright.chromium.launch({channel:'msedge',headless:true});let pass=0;
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.waitForFunction(()=>loaded);
  const reset=async(sp=1000000)=>page.evaluate(sp=>{stopBuyHold();S=fresh();S.sp=sp;buyMode=1;tab='gen';derive();render();hud()},sp);
  // 讀當下 DOM，避免定時商店重繪使先取得的 element handle 脫離文件。
  const buttonBox=()=>page.evaluate(()=>{const r=document.querySelector('[data-g="0"]').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}});
  await reset();
  for(const limit of [1,10,100,'max']){
   const result=await page.evaluate(limit=>{
    S=fresh();S.sp=1000000;buyMode=limit;derive();render();
    let remaining=S.sp,count=0;const cap=limit==='max'?Infinity:limit;
    while(count<cap){const price=Math.ceil(15*1.15**count);if(price>remaining)break;remaining-=price;count++}
    const quote=purchaseQuote(0),before=S.total;document.querySelector('[data-g="0"]').click();
    return{count,remaining,quote,actual:S.g[0],sp:S.sp,total:S.total-before};
   },limit);
   assert.equal(result.actual,result.count);assert.equal(result.sp,result.remaining);assert.equal(result.quote.remaining,result.remaining);assert.equal(result.total,0);pass++;
  }
  await reset(50);
  await page.locator('[data-buy-mode="10"]').click();
  assert.equal(await page.locator('[data-g="0"]').innerText(),'買 2\n33');pass++;
  await page.locator('[data-g="0"]').tap();
  assert.equal(await page.evaluate(()=>S.g[0]),2);pass++;
  const empty=await page.evaluate(()=>{S.sp=0;const before=S.g[0];return{ok:buyGenerator(0),same:S.g[0]===before,sp:S.sp}});
  assert.deepEqual(empty,{ok:false,same:true,sp:0});pass++;
  const boundary=await page.evaluate(()=>{S=fresh();S.sp=15;derive();buyMode='max';const q=purchaseQuote(0);buyGenerator(0);return{q,g:S.g[0],sp:S.sp}});
  assert.equal(boundary.q.count,1);assert.equal(boundary.g,1);assert.equal(boundary.sp,0);pass++;
  const enormous=await page.evaluate(()=>{S=fresh();S.sp=Number.MAX_VALUE;buyMode='max';const q=purchaseQuote(0);return{count:q.count,finite:Number.isFinite(q.remaining)&&Number.isFinite(q.spent)}});
  assert.ok(enormous.count>1000&&enormous.count<10000);assert.equal(enormous.finite,true);pass++;
  // Mouse hold uses real pointer events; release must not append a synthetic extra purchase.
  await reset();
  let box=await buttonBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.waitForFunction(()=>S.g[0]>=3);const held=await page.evaluate(()=>S.g[0]);await page.mouse.up();
  await page.waitForTimeout(260);assert.equal(await page.evaluate(()=>S.g[0]),held);pass++;
  // A fresh tap immediately after hold is not swallowed by click suppression.
  await page.locator('[data-g="0"]').tap();assert.equal(await page.evaluate(()=>S.g[0]),held+1);pass++;
  for(const stop of ['move','cancel','tab','blur','reset']){
   await reset();box=await buttonBox();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForFunction(()=>S.g[0]>=2);
   if(stop==='move')await page.mouse.move(2,2);
   else await page.evaluate(stop=>{
    if(stop==='cancel')document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:buyHold.pointer}));
    if(stop==='tab')document.querySelector('[data-t="up"]').click();
    if(stop==='blur')window.dispatchEvent(new Event('blur'));
    if(stop==='reset')resetTransient();
   },stop);
   const stopped=await page.evaluate(()=>S.g[0]);await page.waitForTimeout(250);await page.mouse.up();
   assert.equal(await page.evaluate(()=>S.g[0]),stopped,stop);assert.equal(await page.evaluate(()=>buyHold),null);pass++;
  }
  // Touch long-press takes the same pointer route and pointercancel stops it.
  await reset();
  await page.locator('[data-g="0"]').evaluate(b=>b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:72,isPrimary:true,button:0})));
  await page.waitForFunction(()=>S.g[0]>=2);await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:72})));
  const touchCount=await page.evaluate(()=>S.g[0]);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>S.g[0]),touchCount);pass++;
  await reset();await page.locator('[data-buy-mode="100"]').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>buyMode),100);pass++;
  await page.locator('[data-buy-mode="10"]').click();
  await page.locator('[data-g="0"]').focus();await page.keyboard.press('Enter');assert.ok(await page.evaluate(()=>S.g[0]>1));pass++;
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.g),'0');pass++;
  await page.evaluate(()=>{S.g=[50,51,30,38,57,50,40];S.sp=14.87e9;S.seeds=873;S.bought=UPS.map(u=>u.id);derive();buyMode='max';render();hud()});
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.ok(await page.locator('[data-buy-mode="max"]').evaluate(b=>b.getBoundingClientRect().height>=44));pass++;
  }
  assert.deepEqual(errors,[]);pass++;
  // Mutating the price to a flat bulk price must break the repeated-price equivalence.
  const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const needle='Math.pow(1.15,S.g[i]+count)';assert.ok(source.includes(needle));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'spore-purchase-'));
  try{
   const mutant=path.join(dir,'mutant.html');fs.writeFileSync(mutant,source.replace(needle,'Math.pow(1.15,S.g[i])'));
   const mp=await context.newPage();await mp.goto(pathToFileURL(mutant).href);await mp.waitForFunction(()=>loaded);
   const mutated=await mp.evaluate(()=>{S=fresh();S.sp=1000;derive();return purchaseQuote(0,10).spent});
   let expected=0;for(let i=0;i<10;i++)expected+=Math.ceil(15*1.15**i);
   assert.notEqual(mutated,expected);pass++;await mp.close();
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
  console.log(`PASS ${pass}; FAIL 0; flat-price mutation detected; hold release/cancel verified`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
