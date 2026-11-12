// Record genuine app behavior. The edit removes waits; no model replies are fabricated.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const out=path.join(__dirname,'parte2');fs.mkdirSync(path.join(out,'clips'),{recursive:true});
const base='http://127.0.0.1:8765',fiche='/carreras-detalle/ingenieria-en-informatica.html';
const clips=[],proof={date:new Date().toISOString(),modelResponses:[],guidedStages:[],checks:[]};
let browser;
async function ready(p,open=true){
 await p.waitForFunction(()=>window.duco?.aiClient);
 await p.evaluate(open=>{duco.typewriterSpeed=0;if(open)duco.openPanel();else if(duco.isOpen)duco.closePanel();},open);
 await p.waitForTimeout(650);
 await p.evaluate(()=>{
  if(document.querySelector('#pitch-cursor'))return;
  const cursor=document.createElement('div');cursor.id='pitch-cursor';cursor.style.cssText='position:fixed;left:730px;top:435px;width:22px;height:22px;border:3px solid white;background:#005bb5;border-radius:50%;box-shadow:0 2px 12px #0005;z-index:2147483647;pointer-events:none;transition:transform .18s';document.body.append(cursor);
  addEventListener('mousemove',e=>{cursor.style.left=e.clientX-11+'px';cursor.style.top=e.clientY-11+'px';});
  addEventListener('mousedown',()=>cursor.style.transform='scale(.75)');addEventListener('mouseup',()=>cursor.style.transform='scale(1)');
 });
}
async function move(p,selector){const r=await p.locator(selector).first().boundingBox();if(r)await p.mouse.move(r.x+r.width/2,r.y+r.height/2,{steps:24});}
async function newRecording(){
 const context=await browser.newContext({viewport:{width:1440,height:810},recordVideo:{dir:path.join(out,'clips'),size:{width:1440,height:810}}});
 const born=Date.now(),page=await context.newPage();
 await page.route(/google-analytics|googletagmanager|doubleclick|facebook\.com\/tr/,r=>r.abort());
 page.on('response',async r=>{if(new URL(r.url()).pathname==='/api/chat')try{const data=await r.json();proof.modelResponses.push({status:r.status(),model:data.model,content:data.message?.content});}catch{}});
 return {context,page,born,time:()=> (Date.now()-born)/1000};
}
function save(){fs.writeFileSync(path.join(out,'clips.json'),JSON.stringify(clips,null,2));fs.writeFileSync(path.join(out,'demostracion.json'),JSON.stringify(proof,null,2));}
async function finish(recording,name,segments){
 const video=recording.page.video();await recording.context.close();const file=path.join(out,'clips',name+'.webm');await video.saveAs(file);
 for(const s of segments)clips.push({...s,file});save();console.log(JSON.stringify({recording:name,segments:segments.map(s=>s.name)}));
}
(async()=>{
 browser=await chromium.launch({headless:true});
 try{
  const r=await newRecording(),p=r.page,segments=[];
  await p.goto(base+'/duco',{waitUntil:'domcontentloaded'});await ready(p);await p.mouse.move(960,620,{steps:20});
  let start=r.time();await p.waitForTimeout(6500);segments.push({name:'intro',start,duration:r.time()-start});
  start=r.time();const highlighted=await p.evaluate(()=>duco.executeFlowAction({type:'highlightTerms',terms:['Congreso i2T 2026'],duration:15000}));assert(highlighted.success);await p.mouse.move(730,540,{steps:20});await p.waitForTimeout(5600);segments.push({name:'accion',start,duration:r.time()-start});
  proof.checks.push({name:'Real homepage highlight',outcome:highlighted});await p.evaluate(()=>duco.executeFlowAction({type:'clearHighlights'}));
  await p.evaluate(()=>duco.openPanel());await p.waitForTimeout(500);
  start=r.time();await move(p,'#duco-input');await p.locator('#duco-input').pressSequentially('Llevame a Ingenieria en Informatica',{delay:65});await p.waitForTimeout(1000);await move(p,'#duco-send-btn');
  const clickTime=r.time();await p.click('#duco-send-btn');await p.waitForURL('**'+fiche,{timeout:60000});
  segments.push({name:'solicitud',start,duration:clickTime-start+0.2});
  await ready(p);await p.waitForFunction(()=>!duco.isProcessing,null,{timeout:60000});
  assert.equal(new URL(p.url()).pathname,fiche);proof.checks.push({name:'Natural-language navigation via chat',path:new URL(p.url()).pathname});
  start=r.time();await p.mouse.move(940,630,{steps:20});await p.waitForTimeout(6500);segments.push({name:'destino',start,duration:r.time()-start});
  const stageTimes=[];
  await p.exposeFunction('__pitchStage',stage=>{stageTimes.push({start:r.time(),...stage});proof.guidedStages.push(stage);console.log(JSON.stringify({stage:stage.step,sourceCount:stage.sources.length}));});
  await p.evaluate(()=>{
    const display=duco.displayMessage.bind(duco);
    duco.displayMessage=async(text,type,options={})=>{
      const el=await display(text,type,options);
      if(options.guidedStep){await new Promise(r=>setTimeout(r,160));await window.__pitchStage({step:options.guidedStep,text,
        sources:duco.getSourceParagraphElements().filter(el=>el.querySelector('.duco-page-highlight')).map(el=>el.textContent.replace(/\s+/g,' ').trim())});}
      return el;
    };
  });
  const request='Explicame Ingenieria en Informatica y resalta el texto de respaldo a medida que explicas.';
  await p.fill('#duco-input',request);await p.click('#duco-send-btn');
  await p.waitForFunction(()=>!duco.isProcessing&&document.querySelectorAll('[data-guided-step]').length>=2,null,{timeout:210000});
  const saved=await p.evaluate(()=>chatHandler.conversationContext.lastExplanation);assert(saved.blocks.length>=2);assert(stageTimes.length>=2);assert(proof.modelResponses.length);
  for(let i=0;i<2;i++){
   const stage=stageTimes[i],end=stageTimes[i+1]?.start || r.time();
   assert(stage.sources.includes(saved.blocks[i]));segments.push({name:'evidencia'+(i+1),start:stage.start+0.15,duration:Math.min(4.6,end-stage.start-0.4)});
  }
  proof.checks.push({name:'Real AI explanation with source highlights',saved,stages:stageTimes.map(s=>s.step)});
  start=r.time();await p.waitForTimeout(4000);segments.push({name:'contexto_antes',start,duration:r.time()-start});
  const session=await p.evaluate(()=>chatHandler.getSessionId());
  await p.goto(base+'/carreras.html',{waitUntil:'domcontentloaded'});await ready(p);
  assert.equal(await p.evaluate(()=>chatHandler.getSessionId()),session);
  start=r.time();await p.waitForTimeout(800);await move(p,'#duco-input');await p.locator('#duco-input').pressSequentially('Cual fue mi pregunta anterior?',{delay:50});await p.click('#duco-send-btn');await p.waitForFunction(()=>!duco.isProcessing,null,{timeout:60000});await p.waitForTimeout(2300);
  const answer=await p.evaluate(()=>chatHandler.getDialogueMessages().filter(m=>m.type==='assistant').at(-1)?.text);assert(answer.includes(request));
  segments.push({name:'contexto_despues',start,duration:r.time()-start});proof.checks.push({name:'Same session and previous query preserved after manual navigation',session,answer});
  start=r.time();await p.mouse.move(940,640,{steps:25});await p.waitForTimeout(9000);segments.push({name:'cierre',start,duration:r.time()-start});
  await finish(r,'conversacion-real',segments);

  const menu=await newRecording();await menu.page.goto(base+'/duco',{waitUntil:'domcontentloaded'});await ready(menu.page,false);
  start=menu.time();const m=await menu.page.evaluate(()=>duco.executeFlowAction({type:'dropdown',terms:['Oferta Academica']}));assert(m.success);await menu.page.mouse.move(390,160,{steps:20});await menu.page.waitForTimeout(3400);assert(await menu.page.locator('.dropdown-menu.show').count());proof.checks.push({name:'Real dropdown action',outcome:m});await finish(menu,'menu-real',[{name:'menus',start,duration:menu.time()-start}]);

  const tabs=await newRecording();await tabs.page.goto(base+fiche,{waitUntil:'domcontentloaded'});await ready(tabs.page,false);await tabs.page.locator('a[role="tab"]').filter({hasText:/perfil de egreso/i}).first().scrollIntoViewIfNeeded();await tabs.page.waitForTimeout(600);
  start=tabs.time();await tabs.page.waitForTimeout(450);const tab=await tabs.page.evaluate(()=>duco.executeFlowAction({type:'selectPageControl',terms:['Perfil de Egreso Institucional']}));assert(tab.success);await tabs.page.waitForTimeout(2200);proof.checks.push({name:'Real page tab',outcome:tab});await finish(tabs,'pestana-real',[{name:'pestana',start,duration:tabs.time()-start}]);

  const scroll=await newRecording();await scroll.page.goto(base+fiche,{waitUntil:'domcontentloaded'});await ready(scroll.page,false);
  start=scroll.time();await scroll.page.waitForTimeout(500);const s=await scroll.page.evaluate(()=>duco.executeFlowAction({type:'scroll',terms:['Especializaciones']}));assert(s.success);await scroll.page.waitForTimeout(2300);proof.checks.push({name:'Real guided scroll',outcome:s});await finish(scroll,'scroll-real',[{name:'scroll',start,duration:scroll.time()-start}]);
  proof.passed=true;save();
 }catch(e){proof.passed=false;proof.error=e.stack;save();throw e;}
 finally{await browser?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
