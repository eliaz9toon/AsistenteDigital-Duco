const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:5500/duoc.html');
  await page.waitForFunction(()=>window.duco?.aiClient);
  const cases=[['otra opcion por favor','alternative'],['haz lo mismo otra vez','repeat'],['no se abrio nada, revisalo','correction']];
  for(const [text,expected] of cases){
   const result=await page.evaluate(async text=>{
    const client=duco.aiClient;
    return client.decideTurn(text,[{role:'user',content:'Abre el menú Admisión'},{role:'assistant',content:'Voy a abrir Admisión.'}],
     {currentPage:location.pathname,actionOutcomes:[{type:'dropdown',target:['Admisión'],success:true}]},
     async payload=>(await fetch(client.baseUrl+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})).json());
   },text);
   assert.equal(result.mode,expected,JSON.stringify(result));
  }
  const failure=await page.evaluate(async()=>{
   const assistant=Object.create(Object.getPrototypeOf(duco));
   let executed=0;let recoveries=0;const records=[];
   assistant.sleep=async()=>{};assistant.displayMessage=async()=>null;
   assistant.executeFlowAction=async()=>{executed++;throw Error('simulated failure');};
   assistant.requestAiResponse=async()=>{recoveries++;return {reply:'Voy a intentar otra ruta.',actions:[{type:'clearHighlights'}]};};
   const original=chatHandler.recordActionOutcome;
   chatHandler.recordActionOutcome=(action,outcome)=>records.push(outcome);
   try {const outcomes=await assistant.runAssistantFlow([{action:{type:'clearHighlights'}},{action:{type:'clearHighlights'}}],{userText:'limpia los resaltados'});
    return {executed,recoveries,records,outcomes};
   } finally {chatHandler.recordActionOutcome=original;}
  });
  assert.equal(failure.executed,2);assert.equal(failure.recoveries,1);assert.equal(failure.records[0].success,false);
  console.log('OK: intención semántica real (alternativa, repetición, corrección); fallo registrado y secuencia detenida.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
