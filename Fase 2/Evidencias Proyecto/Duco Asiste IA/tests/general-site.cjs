const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { date: new Date().toISOString(), externalNetwork: !!process.env.DUCO_TEST_EXTERNAL, pages: [], catalog: [] };
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    if (!report.externalNetwork) await page.route('**/*', r => ['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
    let current;
    page.on('pageerror', error => current?.errors.push(error.stack));
    page.on('response', response => {
      if (response.status() >= 400 && ['localhost', '127.0.0.1'].includes(new URL(response.url()).hostname)) current?.httpErrors.push({ url: response.url(), status: response.status() });
    });
    for (const route of ['/duco', '/carreras.html', '/carreras-detalle/ingenieria-en-informatica.html']) {
      current = { route, errors: [], httpErrors: [] }; report.pages.push(current);
      await page.goto('http://127.0.0.1:8765' + route, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.duco?.aiClient);
      await page.evaluate(() => { duco.typewriterSpeed = 0; duco.openPanel(); });
      await page.waitForTimeout(500);
      if (route === '/carreras.html' && report.externalNetwork) {
        await page.fill('#carrera-search', 'informática');
        await page.waitForFunction(() => {
          const text = document.querySelector('#resultados-carreras')?.textContent || '';
          return /inform[aá]tica/i.test(text) && !/Preparador F[ií]sico/i.test(text);
        });
        current.searchWorks = true;
      }
      current.chatVisible = await page.locator('#duco-chat-panel').isVisible();
      current.assistantCount = await page.locator('#duco-assistant-container').count();
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);
      if (route.includes('carreras-detalle')) {
        current.controls = await page.evaluate(async () => {
          const tab = [...document.querySelectorAll('a[role="tab"]')].find(e => /perfil de egreso/i.test(e.textContent));
          if (!tab) throw Error('Missing institutional profile tab');
          const video = duco.getDialogControls().find(e => /video de la carrera/i.test(e.label));
          if (!video) throw Error('Missing video control');
          const opened = await duco.executeFlowAction({ type: 'clickControl', terms: [video.label], dialogId: video.dialogId });
          const dialog = document.getElementById(video.dialogId);
          const close = [...dialog.querySelectorAll('button')].find(b => /cerrar|close/i.test(b.getAttribute('aria-label') || ''));
          close?.click();
          const selected = await duco.executeFlowAction({ type: 'selectPageControl', terms: [tab.textContent.trim()] });
          return { selected, opened, closed: dialog.hidden };
        });
      }
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(200);
      current.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    const catalog = await (await page.request.get('http://127.0.0.1:8765/assets/carreras-catalogo.json')).json();
    for (const career of catalog) {
      const url = new URL(career.local_link, 'http://127.0.0.1:8765/');
      assert.equal(url.origin, 'http://127.0.0.1:8765');
      const response = await page.request.get(url.href);
      report.catalog.push({ route: url.pathname, status: response.status(), chatScript: (await response.text()).includes('js/duco-assistant.js') });
    }
    report.passed = report.pages.every(p => !p.errors.length && p.chatVisible && p.assistantCount === 1 && !p.mobileOverflow && (!p.controls || (p.controls.selected.success && p.controls.opened.success && p.controls.closed))) && report.catalog.length > 0 && report.catalog.every(c => c.status === 200 && c.chatScript);
    if (!report.passed) process.exitCode = 1;
  } catch (error) { report.passed = false; report.error = error.stack; process.exitCode = 1; }
  finally {
    report.warnings = report.pages.flatMap(p => p.httpErrors.map(e => ({ page: p.route, ...e })));
    fs.writeFileSync(path.join(__dirname, 'evidence', report.externalNetwork ? 'general-site-online.json' : 'general-site-offline.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, catalog: { count: report.catalog.length, failed: report.catalog.filter(c => c.status !== 200 || !c.chatScript) } }, null, 2));
    await browser.close();
  }
})();
