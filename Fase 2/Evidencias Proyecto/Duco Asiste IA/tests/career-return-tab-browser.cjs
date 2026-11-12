const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://127.0.0.1:5500/duoc.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.duco);
  await page.evaluate(async()=>{
   duco.typewriterSpeed=0;duco.openPanel();
   const catalog=await (await fetch('/assets/carreras-catalogo.json')).json();
   const career=catalog.find(x=>x.title==='Ingeniería en Informática');
   chatHandler.conversationContext.lastCareer={title:career.title,source:career.link,localLink:career.local_link};
   chatHandler.conversationContext.actionPlans=[{request:'resalta el perfil',actions:[{type:'highlightTerms',terms:['PERFIL DE EGRESO INSTITUCIONAL']}],outcomes:[{success:true}]}];
   chatHandler.addUserMessage('llevame al perfil de egreso institucional');
   chatHandler.addAssistantMessage('Te señalo el perfil.');
   chatHandler.addUserMessage('ahora ve hacia alla y selecciona el perfil de egreso institucional');
   duco.processUserInput('ahora ve hacia alla y selecciona el perfil de egreso institucional');
  });
  await page.waitForURL('**/carreras.html',{timeout:60000});
  await page.waitForURL('**/carreras-detalle/ingenieria-en-informatica.html',{timeout:40000});
  await page.waitForFunction(()=>[...document.querySelectorAll('a[role="tab"]')].some(el=>/perfil de egreso institucional/i.test(el.textContent) && el.getAttribute('aria-selected')==='true'),null,{timeout:30000});
  const state=await page.evaluate(()=>({selected:document.querySelector('a[role="tab"][href="#ficha-tecnica"]')?.getAttribute('aria-selected'),open:duco.isOpen,messages:chatHandler.getAllMessages().map(m=>m.text)}));
  assert.equal(state.selected,'true');assert(state.open);
  const direct=await page.evaluate(async()=>{
   const text='selecciona el perfil de egreso institucional';
   chatHandler.addUserMessage(text);
   const response=await duco.requestAiResponse(text);
   return response.actions[0]?.type;
  });
  assert.equal(direct,'selectPageControl');
  console.log('OK: inicio → carreras → ficha anterior → pestaña de perfil seleccionada; conversación abierta.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
