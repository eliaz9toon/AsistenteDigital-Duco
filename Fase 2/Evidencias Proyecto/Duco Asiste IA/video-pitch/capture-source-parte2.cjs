const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out=path.join(__dirname,'parte2');
(async()=>{
 const proof=JSON.parse(fs.readFileSync(path.join(out,'demostracion.json'),'utf8'));
 const source=proof.guidedStages[1].sources[0];assert(source);
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:810},recordVideo:{dir:path.join(out,'clips'),size:{width:1440,height:810}}});
  const born=Date.now(),p=await context.newPage();
  await p.route(/google-analytics|googletagmanager|doubleclick/,r=>r.abort());
  await p.goto('http://127.0.0.1:8765/carreras-detalle/ingenieria-en-informatica.html',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>window.duco?.aiClient);await p.evaluate(()=>{if(duco.isOpen)duco.closePanel();});await p.waitForTimeout(600);
  const result=await p.evaluate(source=>duco.executeFlowAction({type:'showEvidence',terms:['texto de la ficha'],evidenceTexts:[source],duration:20000}),source);assert(result.success);
  const start=(Date.now()-born)/1000;await p.waitForTimeout(4700);const duration=(Date.now()-born)/1000-start;
  const video=p.video();await context.close();const file=path.join(out,'clips','fuente-sin-panel.webm');await video.saveAs(file);
  const clips=JSON.parse(fs.readFileSync(path.join(out,'clips.json'),'utf8'));clips.push({name:'fuente',file,start,duration});fs.writeFileSync(path.join(out,'clips.json'),JSON.stringify(clips,null,2));
  proof.sourceCloseup={source,outcome:result,note:'Additional view of the same generated source paragraph with the chat panel closed for legibility.'};fs.writeFileSync(path.join(out,'demostracion.json'),JSON.stringify(proof,null,2));
  console.log(JSON.stringify({name:'fuente',start,duration,result}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
