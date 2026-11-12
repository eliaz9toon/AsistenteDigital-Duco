const {chromium}=require('playwright');
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.route('**/*',r=>/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.request().url())?r.continue():r.abort());
    await page.goto('http://127.0.0.1:5500/duoc.html');
    await page.waitForFunction(()=>window.duco);
    const context=await page.evaluate(()=>({navigationMenus:window.duco.getNavigationMenus(),pageVisibleContent:window.duco.getVisiblePageContentForAi()}));
    const sandbox=vm.createContext({window:{},console,fetch,AbortController,setTimeout,clearTimeout});
    vm.runInContext(fs.readFileSync('js/ollama-client.js','utf8'),sandbox);
    const client=sandbox.window.ducoAI;
    const request='abre un dropdown y subsecuentemente cierralo? porfavor';
    const initial=await client.generateResponse(request,{context});
    assert.deepEqual(Array.from(initial.actions,a=>a.type),['dropdown','closeDropdown']);
    await page.evaluate(async({initial,request})=>{
      window.duco.typewriterSpeed=0;
      const actions=window.duco.bindMenuActions(window.duco.reorderAndAdjustActionsForQuery(initial.actions,request));
      await window.duco.runAssistantFlow(window.duco.buildFlowFromAiResponse({...initial,reply:'',actions}),{userText:request});
    },{initial,request});
    await page.reload();
    await page.waitForFunction(()=>window.duco);
    const plans=await page.evaluate(()=>window.chatHandler.getActionPlans());
    assert.equal(plans.length,1);
    assert.deepEqual(plans[0].actions.map(a=>a.type),['dropdown','closeDropdown']);
    assert.equal(plans[0].actions[0].pauseAfter,1000);
    assert(plans[0].outcomes.every(o=>o.success));
    const dialogue=[{type:'user',text:request},{type:'assistant',text:'Abro el menú y después lo cierro.'}];
    for (const text of ['ahora pruebalo, hice arreglos',`Era esto "${request}"`,'solamente cerraste dropdown, y lo de abrirlo? que paso?']) {
      const answer=await client.generateResponse(text,{messages:dialogue,context:{...context,actionPlans:plans,
        actionOutcomes:[{type:'closeDropdown',target:[],request,success:true}]}});
      console.log(JSON.stringify({text,actions:answer.actions}));
      assert.deepEqual(Array.from(answer.actions,a=>a.type),['dropdown','closeDropdown']);
      const states=await page.evaluate(async({answer,text})=>{
        const duco=window.duco;
        const actions=duco.bindMenuActions(duco.reorderAndAdjustActionsForQuery(answer.actions,text));
        const result=[];
        for(const action of actions){await duco.executeFlowAction(action);result.push(document.querySelectorAll('.dropdown-menu.show').length);}
        return result;
      },{answer,text});
      assert(states[0]>0);
      assert.equal(states[1],0);
      dialogue.push({type:'user',text},{type:'assistant',text:'Cierro el menú desplegable.'});
    }
    // Compatibilidad con sesiones previas, que no guardaban planes.
    const legacy=await client.generateResponse(`Era esto "${request}"`,{messages:dialogue,
      context:{...context,actionOutcomes:[{type:'closeDropdown',target:[],request,success:true}]}});
    assert.deepEqual(Array.from(legacy.actions,a=>a.type),['dropdown','closeDropdown']);
    const errors=await page.evaluate(()=>({internal:window.duco.getUserFacingError(new TypeError('Cannot read properties of undefined')),network:window.duco.getUserFacingError(new Error('OLLAMA_NETWORK_ERROR'))}));
    assert(!errors.internal.includes('conexión'));
    assert(errors.network.includes('conexión'));
    await page.evaluate(()=>window.chatHandler.clearHistory());
    assert.equal(await page.evaluate(()=>window.chatHandler.getActionPlans().length),0);
    console.log('OK: plan completo persistido y recuperado para probar, citar y corregir; apertura/cierre reales, sesión antigua y errores diferenciados.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
