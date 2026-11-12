const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  await page.goto('http://127.0.0.1:5500/carreras-detalle/tecnico-en-operaciones-logisticas.html');
  await page.waitForFunction(()=>window.duco?.aiClient);await page.waitForTimeout(700);
  const result=await page.evaluate(async()=>{
   chatHandler.clearHistory();await duco.rememberCurrentCareer();duco.typewriterSpeed=0;duco.openPanel();
   const paragraph=duco.getSourceParagraphElements().find(element=>/Destácate/.test(element.textContent));
   const text=paragraph.textContent.replace(/\s+/g,' ').trim();
   chatHandler.conversationContext.lastExplanation={path:location.pathname,answer:text,blocks:[text]};
   chatHandler.addUserMessage('Resalta el texto que usaste para explicar la carrera');chatHandler.addAssistantMessage('Te señalo LA CARRERA.');
   const request='No, te pedí el párrafo explicativo, no el título';chatHandler.addUserMessage(request);
   const response=await duco.requestAiResponse(request);
   const outcomes=await duco.runAssistantFlow(duco.buildFlowFromAiResponse(response),{userText:request});
   return {response,outcomes,marks:paragraph.querySelectorAll('.duco-page-highlight').length};
  });
  assert.equal(result.response.turnDecision.mode,'correction',JSON.stringify(result.response));
  assert(result.response.actions.some(action=>action.type==='showEvidence'),JSON.stringify(result.response));
  assert(result.outcomes.every(outcome=>outcome.success));assert(result.marks>0);
  console.log('OK: corrección de título a párrafo produce un plan revisado y resalta el texto original.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
