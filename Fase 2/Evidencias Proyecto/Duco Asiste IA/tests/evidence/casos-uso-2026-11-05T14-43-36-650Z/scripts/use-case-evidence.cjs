// Captures actual application states. Direct action-engine checks are not NLU tests.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const base = 'http://127.0.0.1:8765';
const fiche = '/carreras-detalle/ingenieria-en-informatica.html';
const root = path.join(__dirname, 'evidence', 'casos-uso-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(root, { recursive: true });
const manifest = { marker: 'DUCO_EVIDENCE_' + randomUUID().replaceAll('-', ''), sessions: [] };
const manifestPath = path.join(root, 'fixtures.json');
const saveManifest = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
saveManifest();
const report = { startedAt: new Date().toISOString(), timezone: 'America/Santiago', baseUrl: base, cases: [],
  limitations: ['Chromium de escritorio; capturas moviles por emulacion, no telefono fisico.',
    'Ollama se usa solo como servicio de IA del prototipo, no como requisito del visitante final.',
    'Las pruebas del motor de acciones no certifican la interpretacion de lenguaje natural.',
    'CU-29 provoca un fallo controlado; no se apaga el servicio compartido.',
    'Abrir el reproductor no certifica reproduccion audiovisual externa.',
    'No se certifican produccion, autenticacion administrativa ni exactitud semantica completa del modelo.'] };
let browser, current, page, context, explanation;
function oracle(mode = 'inspect') {
  saveManifest();
  const p = spawnSync(path.join(__dirname, '../admin-app/.venv/Scripts/python.exe'), [path.join(__dirname, 'use-case-oracle.py'), mode, manifestPath], { encoding: 'utf8', timeout: 60000 });
  if (p.status !== 0) throw Error(p.stderr || p.stdout);
  const data = JSON.parse(p.stdout.trim());
  fs.writeFileSync(path.join(root, (current?.id || 'final') + '-oracle-' + mode + '.json'), JSON.stringify(data, null, 2));
  return data;
}
async function shot(label, locator) {
  await page.waitForTimeout(450);
  const file = current.id + '-' + String(current.images.length + 1).padStart(2, '0') + '-' + label.replace(/[^a-z0-9-]/gi, '-') + '.png';
  await (locator || page).screenshot({ path: path.join(root, file), animations: 'disabled', timeout: 15000 });
  current.images.push({ file, label, url: page.url(), timestamp: new Date().toISOString() });
}
async function ready(open = true) {
  await page.waitForFunction(() => window.duco?.aiClient && window.chatHandler);
  await page.evaluate(open => { duco.typewriterSpeed = 0; if (open) duco.openPanel(); }, open);
  await page.waitForTimeout(700);
  const session = await page.evaluate(() => chatHandler.getSessionId());
  if (!manifest.sessions.includes(session)) { manifest.sessions.push(session); saveManifest(); }
}
async function go(route, open = true) { await page.goto(base + route, { waitUntil: 'domcontentloaded' }); await ready(open); }
async function ask(text) {
  current.inputs.push(text);
  await page.fill('#duco-input', text); await page.click('#duco-send-btn');
  await page.waitForTimeout(250);
  await page.waitForFunction(() => window.duco?.isProcessing === false, null, { timeout: 210000 });
  await ready();
  const reply = await page.evaluate(() => chatHandler.getDialogueMessages().filter(m => m.type === 'assistant').at(-1)?.text);
  current.replies.push(reply); return reply || '';
}
async function action(value) {
  current.actions.push(value);
  const result = await page.evaluate(a => duco.executeFlowAction(a, {}), value);
  current.outcomes.push(result); return result;
}
async function check(id, title, mode, route, fn) {
  current = { id, title, mode, startedAt: new Date().toISOString(), images: [], inputs: [], replies: [], actions: [], outcomes: [], modelResponses: [], errors: [] };
  report.cases.push(current);
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => current.errors.push(e.message));
  page.on('response', async r => {
    if (new URL(r.url()).pathname === '/api/chat') {
      const target = current;
      try { const data = await r.json(); target.modelResponses.push({ status: r.status(), model: data.model, content: data.message?.content }); } catch {}
    }
  });
  // Leave institutional assets online, but avoid nonessential trackers and ads.
  await page.route(/google-analytics|googletagmanager|doubleclick|facebook\.com\/tr/, r => r.abort());
  try {
    if (route === '/') await page.goto(base + '/', { waitUntil: 'domcontentloaded' }); else await go(route);
    await fn(); current.status = 'VERIFICADO';
  } catch (e) {
    current.status = 'FALLO'; current.error = e.stack;
    try { await shot('estado-del-fallo'); } catch (capture) { current.captureError = capture.message; }
  } finally {
    current.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(root, id + '.json'), JSON.stringify(current, null, 2));
    console.log(JSON.stringify({ id, status: current.status, screenshots: current.images.length, error: current.error?.split('\n')[0] }));
    await context.close(); fs.writeFileSync(path.join(root, 'resultados.json'), JSON.stringify(report, null, 2));
  }
}
async function adminReview() {
  await page.click('#review-proposals');
  await page.waitForFunction(() => !document.querySelector('#proposal-list').textContent.includes('Cargando'));
}
async function configTable() {
  await page.waitForSelector('#tables option[value="CONFIGURACIONES"]', { state: 'attached' });
  const loaded = page.waitForResponse(r => r.url().endsWith('/api/tables/CONFIGURACIONES/rows'));
  await page.selectOption('#tables', 'CONFIGURACIONES'); await loaded;
  await page.waitForFunction(() => !document.querySelector('#status').textContent.includes('Cargando'));
}
async function seedProposal(suffix) {
  const question = manifest.marker + ' ' + suffix;
  const response = await page.request.post(base + '/api/duco/proposals', { data: { question, answer: 'Informacion sintetica exclusiva de la prueba de evidencias. No es informacion institucional.' } });
  assert.equal(response.status(), 202); return question;
}
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function gallery() {
  const passed = report.cases.filter(c => c.status === 'VERIFICADO').length;
  const images = report.cases.flatMap(c => c.images);
  report.summary = { verified: passed, failed: report.cases.length - passed, total: report.cases.length, screenshots: images.length };
  report.finishedAt = new Date().toISOString();
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Evidencias Duco Asiste</title>
  <style>body{margin:0;background:#eef3f8;color:#17324d;font:16px/1.6 Georgia,serif}header,main{max-width:1280px;margin:auto;padding:28px}header{border-bottom:4px solid #ffca28}h1{font-size:38px}h2{margin-top:0}nav{columns:3}a{color:#035bb3}article{background:white;border:1px solid #dce5ee;border-radius:12px;padding:26px;margin:24px 0}img{max-width:100%;height:auto;border:1px solid #dce5ee}figure{margin:20px 0}.tag{font:14px sans-serif;background:#e8f2ff;padding:6px 10px;border-radius:6px}.failed{background:#ffe5e5}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7fa;padding:14px;font-size:13px}figcaption{font-size:14px}@media(max-width:700px){nav{columns:1}header,main{padding:14px}}</style>
  <header><h1>Duco Asiste: evidencias de casos de uso</h1><p>${h(report.startedAt)} (registro UTC). Zona de trabajo: America/Santiago.</p><p><b>${passed}/${report.cases.length} casos verificados en el alcance indicado. ${images.length} capturas originales.</b></p><p>Estados capturados por Playwright sin fabricar mensajes ni agregar marcas ajenas a la aplicacion. Escritura acelerada y movimiento reducido para la prueba.</p><ul>${report.limitations.map(s=>`<li>${h(s)}</li>`).join('')}</ul><p>Las capturas son evidencia de estados, no una certificacion total del caso. Revisar el modo y las aserciones en cada JSON. Los fallos se conservan.</p><p><a href="resultados.json">Resultados completos</a> | <a href="integridad.json">Hashes SHA-256</a> | <a href="limpieza.json">Limpieza de datos temporales</a></p><nav>${report.cases.map(c=>`<div><a href="#${c.id}">${c.id}: ${h(c.title)}</a></div>`).join('')}</nav></header><main>
  ${report.cases.map(c=>`<article id="${c.id}"><h2>${c.id}: ${h(c.title)}</h2><span class="tag ${c.status==='FALLO'?'failed':''}">${c.status}</span><p><b>Alcance:</b> ${h(c.mode)}</p>${c.detail?`<p>${h(c.detail)}</p>`:''}<p><a href="${c.id}.json">Registro tecnico del caso</a></p>${c.inputs.map((s,i)=>`<p><b>Solicitud:</b> ${h(s)}</p><pre>${h(c.replies[i] || '')}</pre>`).join('')}${c.error?`<pre>${h(c.error)}</pre>`:''}${c.images.map(im=>`<figure><a href="${im.file}"><img loading="lazy" src="${im.file}" alt="${h(c.id+' '+im.label)}"></a><figcaption>${h(im.label)} | ${h(im.timestamp)} | ${h(im.url)}</figcaption></figure>`).join('')}</article>`).join('')}</main></html>`;
  fs.writeFileSync(path.join(root, 'index.html'), html);
  fs.writeFileSync(path.join(root, 'resultados.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, 'integridad.json'), JSON.stringify(images.map(im => ({ file: im.file, bytes: fs.statSync(path.join(root, im.file)).size, sha256: createHash('sha256').update(fs.readFileSync(path.join(root, im.file))).digest('hex') })), null, 2));
}
(async () => {
  browser = await chromium.launch({ headless: true }); report.browser = browser.version();
  try {
    await check('CU-01', 'Abrir y cerrar el asistente', 'UI real, teclado y movil emulado', '/duco', async () => {
      await page.click('#duco-close-btn'); await shot('cerrado');
      await page.locator('.duco-avatar-button').focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement === document.querySelector('#duco-input')); await shot('abierto');
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#duco-chat-panel').getAttribute('aria-hidden'), 'true');
      await page.setViewportSize({width:375,height:812}); await page.locator('.duco-avatar-button').click(); await shot('movil-abierto');
    });
    await check('CU-02', 'Consultar informacion institucional', 'Consulta por UI y servicio de IA real', '/duco', async () => {
      await shot('antes'); const answer = await ask('Que es Duoc UC? Solo explicamelo, no navegues.');
      assert.match(answer, /educaci[oó]n|instituci[oó]n|formaci[oó]n/i); assert(current.modelResponses.length); await shot('respuesta');
    });
    await check('CU-03', 'Buscar y filtrar carreras', 'Buscador institucional real; no clasificacion IA', '/carreras.html', async () => {
      await page.click('#duco-close-btn'); await page.locator('#carrera-search').scrollIntoViewIfNeeded(); await shot('catalogo');
      await page.fill('#carrera-search', 'informatica');
      await page.waitForFunction(() => /inform[aá]tica/i.test(document.querySelector('#resultados-carreras').textContent) && !/Preparador F[ií]sico/i.test(document.querySelector('#resultados-carreras').textContent));
      current.detail = await page.locator('#resultados-carreras').innerText(); await shot('filtro-informatica');
    });
    await check('CU-04', 'Consultar la ficha de una carrera', 'Ficha local y consulta estructurada por UI', fiche, async () => {
      await page.click('#duco-close-btn'); await shot('ficha'); await page.locator('.duco-avatar-button').click();
      const answer = await ask('Cuanto dura Ingenieria en Informatica?'); assert.match(answer, /8|ocho|semestres/i); await shot('datos-carrera');
    });
    await check('CU-05', 'Solicitar una explicacion de una carrera', 'Motor de explicacion guiada con Ollama real; no clasificacion de la solicitud', fiche, async () => {
      const stages = [];
      await page.exposeFunction('__captureGuidedStage', async i => { await shot('parte-'+i); stages.push(i); });
      await page.evaluate(() => {
        const display = duco.displayMessage.bind(duco);
        duco.displayMessage = async (text,type,options={}) => { const el=await display(text,type,options); if(options.guidedStep) await window.__captureGuidedStage(options.guidedStep); return el; };
      });
      const outcome = await action({type:'explainCareer',terms:['Ingenieria en Informatica'],guided:true}); assert(outcome.success);
      explanation = await page.evaluate(() => chatHandler.conversationContext.lastExplanation);
      assert(explanation.blocks.length >= 2); assert(current.modelResponses.length); current.detail = 'Partes capturadas: '+stages.join(', '); await shot('explicacion-completa');
    });
    await check('CU-06', 'Navegar a otra pagina mediante Duco', 'Solicitud por UI, ruta real y continuidad de sesion', '/duco', async () => {
      await page.fill('#duco-input','Llevame a Ingenieria en Informatica'); await shot('solicitud');
      current.inputs.push('Llevame a Ingenieria en Informatica');
      await page.click('#duco-send-btn'); await page.waitForURL('**'+fiche,{timeout:90000}); await ready();
      assert.equal(new URL(page.url()).pathname,fiche); await shot('destino');
    });
    await check('CU-07', 'Localizar una seccion mediante desplazamiento', 'Integracion motor de desplazamiento sobre contenido real', '/duco', async () => {
      await page.click('#duco-close-btn'); await page.evaluate(() => scrollTo(0,1600)); await shot('antes-scroll');
      const before = await page.evaluate(() => scrollY);
      const outcome = await action({type:'scroll',terms:['Vida Estudiantil']}); assert(outcome.success);
      const after = await page.evaluate(() => scrollY); assert(after < before); current.detail = `Scroll vertical: ${before} -> ${after}`; await shot('seccion-localizada');
    });
    await check('CU-08', 'Resaltar un texto o elemento', 'Integracion motor de resaltado; carrusel real', '/duco', async () => {
      const result = await action({type:'highlightTerms',terms:['Congreso i2T 2026'],duration:15000}); assert(result.success);
      assert(await page.locator('.duco-page-highlight').count()); await shot('texto-resaltado');
      await action({type:'clearHighlights'}); assert.equal(await page.locator('.duco-page-highlight').count(),0); await shot('resaltado-limpiado');
    });
    await check('CU-09', 'Mostrar el respaldo de una explicacion', 'Reutiliza parrafos obtenidos realmente en CU-05; motor de evidencia', fiche, async () => {
      assert(explanation?.blocks.length,'CU-05 debe haber generado el respaldo'); await shot('antes');
      const result = await action({type:'showEvidence',terms:['texto de la ficha'],evidenceTexts:explanation.blocks,duration:20000}); assert(result.success);
      assert(await page.locator('.duco-page-highlight').count()); current.detail=explanation.blocks.join('\n\n'); await shot('parrafos-fuente');
    });
    await check('CU-10', 'Abrir un menu del sitio', 'Integracion motor de menus con DOM real', '/duco', async () => {
      await page.click('#duco-close-btn'); await shot('menu-cerrado');
      assert((await action({type:'dropdown',terms:['Oferta Academica']})).success);
      assert.equal(await page.locator('.dropdown-menu.show').count(),1); await shot('menu-abierto');
    });
    await check('CU-11', 'Cerrar menus abiertos por la guia', 'Integracion apertura y cierre explicito; no temporizador automatico', '/duco', async () => {
      await page.click('#duco-close-btn'); await action({type:'dropdown',terms:['Admision']}); await shot('abierto');
      assert((await action({type:'closeDropdown'})).success); assert.equal(await page.locator('.dropdown-menu.show').count(),0); await shot('cerrado');
    });
    await check('CU-12', 'Seleccionar una pestana de la ficha', 'Integracion control real de pestanas', fiche, async () => {
      await page.click('#duco-close-btn');
      const label = await page.locator('a[role="tab"]').filter({hasText:/perfil de egreso/i}).innerText();
      await page.locator('a[role="tab"]').filter({hasText:/perfil de egreso/i}).scrollIntoViewIfNeeded(); await shot('antes');
      assert((await action({type:'selectPageControl',terms:[label.trim()]})).success);
      current.detail = await page.locator('a[role="tab"]').filter({hasText:/perfil de egreso/i}).evaluate(el=>({className:el.className,ariaSelected:el.getAttribute('aria-selected')})).then(JSON.stringify); await shot('perfil-seleccionado');
    });
    await check('CU-13', 'Abrir contenido multimedia de una carrera', 'Apertura y cierre del dialogo real; no certifica reproduccion', fiche, async () => {
      await page.click('#duco-close-btn'); await page.locator('.dfc-btn-video').scrollIntoViewIfNeeded(); await shot('boton-video');
      const control = await page.evaluate(() => duco.getDialogControls().find(e=>/video de la carrera/i.test(e.label)));
      assert(control); assert((await action({type:'clickControl',terms:[control.label],dialogId:control.dialogId})).success);
      const dialog=page.locator('#'+control.dialogId); await dialog.waitFor({state:'visible'}); await shot('reproductor-abierto');
      assert(await dialog.locator('iframe').getAttribute('src'));
      await dialog.locator('button[aria-label]').first().click(); await dialog.waitFor({state:'hidden'}); await shot('reproductor-cerrado');
    });
    await check('CU-14', 'Aclarar una consulta ambigua', 'Solicitudes por UI y servicio de IA real', '/duco', async () => {
      const answer=await ask('Abreme eso.'); assert.match(answer,/[?\u00bf]/); assert.equal(await page.locator('.dropdown-menu.show').count(),0); await shot('solicita-aclaracion');
      await ask('Me refiero al menu Admision.'); await shot('aclaracion-procesada');
      assert((await page.evaluate(()=>chatHandler.getActionOutcomes())).some(o=>o.type==='dropdown'&&o.success));
    });
    await check('CU-15', 'Corregir una interpretacion o accion de Duco', 'Precondicion controlada con titulo resaltado; correccion por UI con IA real', fiche, async () => {
      assert(explanation?.blocks.length);
      await page.evaluate(saved => {chatHandler.conversationContext.lastExplanation=saved;},explanation);
      await action({type:'highlightTerms',terms:['Ingenieria en Informatica'],duration:15000}); await shot('titulo-antes-de-corregir');
      const answer=await ask('No, te pedi el parrafo explicativo, no el titulo. Resalta el texto que usaste para explicar la carrera.');
      assert(await page.locator('main p .duco-page-highlight, main li .duco-page-highlight').count()); await shot('parrafo-corregido');
    });
    await check('CU-16', 'Continuar una conversacion durante la navegacion', 'UI real, Session Storage, navegacion y recarga; sin llamada generativa necesaria', '/duco', async () => {
      await ask('hola duco'); const before=await page.evaluate(()=>({session:chatHandler.getSessionId(),dialogue:chatHandler.getDialogueMessages()})); await shot('antes-de-navegar');
      await go('/carreras.html'); assert.deepEqual(await page.evaluate(()=>({session:chatHandler.getSessionId(),dialogue:chatHandler.getDialogueMessages()})),before); await shot('historial-en-catalogo');
      await page.reload({waitUntil:'domcontentloaded'}); await ready(); assert.equal(await page.locator('.duco-message-user').last().textContent(),'hola duco'); await shot('historial-tras-recarga');
    });
    await check('CU-17', 'Repetir una guia o un resaltado anterior', 'Boton real de repeticion, generado desde accion del motor', '/duco', async () => {
      const a={type:'highlightTerms',terms:['Congreso i2T 2026'],duration:15000}; assert((await action(a)).success);
      await page.evaluate(a=>duco.addActionButtons({actions:[a]}),a);
      await shot('primer-resaltado'); await action({type:'clearHighlights'}); await shot('sin-resaltado');
      await page.locator('.duco-action-btn').last().click(); await page.waitForFunction(()=>document.querySelector('.duco-page-highlight')); await shot('repetido-por-boton');
      current.detail='Se conecta el boton real a una accion conocida para aislar la repeticion; no se prueba el clasificador de lenguaje en este caso.';
    });
    await check('CU-18', 'Iniciar una nueva conversacion', 'Boton real y almacenamiento de sesion', '/duco', async () => {
      await ask('hola duco'); const before=await page.evaluate(()=>chatHandler.getSessionId()); await shot('conversacion-previa');
      await page.click('#duco-reset-btn'); assert.notEqual(await page.evaluate(()=>chatHandler.getSessionId()),before); assert.equal(await page.locator('.duco-message-user').count(),0); await shot('nueva-conversacion');
    });
    await check('CU-19', 'Valorar una respuesta o una guia', 'Boton negativo real, persistencia Oracle independiente', '/duco', async () => {
      await ask('hola duco'); await shot('controles-de-valoracion');
      const saved=page.waitForResponse(r=>r.url().endsWith('/api/duco/feedback')&&r.request().method()==='POST');
      await page.getByRole('button',{name:'No me sirvio',exact:true}).count().then(async count=>{ if(count) await page.getByRole('button',{name:'No me sirvio',exact:true}).last().click(); else await page.locator('.duco-feedback-btn').last().click(); });
      assert.equal((await saved).status(),201); await page.waitForFunction(()=>document.querySelector('.duco-feedback-status').textContent.includes('registrada'));
      const snapshot=oracle(); assert(snapshot.sessionRows.some(s=>s.ratings.some(r=>r[1]===-1))); await shot('valoracion-guardada');
      report.negativeFeedbackSession=await page.evaluate(()=>chatHandler.getSessionId());
    });
    await check('CU-20', 'Proponer informacion para revision', 'Motor proposeKnowledge y API Oracle reales; no interpretacion de solicitud', '/duco', async () => {
      await shot('antes'); await action({type:'proposeKnowledge',question:manifest.marker+' propuesta visitante',answer:'Dato sintetico de prueba para revision, no publicar como informacion institucional.'});
      assert((await page.locator('#duco-messages').innerText()).includes('Se mando a revision'.replace('mando','mand\u00f3').replace('revision','revisi\u00f3n')));
      assert(oracle().proposals.some(p=>p[1].endsWith('propuesta visitante'))); await shot('propuesta-enviada');
    });
    await check('CU-21', 'Consultar propuestas de conocimiento pendientes', 'UI administrativa y Oracle reales; solo datos sinteticos creados para prueba', '/', async () => {
      const q=await seedProposal('lista pendientes'); await adminReview(); const card=page.locator('#proposal-list .proposal').filter({hasText:q}); await card.waitFor(); await shot('propuesta-pendiente',card); assert(await card.locator('.approve').isEnabled());
    });
    await check('CU-22', 'Aprobar una propuesta de conocimiento', 'UI real; commit y publicacion verificados por conexion Oracle independiente', '/', async () => {
      const q=await seedProposal('aprobar'); await adminReview(); const card=page.locator('#proposal-list .proposal').filter({hasText:q}); await card.waitFor(); await shot('pendiente-aprobacion',card);
      const response=page.waitForResponse(r=>/\/proposals\/\d+\/review$/.test(r.url())); await card.locator('.approve').click(); assert.equal((await response).status(),200);
      await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('aprobada')); await shot('aprobacion-confirmada',page.locator('#status'));
      const state=oracle(); assert(state.proposals.some(p=>p[1]===q&&p[2]==='APROBADA')); assert(state.publishedFaqs.some(f=>f[1]===q));
      await page.click('#close-proposals'); await page.selectOption('#tables','PREGUNTAS_FRECUENTES'); const row=page.locator('#grid tr').filter({hasText:q}); await row.waitFor(); await shot('faq-publicada',row);
    });
    await check('CU-23', 'Rechazar una propuesta de conocimiento', 'UI real; rechazo y ausencia de FAQ verificados en Oracle', '/', async () => {
      const q=await seedProposal('rechazar'); await adminReview(); const card=page.locator('#proposal-list .proposal').filter({hasText:q}); await card.waitFor(); await shot('pendiente-rechazo',card);
      const response=page.waitForResponse(r=>/\/proposals\/\d+\/review$/.test(r.url())); await card.locator('.reject').click(); assert.equal((await response).status(),200);
      await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('rechazada')); await shot('rechazo-confirmado',page.locator('#status'));
      const state=oracle(); assert(state.proposals.some(p=>p[1]===q&&p[2]==='RECHAZADA')); assert(!state.publishedFaqs.some(f=>f[1]===q));
    });
    await check('CU-24', 'Revisar valoraciones negativas', 'UI real sobre voto registrado en CU-19 y verificacion Oracle', '/', async () => {
      assert(report.negativeFeedbackSession,'Requiere CU-19'); const state=oracle(); const rating=state.sessionRows.find(s=>s.session===report.negativeFeedbackSession).ratings.find(r=>r[1]===-1); assert(rating);
      await adminReview(); const card=page.locator('#negative-feedback-list .proposal[data-id="'+rating[0]+'"]'); await card.waitFor(); await shot('valoracion-pendiente',card);
      const response=page.waitForResponse(r=>/\/feedback\/\d+\/review$/.test(r.url())); await card.locator('button').click(); assert.equal((await response).status(),200);
      await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('marcada como revisada')); await shot('revisada',page.locator('#status'));
      assert(oracle().sessionRows.find(s=>s.session===report.negativeFeedbackSession).ratings.some(r=>r[0]===rating[0]&&r[2]==='REVISADA'));
    });
    await check('CU-25', 'Consultar tablas y registros administrables', 'Selector y listado de tabla Oracle por UI real', '/', async () => {
      await configTable(); await shot('listado-configuraciones'); const options=await page.locator('#tables option').allTextContents(); assert(options.includes('CONFIGURACIONES')); current.detail=options.join(', ');
    });
    const configKey=manifest.marker+' configuracion';
    await check('CU-26', 'Crear un registro administrativo', 'Formulario real y commit Oracle independiente', '/', async () => {
      await configTable(); await page.click('#add'); await page.fill('#field-CLAVE',configKey); await page.fill('#field-VALOR','valor inicial de evidencia'); await shot('formulario-alta',page.locator('#modal'));
      const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/tables/CONFIGURACIONES')); await page.click('#save'); assert.equal((await response).status(),201);
      const row=page.locator('#grid tr').filter({hasText:configKey}); await row.waitFor(); await shot('registro-creado',row); assert(oracle().configurations.some(r=>r[1]===configKey&&r[2]==='valor inicial de evidencia'));
    });
    await check('CU-27', 'Modificar un registro administrativo', 'Formulario real y commit Oracle independiente; registro de CU-26', '/', async () => {
      await configTable(); const row=page.locator('#grid tr').filter({hasText:configKey}); await row.waitFor(); await shot('valor-anterior',row);
      await row.locator('.edit').click(); await page.fill('#field-VALOR','valor actualizado de evidencia'); await shot('formulario-edicion',page.locator('#modal'));
      const response=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/api/tables/CONFIGURACIONES')); await page.click('#save'); assert.equal((await response).status(),200);
      await page.waitForFunction(key=>[...document.querySelectorAll('#grid tr')].some(r=>r.textContent.includes(key)&&r.textContent.includes('valor actualizado')),configKey); await shot('registro-actualizado',row);
      assert(oracle().configurations.some(r=>r[1]===configKey&&r[2]==='valor actualizado de evidencia'));
    });
    await check('CU-28', 'Eliminar un registro administrativo', 'Boton y confirmacion reales; ausencia verificada en Oracle', '/', async () => {
      await configTable(); const row=page.locator('#grid tr').filter({hasText:configKey}); await row.waitFor(); await shot('antes-eliminar',row);
      page.once('dialog',async d=>{current.detail='Confirmacion real: '+d.message();await d.accept();});
      const response=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().endsWith('/api/tables/CONFIGURACIONES')); await row.locator('.delete').click(); assert.equal((await response).status(),200);
      await row.waitFor({state:'hidden'}); await shot('listado-sin-registro'); assert(!oracle().configurations.some(r=>r[1]===configKey));
    });
    await check('CU-29', 'Reintentar una consulta tras un fallo del servicio de IA', 'Fallo de IA simulado, recuperacion posterior con Ollama real por UI', '/duco', async () => {
      await page.evaluate(()=>{window.__realGenerate=duco.aiClient.generateResponse;duco.aiClient.generateResponse=async()=>{throw Error('OLLAMA_UNAVAILABLE');};});
      await ask('Que es Duoc UC? Solo explicamelo, no navegues.'); assert.match(await page.locator('#duco-messages').innerText(),/no est[aá] disponible|No pude conectarme/i); await shot('fallo-controlado');
      await page.evaluate(()=>{duco.aiClient.generateResponse=window.__realGenerate;});
      const answer=await ask('Que es Duoc UC? Solo explicamelo, no navegues.'); assert.match(answer,/educaci[oó]n|instituci[oó]n|formaci[oó]n/i); assert(current.modelResponses.length); await shot('reintento-exitoso');
    });
    await check('CU-30', 'Solicitar una carrera alternativa', 'Solicitud por UI con contexto de ficha real', fiche, async () => {
      await shot('carrera-inicial'); current.inputs.push('me muestras otra carrera cualquiera?');
      await page.fill('#duco-input','me muestras otra carrera cualquiera?'); await page.click('#duco-send-btn');
      await page.waitForURL('**/carreras.html',{timeout:120000}); await ready();
      await page.waitForFunction(()=>window.ducoHighlighter?.highlightedElement?.classList.contains('bc-card'),null,{timeout:45000});
      const career=await page.evaluate(()=>chatHandler.conversationContext.lastCareer); assert(career?.title); assert(!/Ingenier[ií]a en Inform[aá]tica/i.test(career.title)); current.detail=career.title; await shot('alternativa-destacada');
    });
    await check('CU-31', 'Consultar la ubicacion actual y la peticion anterior', 'Consulta por UI tras navegacion manual; lectura de contexto real', '/duco', async () => {
      await ask('hola duco'); await go('/carreras.html');
      const where=await ask('En que pagina estoy ahora?'); assert.match(where,/carreras|cat[aá]logo/i); await shot('ubicacion-actual');
      const previous=await ask('Cual fue mi pregunta anterior?'); assert.match(previous,/pagina|p[aá]gina|ahora/i); await shot('peticion-anterior');
    });
  } finally {
    current=null;
    try { const clean=oracle('cleanup'); report.cleanup=clean; assert(clean.clean); fs.writeFileSync(path.join(root,'limpieza.json'),JSON.stringify(clean,null,2)); }
    catch(e){report.cleanup={clean:false,error:e.stack};fs.writeFileSync(path.join(root,'limpieza.json'),JSON.stringify(report.cleanup,null,2));}
    gallery(); await browser?.close();
    console.log(JSON.stringify({output:root,...report.summary,cleanup:report.cleanup?.clean}));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
