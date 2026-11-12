// Prueba de integración semántica: requiere Ollama y qwen3.5:9b locales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = vm.createContext({window:{ducoConfig:{ollamaModel:'qwen3.5:9b'}},console,AbortController,setTimeout,clearTimeout,fetch});
vm.runInContext(fs.readFileSync('js/ollama-client.js','utf8'),sandbox);
const client = sandbox.window.ducoAI;
const first = {type:'highlightTerms',target:['Duoc Online'],request:'resalta lo que quieras',success:true};
const wrong = {type:'highlightTerms',target:['Nuestras Escuelas'],request:'denuevo porfa',success:true};
const dialogue = [
  {type:'user',text:'resalta lo que quieras'},
  {type:'assistant',text:"Resaltando 'Duoc Online' en la página."},
  {type:'assistant',text:'🔎 Buscando: Duoc Online'}
];
const send = async payload => {
  const response = await fetch('http://localhost:11434/api/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)
  });
  if (!response.ok) throw Error(await response.text());
  const data = await response.json();
  if (process.env.DUCO_DEBUG_REFERENCE && payload.format?.properties?.mode) console.log('Referencia:',data.message.content);
  return data;
};
(async () => {
  for (const text of ['denuevo porfa','puedes volver a hacerlo?']) {
    const reply = await client.resolveActionReference(text,dialogue,[first],send);
    assert(reply,'Debe resolver la continuación: '+text);
    assert.deepEqual(Array.from(reply.actions[0].terms),['Duoc Online']);
    assert.equal(reply.intent.reference,'resolved_action');
  }
  const mistakenDialogue = [...dialogue,
    {type:'user',text:'denuevo porfa'},
    {type:'assistant',text:"¡De acuerdo! Resaltando 'Nuestras Escuelas' para que lo veas."},
    {type:'assistant',text:'🔎 Buscando: Nuestras Escuelas'}
  ];
  const correction = await client.resolveActionReference('me referia al mismo de antes',mistakenDialogue,[first,wrong],send);
  assert(correction,'Debe resolver la corrección');
  assert.deepEqual(Array.from(correction.actions[0].terms),['Duoc Online'],'Recuperar la acción original, no la respuesta equivocada');
  const noCatalog = await client.resolveActionReference('ahora resalta algo distinto',dialogue,[first],send);
  assert.equal(noCatalog.actions.length,0,'Si no hay catálogo visible, pedir un objetivo en lugar de repetir');
  const initial = 'Carreras Técnicas y Profesionales';
  const catalog = [initial,'Duoc Online','Nuestras Escuelas','Biblioteca','Sedes y Campus','Admisión Duoc UC'];
  const alternativeHistory = [
    {type:'user',text:'Buenas, puedes resaltar algo del sitio? te lo dejo a tu eleccion'},
    {type:'assistant',text:"Acá te muestro la sección de '"+initial+"'."},
    {type:'assistant',text:'🔎 Buscando: '+initial}
  ];
  const outcomes = [{type:'highlightTerms',target:[initial],request:alternativeHistory[0].text,success:true}];
  const used = new Set([initial]);
  for (const text of ['y otra cosa?','y otra cosa?','¿Qué otra sección me puedes mostrar?','cambia de elemento']) {
    const other = await client.resolveActionReference(text,alternativeHistory,outcomes,send,catalog);
    assert(other,'Debe resolver la elección de otro objetivo: '+text);
    const target = other.actions[0].terms[0];
    assert(catalog.includes(target),'Elegir un texto literal disponible');
    assert(!used.has(target),'No repetir un objetivo ya mostrado al pedir una alternativa');
    used.add(target);
    alternativeHistory.push({type:'user',text},{type:'assistant',text:other.reply},{type:'assistant',text:'🔎 Buscando: '+target});
    outcomes.push({type:'highlightTerms',target:[target],request:text,success:true});
  }
  const again = await client.resolveActionReference('denuevo porfa',alternativeHistory,outcomes,send,catalog);
  assert.equal(again.actions[0].terms[0],outcomes.at(-1).target[0],'Después de elegir otro, repetir conserva el último objetivo');
  const stuckHistory = alternativeHistory.slice(0,3);
  const stuckOutcomes = [outcomes[0]];
  for (let i=0; i<4; i++) {
    stuckHistory.push({type:'user',text:'y otra cosa?'},{type:'assistant',text:'Vuelvo a mostrarlo.'},{type:'assistant',text:'🔎 Buscando: '+initial});
    stuckOutcomes.push({type:'highlightTerms',target:[initial],request:'y otra cosa?',success:true});
  }
  const unstuck = await client.resolveActionReference('y otra cosa?',stuckHistory,stuckOutcomes,send,catalog);
  assert(unstuck && unstuck.actions.length);
  assert.notEqual(unstuck.actions[0].terms[0],initial,'Salir del bucle aunque el historial contenga varias repeticiones erróneas');
  const generated = await client.generateResponse('y otra cosa?',{
    messages:stuckHistory,context:{actionOutcomes:stuckOutcomes,pageVisibleContent:catalog}
  });
  assert.notEqual(generated.actions[0].terms[0],initial,'El cliente completo debe aplicar la selección alternativa');
  assert.equal(generated.intent.reference,'resolved_action');
  console.log('OK Ollama: repetición informal, referencia equivalente, corrección de un objetivo erróneo y petición de otro objetivo.');
  console.log('OK Ollama: alternativas consecutivas eligen textos distintos del catálogo y una repetición posterior conserva el último.');
})().catch(error=>{console.error(error);process.exitCode=1;});
