const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { date: new Date().toISOString(), cases: [], modelResponses: [] };
  const directory = path.join(__dirname, 'evidence');
  fs.mkdirSync(directory, { recursive: true });
  async function check(name, fn) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await page.route('**/*', r => ['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
      await page.goto('http://127.0.0.1:8765/duco', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.duco?.aiClient);
      await page.evaluate(() => { duco.typewriterSpeed = 0; duco.openPanel(); });
      await page.waitForFunction(() => document.querySelector('#duco-messages')?.textContent.includes('Hola'));
      const detail = await fn(page);
      report.cases.push({ name, passed: true, detail });
    } catch (e) { report.cases.push({ name, passed: false, error: e.message }); process.exitCode = 1; }
    finally { await context.close(); }
    console.log(JSON.stringify(report.cases.at(-1)));
  }
  try {
    await check('E4-H1-T01: keyboard launcher and focus', async page => {
      await page.click('#duco-close-btn');
      await page.locator('.duco-avatar-button').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#duco-chat-panel.open').count(), 1);
      assert(await page.locator('#duco-input').evaluate(e => e === document.activeElement));
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#duco-chat-panel').getAttribute('aria-hidden'), 'true');
      assert(await page.locator('.duco-avatar-button').evaluate(e => e === document.activeElement));
    });
    await check('E4-H1-T03: full response beyond 2000 characters; safe text', async page => {
      const r = await page.evaluate(async () => {
        duco.typewriterSpeed = 1; duco.sleep = async () => {};
        const text = 'A'.repeat(2100) + ' FIN <img src=x onerror="window.__unsafe=true">';
        const message = await duco.displayMessage(text);
        return { expected: text, actual: message.textContent, images: message.querySelectorAll('img').length, unsafe: !!window.__unsafe };
      });
      assert.equal(r.actual, r.expected); assert.equal(r.images, 0); assert(!r.unsafe);
      return { characters: r.actual.length, safe: true };
    });
    await check('E4-H1-T04: restored messages retain clickable links', async page => {
      await page.evaluate(() => chatHandler.addAssistantMessage('Referencia https://www.duoc.cl/'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.duco?.aiClient);
      await page.waitForTimeout(650);
      assert.equal(await page.locator('#duco-messages a[href="https://www.duoc.cl/"]').count(), 1);
    });
    await check('E1-H1-T02: blank and oversized queries never reach the model', async page => {
      await page.evaluate(() => { window.__modelCalls = 0; duco.aiClient.generateResponse = async () => { window.__modelCalls++; throw Error('Must not call'); }; });
      for (const value of ['', '   ', '\u00a0', 'A'.repeat(2001)]) {
        await page.fill('#duco-input', value); await page.click('#duco-send-btn');
      }
      await page.waitForFunction(() => document.querySelector('#duco-messages').textContent.includes('Máximo 2000 caracteres'));
      const r = await page.evaluate(() => ({ calls: window.__modelCalls, users: chatHandler.getDialogueMessages().filter(m => m.type === 'user').length }));
      assert.equal(r.calls, 0); assert.equal(r.users, 0); return r;
    });
    await check('E1-H1-T01 / E4-H1-T03: duplicate submissions blocked; draft retained', async page => {
      await page.evaluate(() => { window.__calls = 0; duco.aiClient.generateResponse = () => { window.__calls++; return new Promise(resolve => window.__release = () => resolve({ reply: 'Respuesta controlada.', actions: [], intent: { reference: 'resolved_action', action: 'none' } })); }; });
      await page.fill('#duco-input', 'Primera consulta'); await page.click('#duco-send-btn');
      await page.waitForFunction(() => !!window.__release);
      assert(await page.locator('#duco-send-btn').isDisabled()); assert(await page.locator('#duco-reset-btn').isDisabled());
      await page.fill('#duco-input', 'Borrador siguiente'); await page.press('#duco-input', 'Enter');
      assert.equal(await page.evaluate(() => window.__calls), 1);
      await page.evaluate(() => window.__release());
      await page.waitForFunction(() => !duco.isProcessing);
      assert.equal(await page.locator('.duco-message-user').count(), 1);
      assert.equal(await page.locator('#duco-input').inputValue(), 'Borrador siguiente');
      assert.match(await page.locator('.duco-message-assistant').last().textContent(), /Respuesta controlada/);
    });
    await check('E1-H1-T01 / E1-H1-T03: exact size limit accepted; composition Enter ignored', async page => {
      await page.evaluate(() => { window.__accepted = []; duco.requestAiResponse = async text => { window.__accepted.push(text); return { reply: 'Recibido.', actions: [], intent: { reference: 'resolved_action', action: 'none' } }; }; });
      await page.fill('#duco-input', '  ' + 'A'.repeat(2000) + '  ');
      await page.locator('#duco-input').dispatchEvent('keydown', { key: 'Enter', isComposing: true });
      assert.equal(await page.evaluate(() => window.__accepted.length), 0);
      await page.press('#duco-input', 'Enter'); await page.waitForFunction(() => !duco.isProcessing);
      assert.deepEqual(await page.evaluate(() => window.__accepted.map(t => t.length)), [2000]);
    });
    await check('E4-H1-T04: new conversation clears draft and persists reset', async page => {
      await page.fill('#duco-input', 'hola?'); await page.press('#duco-input', 'Enter');
      await page.waitForFunction(() => !duco.isProcessing);
      const oldSession = await page.evaluate(() => chatHandler.getSessionId());
      await page.fill('#duco-input', 'Borrador pendiente'); await page.click('#duco-reset-btn');
      assert.equal(await page.locator('#duco-input').inputValue(), '');
      assert.notEqual(await page.evaluate(() => chatHandler.getSessionId()), oldSession);
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.duco?.aiClient);
      assert.equal(await page.locator('.duco-message-user').count(), 0);
      assert.equal(await page.locator('.duco-message-assistant').count(), 1);
    });
    await check('E1-H1-T03 / E4-H1-T04: timeout releases UI and persists error', async page => {
      await page.evaluate(() => { duco.aiClient.generateResponse = async () => { throw Error('OLLAMA_TIMEOUT'); }; });
      await page.fill('#duco-input', 'Consulta para simular timeout'); await page.press('#duco-input', 'Enter');
      await page.waitForFunction(() => !duco.isProcessing);
      await page.waitForFunction(() => document.querySelector('#duco-messages').textContent.includes('Ollama tardó demasiado'));
      assert(!(await page.locator('#duco-send-btn').isDisabled()));
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.duco?.aiClient);
      await page.waitForTimeout(650);
      assert.match(await page.locator('#duco-messages').textContent(), /Ollama tardó demasiado/);
    });
    await check('E4-H1-T01: mobile geometry and controls at 320/375/600px', async page => {
      const results = [];
      for (const width of [320, 375, 600]) {
        await page.setViewportSize({ width, height: 812 }); await page.waitForTimeout(100);
        const r = await page.evaluate(() => {
          const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height, top: r.top, bottom: r.bottom }; };
          return { width: innerWidth, panel: rect('#duco-chat-panel'), send: rect('#duco-send-btn'), close: rect('#duco-close-btn'), input: rect('#duco-input') };
        });
        assert(r.panel.left >= 0 && r.panel.right <= width + 1 && r.panel.top >= 0 && r.panel.bottom <= 813, JSON.stringify(r));
        assert(r.send.width >= 44 && r.send.height >= 44 && r.close.width >= 44 && r.input.height >= 44, JSON.stringify(r)); results.push(r);
      }
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForFunction(() => document.querySelector('#duco-messages').textContent.includes('hoy?'));
      await page.screenshot({ path: path.join(directory, 'sprint1-mobile.png') });
      return results;
    });
    if (!process.env.DUCO_SKIP_REAL_MODEL) await check('E1-H1-T03 / E4-H1-T04: real Ollama via UI; navigation/back/reload', async page => {
      page.on('response', async response => {
        if (new URL(response.url()).pathname === '/api/chat') {
          try { const data = await response.json(); report.modelResponses.push({ status: response.status(), model: data.model, content: data.message?.content }); } catch {}
        }
      });
      await page.fill('#duco-input', '¿Qué es Duoc UC?'); await page.click('#duco-send-btn');
      await page.waitForFunction(() => window.duco?.isProcessing === false, null, { timeout: 180000 });
      const before = await page.evaluate(() => ({ id: chatHandler.getSessionId(), dialogue: chatHandler.getDialogueMessages() }));
      const answer = before.dialogue.filter(m => m.type === 'assistant').at(-1).text;
      assert.match(answer, /educaci[oó]n|instituci[oó]n|formaci[oó]n/i); assert(report.modelResponses.length);
      await page.goto('http://127.0.0.1:8765/carreras.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.duco?.aiClient);
      await page.goBack({ waitUntil: 'domcontentloaded' }); await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.duco?.aiClient); await page.waitForTimeout(650);
      assert.deepEqual(await page.evaluate(() => ({ id: chatHandler.getSessionId(), dialogue: chatHandler.getDialogueMessages() })), before);
      const renderedAnswer = await page.evaluate(text => {
        const element = document.createElement('span'); duco.linkifyAssistantMessage(element, text); return element.textContent;
      }, answer);
      assert((await page.locator('#duco-messages').textContent()).includes(renderedAnswer)); return { answer, model: await page.evaluate(() => duco.aiClient.model) };
    });
  } finally {
    report.realModelSkipped = !!process.env.DUCO_SKIP_REAL_MODEL;
    report.passed = report.cases.length === (report.realModelSkipped ? 9 : 10) && report.cases.every(c => c.passed);
    fs.writeFileSync(path.join(directory, 'sprint1-revalidation.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
