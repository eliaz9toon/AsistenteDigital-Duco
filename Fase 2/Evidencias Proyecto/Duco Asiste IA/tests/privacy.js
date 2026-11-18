/**
 * Datos sensibles en el chat: se tapan, no llegan al historial ni a la IA. (navegador, sin Node; correr en duoc.html)
 *   const s = document.createElement('script'); s.src = '/tests/privacy.js'; document.head.appendChild(s);
 *   await window.__privacyTests();
 * Los valores de prueba son inventados (la tarjeta es un número de prueba público de Visa).
 */
(function () {
  const SENSITIVE = [
    ['clave con "es"', 'mi contraseña es Duoc2026!', 'Duoc2026'],
    ['clave con ":"', 'clave: 8374abc', '8374abc'],
    ['password inglés', 'my password is hunter2xyz', 'hunter2xyz'],
    ['pin', 'mi pin es 4821', '4821'],
    ['clave sin "es"', 'mi clave 9921xk', '9921xk'],
    ['tarjeta válida', 'mi tarjeta es 4111 1111 1111 1111', '4111'],
    ['tarjeta con guiones', 'paga con 4111-1111-1111-1111 por favor', '4111-1111'],
    ['cvv', 'el cvv es 123', '123'],
    ['RUT', 'mi rut es 12.345.678-5', '12.345.678'],
    ['cuenta bancaria', 'mi cuenta corriente es 00123456789', '00123456789'],
    ['token API', 'usa este token sk-abcdefghijklmnop1234567890', 'sk-abcdef'],
    ['conexión Oracle', 'conectate con DUCO_APP/Secreta123@localhost:1521/FREEPDB1', 'Secreta123'],
    ['mezclado con pregunta', 'hola, mi contraseña es Pass9876 y quiero saber los requisitos', 'Pass9876']
  ];
  const HARMLESS = [
    'cual es la clave del exito en una carrera',
    'cuantos dias dura la matricula? son 153',
    'mi numero de telefono es 912345678',
    'necesito requisitos para entrar',
    'estudio enfermeria desde 2024-03-01',
    'quiero ver el pago en linea',
    'cuanto dura enfermeria, 5 semestres?',
    'olvide mi clave, como la recupero?',
    'necesito cambiar mi contraseña'
  ];
  const ASKS = ['puedo pasarte mi contraseña?', 'te doy mi clave para que entres?', 'necesitas mi contraseña para matricularme?'];
  window.__privacyTests = async () => {
    const failures = [];
    let pass = 0, total = 0;
    const P = window.ducoPrivacy;
    const fetches = [];
    const realFetch = window.fetch;
    window.fetch = (...args) => { fetches.push(String(args[0])); return realFetch.apply(window, args); };
    try {
      for (const [label, text, secret] of SENSITIVE) {
        total += 4;
        const info = P.inspect(text);
        if (info.sensitive && !info.redacted.includes(secret)) pass++; else failures.push(`FAIL [${label}] no se tapó: "${info.redacted}"`);
        window.chatHandler.clearHistory?.();
        const before = fetches.filter(url => /11434|\/api\/(?:chat|generate)/.test(url)).length;
        const message = window.chatHandler.addUserMessage(text);
        if (!message.text.includes(secret)) pass++; else failures.push(`FAIL [${label}] el historial guardó el dato`);
        let reply;
        try { reply = await window.duco.requestAiResponse(text); } catch (error) { reply = {reply: 'ERROR ' + error.message, actions: []}; }
        window.duco.discardLiveStream?.();
        if (/por tu seguridad/i.test(reply.reply)) pass++; else failures.push(`FAIL [${label}] respuesta: ${(reply.reply || '').slice(0, 100)}`);
        const sentToModel = fetches.filter(url => /11434|\/api\/(?:chat|generate)/.test(url)).length - before;
        const stored = JSON.stringify(sessionStorage.getItem('duco-chat-session') || '');
        if (sentToModel === 0 && !stored.includes(secret)) pass++; else failures.push(`FAIL [${label}] llamadas al modelo: ${sentToModel}, en sessionStorage: ${stored.includes(secret)}`);
      }
      for (const text of HARMLESS) {
        total++;
        if (!P.inspect(text).sensitive) pass++; else failures.push(`FAIL falso positivo: "${text}" → ${P.inspect(text).redacted}`);
      }
      for (const text of ASKS) {
        total++;
        const info = P.inspect(text);
        if (info.ask && !info.sensitive) pass++; else failures.push(`FAIL pregunta sobre dar claves no detectada: "${text}"`);
      }
    } finally { window.fetch = realFetch; }
    return `${pass}/${total} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
