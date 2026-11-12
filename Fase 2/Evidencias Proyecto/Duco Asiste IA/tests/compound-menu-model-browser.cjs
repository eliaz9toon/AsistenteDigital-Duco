const {chromium}=require('playwright');
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    await page.route('**/*',route=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(route.request().url())?route.continue():route.abort());
    await page.goto('http://127.0.0.1:5500/duoc.html',{waitUntil:'load'});
    await page.waitForFunction(()=>window.duco);
    const context=await page.evaluate(()=>({
      navigationMenus:window.duco.getNavigationMenus(),
      pageVisibleContent:window.duco.getVisiblePageContentForAi()
    }));
    assert(context.navigationMenus.length);
    const sandbox=vm.createContext({window:{ducoConfig:{ollamaModel:'qwen3.5:9b'}},console,setTimeout,clearTimeout,fetch,AbortController});
    vm.runInContext(fs.readFileSync('js/ollama-client.js','utf8'),sandbox);
    const text='abre un dropdown y luego resalta algo, lo que quieras';
    const answer=await sandbox.window.ducoAI.generateResponse(text,{context:{...context,
      actionOutcomes:[{type:'highlightTerms',target:['Carreras Técnicas y Profesionales'],request:'resalta algo',success:true}]
    },messages:[{type:'user',text:'resalta algo'},{type:'assistant',text:'🔎 Buscando: Carreras Técnicas y Profesionales'}]});
    console.log(JSON.stringify({intent:answer.intent,actions:answer.actions}));
    const open=answer.actions.find(action=>action.type==='dropdown');
    const highlight=answer.actions.find(action=>action.type==='highlightTerms');
    assert(open,'La apertura debe existir como acción, no solo en la respuesta');
    assert(highlight);
    assert.equal(highlight.scope,'opened_menu');
    const menu=context.navigationMenus.find(menu=>menu.label===open.terms[0]);
    assert(menu.items.includes(highlight.terms[0]),'El resaltado debe pertenecer al menú elegido');
    const result=await page.evaluate(async({answer,text})=>{
      window.duco.typewriterSpeed=0;
      window.duco.requestAiResponse=async()=>answer;
      window.chatHandler.addUserMessage(text);
      await window.duco.processUserInput(text);
      const overlay=window.ducoHighlighter.highlightedElement;
      return {isOption:!!overlay?.closest('.dropdown-menu.show'),
        visible:!!overlay?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) && overlay.getBoundingClientRect().width>0,
        label:window.duco.getElementContentText(overlay),
        outside:[...document.querySelectorAll('.duco-page-highlight')].filter(el=>!el.closest('.dropdown-menu')).length,
        y:scrollY};
    },{answer,text});
    assert(result.isOption,'Resaltar una opción dentro del menú que realmente se abrió');
    assert(result.visible,'La opción debe estar visible, incluidos todos sus menús padres');
    assert.equal(result.label,highlight.terms[0]);
    assert.equal(result.outside,0,'No resaltar noticias ni textos ajenos al menú');
    assert.equal(result.y,0,'Conservar la vista del menú');
    let previousLabel = result.label;
    for (const followUp of ['nuevamente','otra opción']) {
      const state=await page.evaluate(()=>({messages:window.chatHandler.getAllMessages(),outcomes:window.chatHandler.getActionOutcomes(),plans:window.chatHandler.getActionPlans()}));
      const next=await sandbox.window.ducoAI.generateResponse(followUp,{messages:state.messages,context:{...context,actionOutcomes:state.outcomes,actionPlans:state.plans}});
      const selected=next.actions.find(action=>action.type==='highlightTerms');
      console.log(JSON.stringify({followUp,actions:next.actions,decision:next.turnDecision}));
      assert.equal(selected.scope,'opened_menu','Las continuaciones mantienen el ámbito del menú');
      assert(menu.items.includes(selected.terms[0]));
      if (followUp==='nuevamente') assert.equal(selected.terms[0],previousLabel);
      else assert.notEqual(selected.terms[0],previousLabel);
      const visible=await page.evaluate(async({next,followUp})=>{
        window.duco.requestAiResponse=async()=>next;
        window.chatHandler.addUserMessage(followUp);
        await window.duco.processUserInput(followUp);
        const target=window.ducoHighlighter.highlightedElement;
        return {visible:!!target?.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) && !!target.closest('.dropdown-menu.show'),label:target?.textContent,open:[...document.querySelectorAll('.dropdown-menu.show')].map(el=>el.getAttribute('aria-labelledby'))};
      },{next,followUp});
      assert(visible.visible,JSON.stringify(visible));
      previousLabel=selected.terms[0];
    }
    console.log('OK Ollama + Chromium: dropdown real abierto y opción de su interior resaltada en orden, sin salir hacia una noticia.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
