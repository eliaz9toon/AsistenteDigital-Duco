const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5500/duoc.html');
  await page.waitForFunction(()=>window.duco?.aiClient);
  await page.waitForTimeout(700);
  const before=await page.evaluate(async()=>{
   chatHandler.clearHistory();duco.sleep=async()=>{};duco.displayMessage=async()=>null;
   const text='Abre el menú Admisión';chatHandler.addUserMessage(text);
   const response={reply:'Voy a abrir el menú Admisión.',actions:[{type:'dropdown',terms:['Admisión']}]};
   await duco.runAssistantFlow(duco.buildFlowFromAiResponse(response),{userText:text});
   // Un flujo largo no debe desplazar los turnos del usuario del contexto.
   for(let i=0;i<55;i++) chatHandler.addAssistantMessage('📂 Abriendo menú: Admisión');
   return {response,outcomes:chatHandler.getActionOutcomes(),dialogue:chatHandler.getDialogueMessages(),session:chatHandler.getSessionId()};
  });
  assert(before.outcomes.length,'La petición inicial debe ejecutar una acción');
  assert(before.dialogue.some(message=>message.type==='user' && message.text==='Abre el menú Admisión'));
  await page.reload();await page.waitForFunction(()=>window.duco?.aiClient);await page.waitForTimeout(700);
  const after=await page.evaluate(async()=>{
   const dialogue=chatHandler.getDialogueMessages();
   const outcomes=chatHandler.getActionOutcomes();
   const text='vuelve a abrir ese mismo menú';chatHandler.addUserMessage(text);
   return {dialogue,outcomes,session:chatHandler.getSessionId(),response:await duco.requestAiResponse(text)};
  });
  assert.equal(after.session,before.session);assert.deepEqual(after.dialogue,before.dialogue);
  assert(after.outcomes.length && after.outcomes.every(item=>item.historical));
  assert(after.response.actions.some(action=>action.type==='dropdown' && action.terms.some(term=>/admisi/i.test(term))),JSON.stringify(after.response));
  assert(!after.dialogue.some(message=>/^📂/.test(message.text)));
  await page.evaluate(()=>chatHandler.clearHistory());
  await page.reload();await page.waitForFunction(()=>window.chatHandler);
  assert.equal(await page.evaluate(()=>chatHandler.getDialogueMessages().some(message=>message.type==='user')),false);
  console.log('OK: sesión y diálogo sobreviven recarga sin avisos de acciones; Ollama conserva referencia a Admisión; Nueva conversación borra memoria.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
