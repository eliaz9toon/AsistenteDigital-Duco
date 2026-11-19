/**
 * Preguntas frecuentes de la página de Financiamiento (correr en /financiamiento.html)
 *   const s = document.createElement('script'); s.src = '/tests/financiamiento-page.js'; document.head.appendChild(s);
 *   await window.__financiamientoPageTests();
 * Las respuestas salen tal cual de las preguntas frecuentes de la propia página (sin modelo) y la pregunta se señala en pantalla.
 */
(function () {
  window.ducoConfig = Object.assign(window.ducoConfig || {}, {humanizeReplies: false});
  const ask = async text => {
    window.chatHandler.addUserMessage(text);
    const reply = await window.duco.requestAiResponse(text);
    window.duco.discardLiveStream?.();
    window.chatHandler.addAssistantMessage(reply.reply || '', false);
    return reply;
  };
  const types = r => (r.actions || []).map(a => a.type).join('>');
  const CASES = [
    ['gratuidad en vespertinas', 'la gratuidad cubre carreras vespertinas?', r => /diurnas y vespertinas/.test(r.reply) && /highlightTerms/.test(types(r)) && /duoc\.cl/.test(r.reply)],
    ['gratuidad en carreras online', 'hay gratuidad para carreras online?', r => /^No\./.test(r.reply) && /online/i.test(r.reply)],
    ['cómo postular a la gratuidad', 'como postulo a la gratuidad?', r => /FUAS/.test(r.reply) && !/5 pasos/.test(r.reply)],
    ['DICOM', 'puedo matricularme si estoy en dicom?', r => /DICOM/.test(r.reply) && /^Sí/.test(r.reply)],
    ['becas propias', 'duoc tiene becas propias?', r => /^Sí\./.test(r.reply) && /becas/i.test(r.reply)],
    ['dónde pagar cuotas', 'donde pago mis cuotas?', r => /portal de pago/i.test(r.reply)],
    ['resaltar la pregunta exacta', 'resalta ¿Cómo puedo pagar mi matrícula en Duoc UC?', r => /Te señalo la pregunta/.test(r.reply) && /highlightTerms/.test(types(r))],
    ['la respuesta no incluye textos de botones', 'donde veo el valor de la matricula y el arancel?', r => /ficha de cada carrera/.test(r.reply) && !/Revisa carreras y aranceles/.test(r.reply)],
    ['navegar sigue funcionando', 'puedes llevarme a admision?', r => /navigate/.test(types(r))],
    ['fuera de tema no se confunde', 'cual es la mejor pizza?', r => !/Fuente:/.test(r.reply)]
  ];
  window.__financiamientoPageTests = async () => {
    if (document.querySelectorAll('.ad26-faq-item').length < 3) return 'Correr en financiamiento.html';
    let pass = 0;
    const failures = [];
    for (const [name, text, check] of CASES) {
      window.chatHandler.clearHistory?.();
      const reply = await ask(text);
      let ok = false;
      try { ok = !!check(reply); } catch { ok = false; }
      if (ok) pass++; else failures.push(`FAIL [${name}] "${text}" => ${(reply.reply || '').slice(0, 200).replace(/\n/g, ' ⏎ ')} | ${types(reply) || '-'}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
