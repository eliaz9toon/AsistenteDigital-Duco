// Requiere Ollama local y el sitio en el puerto 5500.
const {chromium}=require('playwright');
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.route('**/*',route=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(route.request().url())?route.continue():route.abort());
    await page.goto('http://127.0.0.1:5500/duoc.html');
    await page.waitForFunction(()=>window.duco);
    const context=await page.evaluate(()=>({navigationMenus:window.duco.getNavigationMenus(),pageVisibleContent:window.duco.getVisiblePageContentForAi()}));
    const sandbox=vm.createContext({window:{},console,fetch,AbortController,setTimeout,clearTimeout});
    vm.runInContext(fs.readFileSync('js/ollama-client.js','utf8'),sandbox);
    for (const text of ['puedes remarcarme un dropdown cualquiera?','en el dropdown admision, remarca el boton de admision duoc uc']) {
      const response=await sandbox.window.ducoAI.generateResponse(text,{context});
      console.log(JSON.stringify({text,reply:response.reply,actions:response.actions}));
      assert(response.reply.length<180,'Una guía visual necesita una frase breve');
      assert(!/Admisión Especial|Tu Primer Paso|Contáctanos|Ir a la sección/i.test(response.reply),'No enumerar opciones ajenas');
      const mark=response.actions.find(action=>['highlightTerms','highlight'].includes(action.type));
      assert(mark,'Debe ejecutar el resaltado');
      if (text.includes('cualquiera')) {
        assert(context.navigationMenus.some(menu=>menu.label.toLowerCase()===mark.terms[0].toLowerCase()));
      } else {
        assert.equal(mark.scope,'opened_menu');
        assert.equal(mark.terms[0],'Admisión Duoc UC');
        assert(response.reply.includes('Admisión Duoc UC'));
      }
    }
    console.log('OK: guía breve de menú y opción específica sin enumerar el resto.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
