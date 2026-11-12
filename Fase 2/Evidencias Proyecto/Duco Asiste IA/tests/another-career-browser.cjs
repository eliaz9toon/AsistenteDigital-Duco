const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const responses=[];page.on('console',message=>{if(message.text().startsWith('TEST_RESULT '))responses.push(message.text());});
  await page.goto('http://127.0.0.1:5500/carreras-detalle/ingenieria-en-informatica.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.duco && window.chatHandler?.conversationContext?.lastCareer?.title);
  await page.evaluate(()=>{
   duco.typewriterSpeed=0;duco.openPanel();
   const originalRequest=duco.requestAiResponse.bind(duco);
   duco.requestAiResponse=async(...args)=>{const result=await originalRequest(...args);console.log('TEST_RESULT '+JSON.stringify(result));return result;};
   chatHandler.conversationContext.lastExplanation={path:location.pathname,answer:'La carrera tiene distintas especializaciones.'};
   chatHandler.recordActionOutcome({type:'showEvidence',terms:['texto de la ficha'],evidenceTexts:['Texto de ejemplo']},{success:true},'resalta la explicación');
   const text='me muestras otra carrera cualquiera?';chatHandler.addUserMessage(text);duco.processUserInput(text);
  });
  await page.waitForURL('**/carreras.html',{timeout:90000,waitUntil:'domcontentloaded'}).catch(error=>{error.message+=' Responses: '+JSON.stringify(responses);throw error;});
  await page.waitForFunction(()=>window.ducoHighlighter?.highlightedElement?.classList.contains('bc-card'),null,{timeout:30000}).catch(error=>{error.message+=' Responses: '+JSON.stringify(responses);throw error;});
  const first=await page.evaluate(()=>({title:ducoHighlighter.highlightedElement.querySelector('h3')?.innerText,stored:chatHandler.conversationContext.lastCareer?.title}));
  assert(first.title && first.title===first.stored);
  assert.notEqual(first.title,'Ingeniería en Informática');
  const second=await page.evaluate(async()=>{
   const text='muéstrame otra carrera cualquiera';chatHandler.addUserMessage(text);
   const response=await duco.requestAiResponse(text);
   return {response,stored:chatHandler.conversationContext.lastCareer?.title};
  });
  assert(second.response.actions.some(action=>action.careerCard),JSON.stringify(second.response));
  assert(!second.response.actions.some(action=>action.type==='showEvidence'));
  assert.notEqual(second.stored,first.title);
  assert.notEqual(second.stored,'Ingeniería en Informática');
  console.log('OK: otra carrera abre el buscador y destaca una ficha distinta; otra petición elige una tercera.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
