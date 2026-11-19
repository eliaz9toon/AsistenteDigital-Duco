/**
 * Cómo manejar el catálogo de carreras (correr en /carreras.html)
 *   const s = document.createElement('script'); s.src = '/tests/catalog-usage.js'; document.head.appendChild(s);
 *   await window.__catalogUsageTests();
 */
(function () {
  window.ducoConfig = Object.assign(window.ducoConfig || {}, {humanizeReplies: false});
  const types = r => (r.actions || []).map(a => a.type).join('>');
  const CASES = [
    ['cómo filtrar por sede explica los filtros', 'como filtro por sede?', r => /modalidad/.test(r.reply) && /jornada/.test(r.reply) && !/Sedes y Campus/.test(r.reply)],
    ['cómo buscar por nombre', 'como busco una carrera por nombre?', r => /Busca aquí/.test(r.reply)],
    ['cómo limpiar los filtros lo hace', 'como limpio los filtros?', r => /Quito todos los filtros/.test(r.reply) && /selectPageControl/.test(types(r))],
    ['cómo abrir una carrera no resalta una al azar', 'como abro una carrera?', r => /tarjeta/.test(r.reply) && !/highlightTerms/.test(types(r))],
    ['cómo ver las vespertinas', 'como veo las vespertinas?', r => /vespertina/.test(r.reply) && /\d+ carreras/.test(r.reply)],
    ['cómo ver solo las online', 'como veo solo las online?', r => /online/.test(r.reply) && /\d+ carreras/.test(r.reply)],
    ['qué puedo hacer en esta página', 'que puedo hacer en esta pagina?', r => /filtrar/.test(r.reply) && /Busca aquí/.test(r.reply)],
    ['cómo ver más carreras no habla de gratuidad', 'como veo mas carreras?', r => !/Gratuidad/.test(r.reply) && /filtros/.test(r.reply)]
  ];
  window.__catalogUsageTests = async () => {
    if (!document.getElementById('bc-filtro-sede')) return 'Correr en carreras.html';
    let pass = 0;
    const failures = [];
    for (const [name, text, check] of CASES) {
      window.chatHandler.clearHistory?.();
      window.chatHandler.addUserMessage(text);
      const reply = await window.duco.requestAiResponse(text);
      window.duco.discardLiveStream?.();
      let ok = false;
      try { ok = !!check(reply); } catch { ok = false; }
      if (ok) pass++; else failures.push(`FAIL [${name}] "${text}" => ${(reply.reply || '').slice(0, 200).replace(/\n/g, ' ⏎ ')} | ${types(reply) || '-'}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
