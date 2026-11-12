// Ejecutar con Playwright disponible en NODE_PATH y Chromium headless instalado.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, reducedMotion: 'no-preference' });
    await page.setContent('<!doctype html><style>body{margin:0;overflow-y:scroll}header{position:fixed;top:0;height:80px;width:100%;background:white}h1{font:32px Arial;margin:0}a{background:#035bb3;color:white;padding:8px}</style><header class="fixed-top">Cabecera</header><div style="height:1200px"></div><h1 id="target">Carreras Técnicas y Profesionales <a id="button" href="#">VER TODAS LAS CARRERAS</a></h1><div style="height:1000px"></div>');
    await page.addScriptTag({ content: fs.readFileSync('js/ui-highlighter.js', 'utf8') });
    await page.addScriptTag({ content: fs.readFileSync('js/duco-assistant.js', 'utf8').split('// Inicializar Duco cuando')[0] + ';window.testAssistant=Object.create(DucoAssistant.prototype);' });
    const frames = await page.evaluate(async () => {
      const samples = [];
      let recording = true;
      const sample = () => {
        const mark = document.querySelector('#target .duco-page-highlight-bg');
        samples.push({
          y: scrollY, width: document.documentElement.clientWidth,
          overflow: document.body.style.overflow,
          color: mark ? getComputedStyle(mark).backgroundColor : null
        });
        if (recording) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      await testAssistant.executeFlowAction({type:'highlightTerms',terms:['Carreras Técnicas y Profesionales'],closeTransientUi:false});
      await new Promise(resolve => setTimeout(resolve,650));
      recording = false;
      return samples;
    });
    const colors = new Set(frames.map(frame => frame.color).filter(Boolean));
    if (colors.size <= 3) console.log('Diagnóstico:', [...colors], await page.locator('#target').innerHTML(), await page.locator('#target span').evaluateAll(els => els.map(el => ({classes:el.className,transition:getComputedStyle(el).transition,background:getComputedStyle(el).backgroundColor}))));
    assert(colors.size > 3, 'La entrada debe pasar por varios colores intermedios');
    assert(colors.has('rgba(0, 0, 0, 0)'), 'Debe existir un fotograma transparente');
    assert(colors.has('rgb(255, 224, 130)'), 'Debe alcanzar el amarillo final');
    assert(frames.at(-1).y > 900, 'La guía debe llegar al título');
    for (let i = 1; i < frames.length; i++) {
      assert(frames[i].y >= frames[i-1].y - 2, 'El scroll no debe retroceder durante la entrada');
      assert.equal(frames[i].width, frames[0].width, 'El ancho no debe cambiar durante la guía');
      assert.equal(frames[i].overflow, frames[0].overflow, 'Conservar el overflow original');
    }
    await page.evaluate(() => ducoHighlighter.clearAllHighlights());
    const outlines = await page.evaluate(async () => {
      const control = document.querySelector('#button');
      ducoHighlighter.highlight(control, 0, {guide:false});
      const values = [];
      const started = performance.now();
      while (performance.now() - started < 550) {
        await new Promise(requestAnimationFrame);
        values.push(getComputedStyle(document.querySelector('.duco-control-overlay')).outlineColor);
      }
      return values;
    });
    assert(new Set(outlines).size > 3, 'El contorno también debe entrar gradualmente');
    console.log('OK Chromium: entrada con ' + colors.size + ' estados de color, contorno animado y scroll sin retroceso ni cambio de ancho.');
    // Verificación de integración sobre el HTML del proyecto servido localmente.
    await page.route('**/*', route => {
      const url = route.request().url();
      return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url) ? route.continue() : route.abort();
    });
    await page.goto('http://127.0.0.1:5500/duoc.html', {waitUntil:'load'});
    await page.waitForFunction(() => window.duco && window.ducoHighlighter);
    const liveFrames = await page.evaluate(async () => {
      const samples = [];
      let recording = true;
      const sample = () => {
        const mark = document.querySelector('.duco-page-highlight-bg');
        samples.push({y:scrollY, width:document.documentElement.clientWidth, color:mark ? getComputedStyle(mark).backgroundColor : null});
        if (recording) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      await window.duco.executeFlowAction({type:'highlightTerms',terms:['Carreras Técnicas y Profesionales'],closeTransientUi:false});
      await new Promise(resolve => setTimeout(resolve,650));
      recording = false;
      return samples;
    });
    assert(new Set(liveFrames.map(frame => frame.color).filter(Boolean)).size > 3, 'La página real también debe mostrar colores intermedios');
    for (let i=1; i<liveFrames.length; i++) {
      assert(liveFrames[i].y >= liveFrames[i-1].y - 2, 'El sitio real no debe regresar al punto anterior');
      assert.equal(liveFrames[i].width,liveFrames[0].width);
    }
    console.log('OK integración: amarillo animado y desplazamiento sin retorno en duoc.html.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
