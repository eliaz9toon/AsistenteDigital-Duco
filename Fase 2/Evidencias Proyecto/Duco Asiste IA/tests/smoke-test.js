/** Pruebas locales sin dependencias ni conexión a Ollama. Ejecutar: node tests/smoke-test.js */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const session = new Map();
const window = { ducoConfig: { ollamaModel: 'qwen3.5:9b' } };
const context = vm.createContext({
  window, console, setTimeout, clearTimeout, Date, Set, AbortController,
  sessionStorage: {
    getItem: k => session.get(k) ?? null,
    setItem: (k,v) => session.set(k,v),
    removeItem: k => session.delete(k)
  },
  fetch: async () => ({ok:true})
});
vm.runInContext(fs.readFileSync('js/chat-handler.js','utf8'),context);
const chat = window.chatHandler;
assert(chat, 'El ChatHandler debe inicializarse');
chat.clearHistory();
chat.addUserMessage('Prueba Duco');
assert.equal(chat.getAllMessages().length, 1);
assert(session.has('duco-chat-session'), 'Historial guardado en Session Storage');
chat.clearHistory();
assert.equal(chat.getAllMessages().length, 0);
assert(!session.has('duco-chat-session'), 'Historial borrado de Session Storage');
let online = true;
let calls = 0;
context.fetch = async () => {calls++; if (!online) throw Error('apagado'); return {ok:true};};
vm.runInContext(fs.readFileSync('js/ollama-client.js','utf8'),context);
(async()=>{
  assert.equal(await window.ducoAI.isServerOnline(),true);
  online=false;
  assert.equal(await window.ducoAI.isServerOnline(),false);
  online=true;
  assert.equal(await window.ducoAI.isServerOnline(),true);
  assert.equal(calls,3,'El cliente comprueba si Ollama vuelve a estar disponible');
  console.log('OK: Session Storage, limpiar historial, reconexión a Ollama (simulada).');
})().catch(err=>{console.error(err);process.exitCode=1;});
