const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5500/carreras-detalle/ingenieria-en-informatica.html');
  await page.waitForFunction(()=>window.duco?.aiClient);
  const response=await page.evaluate(async()=>{
   const history=[{type:'user',text:'abre un dropdown y despues cierralo'},
    {type:'assistant',text:'Abro el menú y después lo cierro.'},
    {type:'user',text:'llevame a la pagina principal'},
    {type:'assistant',text:'Cierro el menú desplegable.'}];
   const context={currentPage:location.pathname,navigationMenus:duco.getNavigationMenus(),
    actionOutcomes:[{type:'closeDropdown',success:true}],actionPlans:[{request:'abre y cierra un dropdown',actions:[{type:'dropdown',terms:['Oferta Académica']},{type:'closeDropdown'}]}]};
   const direct=await duco.aiClient.generateResponse('llevame a la pagina principal',{messages:history,context});
   const correction=await duco.aiClient.generateResponse('Nope, no es lo que te pedi',{messages:history,context});
   return {direct,correction};
  });
  for(const result of Object.values(response)){
   assert.equal(result.actions.length,1,JSON.stringify(result));
   assert.equal(result.actions[0].type,'navigate');assert.deepEqual(result.actions[0].terms,['logo']);
  }
  await page.evaluate(async response=>{duco.sleep=async()=>{};duco.displayMessage=async()=>null;await duco.runAssistantFlow(duco.buildFlowFromAiResponse(response),{userText:'llevame a la pagina principal'});},response.direct).catch(error=>{if(!/context was destroyed/i.test(error.message)) throw error;});
  await page.waitForURL('**/duoc.html',{timeout:15000});
  console.log('OK: petición y corrección ignoran menú anterior; navegación real por logo hacia duoc.html.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
