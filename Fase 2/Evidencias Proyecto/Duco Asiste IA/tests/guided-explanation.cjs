const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const careers = require('../assets/carreras-catalogo.json').map(c=>({title:c.title,localLink:c.local_link,source:c.link}));
const request = 'puedes irme resaltando a medida que me vayas explicando que es ingenieria en informatica?';
const destination = '/carreras-detalle/ingenieria-en-informatica.html';

(async()=>{
  const browser = await chromium.launch({headless:true});
  const report = {date:new Date().toISOString(),cases:[]};
  async function check(name,route,run) {
    const context=await browser.newContext({reducedMotion:'reduce'});
    const page=await context.newPage();
    try {
      await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
      await page.goto('http://127.0.0.1:8765'+route,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.duco?.aiClient);
      await page.evaluate(()=>{duco.typewriterSpeed=0;duco.openPanel();duco.getGuidedStepReadingDelay=()=>120;});
      const detail=await run(page);report.cases.push({name,passed:true,detail});
    }catch(error){report.cases.push({name,passed:false,error:error.stack});process.exitCode=1;}
    finally{await context.close();}console.log(JSON.stringify(report.cases.at(-1)));
  }
  try {
    await check('Combined request plans explanation, not a title highlight','/duco',async page=>{
      const result=await page.evaluate(({careers,request,destination})=>{
        const context={careerAlternatives:careers,currentPage:'/duco'};
        return {plan:duco.aiClient.getGuidedCareerResponse(request,context),
          here:duco.aiClient.getGuidedCareerResponse(request,{...context,currentPage:destination}),
          denied:duco.aiClient.getGuidedCareerResponse('Explica Ingeniería en Informática pero no resaltes nada',context),
          unrelated:duco.aiClient.getGuidedCareerResponse('Explica el texto de admisión y resalta lo importante',context),
          ambiguous:duco.aiClient.getGuidedCareerResponse('Explica y resalta una carrera',context)};
      },{careers,request,destination});
      assert.deepEqual(result.plan.actions.map(a=>a.type),['navigate','explainCareer']);
      assert.equal(result.plan.actions[1].guided,true);
      assert.deepEqual(result.here.actions.map(a=>a.type),['explainCareer']);
      assert.equal(result.denied,null);assert.equal(result.unrelated,null);assert.deepEqual(result.ambiguous.actions,[]);return result;
    });
    await check('Real UI navigation and real AI plan execute evidence before each explanation','/duco',async page=>{
      let calls=0;page.on('request',r=>{if(new URL(r.url()).pathname==='/api/chat')calls++;});
      await page.fill('#duco-input',request);await page.click('#duco-send-btn');
      await page.waitForURL('**'+destination,{timeout:60000});await page.waitForFunction(()=>window.duco?.aiClient);
      await page.evaluate(()=>{
        duco.typewriterSpeed=0;duco.getGuidedStepReadingDelay=()=>120;window.__stages=[];window.__pauses=0;
        const display=duco.displayMessage.bind(duco),sleep=duco.sleep.bind(duco);
        duco.sleep=ms=>{if(ms===120)window.__pauses++;return sleep(ms);};
        duco.displayMessage=async(text,type,options={})=>{
          if(options.guidedStep)window.__stages.push({step:options.guidedStep,text,locked:duco.isProcessing,
            sources:duco.getSourceParagraphElements().filter(el=>el.querySelector('.duco-page-highlight')).map(el=>el.textContent.replace(/\s+/g,' ').trim())});
          return display(text,type,options);
        };
      });
      await page.waitForFunction(()=>!duco.isProcessing&&window.__stages?.length>=2,null,{timeout:180000});
      const result=await page.evaluate(()=>({stages:window.__stages,pauses:window.__pauses,
        saved:chatHandler.conversationContext.lastExplanation,model:duco.aiClient.model,
        outcomes:chatHandler.getActionOutcomes(),feedbackAnswer:chatHandler.conversationContext.lastActionInteraction?.answer,
        visibleSteps:document.querySelectorAll('[data-guided-step]').length}));
      assert(calls>=1,'The explanation must use real AI');assert(result.stages.length>=2&&result.stages.length<=4);
      assert.equal(result.visibleSteps,result.stages.length);assert.equal(result.pauses,result.stages.length);
      result.stages.forEach((s,i)=>{assert(s.locked);assert(s.sources.includes(result.saved.blocks[i]),JSON.stringify(s));});
      assert.equal(new Set(result.saved.blocks).size,result.stages.length);
      assert.equal(result.feedbackAnswer,result.saved.answer);
      assert(result.outcomes.some(o=>o.type==='explainCareer'&&o.success));return result;
    });
    await check('Invalid AI evidence is rejected before any explanatory stage',destination,async page=>{
      const result=await page.evaluate(async()=>{
        const client=duco.aiClient,fetchOriginal=window.fetch,online=client.isServerOnline;
        client.isServerOnline=async()=>true;
        window.fetch=async(url,options)=>String(url).endsWith('/api/chat')?{ok:true,json:async()=>({message:{content:JSON.stringify({steps:[{explanation:'Texto sin respaldo',sourceIndex:999},{explanation:'Otro',sourceIndex:998}]})}})}:fetchOriginal(url,options);
        try{await duco.executeFlowAction({type:'explainCareer',terms:['Ingeniería en Informática'],guided:true});return {rejected:false};}
        catch(error){return {rejected:true,message:error.message,steps:document.querySelectorAll('[data-guided-step]').length,marks:document.querySelectorAll('.duco-page-highlight').length};}
        finally{window.fetch=fetchOriginal;client.isServerOnline=online;}
      });
      assert(result.rejected);assert.equal(result.message,'OLLAMA_INVALID_RESPONSE');assert.equal(result.steps,0);assert.equal(result.marks,0);return result;
    });
    await check('A disappearing source stops the sequence rather than inventing the next step',destination,async page=>{
      const result=await page.evaluate(async()=>{
        duco.aiClient.generateGuidedCareerExplanation=async(title,blocks)=>[
          {explanation:'Primera explicación de prueba.',sourceText:blocks[0]},
          {explanation:'Segunda explicación de prueba.',sourceText:blocks[1]}];
        const display=duco.displayMessage.bind(duco);
        const original=duco.aiClient.generateGuidedCareerExplanation;
        let second;
        duco.aiClient.generateGuidedCareerExplanation=async(...args)=>{const plan=await original(...args);second=plan[1].sourceText;return plan;};
        duco.displayMessage=async(text,type,options={})=>{
          const element=await display(text,type,options);
          if(options.guidedStep===1)duco.getSourceParagraphElements().find(el=>el.textContent.replace(/\s+/g,' ').trim()===second)?.remove();
          return element;
        };
        const outcome=await duco.executeFlowAction({type:'explainCareer',terms:['Ingeniería en Informática'],guided:true});
        return {outcome,steps:document.querySelectorAll('[data-guided-step]').length,saved:chatHandler.conversationContext.lastExplanation};
      });
      assert.equal(result.outcome.success,false);assert.equal(result.steps,1);assert.equal(result.saved.blocks.length,1);return result;
    });
  }finally{
    report.passed=report.cases.length===4&&report.cases.every(c=>c.passed);
    fs.writeFileSync(path.join(__dirname,'evidence','guided-explanation.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
