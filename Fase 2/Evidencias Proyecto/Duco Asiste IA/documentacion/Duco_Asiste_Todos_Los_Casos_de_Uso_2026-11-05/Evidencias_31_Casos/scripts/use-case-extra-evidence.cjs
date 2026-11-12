// Additional boundary states, retained separately from the first execution.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2]);
const results = JSON.parse(fs.readFileSync(path.join(root, 'resultados.json'), 'utf8'));
const extra = { date: new Date().toISOString(), scenarios: process.env.DUCO_EXTRA_ONLY ? JSON.parse(fs.readFileSync(path.join(root,'complementarias.json'),'utf8')).scenarios : [] };
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const [id,title,route,run] of [
      ['CU-01','Consulta vacia no enviada','/duco',async p=>{
        const before=await p.locator('.duco-message-user').count();await p.fill('#duco-input','   ');await p.press('#duco-input','Enter');
        assert.equal(await p.locator('.duco-message-user').count(),before);return {messages:before,processing:await p.evaluate(()=>duco.isProcessing)};
      }],
      ['CU-03','Buscador sin coincidencias','/carreras.html',async p=>{
        await p.click('#duco-close-btn');await p.fill('#carrera-search','ZXQ987SINCOINCIDENCIAS');
        await p.waitForFunction(()=>!document.querySelector('#resultados-carreras .bc-card'));
        await p.locator('#carrera-search').scrollIntoViewIfNeeded();return {visible:await p.locator('#resultados-carreras').innerText()};
      }],
      ['CU-07','Desplazamiento a Admision Duoc UC','/duco',async p=>{
        await p.click('#duco-close-btn');
        return p.evaluate(async()=>{
          scrollTo(0,0);const target=[...document.querySelectorAll('h2,h3')].find(el=>/Admisi[o\u00f3]n Duoc UC/i.test(el.textContent)&&el.getClientRects().length);
          if(!target)throw Error('No se encontro el encabezado real esperado');
          const before=scrollY;const outcome=await duco.executeFlowAction({type:'scroll',terms:[target.textContent.trim()]});
          await new Promise(r=>setTimeout(r,1000));if(!outcome.success||scrollY<=before)throw Error('No avanzo hacia el contenido');
          return {outcome,before,after:scrollY,target:target.textContent.trim()};
        });
      }],
      ['CU-08','Contenido inexistente no se informa como resaltado','/duco',async p=>{
        const out=await p.evaluate(()=>duco.runAssistantFlow([{action:{type:'highlightTerms',terms:['ZXQ987NOEXISTE']}}]));
        assert(out.some(o=>o.success===false));return {outcomes:out,text:await p.locator('#duco-messages').innerText()};
      }],
      ['CU-09','Parrafo fuente sin el chat encima','/carreras-detalle/ingenieria-en-informatica.html',async p=>{
        const original=results.cases.find(c=>c.id==='CU-05');const model=original.modelResponses.find(r=>{try{return JSON.parse(r.content).steps;}catch{return false;}});assert(model);
        await p.click('#duco-close-btn');
        return p.evaluate(async()=>{
          const source=duco.getSourceParagraphElements().map(el=>el.textContent.replace(/\s+/g,' ').trim()).find(text=>text.length>=60&&text.length<=800);if(!source)throw Error('Sin parrafo fuente');
          const outcome=await duco.executeFlowAction({type:'showEvidence',terms:['texto de la ficha'],evidenceTexts:[source],duration:20000});if(!outcome.success)throw Error('Respaldo no localizado');return {outcome,source};
        });
      }],
      ['CU-11','Cierre automatico tras respuesta con menu','/duco',async p=>{
        // Control only the model plan to isolate the real lifecycle and timer.
        await p.evaluate(()=>{duco.requestAiResponse=async()=>({reply:'Abro el menu solicitado.',actions:[{type:'dropdown',terms:['Admision']}]});});
        await p.fill('#duco-input','Abre el menu Admision');await p.click('#duco-send-btn');
        await p.waitForFunction(()=>!duco.isProcessing);const opened=await p.locator('.dropdown-menu.show').count();assert.equal(opened,1);
        await p.screenshot({path:path.join(root,'CU-11-extra-antes-del-cierre-automatico.png'),animations:'disabled'});
        await p.waitForTimeout(5500);const remaining=await p.locator('.dropdown-menu.show').count();assert.equal(remaining,0);
        return {opened,remaining,model:'Plan controlado, no es una respuesta generada por IA'};
      }],
    ]) {
      if(process.env.DUCO_EXTRA_ONLY && process.env.DUCO_EXTRA_ONLY!==id) continue;
      const c={id,title,status:'VERIFICADO',images:[],scope:id==='CU-11'?'Plan de IA simulado; temporizador y ciclo UI reales':'UI o motor real; sin servicio de IA generativa'};extra.scenarios.push(c);
      const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const p=await context.newPage();
      try {
        await p.route(/google-analytics|googletagmanager|doubleclick/,r=>r.abort());
        await p.goto('http://127.0.0.1:8765'+route,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.duco?.aiClient);
        await p.evaluate(()=>{duco.typewriterSpeed=0;duco.openPanel();});await p.waitForTimeout(700);
        c.detail=await run(p);await p.waitForTimeout(450);
      }catch(e){c.status='FALLO';c.error=e.stack;}
      const file=id+'-extra-'+title.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png';
      try{await p.screenshot({path:path.join(root,file),animations:'disabled'});c.images.push(file);if(id==='CU-11')c.images.unshift('CU-11-extra-antes-del-cierre-automatico.png');}catch(e){c.captureError=e.message;}
      await context.close();console.log(JSON.stringify(c));
    }
  } finally {
    fs.writeFileSync(path.join(root,'complementarias.json'),JSON.stringify(extra,null,2));await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
