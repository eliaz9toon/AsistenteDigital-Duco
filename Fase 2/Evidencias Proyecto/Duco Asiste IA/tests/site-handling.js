/**
 * Manejo del sitio: menús, resaltado, desplazamiento y navegación (navegador, sin Node; correr en duoc.html)
 *   const s = document.createElement('script'); s.src = '/tests/site-handling.js'; document.head.appendChild(s);
 *   await window.__siteTests();
 */
(function () {
  const types = r => (r.actions || []).map(a => a.type).join('>');
  const term = r => (r.actions || []).filter(a => a.terms).map(a => a.terms[0]).pop();
  const CASES = [
    ['abrir menú', 'abre el menu de escuelas', r => types(r) === 'dropdown' && term(r) === 'Escuelas'],
    ['cerrar menú', 'cierra el menu', r => types(r) === 'closeDropdown'],
    ['cerrar todo', 'cierra todo', r => /closeDropdown/.test(types(r)) && /clearHighlights/.test(types(r))],
    ['ubicar menú', 'donde esta el menu de admision?', r => types(r) === 'highlightTerms' && term(r) === 'Admisión'],
    ['abrir y resaltar', 'abre vida estudiantil y resalta deportes', r => types(r) === 'dropdown>highlightTerms' && term(r) === 'Deportes'],
    ['opción dentro de menú', 'resalta la opcion sedes y campus', r => types(r) === 'dropdown>highlightTerms' && term(r) === 'Sedes y Campus'],
    ['menú de carreras online', 'abre el menu de carreras online', r => types(r) === 'dropdown' && term(r) === 'CARRERAS ONLINE'],
    ['contenido del menú', 'que hay en el menu de nosotros?', r => /Autoridades/.test(r.reply) && /Transparencia/.test(r.reply) && types(r) === 'dropdown'],
    ['opciones de un menú', 'que opciones tiene el menu de admision?', r => /Tu Primer Paso/.test(r.reply)],
    ['una opción por nombre', 'muestrame las autoridades', r => types(r) === 'dropdown>highlightTerms' && term(r) === 'Autoridades'],
    ['enlace externo se señala, no se navega', 'llevame a duoc online', r => !/navigate/.test(types(r)) && term(r) === 'Duoc Online'],
    ['semestre cero', 'abre semestre cero', r => term(r) === 'Semestre Cero'],
    ['calendario', 'donde puedo ver el calendario?', r => term(r) === 'Calendario 2026'],
    ['enlace superior', 'quiero ir a pago en linea', r => term(r) === 'Pago en línea'],
    ['logo', 'resalta el logo', r => types(r) === 'highlightTerms'],
    ['palabra de la página', 'resalta la palabra admision', r => types(r) === 'highlightTerms'],
    ['subir', 'sube al inicio de la pagina', r => types(r) === 'scroll' && r.actions[0].top === 0],
    ['bajar', 'baja un poco', r => types(r) === 'scroll' && r.actions[0].deltaY > 0],
    ['ir al final', 've al final de la pagina', r => types(r) === 'scroll' && r.actions[0].top > 10000],
    ['dos pasos', 'abre el menu de admision y muestrame tu primer paso', r => types(r) === 'dropdown>highlightTerms' && term(r) === 'Tu Primer Paso'],
    ['carrera directa por menú', 'llevame a la pagina de ingenieria en informatica', r => /dropdown>navigate/.test(types(r)) && /ingenieria-en-informatica/.test(JSON.stringify(r.actions))],
    ['carrera con typo (TENS)', 'llevame a TENS', r => /navigate/.test(types(r)) && /enfermer/i.test(JSON.stringify(r.actions))],
    ['sede en mapa', 'donde esta la sede de maipu', r => r.actions[0]?.type === 'showMap'],
    ['sin abrir nada', 'no abras nada, solo dime donde esta admision', r => !/dropdown/.test(types(r))],
    ['inicio ya estando en inicio', 'vuelve al inicio', r => /Ya estás/.test(r.reply)]
  ];
  window.__siteTests = async () => {
    const failures = [];
    let pass = 0;
    for (const [label, text, check] of CASES) {
      window.chatHandler.clearHistory?.();
      window.chatHandler.addUserMessage(text);
      let reply;
      try { reply = await window.duco.requestAiResponse(text); } catch (error) { reply = {reply: 'ERROR ' + error.message, actions: []}; }
      window.duco.discardLiveStream?.();
      let ok = false;
      try { ok = !!check(reply); } catch { ok = false; }
      if (ok) pass++; else failures.push(`FAIL ${label}: "${text}"\n   => ${(reply.reply || '').slice(0, 160).replace(/\n/g, ' ⏎ ')} | ${types(reply) || '-'} ${term(reply) || ''}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
