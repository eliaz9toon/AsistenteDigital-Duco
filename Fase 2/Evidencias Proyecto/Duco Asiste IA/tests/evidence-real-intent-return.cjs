const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://127.0.0.1:5500/carreras-detalle/ingenieria-en-informatica.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.duco && document.querySelector('#tab-inicio p'));
  await page.evaluate(()=>{
   duco.typewriterSpeed=0;duco.openPanel();chatHandler.clearHistory();
   const answer='La carrera de Ingeniería en Informática forma profesionales en creación y análisis de tecnologías de información, con distintas especializaciones.';
   const blocks=[...document.querySelectorAll('main h2,main h3,main p,main li')].map(el=>el.textContent.replace(/\s+/g,' ').trim()).filter(t=>t.length>=25 && t.length<=800).slice(0,35);
   // Una conversación anterior puede no tener los bloques guardados todavía.
   chatHandler.conversationContext.lastExplanation={path:location.pathname,answer};
   chatHandler.addAssistantMessage(answer);
   document.querySelector('a[role="tab"][href="#ficha-tecnica"]').click();
  });
  await page.waitForFunction(()=>!document.querySelector('#tab-inicio').classList.contains('active'));
  const before=await page.evaluate(()=>({inicio:document.querySelector('#tab-inicio').classList.contains('active'),blocks:duco.getEvidenceContext()?.blocks.length}));
  assert.equal(before.inicio,false);assert(before.blocks>0,'Debe incluir textos de Inicio aunque la pestaña esté oculta');
  const first=await page.evaluate(async()=>{
   const text='resáltame dónde aparece esa información de Ingeniería en Informática';
   chatHandler.addUserMessage(text);
   const response=await duco.requestAiResponse(text);
   const original=duco.requestAiResponse;
   duco.requestAiResponse=async()=>response;
   await duco.processUserInput(text);
   duco.requestAiResponse=original;
   return {actions:response.actions,last:chatHandler.getActionOutcomes().at(-1),active:document.querySelector('#tab-inicio').classList.contains('active'),
    marked:[...document.querySelectorAll('#tab-inicio p .duco-page-highlight')].map(el=>el.textContent)};
  });
  assert.equal(first.actions[0]?.type,'showEvidence');
  assert(first.active && first.last.success && first.marked.join(' ').length>100,'Debe marcar párrafos, no solo el título');
  await page.evaluate(()=>document.querySelector('a[role="tab"][href="#ficha-tecnica"]').click());
  await page.waitForFunction(()=>!document.querySelector('#tab-inicio').classList.contains('active'));
  const repeat=await page.evaluate(async()=>{
   const text='repítelo';chatHandler.addUserMessage(text);const response=await duco.requestAiResponse(text);
   const original=duco.requestAiResponse;duco.requestAiResponse=async()=>response;
   await duco.processUserInput(text);duco.requestAiResponse=original;
   return {actions:response.actions,active:document.querySelector('#tab-inicio').classList.contains('active'),
    marked:[...document.querySelectorAll('#tab-inicio p .duco-page-highlight')].map(el=>el.textContent).join(' ')};
  });
  assert.equal(repeat.actions[0]?.type,'showEvidence');
  assert(repeat.active && repeat.marked.length>100,'Repetir debe regresar a Inicio y mostrar los párrafos');
  await page.evaluate(()=>{document.querySelector('a[role="tab"][href="#ficha-tecnica"]').click();scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});});
  await page.waitForTimeout(500);
  await page.locator('.duco-action-btn').filter({hasText:'Resaltar texto'}).last().click();
  await page.waitForFunction(()=>document.querySelector('#tab-inicio').classList.contains('active') && document.querySelectorAll('#tab-inicio p .duco-page-highlight').length>1,null,{timeout:15000});
  const result=await page.evaluate(()=>({active:document.querySelector('#tab-inicio').classList.contains('active'),
   marked:[...document.querySelectorAll('#tab-inicio p .duco-page-highlight')].map(e=>e.textContent).join(' '),last:chatHandler.getActionOutcomes().at(-1)}));
  assert(result.active && result.last.success && result.marked.length>100);
  console.log('OK: petición interpretada por Ollama desde Perfil vuelve a Inicio y resalta párrafos; la vista previa repite ese recorrido.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
