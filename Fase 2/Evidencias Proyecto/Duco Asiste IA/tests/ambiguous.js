/**
 * Peticiones ambiguas: el asistente decide con algo real del sitio/catálogo en vez de decir "no puedo". (navegador, sin Node)
 *   const s = document.createElement('script'); s.src = '/tests/ambiguous.js'; document.head.appendChild(s);
 *   window.__ambiguousTests().then(x => window.__amb = x);
 */
(function () {
  const types = r => (r.actions || []).map(a => a.type).join('>');
  const picksCareer = r => /^(?:Entre las que te mostré, )?(?:Otra opción: )?(?:Sin problema, elijo yo\. )?Te elijo «/.test(r.reply) && /navigate/.test(types(r)) && !!r.selectedCareer;
  const noRefusal = r => !/no puedo (?:seleccionar|elegir|sorprender)|no tengo claro/i.test(r.reply);
  const CASES = [
    ['una carrera cualquiera', ['buscame una carrera cualquiera'], picksCareer],
    ['carrera al azar', ['dame una carrera al azar'], picksCareer],
    ['elige por mí', ['elige una carrera por mi'], picksCareer],
    ['sorpréndeme', ['sorprendeme'], picksCareer],
    ['muéstrame una cualquiera', ['muestrame una carrera cualquiera'], picksCareer],
    ['carrera random', ['una carrera random'], picksCareer],
    ['llévame a cualquier parte', ['llevame a cualquier parte'], r => picksCareer(r) && /Sin problema/.test(r.reply)],
    ['llévame a algo interesante', ['llevame a algo interesante'], picksCareer],
    ['"cualquiera" tras lista', ['quiero algo de cocina', 'cualquiera'], r => /Entre las que te mostré/.test(r.reply) && /Gastronom/.test(r.reply) && picksCareer(r)],
    ['"lo que sea" sin contexto', ['lo que sea'], r => /sorpréndeme/.test(r.reply) && noRefusal(r)],
    ['"me da igual"', ['quiero estudiar algo', 'me da igual'], noRefusal],
    ['"otra" tras carrera al azar', ['sorprendeme', 'otra'], r => /Otra opción: Te elijo/.test(r.reply) && picksCareer(r)],
    ['"dame otra" tras resaltar', ['resaltame algo', 'dame otra'], r => /highlightTerms/.test(types(r)) && /Te señalo/.test(r.reply)],
    ['"otra" tras abrir menú', ['abre algun menu', 'otro'], r => /dropdown/.test(types(r))],
    ['"otra" sin contexto', ['otra'], noRefusal],
    ['abre cualquier menú', ['abre cualquier menu'], r => types(r) === 'dropdown'],
    ['resáltame algo', ['resaltame algo'], r => /highlightTerms/.test(types(r)) && /Te señalo/.test(r.reply)],
    ['señálame cualquier cosa', ['senalame cualquier cosa'], r => /highlightTerms/.test(types(r))],
    ['muéstrame algo', ['muestrame algo'], r => /highlightTerms/.test(types(r))],
    ['ayuda', ['ayuda'], r => /sorpréndeme|Búscame una carrera cualquiera/.test(r.reply) && /Recomiéndame/.test(r.reply)],
    ['no sé', ['no se'], r => /Recomiéndame/.test(r.reply)],
    ['por dónde empiezo', ['por donde empiezo?'], r => /Recomiéndame/.test(r.reply)],
    ['tengo una duda', ['tengo una duda'], r => /Recomiéndame/.test(r.reply)],
    ['signo de pregunta', ['?'], r => /Recomiéndame/.test(r.reply)],
    ['recomiéndame sin datos', ['recomiendame una carrera'], r => /qué te gusta/.test(r.reply) && /sorpréndeme/.test(r.reply)],
    ['qué me recomiendas sin datos', ['que me recomiendas?'], r => /qué te gusta/.test(r.reply)],
    ['recomiéndame con gustos', ['me gusta la cocina', 'recomiendame una carrera'], r => /Gastronom/.test(r.reply)],
    ['la mejor', ['la mejor'], r => /No tengo datos/.test(r.reply)],
    ['carrera fácil', ['una carrera facil'], r => /No tengo datos/.test(r.reply)],
    ['la más barata', ['la mas barata'], r => /No tengo datos/.test(r.reply)],
    ['la más popular', ['la mas popular'], r => /No tengo datos/.test(r.reply)],
    ['sigue funcionando: carrera concreta', ['llevame a enfermeria'], r => /Enfermer/.test(r.reply) && /navigate/.test(types(r)) && !/Te elijo/.test(r.reply)],
    ['sigue funcionando: área', ['algo de salud'], r => /Salud|Enfermer/.test(r.reply) && !/Te elijo/.test(r.reply)]
  ];
  window.__ambiguousTests = async () => {
    const failures = [];
    let pass = 0;
    for (const [label, messages, check] of CASES) {
      window.chatHandler.clearHistory?.();
      let reply;
      for (const text of messages) {
        window.chatHandler.addUserMessage(text);
        try { reply = await window.duco.requestAiResponse(text); } catch (error) { reply = {reply: 'ERROR ' + error.message, actions: []}; }
        window.duco.discardLiveStream?.();
        window.chatHandler.addAssistantMessage(reply.reply || '', false);
      }
      let ok = false;
      try { ok = !!check(reply); } catch { ok = false; }
      if (ok) pass++; else failures.push(`FAIL ${label}: "${messages.at(-1)}"\n   => ${(reply.reply || '').slice(0, 170).replace(/\n/g, ' ⏎ ')} | ${types(reply) || '-'}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
