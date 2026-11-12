const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    await page.route('**/*', route => /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(route.request().url()) ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:5500/duoc.html',{waitUntil:'load'});
    await page.waitForFunction(() => window.duco);
    const result = await page.evaluate(async () => {
      const duco = window.duco;
      duco.typewriterSpeed = 0;
      const actions = duco.bindMenuActions(duco.reorderAndAdjustActionsForQuery([
        {type:'dropdown',terms:['Carreras']},
        {type:'highlightTerms',terms:['Carreras']},
        {type:'scroll',terms:['Carreras']}
      ], 'abre un menú'));
      const open = actions.find(action => action.type === 'dropdown');
      const highlight = actions.find(action => action.type === 'highlightTerms');
      const owner = open.trigger?.textContent.trim();
      const sameTarget = open.trigger === highlight.menuTrigger;
      window.scrollTo({top:1100,behavior:'instant'});
      await duco.runAssistantFlow(duco.buildFlowFromAiResponse({reply:'',actions}));
      await duco.runAssistantFlow(duco.buildFlowFromAiResponse({reply:'',actions}));
      await new Promise(resolve => setTimeout(resolve,450));
      const pageMarks = [...document.querySelectorAll('.duco-page-highlight')].filter(el => !el.closest('nav,header'));
      return {owner,sameTarget,scrolls:actions.filter(action=>action.type==='scroll').length,y:scrollY,pageMarks:pageMarks.length,
        menuOpen:open.menu.classList.contains('show'),controlMarked:highlight.menuTrigger.classList.contains('duco-control-highlight')};
    });
    assert(result.owner && !/^Carreras$/i.test(result.owner),'Carreras debe resolverse a su menú propietario');
    assert(result.sameTarget);
    assert.equal(result.scrolls,0);
    assert.equal(result.y,0);
    assert.equal(result.pageMarks,0);
    assert(result.menuOpen);
    assert(result.controlMarked);
    const layer = await page.evaluate(() => {
      const overlay = document.querySelector('.duco-control-overlay');
      const target = window.ducoHighlighter.highlightedElement;
      const a = overlay.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const passesClicks = getComputedStyle(overlay).pointerEvents === 'none';
      overlay.style.setProperty('pointer-events','auto','important');
      const inFront = document.elementFromPoint(a.left+2,a.top+2) === overlay;
      overlay.style.removeProperty('pointer-events');
      return {passesClicks,inFront,error:Math.abs(a.left-b.left)+Math.abs(a.top-b.top)+Math.abs(a.width-b.width)+Math.abs(a.height-b.height)};
    });
    assert(layer.inFront,'La capa del contorno debe estar delante del botón y del menú');
    assert(layer.passesClicks,'El contorno no debe interceptar los clics');
    assert(layer.error<2,'El contorno debe seguir la posición y dimensiones del botón');
    await page.screenshot({path:'C:/Users/elias/.codex/visualizations/2026/10/29/01a184fe-3c0f-7e92-853e-4eaed2a46448/duco-menu-overlay.png'});
    await page.evaluate(() => window.duco.openPanel());
    await page.waitForTimeout(400);
    const overlap = await page.evaluate(async () => {
      const plan = window.duco.bindMenuActions(window.duco.reorderAndAdjustActionsForQuery([
        {type:'dropdown',terms:['Admisión']},{type:'highlightTerms',terms:['Admisión']}
      ], 'abre admisión'));
      await window.duco.runAssistantFlow(window.duco.buildFlowFromAiResponse({reply:'',actions:plan}));
      await new Promise(resolve=>setTimeout(resolve,1200));
      const menu = plan.find(action=>action.type==='dropdown').menu.getBoundingClientRect();
      const panel = document.querySelector('#duco-chat-panel').getBoundingClientRect();
      return {area:window.ducoHighlighter.getIntersectionArea(menu,panel),left:panel.left,shift:document.querySelector('#duco-chat-panel').style.getPropertyValue('--duco-chat-shift-x')};
    });
    assert(overlap.shift && overlap.shift !== '0px','El panel debe desplazarse cuando tapa el menú');
    assert(Math.abs(overlap.left-20)<2,'Conservar 20px de margen al cambiar de lado');
    assert.equal(overlap.area,0,'El panel no debe tapar el menú abierto');
    console.log('OK Chromium: Carreras abre '+result.owner+', un único destino arriba, y Duco deja visible Admisión conservando el margen.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
