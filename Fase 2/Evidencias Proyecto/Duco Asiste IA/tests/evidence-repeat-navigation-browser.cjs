const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://127.0.0.1:5500/carreras-detalle/ingenieria-en-informatica.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.duco && document.querySelector('#tab-inicio p'));
  const first=await page.evaluate(async()=>{
   duco.typewriterSpeed=0;duco.openPanel();
   const element=[...document.querySelectorAll('#tab-inicio p')].find(el=>el.innerText.trim().length>100 && el.getClientRects().length);
   if (!element) throw Error('No hay párrafo visible en Inicio');
   const text=element.textContent.replace(/\s+/g,' ').trim();
   const action={type:'showEvidence',terms:['texto de la ficha'],evidenceTexts:[text]};
   await duco.runAssistantFlow(duco.buildFlowFromAiResponse({reply:'Esta es la información.',actions:[action]}),{userText:'muestra el texto'});
   duco.addActionButtons({actions:[action]});
   return {text,count:element.querySelectorAll('.duco-page-highlight').length};
  });
  assert(first.count>0);
  await page.evaluate(()=>{document.querySelector('a[role="tab"][href="#ficha-tecnica"]').click(); window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});});
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>document.querySelector('#tab-inicio').classList.contains('active')),false);
  await page.locator('.duco-action-btn').filter({hasText:'Resaltar texto'}).last().click();
  await page.waitForFunction(()=>document.querySelector('#tab-inicio')?.classList.contains('active') && document.querySelector('#tab-inicio .duco-page-highlight'),null,{timeout:15000});
  const restored=await page.evaluate(()=>({y:scrollY,last:chatHandler.getActionOutcomes().at(-1),marks:document.querySelectorAll('#tab-inicio .duco-page-highlight').length}));
  assert(restored.y<await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight-100));
  assert.equal(restored.last.type,'showEvidence');assert(restored.last.success);assert(restored.marks>0);
  const repeated=await page.evaluate(()=>duco.requestAiResponse('repítelo'));
  assert.equal(repeated.actions[0].type,'showEvidence');
  assert.deepEqual(repeated.actions[0].evidenceTexts,[first.text]);
  await page.evaluate(async()=>{
   window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
   chatHandler.addUserMessage('repítelo');
   await duco.processUserInput('repítelo');
  });
  const replay=await page.evaluate(()=>({y:scrollY,last:chatHandler.getActionOutcomes().at(-1),marks:document.querySelectorAll('#tab-inicio .duco-page-highlight').length}));
  assert.equal(replay.last.type,'showEvidence');assert(replay.last.success);assert(replay.marks>0);
  assert(replay.y<await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight-100));
  console.log('OK: desde otra pestaña y posición, el botón vuelve al texto y lo resalta; repetir conserva el mismo objetivo.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
