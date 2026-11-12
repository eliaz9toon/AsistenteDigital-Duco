const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
      ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:8765/duco', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.duco?.aiClient);
    const result = await page.evaluate(async () => {
      duco.typewriterSpeed = 0;
      const request = 'remarcame la palabra que tu quieras en esta pagina';
      const response = { reply: 'Te señalo Congreso i2T 2026.', actions: [
        { type: 'highlightTerms', terms: ['Congreso i2T 2026'], duration: 6000 }
      ] };
      chatHandler.addUserMessage(request);
      await duco.runAssistantFlow(duco.buildFlowFromAiResponse(response), { userText: request });
      // El resumen no contiene el objetivo: eso no demuestra que falte en el DOM.
      for (const query of ['remarcame el mismo', 'resalta lo mismo']) {
        const repeated = await duco.aiClient.generateResponse(query, {
          messages: chatHandler.getDialogueMessages(), context: {
            currentPage: location.pathname, currentPageText: 'Resumen incompleto',
            actionPlans: chatHandler.getActionPlans(), actionOutcomes: chatHandler.getActionOutcomes()
          }
        });
        const outcomes = await duco.runAssistantFlow(duco.buildFlowFromAiResponse(repeated), { userText: query });
        const span = [...document.querySelectorAll('.duco-page-highlight')].find(el => el.textContent === 'Congreso i2T 2026');
        if (!span?.getClientRects().length || !outcomes.every(item => item.success)) throw Error('Resaltado no visible');
        if (!repeated.actions.some(action => action.terms?.includes('Congreso i2T 2026'))) throw Error('Se perdio el objetivo');
      }
      return { plans: chatHandler.getActionPlans().length, page: location.pathname };
    });
    assert(result.plans >= 3);
    console.log('OK: objetivo conservado y carrusel resaltado tres veces con resumen incompleto.', result);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
