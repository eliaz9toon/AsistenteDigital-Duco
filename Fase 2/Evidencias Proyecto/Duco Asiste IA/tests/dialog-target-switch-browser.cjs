const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://127.0.0.1:5500/carreras-detalle/ingenieria-en-informatica.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.duco && document.querySelector('.dfc-btn-video'));
  const result=await page.evaluate(async()=>{
   duco.typewriterSpeed=0;duco.openPanel();
   const ask='abreme el boton que dice "video de la carrera"?';
   chatHandler.addUserMessage(ask);
   const video=await duco.requestAiResponse(ask);
   await duco.executeFlowAction(video.actions[0]);
   chatHandler.addAssistantMessage('Voy a abrir «Video de la carrera».');
   const requests=['llevame donde dice, perfil de egreso institucional','buscalo tu','el elemento llamado "Perfil de egreso institucional"'];
   const answers=[];
   for(const text of requests){chatHandler.addUserMessage(text);const answer=await duco.requestAiResponse(text);answers.push(answer);chatHandler.addAssistantMessage(answer.reply);}
   const outcome=await duco.executeFlowAction(answers[0].actions[0]);
   return {video:video.actions,answers:answers.map(a=>({reply:a.reply,actions:a.actions})),outcome,
    modalClosed:document.querySelector('#dfc-modal-video-carrera').hidden,scroll:scrollY};
  });
  console.log(JSON.stringify(result));
  assert.equal(result.video[0].type,'clickControl');
  for(const answer of result.answers){assert.equal(answer.actions[0]?.type,'highlightTerms');assert.match(answer.actions[0].terms[0],/perfil de egreso institucional/i);}
  assert(result.outcome.success);assert(result.modalClosed);
  console.log('OK: objetivo nuevo y referencia posterior guían al perfil sin reabrir el vídeo.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
