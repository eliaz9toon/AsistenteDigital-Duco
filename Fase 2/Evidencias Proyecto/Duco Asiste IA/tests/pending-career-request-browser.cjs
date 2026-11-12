const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto('http://127.0.0.1:5500/duoc.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.duco);
  await page.evaluate(async()=>{
   duco.typewriterSpeed=0;duco.openPanel();chatHandler.clearHistory();
   const first='señalame "«PERFIL DE EGRESO INSTITUCIONAL»" que se encuentra en la carrera de informatica';
   chatHandler.addUserMessage(first);await duco.processUserInput(first);
   if(chatHandler.getActionOutcomes().length) throw Error('No debe ejecutar acciones mientras la carrera sea ambigua');
   chatHandler.addUserMessage('denuevo');await duco.processUserInput('denuevo');
   const third='lo vi en donde salia la carrera de ingenieria en informatica';
   chatHandler.addUserMessage(third);duco.processUserInput(third);
  });
  await page.waitForURL('**/carreras.html',{timeout:70000}).catch(async error=>{console.log('DIAGNOSTICO',JSON.stringify(await page.evaluate(()=>({messages:chatHandler.getDialogueMessages(),goal:chatHandler.conversationContext.lastRequestedTarget,career:chatHandler.conversationContext.lastCareer}))));throw error;});
  await page.waitForURL('**/carreras-detalle/ingenieria-en-informatica.html',{timeout:40000});
  await page.waitForFunction(()=>window.chatHandler?.conversationContext?.lastRequestedTarget?.pending===false,null,{timeout:30000});
  const result=await page.evaluate(async()=>{
   const text='pero que elemento te pedi seleccionar, recuerdas?';
   chatHandler.addUserMessage(text);
   const answer=await duco.requestAiResponse(text);
   return {answer,goal:chatHandler.conversationContext.lastRequestedTarget};
  });
  assert.match(result.answer.reply,/perfil de egreso institucional/i);
  assert.equal(result.answer.actions.length,0);
  assert.equal(result.goal.pending,false);
  console.log('OK: sesión nueva conserva el objetivo al aclarar carrera, vuelve a la ficha y recuerda lo pedido.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
