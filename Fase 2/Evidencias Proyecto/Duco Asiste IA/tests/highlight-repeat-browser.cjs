const {chromium} = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:800}});
    await page.setContent('<!doctype html><style>body{margin:0}h1{font:28px Arial;width:390px;margin:1200px 0 0 580px}#duco-chat-panel{position:fixed;right:20px;top:10px;width:360px;height:460px;background:white;transform:translateX(var(--duco-chat-shift-x,0px));transition:transform .35s}footer{height:1500px}</style><h1 id="target">Una frase de prueba</h1><footer></footer><div id="duco-assistant-container"><div id="duco-chat-panel" class="open"><div id="messages"><div class="duco-message-assistant">Respuesta de prueba</div></div></div></div>');
    await page.addScriptTag({content:fs.readFileSync('js/ui-highlighter.js','utf8')});
    await page.addScriptTag({content:fs.readFileSync('js/duco-assistant.js','utf8').split('// Inicializar Duco cuando')[0]+';window.testAssistant=Object.create(DucoAssistant.prototype);testAssistant.messagesId="messages";'});
    await page.evaluate(async () => {
      const action={type:'highlightTerms',terms:['Una frase de prueba'],duration:4500,closeTransientUi:false};
      await testAssistant.executeFlowAction(action);
      window.firstMark=document.querySelector('#target .duco-page-highlight-bg');
      testAssistant.addActionButtons({actions:[action]});
    });
    await page.waitForTimeout(3300);
    const before = await page.evaluate(() => ({
      left:document.querySelector('#duco-chat-panel').getBoundingClientRect().left,
      color:getComputedStyle(document.querySelector('#target .duco-page-highlight-bg')).backgroundColor
    }));
    assert(Math.abs(before.left-20)<2, 'El chat debe apartarse con 20px de margen');
    assert.equal(before.color,'rgb(255, 224, 130)');
    await page.locator('.duco-action-btn').click();
    await page.waitForFunction(() => !window.firstMark.isConnected);
    await page.waitForTimeout(2400);
    const repeated = await page.evaluate(() => {
      const marks=document.querySelectorAll('#target .duco-page-highlight-bg');
      return {count:marks.length,color:marks[0] && getComputedStyle(marks[0]).backgroundColor,
        left:document.querySelector('#duco-chat-panel').getBoundingClientRect().left,
        fallback:document.querySelector('#target').classList.contains('duco-highlight')};
    });
    assert.equal(repeated.count,1,'Recrear un único marcador de texto');
    assert.equal(repeated.color,'rgb(255, 224, 130)','El temporizador anterior no debe quitar el amarillo nuevo');
    assert.equal(repeated.fallback,false,'No sustituir el amarillo por el contorno de respaldo');
    assert(Math.abs(repeated.left-20)<2,'El temporizador anterior tampoco debe devolver el chat encima');
    await page.waitForTimeout(3200);
    assert.equal(await page.locator('#target .duco-page-highlight').count(),0);
    assert.equal(await page.locator('#target').textContent(),'Una frase de prueba');
    console.log('OK Chromium: acción automática y botón repiten el amarillo con el chat apartado, sin temporizadores anteriores ni marcadores duplicados.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
