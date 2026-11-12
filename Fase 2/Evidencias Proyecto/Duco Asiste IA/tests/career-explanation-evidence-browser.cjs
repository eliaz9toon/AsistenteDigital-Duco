const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  await page.goto('http://127.0.0.1:5500/carreras-detalle/tecnico-en-operaciones-logisticas.html');
  await page.waitForFunction(()=>window.duco?.aiClient);await page.waitForTimeout(700);
  const result=await page.evaluate(async()=>{
   duco.typewriterSpeed=0;duco.openPanel();
   const outcome=await duco.executeFlowAction({type:'explainCareer',terms:['Técnico en Operaciones Logísticas']},{});
   const saved=chatHandler.conversationContext.lastExplanation;
   return {outcome,saved,paragraphMarks:document.querySelectorAll('main p .duco-page-highlight,main li .duco-page-highlight').length,
    titleMarks:document.querySelectorAll('main h2 .duco-page-highlight,main h3 .duco-page-highlight').length,
    navigationMarks:document.querySelectorAll('main nav .duco-page-highlight,main .breadcrumb .duco-page-highlight').length,
    sourceNavigation:duco.getSourceParagraphElements().some(element=>!!element.closest('nav,.breadcrumb,.breadcrumb-carrera')),
    last:chatHandler.getActionOutcomes().at(-1),button:!!document.querySelector('.duco-action-btn')};
  });
  assert(result.outcome.success,JSON.stringify(result));
  assert.equal(result.navigationMarks,0);assert.equal(result.sourceNavigation,false);
  assert(!result.saved.blocks.includes('Técnico en Operaciones Logísticas'));
  assert(result.saved.blocks.length>0);assert(result.paragraphMarks>0);assert.equal(result.titleMarks,0);
  assert.equal(result.last.type,'showEvidence');assert(result.button);
  await page.reload();await page.waitForFunction(()=>window.duco?.aiClient && window.chatHandler?.conversationContext?.lastCareer);
  await page.waitForTimeout(700);
  const repeat=await page.evaluate(async()=>{
   duco.typewriterSpeed=0;duco.openPanel();
   const text='explicamelo denuevo?';chatHandler.addUserMessage(text);
   const response=await duco.requestAiResponse(text);
   const outcomes=await duco.runAssistantFlow(duco.buildFlowFromAiResponse(response),{userText:text});
   return {response,outcomes,saved:chatHandler.conversationContext.lastExplanation,
    marks:document.querySelectorAll('main p .duco-page-highlight,main li .duco-page-highlight').length};
  });
  assert(repeat.response.actions.some(action=>action.type==='explainCareer'),JSON.stringify(repeat.response));
  assert(!repeat.response.actions.some(action=>action.type==='highlightTerms'));
  assert(repeat.outcomes.every(outcome=>outcome.success),JSON.stringify(repeat.outcomes));
  assert(repeat.saved.answer.length>100);assert(repeat.marks>0);
  console.log('OK: explicación con párrafos fuente; tras recargar, «explicamelo denuevo?» vuelve a explicar y resaltar párrafos.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
