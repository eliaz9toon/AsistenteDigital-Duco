const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { date: new Date().toISOString(), cases: [], turns: [] };
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/*', r => ['127.0.0.1', 'localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8765/duco', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.duco?.aiClient);
    await page.evaluate(() => { duco.typewriterSpeed = 0; duco.openPanel(); });
    async function ask(text) {
      const result = await page.evaluate(async text => {
        chatHandler.addUserMessage(text);
        const response = await duco.requestAiResponse(text);
        if (!response) throw Error('No response from real Ollama');
        chatHandler.addAssistantMessage(response.reply);
        return { response, model: duco.aiClient.model, page: location.pathname };
      }, text);
      report.turns.push({ text, ...result }); console.log(JSON.stringify(report.turns.at(-1)));
      return result.response;
    }
    async function check(id, fn) {
      try { const detail = await fn(); report.cases.push({ id, passed: true, detail }); }
      catch (error) { report.cases.push({ id, passed: false, error: error.message }); process.exitCode = 1; }
    }
    await check('E2-H2-T01 / E2-H2-T02', async () => {
      const answer = await ask('Ábreme eso.');
      assert.equal(answer.actions.length, 0, JSON.stringify(answer));
      assert.match(answer.reply, /[¿?]/);
      return 'Unresolved reference asks for clarification without actions';
    });
    await check('E2-H2-T03', async () => {
      const answer = await ask('Me refiero al menú Admisión.');
      assert(answer.actions.some(a => a.type === 'dropdown' && a.terms.some(t => /admisi[oó]n/i.test(t))), JSON.stringify(answer));
      const results = await page.evaluate(async response => {
        const actions = duco.bindMenuActions(duco.sanitizeActions(response.actions));
        const outcomes = [];
        for (const action of actions) outcomes.push(await duco.executeFlowAction(action));
        return { outcomes, open: document.querySelectorAll('.dropdown-menu.show').length };
      }, answer);
      assert(results.outcomes.length && results.outcomes.every(o => o.success)); assert.equal(results.open, 1);
      return results;
    });
    await page.evaluate(() => duco.resetConversation());
    await check('E2-H2-T01 unrecognized input', async () => {
      const answer = await ask('zxq987 blorf plim');
      assert.equal(answer.actions.length, 0, JSON.stringify(answer));
      assert.match(answer.reply, /[¿?]|no (entiendo|comprendo|reconozco)|reformula|aclar/i);
      return 'Unknown input produces no browser action';
    });
    await page.evaluate(() => duco.resetConversation());
    await check('E2-H2-T04', async () => {
      const answer = await ask('¿Cuál será el arancel exacto en pesos de Ingeniería en Informática en el año 2099? Si no tienes ese dato, indícalo.');
      assert.equal(answer.actions.length, 0, JSON.stringify(answer));
      assert.match(answer.reply, /no (tengo|dispongo|cuento|hay|est[aá]|puedo)|desconozco|no .*disponible|no .*informaci[oó]n/i);
      assert.doesNotMatch(answer.reply, /\$\s*\d|\d[\d.,]*\s*(pesos|CLP)/i);
      return 'No exact unsupported fee is invented';
    });
    await check('Clarification safety guard across all action modes (simulated classifier)', async () => {
      const results = await page.evaluate(async () => {
        const client = duco.aiClient, original = client.decideTurn;
        const responses = [];
        try {
          for (const mode of ['new', 'alternative', 'repeat', 'evidence', 'explain', 'correction']) {
            client.decideTurn = async () => ({ mode, needsClarification: true, operation: 'dropdown', operations: ['dropdown'], destination: 'none', goal: 'Unresolved target' });
            const answer = await client.generateResponse('Solicitud ambigua de prueba', { messages: [], context: { currentPage: location.pathname } });
            responses.push({ mode, actions: answer.actions.length, reply: answer.reply });
          }
          return responses;
        } finally { client.decideTurn = original; }
      });
      assert.equal(results.length, 6);
      for (const result of results) { assert.equal(result.actions, 0); assert.match(result.reply, /[¿?]/); }
      return results;
    });
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  finally {
    report.passed = !report.error && report.cases.length === 5 && report.cases.every(c => c.passed);
    const file = path.join(__dirname, 'evidence', 'sprint4.json');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, cases: report.cases })); await browser.close();
  }
})();
