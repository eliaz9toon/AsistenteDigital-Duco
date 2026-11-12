const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { date: new Date().toISOString(), checks: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.route('**/*', r => ['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
    async function reset() {
      await page.goto('http://127.0.0.1:8765/duco', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.duco && window.ducoHighlighter);
      await page.evaluate(() => { duco.typewriterSpeed = 0; });
    }
    async function check(name, fn) {
      try { await reset(); const result = await fn(); report.checks.push({ name, passed: true, result }); }
      catch (e) { report.checks.push({ name, passed: false, error: e.message }); process.exitCode = 1; }
      console.log(JSON.stringify(report.checks.at(-1)));
    }
    await check('E3-H1-T03 / E3-H3-T01: open a real menu and access its option', async () => {
      const r = await page.evaluate(async () => {
        const result = await duco.executeFlowAction({ type: 'dropdown', terms: ['Oferta Académica'] });
        const menu = document.querySelector('.dropdown-menu.show');
        return { result, visible: !!menu?.getClientRects().length, careers: !!menu && [...menu.querySelectorAll('a')].some(a => a.textContent.trim() === 'Carreras') };
      });
      assert(r.result.success && r.visible && r.careers, JSON.stringify(r)); return r;
    });
    await check('E3-H1-T04 / E3-H3-T04: missing menu and scroll target fail honestly', async () => {
      const r = await page.evaluate(async () => ({
        menu: await duco.executeFlowAction({ type: 'dropdown', terms: ['Elemento inexistente ZXQ987'] }),
        scroll: await duco.executeFlowAction({ type: 'scroll', terms: ['Elemento inexistente ZXQ987'] })
      }));
      assert.equal(r.menu.success, false); assert.equal(r.scroll.success, false, JSON.stringify(r)); return r;
    });
    await check('E3-H2-T01 / E3-H2-T04: carousel highlight is actually uncovered', async () => {
      const r = await page.evaluate(async () => {
        scrollTo(0, 1600); await new Promise(r => setTimeout(r, 100));
        const result = await duco.executeFlowAction({ type: 'highlightTerms', terms: ['Congreso i2T 2026'], duration: 6000 });
        await new Promise(r => setTimeout(r, 300));
        const mark = [...document.querySelectorAll('.duco-page-highlight')].find(e => e.textContent === 'Congreso i2T 2026');
        const rect = mark?.getBoundingClientRect();
        const hit = rect && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return { result, y: scrollY, uncovered: !!mark && (hit === mark || mark.contains(hit)) };
      });
      assert(r.result.success && r.uncovered && r.y === 0, JSON.stringify(r)); return r;
    });
    await check('E3-H2-T02: a new highlight replaces the previous one', async () => {
      const r = await page.evaluate(async () => {
        await duco.executeFlowAction({ type: 'highlightTerms', terms: ['Congreso i2T 2026'] });
        const result = await duco.executeFlowAction({ type: 'highlightTerms', terms: ['Carreras Técnicas y Profesionales'] });
        await new Promise(r => setTimeout(r, 300));
        return { result, marked: [...document.querySelectorAll('.duco-page-highlight')].map(e => e.textContent) };
      });
      assert(r.result.success); assert(!r.marked.includes('Congreso i2T 2026'), JSON.stringify(r)); assert(r.marked.length); return r;
    });
    await check('E3-H2-T03: nonexistent or hidden-only content is not reported highlighted', async () => {
      const r = await page.evaluate(async () => {
        const hidden = document.createElement('p'); hidden.hidden = true; hidden.textContent = 'Objetivo oculto ZXQ987'; document.body.append(hidden);
        return { missing: await duco.executeFlowAction({ type: 'highlightTerms', terms: ['Elemento inexistente ZXQ987'] }),
          hidden: await duco.executeFlowAction({ type: 'highlightTerms', terms: ['Objetivo oculto ZXQ987'] }) };
      });
      assert.equal(r.missing.success, false, JSON.stringify(r)); assert.equal(r.hidden.success, false, JSON.stringify(r)); return r;
    });
    await check('E3-H3-T02: switching and explicitly closing menus', async () => {
      const r = await page.evaluate(async () => {
        const unrelated = document.createElement('button'); unrelated.setAttribute('aria-expanded', 'true'); document.body.append(unrelated);
        await duco.executeFlowAction({ type: 'dropdown', terms: ['Oferta Académica'] });
        await duco.executeFlowAction({ type: 'dropdown', terms: ['Admisión'] });
        const open = document.querySelectorAll('.dropdown-menu.show').length;
        const closed = await duco.executeFlowAction({ type: 'closeDropdown' });
        return { open, closed, remaining: document.querySelectorAll('.dropdown-menu.show').length, unrelated: unrelated.getAttribute('aria-expanded') };
      });
      assert.equal(r.open, 1); assert(r.closed.success); assert.equal(r.remaining, 0); assert.equal(r.unrelated, 'true'); return r;
    });
    await check('E3-H3-T03: detached controls and missing dialogs are rejected', async () => {
      const r = await page.evaluate(async () => {
        const button = document.createElement('button'); button.textContent = 'Boton separado';
        return { menu: await duco.executeFlowAction({ type: 'dropdown', terms: ['Boton separado'], trigger: button }),
          dialog: await duco.executeFlowAction({ type: 'clickControl', terms: ['Video inexistente'], dialogId: 'missing' }) };
      });
      assert.equal(r.menu.success, false); assert.equal(r.dialog.success, false); return r;
    });
    await check('E3-H3-T03: disabled menu control is rejected', async () => {
      const r = await page.evaluate(async () => {
        const resolved = duco.resolveDropdownControl(['Admisión']);
        resolved.trigger.setAttribute('aria-disabled', 'true');
        return await duco.executeFlowAction({ type: 'dropdown', terms: ['Admisión'] });
      });
      assert.equal(r.success, false); return r;
    });
    await check('E3-H1-T03 / E3-H2-T04: dropdown option is highlighted and uncovered', async () => {
      const r = await page.evaluate(async () => {
        duco.openPanel();
        const actions = duco.bindMenuActions([{ type: 'dropdown', terms: ['Oferta Académica'] },
          { type: 'highlightTerms', scope: 'opened_menu', menuTerms: ['Oferta Académica'], terms: ['Carreras'] }]);
        for (const action of actions) await duco.executeFlowAction(action);
        await new Promise(r => setTimeout(r, 300));
        const item = actions[1].menuTrigger, rect = item.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return { marked: item.classList.contains('duco-control-highlight'), uncovered: hit === item || item.contains(hit) };
      });
      assert(r.marked && r.uncovered, JSON.stringify(r)); return r;
    });
    await check('E3-H3-T04: nonexistent dropdown option is not silently skipped', async () => {
      const r = await page.evaluate(async () => {
        const actions = duco.bindMenuActions([{ type: 'dropdown', terms: ['Oferta Académica'] },
          { type: 'highlightTerms', scope: 'opened_menu', menuTerms: ['Oferta Académica'], terms: ['No existe ZXQ987'] }]);
        return { count: actions.length, result: await duco.executeFlowAction(actions[1]) };
      });
      assert.equal(r.count, 2); assert.equal(r.result.success, false); return r;
    });
    await check('E3-H3-T02: response completion closes assistant-owned menus', async () => {
      const r = await page.evaluate(async () => {
        // Stub only the model: execute the actual response/UI lifecycle.
        duco.requestAiResponse = async () => ({ reply: 'Voy a abrir el menú.', actions: [{ type: 'dropdown', terms: ['Admisión'] }] });
        await duco.processUserInput('Abre el menú Admisión');
        const open = document.querySelectorAll('.dropdown-menu.show').length;
        await new Promise(r => setTimeout(r, 5000));
        return { open, remaining: document.querySelectorAll('.dropdown-menu.show').length };
      });
      assert.equal(r.open, 1); assert.equal(r.remaining, 0); return r;
    });
    await check('E3-H3-T04: flow renders an honest error for a missing target', async () => {
      const r = await page.evaluate(async () => {
        const outcomes = await duco.runAssistantFlow([{ action: { type: 'dropdown', terms: ['No existe ZXQ987'] } }]);
        return { outcomes, text: document.querySelector('#duco-messages').textContent };
      });
      assert.equal(r.outcomes[0].success, false); assert.match(r.text, /No pude completar este paso/); return r;
    });
  } finally {
    report.passed = report.checks.length === 12 && report.checks.every(c => c.passed);
    const file = path.join(__dirname, 'evidence', 'sprint3.json');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
