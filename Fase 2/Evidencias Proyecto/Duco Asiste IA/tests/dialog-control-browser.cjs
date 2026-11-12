const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5500/carreras-detalle/ingenieria-en-informatica.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.duco && document.querySelector('.dfc-btn-video'));
  const result=await page.evaluate(async()=>{
   duco.typewriterSpeed=0;duco.openPanel();
   chatHandler.addUserMessage('abreme el video que sale en video de la carrera?');
   chatHandler.addAssistantMessage('No encontré un enlace local para continuar.');
   const vals=[];
   for(const text of ['abreme el video que sale en video de la carrera?','deberia ser este elemento:',
    '<button type="button" class="dfc-btn-video" aria-haspopup="dialog" aria-controls="dfc-modal-video-carrera">Video de la carrera</button>']) {
     vals.push({text,actions:(await duco.requestAiResponse(text)).actions});
   }
   const outcome=await duco.executeFlowAction(vals[0].actions[0]);
   const modal=document.querySelector('#dfc-modal-video-carrera');
   return {vals,outcome,hidden:modal.hidden,iframe:modal.querySelector('iframe').getAttribute('src')};
  });
  console.log(JSON.stringify(result));
  assert.equal(result.vals[0].actions[0]?.type,'clickControl');
  assert.equal(result.vals[1].actions.length,0);
  assert.equal(result.vals[2].actions[0]?.type,'clickControl');
  assert(result.outcome.success && !result.hidden && result.iframe);
  console.log('OK: intención y correcciones activan el botón real y abren el video.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
