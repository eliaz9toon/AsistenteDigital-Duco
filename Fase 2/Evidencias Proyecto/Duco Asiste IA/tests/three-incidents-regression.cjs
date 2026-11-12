const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const base='http://127.0.0.1:8765', fiche='/carreras-detalle/ingenieria-en-informatica.html';
const root=path.join(__dirname,'evidence','correcciones-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(root,{recursive:true});
const catalog=require('../assets/carreras-catalogo.json').map(c=>({title:c.title,localLink:c.local_link,source:c.link}));
const report={date:new Date().toISOString(),cases:[],scope:'Chromium, UI real y pruebas de enrutamiento. Ollama real solo para la explicacion inicial. No telefono fisico.'};
const manifest={marker:'DUCO_EVIDENCE_'+randomUUID().replaceAll('-',''),sessions:[]};
let browser,page,current;
async function ready(){
  await page.waitForFunction(()=>window.duco?.aiClient);await page.evaluate(()=>{duco.typewriterSpeed=0;duco.openPanel();});await page.waitForTimeout(650);
  const id=await page.evaluate(()=>chatHandler.getSessionId());if(!manifest.sessions.includes(id))manifest.sessions.push(id);
}
async function shot(label){
  await page.waitForTimeout(300);const file=current.id+'-'+String(current.images.length+1).padStart(2,'0')+'-'+label+'.png';
  await page.screenshot({path:path.join(root,file),animations:'disabled'});current.images.push({file,label,time:new Date().toISOString()});
}
async function ask(text){
  current.inputs.push(text);await page.fill('#duco-input',text);await page.click('#duco-send-btn');await page.waitForTimeout(250);
  await page.waitForFunction(()=>window.duco?.isProcessing===false,null,{timeout:180000});
  current.replies.push(await page.evaluate(()=>chatHandler.getDialogueMessages().filter(m=>m.type==='assistant').at(-1)?.text));
}
async function check(id,title,route,fn){
  current={id,title,images:[],inputs:[],replies:[],modelResponses:[]};report.cases.push(current);
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page=await context.newPage();
  await page.route(/google-analytics|googletagmanager|doubleclick/,r=>r.abort());
  page.on('response',async r=>{if(new URL(r.url()).pathname==='/api/chat'){const target=current;try{const data=await r.json();target.modelResponses.push({model:data.model,status:r.status(),content:data.message?.content});}catch{}}});
  try{await page.goto(base+route,{waitUntil:'domcontentloaded'});await ready();current.detail=await fn();current.passed=true;}
  catch(e){current.passed=false;current.error=e.stack;process.exitCode=1;try{await shot('fallo');}catch{}}
  finally{console.log(JSON.stringify({id,passed:current.passed,error:current.error?.split('\n')[0],images:current.images.length}));await context.close();fs.writeFileSync(path.join(root,'resultados.json'),JSON.stringify(report,null,2));}
}
(async()=>{
  browser=await chromium.launch({headless:true});report.browser=browser.version();
  try{
    await check('CU-07','Desplazamiento a Vida Estudiantil','/duco',async()=>{
      await page.click('#duco-close-btn');await page.evaluate(()=>scrollTo(0,1600));await page.waitForTimeout(500);await shot('antes-abajo');
      const result=await page.evaluate(async()=>{
        const before=scrollY,samples=[];const timer=setInterval(()=>samples.push(scrollY),30);
        try{const outcome=await duco.executeFlowAction({type:'scroll',terms:['Vida Estudiantil']});
          const el=duco.findScrollTargetByTerms(['Vida Estudiantil']),r=el.getBoundingClientRect();
          const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return {before,after:scrollY,samples,outcome,target:el.textContent.trim(),visible:r.top>=0&&r.bottom<=innerHeight,uncovered:hit===el||el.contains(hit)};
        }finally{clearInterval(timer);}
      });
      assert(result.outcome.success);assert.equal(result.after,0);assert(result.visible&&result.uncovered);assert(result.samples.some(y=>y>0&&y<result.before),'Debe haber posiciones intermedias, no teletransporte');await shot('navbar-visible');
      const missing=await page.evaluate(()=>duco.executeFlowAction({type:'scroll',terms:['No existe ZXQ987']}));assert.equal(missing.success,false);
      const body=await page.evaluate(async()=>{const outcome=await duco.executeFlowAction({type:'scroll',terms:['Admision Duoc UC']});return {outcome,y:scrollY};});assert(body.outcome.success&&body.y>0);await shot('seccion-del-contenido');
      return {result,missing,body};
    });
    await check('CU-15','Corregir del titulo al parrafo explicativo',fiche,async()=>{
      // Produce real source-backed explanation first, not fabricated conversation memory.
      const explained=await page.evaluate(()=>duco.executeFlowAction({type:'explainCareer',terms:['Ingenieria en Informatica'],guided:true}));assert(explained.success);
      const saved=await page.evaluate(()=>chatHandler.conversationContext.lastExplanation);assert(saved.blocks.length>=2);assert(current.modelResponses.length);await shot('explicacion-generada');
      const title=await page.evaluate(()=>duco.executeFlowAction({type:'highlightTerms',terms:['Ingenieria en Informatica'],duration:15000}));assert(title.success);await shot('titulo-antes-de-corregir');
      await ask('No, te pedi el parrafo explicativo, no el titulo. Resalta el texto que usaste para explicar la carrera.');
      const corrected=await page.evaluate(()=>({sources:duco.getSourceParagraphElements().filter(el=>el.querySelector('.duco-page-highlight')).map(el=>el.textContent.replace(/\s+/g,' ').trim()),
        titleMarks:document.querySelectorAll('h1 .duco-page-highlight,h2 .duco-page-highlight,h3 .duco-page-highlight').length,outcomes:chatHandler.getActionOutcomes()}));
      assert(corrected.sources.length);assert(corrected.sources.every(s=>saved.blocks.includes(s)));assert.equal(corrected.titleMarks,0);assert(corrected.outcomes.some(o=>o.type==='showEvidence'&&o.success));await shot('parrafos-corregidos');
      await page.click('#duco-close-btn');await shot('fuentes-sin-panel');
      return {saved,corrected};
    });
    await check('CU-30','Mostrar otra carrera del catalogo',fiche,async()=>{
      const original=await page.evaluate(()=>chatHandler.conversationContext.lastCareer?.title);await shot('carrera-inicial');
      current.inputs.push('me muestras otra carrera cualquiera?');await page.fill('#duco-input',current.inputs.at(-1));await page.click('#duco-send-btn');
      await page.waitForURL('**/carreras.html',{timeout:60000});await ready();
      await page.waitForFunction(()=>!duco.isProcessing&&window.ducoHighlighter?.highlightedElement?.classList.contains('bc-card'),null,{timeout:60000});
      const selected=await page.evaluate(()=>({career:chatHandler.conversationContext.lastCareer,title:ducoHighlighter.highlightedElement.querySelector('h3')?.textContent.trim(),outcomes:chatHandler.getActionOutcomes()}));
      assert(selected.title&&selected.title!==original);assert(catalog.some(c=>c.title===selected.title));assert.equal(selected.career.title,selected.title);await shot('alternativa-real');
      await ask('muestrame otra carrera cualquiera');
      await page.waitForFunction(()=>!duco.isProcessing&&window.ducoHighlighter?.highlightedElement?.classList.contains('bc-card'));
      const next=await page.evaluate(()=>({career:chatHandler.conversationContext.lastCareer,title:ducoHighlighter.highlightedElement.querySelector('h3')?.textContent.trim()}));
      assert(next.title&&next.title!==selected.title&&next.title!==original);assert(catalog.some(c=>c.title===next.title));await shot('segunda-alternativa');
      assert.equal(current.modelResponses.length,0,'Una alternativa sin restricciones debe salir del catalogo, no de texto generativo');return {original,selected,next};
    });
    await check('RUTAS','Limites de los atajos de enrutamiento',fiche,async()=>{
      const data=await page.evaluate(({catalog,fiche})=>{
        const ctx={careerAlternatives:catalog,currentPage:fiche,lastCareer:catalog.find(c=>c.localLink.includes('ingenieria-en-informatica')),evidenceContext:{blocks:['Parrafo fuente real de ejemplo para probar el enrutador.'],answer:'Prueba aislada'}};
        const guided=duco.aiClient.getGuidedCareerResponse('Explica Ingenieria en Informatica y resalta lo importante',ctx);
        const evidence=duco.aiClient.getExplanationEvidenceResponse('Resalta el parrafo explicativo, no el titulo',ctx);
        const negatives=['No me muestres otra carrera','Muestrame otra carrera con horario vespertino','Explicame otra carrera y despues resaltala','Muestrame otra carrera de salud','Cual es otra carrera cualquiera?'];
        return {guided,evidence,negatives:negatives.map(q=>({q,response:duco.aiClient.getAlternativeCareerResponse(q,ctx)})),
          politeAlternative:duco.aiClient.getAlternativeCareerResponse('Puedes mostrarme otra carrera cualquiera?',ctx),
          invalidCatalog:duco.aiClient.getAlternativeCareerResponse('Muestrame otra carrera cualquiera',{...ctx,careerAlternatives:[{title:'Programa inventado',localLink:'https://example.com/externo'}]}),
          questionGuided:duco.aiClient.getGuidedCareerResponse('Me explicas Ingenieria en Informatica y resaltas lo importante?',ctx),
          notGuided:duco.aiClient.getGuidedCareerResponse('Resalta el parrafo explicativo de la carrera',ctx),
          negatedEvidence:duco.aiClient.getExplanationEvidenceResponse('No resaltes el parrafo explicativo',ctx),
          missingEvidence:duco.aiClient.getExplanationEvidenceResponse('Resalta el texto de la explicacion',{currentPage:fiche})};
      },{catalog,fiche});
      assert(data.guided.actions.some(a=>a.type==='explainCareer'&&a.guided));assert.equal(data.evidence.actions[0].type,'showEvidence');assert.equal(data.notGuided,null);assert.equal(data.negatedEvidence,null);
      assert(data.negatives.every(n=>n.response===null));assert.deepEqual(data.missingEvidence.actions,[]);
      assert(data.politeAlternative.actions.some(a=>a.careerCard));assert.deepEqual(data.invalidCatalog.actions,[]);
      assert(data.questionGuided.actions.some(a=>a.type==='explainCareer'&&a.guided));return data;
    });
  } finally {
    fs.writeFileSync(path.join(root,'fixtures.json'),JSON.stringify(manifest,null,2));
    const cleanup=spawnSync(path.join(__dirname,'../admin-app/.venv/Scripts/python.exe'),[path.join(__dirname,'use-case-oracle.py'),'cleanup',path.join(root,'fixtures.json')],{encoding:'utf8',timeout:60000});
    try{report.cleanup=JSON.parse(cleanup.stdout);assert(cleanup.status===0&&report.cleanup.clean);}catch(e){report.cleanup={clean:false,error:cleanup.stderr||e.message};process.exitCode=1;}
    report.passed=report.cases.length===4&&report.cases.every(c=>c.passed)&&report.cleanup.clean;
    fs.writeFileSync(path.join(root,'resultados.json'),JSON.stringify(report,null,2));
    const beforeRoot=path.join(__dirname,'evidence','casos-uso-2026-11-05T14-43-36-650Z');
    for(const c of report.cases){
      const previous=path.join(beforeRoot,c.id+'.json');if(!fs.existsSync(previous))continue;
      const old=JSON.parse(fs.readFileSync(previous));const screenshot=old.images.at(-1);fs.copyFileSync(path.join(beforeRoot,screenshot.file),path.join(root,c.id+'-antes-del-arreglo.png'));fs.copyFileSync(previous,path.join(root,c.id+'-antes.json'));c.before=c.id+'-antes-del-arreglo.png';
    }
    const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    fs.writeFileSync(path.join(root,'index.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Correcciones Duco Asiste</title><style>body{font:17px/1.6 Georgia,serif;color:#17324d;background:#eef3f8;margin:0}main{max-width:1280px;margin:auto;padding:30px}article{background:white;padding:24px;margin:24px 0;border-radius:12px}img{max-width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}a{color:#035bb3}</style><main><h1>Correcciones de CU-07, CU-15 y CU-30</h1><p>${h(report.date)}. Resultado: ${report.passed?'VERIFICADO':'HAY FALLOS'}. ${h(report.scope)}</p><p><a href="resultados.json">Resultados y aserciones</a>. Limpieza Oracle: ${report.cleanup.clean?'confirmada':'no confirmada'}.</p><p>Los escenarios nuevos no eliminan las evidencias anteriores. No certifican todas las variantes posibles de los 31 casos.</p>${report.cases.map(c=>`<article><h2>${c.id}: ${h(c.title)}</h2><p>${c.passed?'VERIFICADO':'FALLO'}</p>${c.error?`<pre>${h(c.error)}</pre>`:''}${c.before?`<h3>Antes del arreglo (ejecucion anterior)</h3><a href="${c.before}"><img src="${c.before}"></a>`:''}<h3>Despues del arreglo</h3>${c.images.map(i=>`<figure><a href="${i.file}"><img src="${i.file}"></a><figcaption>${h(i.label)} - ${h(i.time)}</figcaption></figure>`).join('')}<details><summary>Solicitudes y resultados tecnicos</summary><pre>${h(JSON.stringify(c,null,2))}</pre></details></article>`).join('')}</main></html>`);
    fs.copyFileSync(__filename,path.join(root,'three-incidents-regression.cjs'));
    const files=fs.readdirSync(root).filter(f=>f!=='integridad.json');fs.writeFileSync(path.join(root,'integridad.json'),JSON.stringify(files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')})),null,2));
    await browser.close();console.log(JSON.stringify({output:root,passed:report.passed,cases:report.cases.map(c=>({id:c.id,passed:c.passed})),cleanup:report.cleanup.clean}));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
