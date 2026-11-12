const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { date: new Date().toISOString(), checks: [] };
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/*', r => ['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8765/duco', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.duco?.aiClient);
    await page.evaluate(() => { duco.typewriterSpeed = 0; duco.openPanel(); });
    await page.waitForFunction(() => document.querySelector('#duco-messages')?.textContent.includes('Hola'));
    assert(await page.locator('#duco-input').isVisible()); assert(await page.locator('#duco-send-btn').isVisible());
    report.checks.push('Chat structure, welcome, input and send control visible');
    await page.fill('#duco-input', '   '); await page.click('#duco-send-btn');
    await page.waitForFunction(() => document.querySelector('#duco-messages').textContent.includes('Escribe una pregunta antes de enviar.'));
    assert.equal(await page.evaluate(() => chatHandler.getDialogueMessages().filter(m => m.type === 'user').length), 0);
    report.checks.push('Empty input is rejected');
    await page.fill('#duco-input', 'hola?'); await page.press('#duco-input', 'Enter');
    await page.waitForFunction(() => !duco.isProcessing);
    assert.equal(await page.locator('.duco-message-user').last().textContent(), 'hola?');
    assert.match(await page.locator('.duco-message-assistant').last().textContent(), /ayudarte/);
    report.checks.push('Enter submits; user and assistant messages have separate roles');
    const original = await page.evaluate(() => ({ session: chatHandler.getSessionId(), dialogue: chatHandler.getDialogueMessages() }));
    await page.goto('http://127.0.0.1:8765/carreras.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.duco?.aiClient);
    assert.deepEqual(await page.evaluate(() => ({ session: chatHandler.getSessionId(), dialogue: chatHandler.getDialogueMessages() })), original);
    report.checks.push('Navigation retains session and dialogue');
    await page.setViewportSize({ width: 375, height: 812 }); await page.evaluate(() => duco.openPanel());
    await page.waitForTimeout(300);
    const mobile = await page.evaluate(() => ({ send: document.querySelector('#duco-send-btn').getBoundingClientRect().width,
      close: document.querySelector('#duco-close-btn').getBoundingClientRect().height, overflow: document.documentElement.scrollWidth > innerWidth }));
    assert(mobile.send >= 44 && mobile.close >= 44 && !mobile.overflow);
    report.mobile = mobile; report.checks.push('Mobile controls >=44px and no horizontal overflow');
    report.passed = true;
  } catch (error) { report.passed = false; report.error = error.stack; process.exitCode = 1; }
  finally {
    const file = path.join(__dirname, 'evidence', 'sprint1.json');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2)); await browser.close();
  }
})();
