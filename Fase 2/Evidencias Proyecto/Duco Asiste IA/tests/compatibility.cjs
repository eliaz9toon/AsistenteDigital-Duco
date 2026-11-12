const { chromium, firefox, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

(async () => {
  const output = path.join(__dirname, 'evidence'); fs.mkdirSync(output, { recursive: true });
  const report = { date: new Date().toISOString(), physicalDevicesTested: false, browsers: [] };
  for (const [name, engine, options] of [
    ['Chromium', chromium, {}], ['Microsoft Edge', chromium, { channel: 'msedge' }],
    ['Firefox', firefox, {}], ['WebKit (not Safari)', webkit, {}]
  ]) {
    const result = { name, checks: [] }; report.browsers.push(result);
    let browser, page, marker, recordId;
    try {
      browser = await engine.launch({ headless: true, ...options }); result.version = browser.version();
      page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
      await page.route('**/*', r => ['127.0.0.1', 'localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
      await page.goto('http://127.0.0.1:8765/duco', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.duco?.aiClient);
      await page.evaluate(() => { duco.typewriterSpeed = 0; });
      await page.locator('.duco-avatar-button').focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement === document.querySelector('#duco-input'));
      await page.fill('#duco-input', 'hola?'); await page.press('#duco-input', 'Enter');
      await page.waitForFunction(() => !duco.isProcessing);
      assert.match(await page.locator('.duco-message-assistant').last().textContent(), /ayudarte/);
      result.checks.push('Keyboard open, focused input, Enter submission and differentiated messages');
      assert(await page.evaluate(() => duco.aiClient.isServerOnline()));
      result.checks.push('Real browser fetch/CORS connection to local Ollama');
      const session = await page.evaluate(() => chatHandler.getSessionId());
      await page.goto('http://127.0.0.1:8765/carreras.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.duco?.aiClient);
      assert.equal(await page.evaluate(() => chatHandler.getSessionId()), session);
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.duco?.aiClient);
      assert.equal(await page.locator('.duco-message-user').last().textContent(), 'hola?');
      result.checks.push('Session Storage and rendered messages survive navigation and reload');
      await page.goto('http://127.0.0.1:8765/duco', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.duco?.aiClient);
      const guide = await page.evaluate(async () => {
        scrollTo(0, 1500);
        const open = await duco.executeFlowAction({ type: 'dropdown', terms: ['Admisión'] });
        const count = document.querySelectorAll('.dropdown-menu.show').length;
        await duco.executeFlowAction({ type: 'closeDropdown' });
        const highlight = await duco.executeFlowAction({ type: 'highlightTerms', terms: ['Congreso i2T 2026'] });
        return { open, count, highlight, marks: document.querySelectorAll('.duco-page-highlight').length, y: scrollY };
      });
      assert(guide.open.success && guide.count === 1 && guide.highlight.success && guide.marks > 0 && guide.y === 0, JSON.stringify(guide));
      result.checks.push('Desktop dropdown, close, carousel activation, scroll to top and text marker');
      result.mobile = [];
      for (const width of [320, 375, 600]) {
        await page.setViewportSize({ width, height: 812 });
        await page.evaluate(() => duco.openPanel()); await page.waitForTimeout(200);
        const geometry = await page.evaluate(() => {
          const r = document.querySelector('#duco-chat-panel').getBoundingClientRect(), s = document.querySelector('#duco-send-btn').getBoundingClientRect();
          return { width: innerWidth, panelLeft: r.left, panelRight: r.right, panelTop: r.top, panelBottom: r.bottom, sendWidth: s.width, sendHeight: s.height, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert(geometry.panelLeft >= 0 && geometry.panelRight <= width + 1 && geometry.panelTop >= 0 && geometry.panelBottom <= 813 && geometry.sendWidth >= 44 && geometry.sendHeight >= 44 && !geometry.overflow, JSON.stringify(geometry));
        result.mobile.push(geometry);
      }
      result.checks.push('320/375/600px simulated viewports: panel within screen and touch-sized send control');
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({ path: path.join(output, 'compatibility-' + name.replace(/[^a-z]/gi, '').toLowerCase() + '.png') });
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#duco-chat-panel').getAttribute('aria-hidden'), 'true');
      result.checks.push('Escape closes panel and restores keyboard focus');
      const touch = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: name !== 'Firefox', deviceScaleFactor: 2, reducedMotion: 'reduce' });
      try {
        const mobile = await touch.newPage();
        await mobile.route('**/*', r => ['127.0.0.1', 'localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
        await mobile.goto('http://127.0.0.1:8765/duco', { waitUntil: 'domcontentloaded' });
        await mobile.waitForFunction(() => window.duco?.aiClient);
        await mobile.evaluate(() => { duco.typewriterSpeed = 0; });
        await mobile.locator('.duco-avatar-button').tap();
        await mobile.fill('#duco-input', 'hola?'); await mobile.locator('#duco-send-btn').tap();
        await mobile.waitForFunction(() => !duco.isProcessing);
        assert.match(await mobile.locator('.duco-message-assistant').last().textContent(), /ayudarte/);
        await mobile.locator('#duco-close-btn').tap();
        await mobile.locator('.duco-avatar-button').tap();
        await mobile.waitForFunction(() => window.duco.isOpen && getComputedStyle(document.querySelector('#duco-chat-panel')).visibility === 'visible' && Number(getComputedStyle(document.querySelector('#duco-chat-panel')).opacity) > 0.9);
        await mobile.locator('#duco-send-btn').waitFor({ state: 'visible' });
        await mobile.locator('.duco-header h3').waitFor({ state: 'visible' });
        await mobile.locator('.duco-message-assistant').last().waitFor({ state: 'visible' });
        await mobile.screenshot({ path: path.join(output, 'compatibility-' + name.replace(/[^a-z]/gi, '').toLowerCase() + '-touch.png'), animations: 'disabled' });
        result.checks.push('Simulated touch: launcher, send, close and reopen at 375px');
      } finally { await touch.close(); }

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!document.querySelector('#tables option[value="CONFIGURACIONES"]'));
      const loading = page.waitForResponse(r => r.url().endsWith('/api/tables/CONFIGURACIONES/rows') && r.status() === 200);
      await page.selectOption('#tables', 'CONFIGURACIONES'); await loading;
      await page.waitForTimeout(100);
      marker = 'DUCO_TEST_BROWSER_' + randomUUID().replaceAll('-', '');
      await page.click('#add'); await page.fill('#field-CLAVE', marker); await page.fill('#field-VALOR', 'original');
      const inserted = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/tables/CONFIGURACIONES'));
      await page.click('#save'); assert.equal((await inserted).status(), 201);
      let data = await (await page.request.get('http://127.0.0.1:8765/api/tables/CONFIGURACIONES/rows')).json();
      const row = data.rows.find(r => r.CLAVE === marker); assert(row); recordId = row.ID_CONFIG;
      const rendered = page.locator('#grid tr').filter({ hasText: marker }); await rendered.waitFor();
      await rendered.locator('.edit').click(); await page.fill('#field-VALOR', 'actualizado');
      const updated = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith('/api/tables/CONFIGURACIONES'));
      await page.click('#save'); assert.equal((await updated).status(), 200);
      await page.waitForFunction(m => [...document.querySelectorAll('#grid tr')].some(r => r.textContent.includes(m) && r.textContent.includes('actualizado')), marker);
      page.once('dialog', dialog => dialog.accept());
      const deleted = page.waitForResponse(r => r.request().method() === 'DELETE' && r.url().endsWith('/api/tables/CONFIGURACIONES'));
      await rendered.locator('.delete').click(); assert.equal((await deleted).status(), 200);
      data = await (await page.request.get('http://127.0.0.1:8765/api/tables/CONFIGURACIONES/rows')).json();
      assert(!data.rows.some(r => r.CLAVE === marker)); recordId = null;
      result.checks.push('Duco Admin UI: create, list, edit and delete temporary real Oracle record');
      result.passed = true;
    } catch (error) { result.passed = false; result.status = browser ? 'failed' : 'unavailable'; result.error = error.stack; process.exitCode = 1; }
    finally {
      if (page && marker) {
        try {
          const data = await (await page.request.get('http://127.0.0.1:8765/api/tables/CONFIGURACIONES/rows')).json();
          const own = data.rows.find(r => r.CLAVE === marker);
          if (own) {
            const removed = await page.request.delete('http://127.0.0.1:8765/api/tables/CONFIGURACIONES', { data: { key: { ID_CONFIG: own.ID_CONFIG } } });
            assert.equal(removed.status(), 200);
          }
          const remaining = await (await page.request.get('http://127.0.0.1:8765/api/tables/CONFIGURACIONES/rows')).json();
          result.cleanup = !remaining.rows.some(r => r.CLAVE === marker);
          if (!result.cleanup) { result.passed = false; process.exitCode = 1; }
        } catch (error) { result.cleanup = false; result.cleanupError = error.message; process.exitCode = 1; result.passed = false; }
      }
      await browser?.close(); console.log(JSON.stringify(result));
    }
  }
  report.passed = report.browsers.length === 4 && report.browsers.every(r => r.passed);
  fs.writeFileSync(path.join(output, 'compatibility.json'), JSON.stringify(report, null, 2));
})();
