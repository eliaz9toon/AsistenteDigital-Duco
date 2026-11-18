/**
 * Interfaz de los casos de uso CU-07 (nueva conversación) y A3 de CU-01/02/03/06 (falla y reintento). (navegador, sin Node)
 *   const s = document.createElement('script'); s.src = '/tests/conversation-ui.js'; document.head.appendChild(s);
 *   window.__conversationUiTests().then(x => window.__cui = x);
 * Las fallas se simulan reemplazando temporalmente métodos del asistente; no se toca ningún servicio real.
 */
(function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.__conversationUiTests = async () => {
    const duco = window.duco;
    const root = document.querySelector('#duco-assistant-container');
    const input = root.querySelector('textarea, input[type=text]');
    const results = [];
    const check = (name, ok) => results.push([name, !!ok]);
    const waitIdle = async () => { for (let i = 0; i < 60 && duco.isProcessing; i++) await sleep(500); };
    const buttons = () => [...root.querySelectorAll('.duco-transient-actions button')].map(b => b.textContent.trim());
    const click = text => [...root.querySelectorAll('button')].find(b => b.textContent.trim() === text)?.click();
    const users = () => window.chatHandler.getDialogueMessages().filter(m => m.type === 'user').length;
    const welcome = () => /Soy Duco, tu asistente virtual/.test(root.textContent);

    await waitIdle();
    window.chatHandler.clearHistory();
    // CU-07 A1: sin conversación previa se reinicia igual, sin pedir confirmación.
    document.getElementById('duco-reset-btn').click();
    check('CU-07 A1 reinicia sin confirmar', buttons().length === 0 && welcome());
    // CU-07 flujo principal con confirmación.
    input.value = 'cuantas sedes tiene duoc?';
    await duco.handleUserInput();
    await waitIdle();
    check('hay conversación', users() === 1);
    document.getElementById('duco-reset-btn').click();
    check('CU-07 pide confirmación', buttons().join('|') === 'Sí, empezar de nuevo|Cancelar' && users() === 1);
    // CU-07 A2: cancelar conserva la conversación.
    click('Cancelar');
    check('CU-07 A2 cancelar conserva', users() === 1 && /sedes/.test(root.textContent) && buttons().length === 0);
    // Confirmar borra historial y muestra bienvenida.
    document.getElementById('duco-reset-btn').click();
    click('Sí, empezar de nuevo');
    check('CU-07 confirmar limpia y da la bienvenida', users() === 0 && welcome() && !/cuantas sedes/.test(root.textContent));
    check('CU-07 limpia el borrador', input.value === '');
    // CU-07 A3: error local con reintento.
    const originalReset = duco.performReset.bind(duco);
    let failReset = 1;
    duco.performReset = () => { if (failReset-- > 0) throw new Error('fallo simulado'); return originalReset(); };
    document.getElementById('duco-reset-btn').click();
    check('CU-07 A3 informa el error y ofrece reintentar', /No se pudo reiniciar/.test(root.textContent) && buttons().includes('🔄 Reintentar'));
    click('🔄 Reintentar');
    check('CU-07 A3 reintento funciona', welcome() && !/No se pudo reiniciar/.test(root.textContent));
    duco.performReset = originalReset;

    // A3 de CU-01/02/03/06: falla de la IA con botón Reintentar, sin duplicar el mensaje del usuario.
    const originalRequest = duco.requestAiResponse.bind(duco);
    let failAi = 1;
    duco.requestAiResponse = async (...args) => { if (failAi-- > 0) throw new Error('OLLAMA_NETWORK_ERROR'); return originalRequest(...args); };
    input.value = 'cuantas sedes tiene duoc?';
    await duco.handleUserInput();
    check('A3 informa la falla', /No se pudo establecer conexión con la IA/.test(root.textContent));
    check('A3 ofrece Reintentar', !!root.querySelector('.duco-retry-btn'));
    root.querySelector('.duco-retry-btn')?.click();
    await sleep(300);
    await waitIdle();
    check('A3 el reintento responde', /19 sedes|sedes y campus/.test(root.textContent) && !root.querySelector('.duco-retry-btn'));
    check('A3 no duplica el mensaje del usuario', users() === 1);
    // Sin respuesta de la IA (null).
    duco.requestAiResponse = async () => null;
    input.value = 'hola duco que tal estas';
    await duco.handleUserInput();
    check('A3 sin respuesta también ofrece Reintentar', /No pude conectarme con la IA/.test(root.textContent) && !!root.querySelector('.duco-retry-btn'));
    duco.requestAiResponse = originalRequest;
    await waitIdle();

    const failed = results.filter(([, ok]) => !ok).map(([name]) => 'FAIL ' + name);
    return `${results.length - failed.length}/${results.length} pasan` + (failed.length ? '\n' + failed.join('\n') : '');
  };
})();
