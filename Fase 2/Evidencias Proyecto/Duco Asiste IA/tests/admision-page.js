/**
 * Pasos de la matrícula en la página de Admisión (correr en /admision.html)
 *   const s = document.createElement('script'); s.src = '/tests/admision-page.js'; document.head.appendChild(s);
 *   await window.__admisionPageTests();
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
  const terms = r => (r.actions || []).filter(a => a.type === 'highlightTerms').flatMap(a => a.terms || []);
  const CASES = [
    ['paso a paso lista los 5 pasos reales', 'puedes explicarme paso a paso?', r => /5 pasos/.test(r.reply) && /Elige tu carrera/.test(r.reply) && /Firma tu contrato/.test(r.reply) && /Define tu forma de pago/.test(r.reply) && /matriculado/.test(r.reply) && !/\*/.test(r.reply) && terms(r).length === 5],
    ['cita el sitio oficial, no la copia local', 'puedes explicarme paso a paso?', r => /https:\/\/www\.duoc\.cl\/admision\//.test(r.reply) && !/127\.0\.0\.1|localhost|capturad|29 de octubre/i.test(r.reply)],
    ['«cómo me matriculo» da los mismos pasos', 'como me matriculo?', r => /5 pasos/.test(r.reply)],
    ['«etapas» también', 'cuales son las etapas de la matricula?', r => /5 pasos/.test(r.reply)],
    ['resaltar después de la lista señala los 5 pasos', ['puedes explicarme paso a paso?', 'puedes irme mostrando en el sitio resaltandomelo?'], r => terms(r).length === 5],
    ['explicar la admisión no cita la copia local', 'explicame sobre la admision?', r => !/127\.0\.0\.1|localhost|capturad|29 de octubre/i.test(r.reply) && r.reply.length > 40],
    ['otra pregunta de la página sigue funcionando', 'resalta Firma tu contrato', r => /highlightTerms/.test((r.actions || []).map(a => a.type).join())]
  ];
  window.__admisionPageTests = async () => {
    if (!document.querySelector('.ad26-reserva-paso')) return 'Correr en admision.html';
    let pass = 0;
    const failures = [];
    for (const [name, turns, check] of CASES) {
      window.chatHandler.clearHistory?.();
      let reply;
      for (const text of [].concat(turns)) reply = await ask(text);
      let ok = false;
      try { ok = !!check(reply); } catch { ok = false; }
      if (ok) pass++; else failures.push(`FAIL [${name}] => ${(reply.reply || '').slice(0, 200).replace(/\n/g, ' ⏎ ')} | ${(reply.actions || []).map(a => a.type).join('>') || '-'}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
