let playwright;
try { playwright = require('playwright'); } catch { playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Leijoa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const { chromium } = playwright;
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = pathToFileURL(path.join(root, 'index.html')).href;

async function freshPage(browser, viewport = { width: 390, height: 844 }, reducedMotion = false) {
  const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  await page.goto(file);
  await page.waitForFunction(() => loaded === true);
  await page.evaluate(() => { localStorage.removeItem('spore-save'); S = fresh(); loaded = true; derive(); tab='album'; render(); });
  return { context, page };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  let pass = 0;
  try {
    const { context, page } = await freshPage(browser);
    assert.equal(await page.locator('.album-list button').count(), 3); pass++;
    assert.equal(await page.locator('.album-list button').filter({ hasText: '未遇見' }).count(), 3); pass++;
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`); pass++;
    }
    for (const [g, bought, expected] of [
      [[3], [], 1], [[8], [], 2], [[10,10], ['g0','g1'], 3]
    ]) {
      await page.evaluate(({g,bought}) => applySave(JSON.stringify({...fresh(),g:[...g],bought,last:Date.now()}), false), {g,bought});
      assert.equal(await page.evaluate(() => S.collection.length), expected); pass++;
    }
    const portraitDelta = await page.evaluate(() => {
      document.querySelector('[data-friend="moss"]').click();
      const before=S.total; document.querySelector('#friendPortrait').click();
      return S.total-before;
    });
    assert.equal(portraitDelta, 0); pass++;
    await page.waitForTimeout(200);
    assert.match(await page.locator('#friendResponse').textContent(), /留了一個位置/); pass++;
    for (const bad of [{...await page.evaluate(() => S), collection:['bogus']}, {...await page.evaluate(() => S), bought:['bogus']}, {...await page.evaluate(() => S),version:4}]) {
      const result = await page.evaluate(b => {const before=JSON.stringify(S);let rejected=false;try{applySave(JSON.stringify(b),false)}catch{rejected=true}return {rejected,unchanged:JSON.stringify(S)===before}}, bad);
      assert.deepEqual(result, {rejected:true,unchanged:true}); pass++;
    }
    await page.evaluate(() => applySave(JSON.stringify({sp:0,total:0,g:[],bought:[],seeds:0,best:0,last:Date.now(),snd:true,peak:0}), false));
    assert.equal(await page.evaluate(() => S.collection.length), 0); assert.equal(await page.evaluate(() => S.version), 3); pass++;
    await page.evaluate(() => { S.collection=['moss','peach']; S.total=1e6; S.last=Date.now(); });
    await page.locator('[data-t="pre"]').evaluate(e=>e.click());
    await page.evaluate(() => { S.total=1e6; render(); });
    await page.locator('#pre').evaluate(e=>e.click());
    await page.locator('#mOk').evaluate(e=>e.click());
    await page.waitForFunction(() => S.seeds > 0);
    assert.deepEqual(await page.evaluate(() => S.collection), ['moss','peach']); pass++;
    await page.evaluate(() => save(true));
    await page.reload(); await page.waitForFunction(() => loaded === true);
    assert.deepEqual(await page.evaluate(() => S.collection), ['moss','peach']); pass++;
    const code = await page.evaluate(() => btoa(unescape(encodeURIComponent(JSON.stringify(S)))));
    await page.evaluate(code => applySave(decodeURIComponent(escape(atob(code))), false), code);
    assert.deepEqual(await page.evaluate(() => S.collection), ['moss','peach']); pass++;
    await page.evaluate(() => { S.collection=['moss']; render(); });
    await page.locator('#btnReset').evaluate(e=>e.click());
    await page.locator('#mOk').evaluate(e=>e.click());
    await page.waitForFunction(() => S.collection.length === 0);
    pass++;
    await context.close();

    const reduced = await freshPage(browser, undefined, true);
    await reduced.page.evaluate(() => {S.collection=['moss'];render()});
    await reduced.page.locator('#friendPortrait').evaluate(e=>e.click());
    assert.match(await reduced.page.locator('#friendResponse').textContent(), /留了一個位置/); pass++;
    await reduced.context.close();

    const corruptContext = await browser.newContext();
    await corruptContext.addInitScript(() => localStorage.setItem('spore-save','{"bought":["unknown"]}'));
    const corruptPage = await corruptContext.newPage();
    await corruptPage.goto(file);
    await corruptPage.waitForFunction(() => document.querySelector('#saveinfo').textContent.includes('原存檔已保留'));
    assert.equal(await corruptPage.evaluate(() => loaded), false);
    await corruptPage.evaluate(() => save(true));
    assert.equal(await corruptPage.evaluate(() => localStorage.getItem('spore-save')), '{"bought":["unknown"]}'); pass++;
    await corruptContext.close();
    const old = execFileSync('git', ['-C', root, 'show', '672f986:index.html'], { encoding: 'utf8' });
    const oldPage = await browser.newPage(); await oldPage.setContent(old);
    const oldState = await oldPage.evaluate(() => ({album:!!document.querySelector('[data-t="album"]'), before:JSON.stringify(S)}));
    assert.equal(oldState.album, false); pass++;
    const invalidOld = await oldPage.evaluate(() => {try{applySave(JSON.stringify({...S,collection:['bogus']}),false)}catch{}return JSON.stringify(S)});
    assert.notEqual(invalidOld, oldState.before); pass++;
    console.log(`PASS ${pass}; FAIL 0; legacy regression assertions: 2 reproduced`);
    await oldPage.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
