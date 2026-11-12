const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://127.0.0.1:5500/carreras-detalle/ingenieria-en-informatica.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.chatHandler?.conversationContext?.lastCareer?.localLink);
  await page.evaluate(()=>{
   chatHandler.recordActionOutcome({type:'highlightTerms',terms:['PERFIL DE EGRESO INSTITUCIONAL']},{success:true},'llevame al perfil');
   chatHandler.recordActionPlan('llevame al perfil',[{type:'highlightTerms',terms:['PERFIL DE EGRESO INSTITUCIONAL']}],[{success:true}]);
   chatHandler.addUserMessage('llevame al perfil de egreso institucional');
   chatHandler.addAssistantMessage('Te señalo el perfil.');
  });
  await Promise.all([page.waitForURL('**/duoc.html'),page.locator('a.navbar-brand').first().click()]);
  await page.waitForFunction(()=>window.duco);
  const answers=await page.evaluate(async()=>{
   const inputs=['ahora ve hacia alla y selecciona el perfil de egreso institucional',
    'señalame "«PERFIL DE EGRESO INSTITUCIONAL»" que se encuentra en la carrera de informatica'];
   const results=[];
   for (const text of inputs){chatHandler.addUserMessage(text);results.push(await duco.requestAiResponse(text));}
   return results;
  });
  for(const answer of answers){
   const actions=answer.actions;
   assert(actions.some(a=>a.type==='navigate' && /ingenieria-en-informatica\.html$/.test(a.target || '')),JSON.stringify(answer));
   assert(actions.some(a=>['selectPageControl','highlightTerms'].includes(a.type) && /perfil de egreso institucional/i.test(a.terms?.[0] || '')));
  }
  await page.evaluate(answer=>{
   duco.typewriterSpeed=0;duco.openPanel();duco.requestAiResponse=async()=>answer;
   duco.processUserInput('ahora ve hacia alla y selecciona el perfil de egreso institucional');
  },answers[0]);
  await page.waitForURL('**/carreras.html',{timeout:30000});
  await page.waitForURL('**/carreras-detalle/ingenieria-en-informatica.html',{timeout:30000});
  await page.waitForFunction(()=>[...document.querySelectorAll('a[role="tab"]')].some(el=>/perfil de egreso institucional/i.test(el.textContent)&&el.getAttribute('aria-selected')==='true'),null,{timeout:30000});
  console.log('OK: sesión real tras volver con el logo; ambas peticiones conservan la carrera y la primera selecciona la pestaña al regresar.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
