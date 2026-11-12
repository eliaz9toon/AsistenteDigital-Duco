const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 let session;
 try {
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  await page.goto('http://127.0.0.1:5500/carreras-detalle/tecnico-en-operaciones-logisticas.html');
  await page.waitForFunction(()=>window.duco?.aiClient && chatHandler.conversationContext.lastCareer);
  await page.waitForTimeout(700);
  session=await page.evaluate(()=>{chatHandler.clearHistory();return chatHandler.getSessionId();});
  fs.writeFileSync('tests/.experience-test-session.json',JSON.stringify({session}));
  const result=await page.evaluate(async()=>{
   await duco.rememberCurrentCareer();duco.typewriterSpeed=0;duco.openPanel();
   const text='explicamelo denuevo';chatHandler.addUserMessage(text);
   const response=await duco.requestAiResponse(text);
   const interaction={sessionId:chatHandler.getSessionId(),interactionId:crypto.randomUUID(),question:text,answer:response.reply,
    interactionType:'navigation',experience:{page:location.pathname,steps:[]}};
   await duco.runAssistantFlow(duco.buildFlowFromAiResponse(response),{userText:text,feedbackInteraction:interaction});
   return {interaction,buttons:document.querySelectorAll('.duco-feedback-controls').length};
  });
  assert.equal(result.buttons,1);
  assert(result.interaction.experience.steps.length);assert(result.interaction.experience.steps.every(step=>step.success));
  const posted=page.waitForResponse(response=>response.url().endsWith('/api/duco/feedback') && response.request().method()==='POST');
  await page.locator('.duco-feedback-btn[aria-label="Sí, me sirvió"]').last().click();
  assert.equal((await posted).status(),201);
  const check=await page.evaluate(async interaction=>{
   const get=async()=> (await (await fetch(duco.knowledgeApiUrl('/api/duco/experiences?query=explicamelo%20denuevo&page='+encodeURIComponent(location.pathname)))).json()).items;
   const positive=await get();
   const update=await fetch(duco.knowledgeApiUrl('/api/duco/feedback'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...interaction,rating:-1})});
   const negative=await get();return {positive,negative,status:update.status};
  },result.interaction);
  assert.equal(check.status,201);assert(check.positive.some(item=>item.verifiedSuccess && item.positive===1));
  assert(check.negative.some(item=>item.negative===1 && !item.verifiedSuccess));
  let consumed=false;
  page.on('request',request=>{
   if(request.url().endsWith('/api/chat')){
    const data=request.postDataJSON();
    if(data.messages.map(item=>item.content).join('\n').includes('"negative":1') && /experiences|EXPERIENCIAS/.test(data.messages.map(item=>item.content).join('\n'))) consumed=true;
   }
  });
  await page.reload();await page.waitForFunction(()=>window.duco?.aiClient && chatHandler.conversationContext.lastCareer);
  await page.evaluate(async()=>{const response=await duco.requestAiResponse('explicamelo denuevo');const action=response.actions.find(item=>item.type==='explainCareer');if(action)await duco.executeFlowAction(action,{userText:'explicamelo denuevo'});});
  assert(consumed,'Las experiencias de Oracle deben llegar a la planificación o explicación de Ollama tras recargar');
  console.log('OK: acción real, pulgar posterior, experiencia Oracle positiva/negativa y uso en Ollama tras recarga.');
 }finally{await browser.close();require('node:child_process').execFileSync('admin-app/.venv/Scripts/python.exe',['tests/cleanup_experience_test.py'],{stdio:'inherit'});}
})().catch(error=>{console.error(error);process.exitCode=1;});
