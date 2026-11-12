const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../assets/carreras-catalogo.json').map(c => ({ title:c.title, localLink:c.local_link, source:c.link }));
const career = catalog.find(c => c.localLink === 'carreras-detalle/ingenieria-en-informatica.html');

(async () => {
  const browser = await chromium.launch({ headless:true });
  const report = { date:new Date().toISOString(), cases:[] };
  async function check(name, fn) {
    const context = await browser.newContext({ reducedMotion:'reduce' });
    const page = await context.newPage();
    try {
      await page.route('**/*', r => ['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
      await page.goto('http://127.0.0.1:8765/duco', {waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => window.duco?.aiClient);
      await page.evaluate(career => {
        duco.typewriterSpeed=0; duco.openPanel();
        chatHandler.addUserMessage('buscame ingenieria en informatica');
        chatHandler.addAssistantMessage('Ingeniería en Informática dura 8 semestres. Tengo la información actualizada para ti. Alameda solo tiene horario Diurno.');
        chatHandler.conversationContext.lastCareer=career;
        chatHandler.conversationContext.lastCorrection={request:'Consulta anterior',goal:'Objetivo anterior incorrecto'};
        chatHandler.saveToSession();
      }, career);
      const detail = await fn(page);
      report.cases.push({name,passed:true,detail});
    } catch(error) { report.cases.push({name,passed:false,error:error.stack}); process.exitCode=1; }
    finally { await context.close(); }
    console.log(JSON.stringify(report.cases.at(-1)));
  }
  try {
    const cases = [
      ['me buscas las carreras?', '/carreras.html'],
      ['buscame ingenieria en informatica', '/'+career.localLink],
      ['Me llevarias hasta donde esta toda esa informacion?', '/'+career.localLink],
      ['Tienes funciones para viajar a traves de paginas, llevame hasta ingenieria en informatica', '/'+career.localLink],
      ['carrera -> ingenieria en informatica', '/'+career.localLink]
    ];
    for(const [text, destination] of cases) await check(text, async page => {
      await page.fill('#duco-input', text); await page.click('#duco-send-btn');
      await page.waitForURL('**'+destination, {timeout:60000});
      await page.waitForFunction(() => window.duco?.aiClient);
      assert.equal(new URL(page.url()).pathname,destination);
      assert(await page.evaluate(t=>chatHandler.getDialogueMessages().some(m=>m.type==='user'&&m.text===t),text));
      assert.equal(await page.evaluate(()=>chatHandler.conversationContext.lastCorrection || null),null);
      return {destination,sessionPreserved:true};
    });
    await check('Guard cases do not authorize unrelated navigation', async page => {
      const result=await page.evaluate(({catalog,career})=>{
        const base={careerAlternatives:catalog,lastCareer:career,currentPage:'/duco',careerCandidates:[]};
        const texts=['hola duco','ayudame','Trabajo de día y prefiero horario vespertino.',
          '¿Qué horario me acomoda y por qué?','¿Cuál es la duración de Ingeniería en Informática?',
          'No quiero abrir Ingeniería en Informática','Abre Ingeniería en Informática y selecciona Perfil de egreso',
          'Me llevas al video de Ingeniería en Informática','Buscame una carrera desconocida ZXQ987',
          'Resalta Ingeniería en Informática','Abre el menú Admisión y luego ciérralo'];
        const untouched=texts.map(text=>({text,response:duco.aiClient.getCareerNavigationResponse(text,[],base)}));
        const unknownReference=duco.aiClient.getCareerNavigationResponse('Me llevas a esa información?',[],base);
        const already=duco.aiClient.getCareerNavigationResponse('Abre Ingeniería en Informática',[],{...base,currentPage:'/'+career.localLink});
        const unsafe=duco.aiClient.getCareerNavigationResponse('Abre Ingeniería en Informática',[],{...base,careerAlternatives:[{...career,localLink:'https://other.example/x'}]});
        return {untouched,unknownReference,already,unsafe};
      },{catalog,career});
      for(const item of result.untouched) assert.equal(item.response,null,item.text);
      assert.equal(result.unknownReference,null); assert.equal(result.unsafe,null);
      assert.deepEqual(result.already.actions,[]);
      return {untouched:result.untouched.length,alreadyAtDestination:true,untrustedRouteRejected:true};
    });
    await check('Structured source overrides invented history without re-generating facts', async page => {
      const text='¿En qué jornadas está Ingeniería en Informática en Sede Alameda?';
      const answer=await page.evaluate(async text=>{chatHandler.addUserMessage(text);return duco.requestAiResponse(text);},text);
      assert.deepEqual(answer.actions,[]);
      assert.match(answer.reply,/diurna/i); assert.match(answer.reply,/vespertina/i);
      assert.doesNotMatch(answer.reply,/solo (?:hay |tiene |cuenta con )?(?:horario )?diurn|m[aá]s populares|informaci[oó]n actualizada/i);
      assert(answer.reply.includes(career.source)); assert.match(answer.reply,/2026-10-29/);
      return answer;
    });
  } finally {
    report.passed=report.cases.length===7 && report.cases.every(c=>c.passed);
    fs.writeFileSync(path.join(__dirname,'evidence','career-navigation.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
