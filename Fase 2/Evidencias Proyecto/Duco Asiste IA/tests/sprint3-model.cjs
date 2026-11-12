const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { date: new Date().toISOString(), request: 'Abre el menú Admisión y después ciérralo.', passed: false };
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/*', r => ['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8765/duco', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.duco?.aiClient);
    await page.evaluate(() => { duco.typewriterSpeed = 0; duco.openPanel(); });
    await page.fill('#duco-input', report.request);
    await page.click('#duco-send-btn');
    await page.waitForFunction(() => !duco.isProcessing, null, { timeout: 180000 });
    report.model = await page.evaluate(() => duco.aiClient.model);
    report.outcomes = await page.evaluate(() => chatHandler.getActionOutcomes());
    report.remainingMenus = await page.locator('.dropdown-menu.show').count();
    assert(report.outcomes.some(o => o.type === 'dropdown' && o.success));
    assert(report.outcomes.some(o => o.type === 'closeDropdown' && o.success));
    assert.equal(report.remainingMenus, 0);
    report.passed = true;
  } catch (e) { report.error = e.stack; process.exitCode = 1; }
  finally {
    const file = path.join(__dirname, 'evidence', 'sprint3-model.json');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2)); await browser.close();
  }
})();
