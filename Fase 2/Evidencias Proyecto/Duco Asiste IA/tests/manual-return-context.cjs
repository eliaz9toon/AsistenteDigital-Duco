// Requiere el servidor local y Ollama con el modelo configurado.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/*', route => {
      const host = new URL(route.request().url()).hostname;
      return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
    });
    await page.goto('http://127.0.0.1:8765/duco', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.duco?.aiClient);
    await page.evaluate(() => { duco.typewriterSpeed = 0; duco.openPanel(); });
    const session = await page.evaluate(() => chatHandler.getSessionId());
    await page.fill('#duco-input', 'Puedes abrirme las carreras?');
    await page.click('#duco-send-btn');
    await page.waitForURL('**/carreras.html', { timeout: 120000 });
    await page.waitForFunction(() => window.duco?.aiClient);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.duco?.aiClient);
    assert.equal(await page.evaluate(() => chatHandler.getSessionId()), session);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.duco?.aiClient);

    const result = await page.evaluate(async () => {
      const text = 'En qué página estoy ahora y qué te pedí anteriormente?';
      const history = chatHandler.getDialogueMessages();
      chatHandler.addUserMessage(text);
      const response = await duco.requestAiResponse(text);
      const cases = [
        ['Dónde estoy?', '/carreras.html', 'catálogo general'],
        ['En qué página estamos?', '/duco', 'inicio'],
        ['Cuál fue mi última pregunta?', '/duco', 'Puedes abrirme las carreras?']
      ].map(([question, currentPage, expected]) => ({ expected,
        response: duco.aiClient.getConversationStateAnswer(question, history, { currentPage }) }));
      const mixed = duco.aiClient.getConversationStateAnswer('Dónde estoy? Y abre Carreras', history, { currentPage: location.pathname });
      return { response, cases, mixed, path: location.pathname };
    });
    assert.equal(result.path, '/duco');
    assert.equal(result.response.actions.length, 0);
    assert.match(result.response.reply, /inicio/);
    assert.match(result.response.reply, /Puedes abrirme las carreras/);
    for (const item of result.cases) {
      assert(item.response.reply.includes(item.expected), JSON.stringify(item));
      assert.equal(item.response.actions.length, 0);
    }
    assert.equal(result.mixed, null, 'Un pedido mixto debe continuar al interprete de tareas');
    console.log(JSON.stringify(result, null, 2));
    console.log('OK: navegacion real del navegador, regreso manual, recarga, historial y ubicacion actual.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
