const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://127.0.0.1:5500/carreras-detalle/ingenieria-en-informatica.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.duco && [...document.querySelectorAll('a')].some(e=>/perfil de egreso institucional/i.test(e.textContent)));
  const result=await page.evaluate(async()=>{
   duco.typewriterSpeed=0;duco.openPanel();
   const text='llevame donde dice, perfil de egreso institucional';
   chatHandler.addUserMessage(text);
   const first=await duco.requestAiResponse(text);
   chatHandler.addAssistantMessage('Indícame cuál es el elemento y lo intento.');
   const next='esta en este sitio, buscalo';
   chatHandler.addUserMessage(next);
   const second=await duco.requestAiResponse(next);
   const outcome=await duco.executeFlowAction(first.actions[0]);
   return {first,second,outcome,y:scrollY};
  });
  for(const answer of [result.first,result.second]) {
   assert.equal(answer.actions[0]?.type,'highlightTerms');
   assert.match(answer.actions[0].terms[0],/perfil de egreso institucional/i);
  }
  assert(result.outcome.success);
  console.log('OK: objetivo explícito y continuación tras una respuesta fallida encuentran el perfil en la página.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
