/**
 * Navegación y respuestas sin sentido: destinos inexistentes, sitios externos, preguntas sobre la página. (navegador, sin Node)
 *   const s = document.createElement('script'); s.src = '/tests/navigation-edge.js'; document.head.appendChild(s);
 *   window.__navEdgeTests().then(x => window.__ne = x);   // tarda: muchos casos llegan al modelo
 */
(function () {
  const types = r => (r.actions || []).map(a => a.type).join('>');
  const term = r => (r.actions || []).filter(a => a.terms).map(a => a.terms[0]).pop();
  const notFound = r => /No encontré|No encuentro|no hay una carrera|no hay carrera/i.test(r.reply) && !/navigate|highlightTerms/.test(types(r));
  const CASES = [
    ['carrera inexistente: medicina', 'llevame a medicina', notFound],
    ['carrera inexistente: periodismo', 'llevame a la ficha de periodismo', notFound],
    ['carrera inexistente: derecho', 'abre la carrera de derecho', r => /no hay una carrera llamada/.test(r.reply)],
    ['sitio externo: google', 'abre google', r => /Solo puedo moverme dentro del sitio/.test(r.reply) && !r.actions.length],
    ['sitio externo: facebook', 'llevame a facebook', r => /no abro otros sitios|pie de la página/.test(r.reply) && !/closeDropdown/.test(types(r))],
    ['sitio externo: youtube', 've a youtube', r => /no abro otros sitios|pie de la página/.test(r.reply)],
    ['redes sociales', 'donde estan las redes sociales?', r => /Instagram/.test(r.reply) && /scroll/.test(types(r))],
    ['escuela de informática', 'abre la escuela de informatica', r => /dropdown>highlightTerms/.test(types(r)) && /Informática/.test(term(r) || '')],
    ['escuela de gastronomía', 'muestrame la escuela de gastronomia', r => /dropdown>highlightTerms/.test(types(r)) && /Gastronom/.test(term(r) || '')],
    ['escuelas > salud', 'ir a escuelas > salud', r => /dropdown>highlightTerms/.test(types(r)) && /Salud/.test(term(r) || '')],
    ['click en un menú', 'clic en admision', r => /dropdown/.test(types(r)) && !/closeDropdown/.test(types(r))],
    ['click en carreras', 'haz click en carreras', r => /navigate|dropdown/.test(types(r))],
    ['menú que no existe', 'abre el menu que dice xyz', r => /No encuentro un menú/.test(r.reply) && !r.actions.length],
    ['menú por una opción', 'abre el menu de contacto', r => /Contáctanos/.test(r.reply)],
    ['no cierra lo que no se pidió', 'resalta el boton de matricula', r => !/closeDropdown/.test(types(r))],
    ['correo de admisión', 'cual es el correo de admision?', r => /Contáctanos/.test(r.reply) && !/@/.test(r.reply.replace(/admisionduoconline@duoc\.cl/, ''))],
    ['teléfono de contacto', 'donde esta el telefono de contacto?', r => /Contáctanos/.test(r.reply)],
    ['resumen de la página', 'hazme un resumen de la pagina', r => /secciones principales/.test(r.reply) && /Nuestras Escuelas|Admisión Duoc UC/.test(r.reply)],
    ['qué hay en la página', 'que hay en esta pagina?', r => /secciones principales/.test(r.reply)],
    ['cambiar color', 'cambia el color de la pagina', r => /No puedo cambiar el aspecto/.test(r.reply)],
    ['traducir página', 'traduce la pagina al ingles', r => /No puedo traducir el sitio/.test(r.reply)],
    ['refrescar', 'refresca la pagina', r => /F5/.test(r.reply)],
    ['borrar todo', 'borra todo', r => /Iniciar nueva conversación/.test(r.reply)],
    ['en qué página estoy', 'en que pagina estoy?', r => /inicio/i.test(r.reply)],
    ['sigue funcionando: carreras', 'llevame a la pagina de carreras', r => /navigate/.test(types(r))],
    ['sigue funcionando: carrera real', 'llevame a ingenieria en informatica', r => /navigate/.test(types(r)) && /Informática/.test(r.reply)],
    ['sigue funcionando: menú real', 'abre el menu de admision', r => types(r) === 'dropdown']
  ];
  // Solo en carreras.html: los filtros reales del catálogo (solo se revisa el plan; la ejecución se probó a mano con handleUserInput).
  const ids = r => (r.actions || []).map(a => a.terms?.[0]).join(',');
  const FILTER_CASES = [
    ['filtra por salud', r => ids(r) === 'bc-escuela-salud-y-bienestar'],
    ['solo las tecnicas', r => ids(r) === 'bc-tipo-tecnica'],
    ['quiero ver solo las online', r => ids(r) === 'bc-modalidad-online'],
    ['filtra por vespertino y presencial', r => /bc-jornada-vespertina/.test(ids(r)) && /bc-modalidad-presencial/.test(ids(r))],
    ['filtra por sede maipu', r => ids(r) === 'bc-sede-sede-maipu'],
    ['filtra por diseno', r => ids(r) === 'bc-escuela-diseno'],
    ['quita los filtros', r => /bc-modalidad-todas/.test(ids(r)) && /bc-escuela-todas/.test(ids(r)) && /bc-jornada-todas/.test(ids(r))],
    ['solo dime cuantas carreras de salud hay', r => !/bc-/.test(ids(r))]
  ];
  window.__catalogFilterTests = async () => {
    if (!document.getElementById('bc-modalidad-todas')) return 'Correr en carreras.html';
    const failures = [];
    let pass = 0;
    for (const [text, check] of FILTER_CASES) {
      window.chatHandler.clearHistory?.();
      window.chatHandler.addUserMessage(text);
      const reply = await window.duco.requestAiResponse(text);
      window.duco.discardLiveStream?.();
      if (check(reply)) pass++; else failures.push(`FAIL "${text}" => ${(reply.reply || '').slice(0, 100)} | ${ids(reply)}`);
    }
    return `${pass}/${FILTER_CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
  // Solo en la ficha de una carrera (p. ej. /carreras-detalle/tecnico-en-enfermeria-2.html).
  const CAREER_PAGE_CASES = [
    ['que carrera es esta?', r => /Técnico en Enfermería/.test(r.reply)],
    ['cuanto dura?', r => /5 semestres/.test(r.reply)],
    ['en que sedes se imparte?', r => /Técnico en Enfermería/.test(r.reply) && /sede/i.test(r.reply)],
    ['y en vespertino?', r => /vespertina/i.test(r.reply)],
    ['muestrame la malla curricular', r => /MALLA DE LA CARRERA/.test(term(r) || '')],
    ['cual es el campo laboral?', r => /CAMPO LABORAL/.test(term(r) || '')],
    ['donde esta el perfil de egreso?', r => /PERFIL DE EGRESO/.test(term(r) || '')],
    ['tiene practica profesional?', r => /PRÁCTICA PROFESIONAL/.test(term(r) || '')],
    ['hay internado?', r => /INTERNADO/.test(term(r) || '')],
    ['que modalidad tiene?', r => /MODALIDAD/.test(term(r) || '')]
  ];
  window.__careerPageTests = async () => {
    if (!/\/carreras-detalle\//.test(location.pathname)) return 'Correr en una ficha de carrera';
    const failures = [];
    let pass = 0;
    window.chatHandler.clearHistory?.();
    for (const [text, check] of CAREER_PAGE_CASES) {
      window.chatHandler.addUserMessage(text);
      const reply = await window.duco.requestAiResponse(text);
      window.duco.discardLiveStream?.();
      window.chatHandler.addAssistantMessage(reply.reply || '', false);
      if (check(reply)) pass++; else failures.push(`FAIL "${text}" => ${(reply.reply || '').slice(0, 120)} | ${types(reply)} ${term(reply) || ''}`);
    }
    return `${pass}/${CAREER_PAGE_CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
  window.__navEdgeTests = async () => {
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
      if (ok) pass++; else failures.push(`FAIL ${label}: "${text}"\n   => ${(reply.reply || '').slice(0, 170).replace(/\n/g, ' ⏎ ')} | ${types(reply) || '-'} ${term(reply) || ''}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
