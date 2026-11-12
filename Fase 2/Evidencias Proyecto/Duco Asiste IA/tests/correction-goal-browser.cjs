const {chromium}=require('playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  await page.goto('http://127.0.0.1:5500/carreras-detalle/tecnico-en-operaciones-logisticas.html');
  await page.waitForFunction(()=>window.duco?.aiClient && chatHandler.conversationContext.lastCareer);await page.waitForTimeout(700);
  const session=await page.evaluate(()=>{chatHandler.clearHistory();return chatHandler.getSessionId();});
  fs.writeFileSync('tests/.experience-test-session.json',JSON.stringify({session}));
  const initial=await page.evaluate(async()=>{await duco.rememberCurrentCareer();return duco.requestAiResponse('puedes ir a las carreras?');});
  assert.equal(initial.turnDecision.destination,'careers',JSON.stringify(initial));
  assert(!initial.actions.some(action=>action.careerCard || action.type==='explainCareer'));
  // Ejecutar un objetivo equivocado para comprobar el rechazo posterior real.
  await page.evaluate(async()=>{
   duco.sleep=async()=>{};duco.typewriterSpeed=0;duco.openPanel();
   const question='puedes ir a las carreras?';chatHandler.addUserMessage(question);
   const interaction={sessionId:chatHandler.getSessionId(),interactionId:crypto.randomUUID(),question,answer:'Te señalo LA CARRERA.',interactionType:'navigation',experience:{page:location.pathname,steps:[]}};
   await duco.runAssistantFlow([{text:interaction.answer},{action:{type:'highlightTerms',terms:['LA CARRERA']}}],{userText:question,feedbackInteraction:interaction});
  });
  const corrected=await page.evaluate(async()=>{
   const text='mal alli, te pedi solamente seleccionar carreras';chatHandler.addUserMessage(text);
   const response=await duco.requestAiResponse(text);
   const memory=await duco.getActionExperiences('puedes ir a las carreras?');
   return {response,memory};
  });
  assert.equal(corrected.response.turnDecision.mode,'correction',JSON.stringify(corrected.response));
  assert.equal(corrected.response.turnDecision.destination,'careers',JSON.stringify(corrected.response));
  assert(corrected.memory.some(item=>item.negative>0 && item.experience.correction?.message==='mal alli, te pedi solamente seleccionar carreras'));
  assert(!corrected.response.actions.some(action=>action.careerCard || action.type==='explainCareer'));
  await page.evaluate(response=>duco.runAssistantFlow(duco.buildFlowFromAiResponse(response),{userText:'mal alli, te pedi solamente seleccionar carreras'}),corrected.response).catch(error=>{if(!/context was destroyed/i.test(error.message))throw error;});
  await page.waitForURL('**/carreras.html',{timeout:15000});await page.waitForFunction(()=>window.duco?.aiClient);
  for(const text of ['No es lo que te pedi, selecciona carreras','Nope, solamente te pedi carreras general, no que me buscaras una en especifico']){
   const response=await page.evaluate(async text=>{chatHandler.addUserMessage(text);return duco.requestAiResponse(text);},text);
   assert.equal(response.turnDecision.destination,'careers',JSON.stringify(response));assert.equal(response.actions.length,0,JSON.stringify(response));
  }
  await page.reload();await page.waitForFunction(()=>window.duco?.aiClient);
  const last=await page.evaluate(()=>duco.requestAiResponse('repite eso, solo el catálogo'));
  assert.equal(last.turnDecision.destination,'careers',JSON.stringify(last));assert.equal(last.actions.length,0);
  console.log('OK: catálogo general, correcciones sin elegir otra carrera, rechazo automático guardado en Oracle y objetivo conservado al recargar.');
 }finally{await browser.close();require('node:child_process').execFileSync('admin-app/.venv/Scripts/python.exe',['tests/cleanup_experience_test.py'],{stdio:'inherit'});}
})().catch(error=>{console.error(error);process.exitCode=1;});
