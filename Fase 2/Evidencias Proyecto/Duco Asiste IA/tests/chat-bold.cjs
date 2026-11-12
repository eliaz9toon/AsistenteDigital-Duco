const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless:true });
  const report = { date:new Date().toISOString(), checks:[] };
  try {
    const page = await browser.newPage({ reducedMotion:'reduce' });
    await page.route('**/*', r => ['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:8765/duco', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.duco?.aiClient);
    await page.evaluate(() => { duco.openPanel(); duco.typewriterSpeed=0; });
    const rendered = await page.evaluate(async () => {
      const text='**Duración:** 8 semestres. **Escuela:** Informática. Fuente **https://www.duoc.cl/** y https://www.duoc.cl/carreras/.';
      const message=await duco.displayMessage(text);
      const content=message.querySelector('.duco-message-content');
      const result={strong:[...content.querySelectorAll('strong')].map(e=>e.textContent),text:content.textContent,
        links:[...content.querySelectorAll('a')].map(e=>({href:e.href,rel:e.rel})),weight:getComputedStyle(content.querySelector('strong')).fontWeight};
      chatHandler.addAssistantMessage(text);
      return result;
    });
    assert.deepEqual(rendered.strong,['Duración:','Escuela:','https://www.duoc.cl/']);
    assert(!rendered.text.includes('**')); assert.equal(rendered.links.length,2);
    assert(Number(rendered.weight)>=600); assert(rendered.links.every(a=>a.rel.includes('noopener')&&a.rel.includes('noreferrer')));
    report.checks.push('Bold text and HTTP links render together, including a bold URL');
    await page.reload({waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>window.duco?.aiClient);
    assert.equal(await page.locator('#duco-messages strong').count(),3);
    assert.equal(await page.locator('#duco-messages a').count(),2);
    report.checks.push('Session history restores bold and links');
    const safety = await page.evaluate(async () => {
      duco.typewriterSpeed=0;
      const message=await duco.displayMessage('**<img src=x onerror="window.__unsafe=true">** <script>window.__unsafe=true</script> javascript:alert(1) **sin cerrar');
      const user=await duco.displayMessage('**Texto del usuario** <b>literal</b>','user');
      return {images:message.querySelectorAll('img').length,scripts:message.querySelectorAll('script').length,
        unsafe:!!window.__unsafe,links:message.querySelectorAll('a').length,unmatched:message.textContent.endsWith('**sin cerrar'),
        user:user.textContent,userMarkup:user.querySelectorAll('strong,b').length};
    });
    assert.equal(safety.images,0); assert.equal(safety.scripts,0); assert(!safety.unsafe); assert.equal(safety.links,0); assert(safety.unmatched);
    assert.equal(safety.user,'**Texto del usuario** <b>literal</b>'); assert.equal(safety.userMarkup,0);
    report.checks.push('HTML remains literal, unsafe schemes are not linked, unmatched delimiters and user text stay intact');
    const animated = await page.evaluate(async () => {
      duco.typewriterSpeed=1;
      let during=false;
      duco.sleep=async()=>{ if([...document.querySelectorAll('#duco-messages .duco-message-assistant')].at(-1)?.querySelector('strong')) during=true; };
      const message=await duco.displayMessage('**Lista** mientras escribe y **fin**.');
      return {during,strong:[...message.querySelectorAll('strong')].map(e=>e.textContent),text:message.textContent};
    });
    assert(animated.during); assert.deepEqual(animated.strong,['Lista','fin']); assert.equal(animated.text,'Lista mientras escribe y fin.');
    report.checks.push('Bold is applied during typing and remains correct in the final message');
    report.passed=true;
  } catch(error) { report.passed=false; report.error=error.stack; process.exitCode=1; }
  finally {
    fs.writeFileSync(path.join(__dirname,'evidence','chat-bold.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2)); await browser.close();
  }
})();
