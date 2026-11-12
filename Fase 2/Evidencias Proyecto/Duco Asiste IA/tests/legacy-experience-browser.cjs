const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5500/carreras.html');
  await page.waitForFunction(()=>window.duco?.aiClient);
  const result=await page.evaluate(async()=>{
   const text='llevame a la pagina principal';chatHandler.addUserMessage(text);
   return {response:await duco.requestAiResponse(text),experiences:await duco.getActionExperiences(text)};
  });
  const response=result.response;
  assert(result.experiences.some(item=>item.experience.origin==='legacy' && item.negative>0),'Las valoraciones antiguas deben estar disponibles para la planificación');
  assert.equal(response.actions.length,1,JSON.stringify(response));
  assert.equal(response.actions[0].type,'navigate');assert.deepEqual(response.actions[0].terms,['logo']);
  console.log('OK: Errores históricos disponibles; la navegación al inicio cumple el objetivo actual sin repetir el cierre de menú.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
