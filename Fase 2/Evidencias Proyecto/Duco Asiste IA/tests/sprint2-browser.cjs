// Requires the local application, Playwright and the configured Ollama model.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { date: new Date().toISOString(), baseUrl: process.env.DUCO_TEST_URL || 'http://127.0.0.1:8765', checks: [], turns: [], modelRequests: [] };
  const output = path.join(__dirname, 'evidence', 'sprint2.json');
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/chat') {
        const payload = request.postDataJSON();
        report.modelRequests.push({ model: payload.model, messages: payload.messages });
      }
    });
    async function ready() {
      await page.waitForFunction(() => window.duco?.aiClient && window.chatHandler);
      await page.evaluate(() => { duco.typewriterSpeed = 0; duco.openPanel(); });
      await page.waitForFunction(() => document.querySelector('#duco-messages')?.children.length > 0);
      await page.waitForTimeout(300);
    }
    async function ask(text) {
      await page.fill('#duco-input', text);
      await page.click('#duco-send-btn');
      await page.waitForFunction(() => window.duco?.isProcessing === false && window.chatHandler, null, { timeout: 180000 });
      await ready();
      const reply = await page.evaluate(() => chatHandler.getDialogueMessages().filter(message => message.type === 'assistant').at(-1)?.text);
      assert(reply && !/No pude conectarme|no est[aá] disponible|problema de conexi[oó]n/i.test(reply), reply);
      report.turns.push({ text, reply });
      console.log(JSON.stringify(report.turns.at(-1)));
      return reply;
    }
    await page.goto(report.baseUrl + '/duco', { waitUntil: 'domcontentloaded' });
    await ready();
    const first = 'Trabajo durante el día y prefiero estudiar en horario vespertino. ¿Puedes tenerlo en cuenta para orientarme? Por ahora solo conversemos, no abras páginas ni menús.';
    await ask(first);
    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('duco-chat-session')));
    assert(stored.dialogue.some(message => message.type === 'user' && message.text === first));
    assert(stored.messages.some(message => message.type === 'assistant'));
    report.checks.push('Session Storage contains the actual user/assistant exchange');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready();
    assert.equal(await page.evaluate(() => chatHandler.getSessionId()), stored.sessionId);
    assert.deepEqual(await page.evaluate(() => chatHandler.getDialogueMessages()), stored.dialogue);
    report.checks.push('Reload restores the same session and dialogue');
    await page.goto(report.baseUrl + '/carreras.html', { waitUntil: 'domcontentloaded' });
    await ready();
    assert.deepEqual(await page.evaluate(() => chatHandler.getDialogueMessages()), stored.dialogue);
    report.checks.push('Same-tab local navigation preserves dialogue');
    const followUp = '¿Qué horario me acomoda y por qué?';
    const answer = await ask(followUp);
    assert.match(answer, /vespertin/i);
    assert.match(answer, /trabaj|durante el d[ií]a/i);
    assert.doesNotMatch(answer, /necesito saber|me indiques|cu[aá]l es tu preferencia/i);
    assert(report.modelRequests.some(request => request.messages.some(message => message.role === 'user' && message.content === first) && request.messages.some(message => message.role === 'user' && message.content === followUp)), 'Real model request must include the previous user statement');
    report.checks.push('Real Ollama resolves a related question using the prior preference and reason');
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await freshPage.goto(report.baseUrl + '/api/duco/health');
    assert.equal(await freshPage.evaluate(() => sessionStorage.getItem('duco-chat-session')), null);
    await freshContext.close();
    report.checks.push('An independent browser session does not inherit chat storage');
    await page.click('#duco-reset-btn');
    const reset = await page.evaluate(() => ({ id: chatHandler.getSessionId(), dialogue: chatHandler.getDialogueMessages(), stored: JSON.parse(sessionStorage.getItem('duco-chat-session')) }));
    assert.notEqual(reset.id, stored.sessionId);
    assert(!reset.dialogue.some(message => message.type === 'user'));
    assert(!JSON.stringify(reset.stored).includes(first));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready();
    assert(!await page.evaluate(() => chatHandler.getDialogueMessages().some(message => message.type === 'user')));
    const count = report.modelRequests.length;
    await ask('¿Qué horario de estudio prefiero?');
    const resetRequests = report.modelRequests.slice(count);
    assert(resetRequests.length);
    assert(!resetRequests.some(request => request.messages.some(message => message.content.includes(first))));
    report.checks.push('New conversation clears persisted memory and removes old dialogue from real model requests');
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error.stack;
    process.exitCode = 1;
    console.error(error);
  } finally {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    await browser.close();
    console.log(JSON.stringify({ passed: report.passed, checks: report.checks, evidence: output }));
  }
})();
