// Forest systems regression suite: jobs, festival preparation, decor, themes, visitors and save safety.
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Leijoa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await playwright.chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let pass = 0;
  try {
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => loaded === true);
    await page.evaluate(() => { localStorage.removeItem('spore-save'); S = fresh(); loaded = true; derive(); render(); });
    assert.equal(await page.evaluate(() => S.forest.jobs.length), 2); pass++;
    assert.deepEqual(await page.evaluate(() => S.forest.decor), [null, null, null]); pass++;

    // Work-slot assignment, distinct residents, and the authoritative multipliers.
    await page.evaluate(() => { S.collection = ['moss', 'peach', 'elder']; unlockForest(); });
    await page.locator('[data-t="forest"]').evaluate(e => e.click());
    for (const id of ['forestJobs', 'forestDecor', 'forestTheme', 'forestEvent', 'forestPrep']) { assert.equal(await page.locator(`#${id}`).count(), 1, `missing #${id}`); pass++; }
    await page.locator('#jobFriend0').selectOption('moss');
    await page.locator('#jobRole0').selectOption('tap');
    await page.locator('#jobFriend1').selectOption('peach');
    await page.locator('#jobRole1').selectOption('tap');
    assert.equal(await page.evaluate(() => workMul('tap')), 1.3); pass++;
    await page.locator('#jobRole1').selectOption('idle');
    assert.equal(await page.evaluate(() => workMul('idle')), 1.1); pass++;
    assert.equal(await page.evaluate(() => workMul('tap')), 1.15); pass++;
    assert.equal(await page.locator('#jobFriend0 option:disabled').count(), 1); pass++;
    const duplicate = await page.evaluate(() => {
      const raw = { ...S.forest, jobs: [{ friend: 'moss', role: 'tap' }, { friend: 'moss', role: 'idle' }] };
      try { validateForest(raw, S); return false; } catch { return true; }
    });
    assert.equal(duplicate, true); pass++;
    const preview = await page.evaluate(() => {
      S.g[0]=10;S.bought=['t2'];derive();refreshForestUI();
      return { text: $('workPreview').innerText, tap: fmt(tapVal()), idle: fmt(pps()), rawTap: tapVal(), rawIdle: pps() };
    });
    assert.match(preview.text, /點擊基礎 ×1\.15/); assert.match(preview.text, /自動產出 ×1\.10/);
    assert.ok(preview.text.includes(preview.tap)); assert.ok(preview.text.includes(preview.idle));
    assert.ok(Math.abs(preview.rawTap-1.172)<1e-9); assert.ok(Math.abs(preview.rawIdle-2.2)<1e-9); pass++;

    // Festival selection only accepts unlocked events; event effects are snapshotted at start.
    const eventResult = await page.evaluate(() => {
      S.forest.nextEvent = 'dance'; S.forest.preparation = 'picnic';
      const selected = pickEvent(); startEvent(selected);
      const during = { id: ev.id, preparation: ev.preparation, mul: ev.mul, duration: ev.end - ev.start, storedPrep: S.forest.preparation, storedEvent: S.forest.nextEvent };
      S.forest.preparation = 'garland';
      const unchanged = ev.preparation === during.preparation && ev.mul === during.mul;
      endEvent(true);
      S.forest.nextEvent = 'parade';
      const locked = pickEvent().id !== 'parade';
      S.forest.nextEvent = 'dance'; S.forest.preparation = 'garland';
      startEvent(pickEvent()); const garlandDuration = ev.end - ev.start; endEvent(true);
      return { during, unchanged, locked, garlandDuration };
    });
    assert.equal(eventResult.during.id, 'dance'); assert.equal(eventResult.during.preparation, 'picnic'); assert.equal(eventResult.during.mul, 1.65); assert.equal(eventResult.during.duration, 22000); pass++;
    assert.equal(eventResult.during.storedPrep, 'none'); assert.equal(eventResult.during.storedEvent, null); pass++;
    assert.equal(eventResult.unchanged, true); pass++;
    assert.equal(eventResult.locked, true); assert.equal(eventResult.garlandDuration, 30000); pass++;
    assert.equal(await page.evaluate(() => { S.forest.nextEvent = 'not-an-event'; return pickEvent().id !== 'not-an-event'; }), true); pass++;

    // Decor unlocks from known residents and selection has three persistent slots.
    await page.evaluate(() => { S.forest.jobs = [null, null]; S.collection = ['moss', 'peach', 'elder']; unlockForest(); });
    for (const [selector, value] of [['#decor0', 'bench'], ['#decor1', 'lamp'], ['#decor2', 'mailbox']]) await page.locator(selector).selectOption(value);
    assert.deepEqual(await page.evaluate(() => S.forest.decor), ['bench', 'lamp', 'mailbox']); pass++;
    assert.deepEqual(await page.evaluate(() => ['bench', 'lamp', 'mailbox'].every(id => S.forest.decorUnlocked.includes(id))), true); pass++;
    const decorArt = await page.evaluate(() => {
      const hashes=[];
      for(const id of ['bench','lamp','mailbox']){
        S.forest.decor=[id,null,null];gx.clearRect(0,0,GW,GH);drawForestDecor(0,GH-78);
        const d=gx.getImageData(0,0,GW,GH).data;let h=2166136261;
        for(let i=0;i<d.length;i+=17)h=Math.imul(h^d[i],16777619);
        hashes.push(h>>>0);
      }
      return hashes;
    });
    assert.equal(new Set(decorArt).size, 3); pass++;

    // Theme choice changes the actual scene and unlocks from deterministic conditions.
    await page.evaluate(() => { S.achievements = ['story']; unlockForest(); });
    await page.locator('#forestTheme').selectOption('moon');
    assert.equal(await page.evaluate(() => S.forest.theme), 'moon'); pass++;
    assert.equal(await page.locator('.stage').getAttribute('data-theme'), 'moon'); pass++;
    assert.ok(await page.locator('#forestTheme').innerText().then(t => /星光森林|晨露花園|月光書林/.test(t))); pass++;

    // Visitors are deterministic, visible in the collection, and can respond without granting spores.
    const visitors = await page.evaluate(() => {
      S.forest.decor = ['bench', 'lamp', 'mailbox']; S.forest.theme = 'moon';
      S.stats.events = ['dance']; unlockForest(); return [...S.forest.visitors];
    });
    assert.deepEqual(new Set(visitors), new Set(['dew', 'ink', 'post'])); pass++;
    await page.locator('[data-t="album"]').evaluate(e => e.click());
    const visitorDelta = await page.evaluate(() => { const before=S.total;document.querySelector('[data-visitor="ink"]').click();return S.total-before; });
    assert.equal(visitorDelta, 0); pass++;
    assert.ok(await page.locator('#visitorResponse').innerText().then(t => t.trim().length > 0)); pass++;
    assert.ok(await page.locator('[data-visitor="ink"] svg').count()); pass++;
    const visitorArt = await page.locator('.visitor-grid button:not([disabled]) svg').evaluateAll(els => els.map(e => e.innerHTML));
    assert.equal(new Set(visitorArt).size, 3); pass++;
    await page.evaluate(() => { visitorReactAt = -Infinity; });
    await page.locator('[data-visitor="ink"]').focus(); await page.keyboard.press('Enter');
    assert.ok(await page.locator('#visitorResponse').innerText().then(t => t.trim().length > 0)); pass++;

    // Actual prestige confirmation keeps permanent forest progress and clears scheduling/buffs.
    await page.evaluate(() => {
      S.forest.jobs = [{ friend: 'moss', role: 'tap' }, { friend: 'peach', role: 'idle' }];
      S.forest.nextEvent = 'dance'; S.forest.preparation = 'picnic'; startEvent(EVENTS[0]);
      S.forest.nextEvent = 'dance'; S.forest.preparation = 'garland'; S.total = 1e6;
      combo = 42; tapBuff = 7; tapBuffEnd = Date.now() + 10000; buffMul = 7; buffEnd = Date.now() + 10000;
      tab = 'pre'; render();
    });
    await page.locator('#pre').evaluate(e => e.click());
    await page.locator('#mOk').evaluate(e => e.click());
    await page.waitForFunction(() => S.seeds > 0);
    const retained = await page.evaluate(() => ({ jobs: S.forest.jobs, decor: S.forest.decor, theme: S.forest.theme, visitors: S.forest.visitors, nextEvent: S.forest.nextEvent, preparation: S.forest.preparation, combo, tapBuff, buffMul, eventCleared: ev===null }));
    assert.deepEqual(retained.jobs, [{ friend: 'moss', role: 'tap' }, { friend: 'peach', role: 'idle' }]); assert.deepEqual(retained.decor, ['bench', 'lamp', 'mailbox']); pass++;
    assert.equal(retained.theme, 'moon'); assert.deepEqual(new Set(retained.visitors), new Set(['dew', 'ink', 'post'])); pass++;
    assert.equal(retained.nextEvent, null); assert.equal(retained.preparation, 'none'); assert.equal(retained.combo, 0); assert.equal(retained.tapBuff, 1); assert.equal(retained.buffMul, 1); assert.equal(retained.eventCleared,true); pass++;
    const prestigeSave = await page.evaluate(() => JSON.stringify(S));
    const offline = await page.evaluate(() => {
      const saved={...fresh(),g:[10],last:Date.now()-60000,collection:['moss'],forest:{...freshForest(),jobs:[{friend:'moss',role:'idle'},null]}};
      buffMul=7;tapBuff=15;applySave(JSON.stringify(saved),true);
      return {total:S.total,rate:basePps()};
    });
    assert.ok(Math.abs(offline.total-offline.rate*30)<0.01); pass++;
    assert.equal(offline.rate, 2.2); pass++;
    await page.evaluate(saved => applySave(saved, false), prestigeSave);

    // Forest block validation is atomic, rejects malformed IDs/duplicates, and migrates old saves safely.
    const malformed = [
      { ...await page.evaluate(() => S), forest: { ...await page.evaluate(() => S.forest), jobs: [{ friend: 'moss', role: 'tap' }, { friend: 'moss', role: 'idle' }] } },
      { ...await page.evaluate(() => S), forest: { ...await page.evaluate(() => S.forest), decor: ['bench', 'lamp'] } },
      { ...await page.evaluate(() => S), forest: { ...await page.evaluate(() => S.forest), visitors: ['ghost'] } },
      { ...await page.evaluate(() => S), forest: { ...await page.evaluate(() => S.forest), jobs: [{ friend: 'ghost', role: 'tap' }, null] } },
      { ...await page.evaluate(() => S), forest: { ...await page.evaluate(() => S.forest), jobs: [{ friend: 'moss', role: 'ghost' }, null] } },
      { ...await page.evaluate(() => S), forest: { ...await page.evaluate(() => S.forest), decorUnlocked: [] } },
      { ...await page.evaluate(() => S), forest: { ...await page.evaluate(() => S.forest), themesUnlocked: ['star'] } },
      { ...await page.evaluate(() => S), forest: { ...await page.evaluate(() => S.forest), nextEvent: 'parade' } }
    ];
    for (const bad of malformed) {
      const result = await page.evaluate(b => { const before = JSON.stringify(S); let rejected = false; try { applySave(JSON.stringify(b), false); } catch { rejected = true; } return { rejected, unchanged: JSON.stringify(S) === before }; }, bad);
      assert.deepEqual(result, { rejected: true, unchanged: true }); pass++;
    }
    const migration = await page.evaluate(() => {
      const old = { ...S }; delete old.forest; old.version = 3;
      applySave(JSON.stringify(old), false);
      return S.forest;
    });
    assert.equal(migration.jobs.length, 2); assert.deepEqual(migration.decor, [null, null, null]); assert.equal(migration.theme, 'star'); pass++;
    await page.evaluate(saved => applySave(saved, false), prestigeSave);
    const roundtrip = await page.evaluate(() => {
      const snapshot = JSON.stringify(S.forest); applySave(JSON.stringify(S), false); return JSON.stringify(S.forest) === snapshot;
    });
    assert.equal(roundtrip, true); pass++;
    const storageSentinel = await page.evaluate(() => {
      S.forest.jobs[0]={friend:'elder',role:'idle'};S.forest.preparation='garland';S.sp=Date.now();
      return {forest:JSON.stringify(S.forest),sp:S.sp};
    });
    await page.evaluate(async () => { await save(); }); await page.reload(); await page.waitForFunction(() => loaded === true);
    assert.deepEqual(await page.evaluate(() => ({forest:JSON.stringify(S.forest),sp:S.sp})), storageSentinel); pass++;

    const invalidRaw = JSON.stringify({ ...await page.evaluate(() => S), forest: { ...await page.evaluate(() => S.forest), jobs: [{ friend: 'elder', role: 'idle' }, { friend: 'elder', role: 'tap' }] } });
    const corruptContext = await browser.newContext();
    await corruptContext.addInitScript(raw => localStorage.setItem('spore-save', raw), invalidRaw);
    const corruptPage = await corruptContext.newPage();
    await corruptPage.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await corruptPage.waitForFunction(() => document.querySelector('#saveinfo').textContent.includes('原存檔已保留'));
    assert.equal(await corruptPage.evaluate(() => loaded), false); pass++;
    assert.equal(await corruptPage.evaluate(() => localStorage.getItem('spore-save')), invalidRaw); pass++;
    await corruptContext.close();

    // Narrow screens and reduced motion retain usable controls and logical effects.
    await page.locator('[data-t="forest"]').evaluate(e => e.click());
    for (const width of [320, 390, 1280]) { await page.setViewportSize({ width, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`); pass++; }
    const themeArt = await page.evaluate(() => {
      const hashes=[];
      for(const theme of ['star','dew','moon']){
        S.forest.theme=theme;gx.clearRect(0,0,GW,GH);drawForestAtmosphere(1000,GH-78);
        const d=gx.getImageData(0,0,GW,GH).data;let h=2166136261;
        for(let i=0;i<d.length;i+=17)h=Math.imul(h^d[i],16777619);
        hashes.push(h>>>0);
      }
      return hashes;
    });
    assert.equal(new Set(themeArt).size, 3); pass++;
    await page.locator('[data-t="album"]').evaluate(e => e.click());
    for (const width of [320, 390, 1280]) { await page.setViewportSize({ width, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `album overflow at ${width}px`); pass++; }
    const reduced = await page.evaluate(() => { S.forest.preparation = 'picnic'; const before = ev; startEvent(EVENTS[0]); const result = ev.mul === 1.65; endEvent(true); return result; });
    assert.equal(reduced, true); pass++;
    const normalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
    const normalPage = await normalContext.newPage();
    await normalPage.goto(pathToFileURL(path.join(root, 'index.html')).href); await normalPage.waitForFunction(() => loaded === true);
    const normalResult = await normalPage.evaluate(() => {
      S.collection=['moss','peach','elder'];S.g[0]=10;S.bought=['t2'];S.forest.jobs=[{friend:'moss',role:'tap'},{friend:'peach',role:'idle'}];S.forest.preparation='picnic';derive();
      const values={tap:tapVal(),pps:pps()};startEvent(EVENTS[0]);values.mul=ev.mul;values.prep=ev.preparation;endEvent(true);return values;
    });
    assert.ok(Math.abs(normalResult.tap-1.172)<1e-9); assert.ok(Math.abs(normalResult.pps-2.2)<1e-9); assert.equal(normalResult.mul,1.65); assert.equal(normalResult.prep,'picnic'); pass++;
    await normalContext.close();
    assert.deepEqual(errors, []); pass++;

    // Real in-memory mutants: removing either guard makes the malformed import assertion fail.
    const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const duplicateGuard = "||new Set(f.jobs.filter(Boolean).map(j=>j.friend)).size!==f.jobs.filter(Boolean).length";
    const assignmentGuard = 'next.forest=validateForest(o.forest,next);';
    assert.ok(source.includes(duplicateGuard)); assert.ok(source.includes(assignmentGuard));
    const duplicateMutant = source.replace(duplicateGuard, '');
    const importMutant = source.replace(assignmentGuard, 'next.forest=o.forest;');
    assert.notEqual(duplicateMutant, source); assert.notEqual(importMutant, source);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spore-forest-mutation-'));
    try { for (const [name, mutant, makeBad] of [
      ['duplicate', duplicateMutant, state => ({ ...state, forest: { ...state.forest, jobs: [{ friend: 'moss', role: 'tap' }, { friend: 'moss', role: 'idle' }] } })],
      ['import', importMutant, state => ({ ...state, forest: { ...state.forest, visitors: ['ghost'] } })]
    ]) {
      const mutantPath = path.join(tempDir, `${name}.html`);
      fs.writeFileSync(mutantPath, mutant, 'utf8');
      const mutantPage = await context.newPage();
      await mutantPage.goto(pathToFileURL(mutantPath).href);
      await mutantPage.waitForFunction(() => loaded === true);
      const state = await page.evaluate(() => S);
      const bad = makeBad(state);
      const accepted = await mutantPage.evaluate(b => { try { applySave(JSON.stringify(b), false); return true; } catch { return false; } }, bad);
      assert.equal(accepted, true, `removing ${name} protection should reproduce acceptance of invalid forest data`); pass++;
      await mutantPage.close();
    }} finally { fs.rmSync(tempDir, { recursive: true, force: true }); }
    console.log(`PASS ${pass}; FAIL 0; mutation counterexamples: 2/2 protections removed and defects reproduced`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
