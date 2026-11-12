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
    const messages=[{type:'user',text:'abre un dropdown'},{type:'assistant',text:'No puedo abrir ni cerrar menús desplegables en tu navegador, ya que soy una inteligencia artificial de texto.'}];
    for (const text of ['cierra el dropdown que tengo abierto?','abre un dropdown y subsecuentemente cierralo? porfavor']) {
      const answer=await sandbox.window.ducoAI.generateResponse(text,{context,messages});
      console.log(JSON.stringify({text,reply:answer.reply,actions:answer.actions,turnDecision:answer.turnDecision}));
      assert(answer.actions.some(a=>a.type==='closeDropdown'));
      assert(!/no puedo|no tengo acceso|inteligencia artificial de texto/i.test(answer.reply));
      if (text.startsWith('abre')) assert.equal(answer.actions[0].type,'dropdown');
      const result=await page.evaluate(async({answer,text})=>{
        const duco=window.duco;
        const seed=duco.bindMenuActions([{type:'dropdown',terms:[duco.getNavigationMenus()[0].label]}]);
        await duco.executeFlowAction(seed[0]);
        const actions=duco.bindMenuActions(duco.reorderAndAdjustActionsForQuery(answer.actions,text));
        const states=[];
        for (const action of actions) {
          const outcome=await duco.executeFlowAction(action);
          states.push({type:action.type,success:outcome.success,open:document.querySelectorAll('.dropdown-menu.show').length});
        }
        return states;
      },{answer,text});
      assert(result.every(r=>r.success));
      if(text.startsWith('abre')) assert(result[0].open>0,'El menú realmente debe abrirse primero');
      assert.equal(result.at(-1).open,0,'El menú debe terminar cerrado');
    }
    console.log('OK: Ollama genera apertura/cierre pese al historial erróneo y el navegador ejecuta el orden correcto.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
