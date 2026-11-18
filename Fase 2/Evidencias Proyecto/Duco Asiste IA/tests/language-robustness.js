/**
 * Robustez de lenguaje: inglés, jerga y errores de tipeo, cortesía, fechas calculadas, ubicación + carrera,
 * ambigüedad, tres pedidos en uno y preguntas sobre el propio asistente. (navegador, sin Node)
 *   const s = document.createElement('script'); s.src = '/tests/language-robustness.js'; document.head.appendChild(s);
 *   await window.__languageTests();
 */
(function () {
  const T = actions => (actions || []).filter(a => a.type === 'navigate' && a.target).map(a => a.terms[0]).pop() || null;
  const types = r => (r.actions || []).map(a => a.type).join('>');
  const toCareers = r => (r.actions || []).some(a => /carreras\.html$/.test(a.target || ''));
  const CASES = [
    // inglés
    ['EN where is the Maipu campus?', ['where is the Maipu campus?'], r => r.actions[0]?.sedeIds?.[0] === 'maipu'],
    ['EN when does admission open?', ['when does admission open?'], r => r.actions[0]?.type === 'showCalendar'],
    ['EN how long is the nursing program?', ['how long is the nursing program?'], r => /5 semest/i.test(r.reply) && /Enfermer/.test(r.reply) && !/Analista Programador/.test(r.reply)],
    ['EN study computer science (recomienda varias)', ['i want to study computer science'], r => !/Which one do you want to open/i.test(r.reply) && /Informática|Software|Cyber|Data/i.test(r.reply)],
    ['EN careers in health (English reply, titles untouched)', ['which careers do you have in health?'], r => /\b(?:careers?|programs?|there are|has)\b/i.test(r.reply) && /Preparador Físico/.test(r.reply) && !/Physical Therapist/i.test(r.reply)],
    ['EN show all campuses', ['show me all campuses'], r => r.actions[0]?.sedeIds?.length === 19],
    ['EN take me to careers', ['take me to the careers page'], r => toCareers(r)],
    ['EN open admission menu', ['open the admission menu'], r => r.actions[0]?.type === 'dropdown'],
    ['EN capital of France', ['what is the capital of France?'], r => !/par[ií]s/i.test(r.reply)],
    ['EN want to study computer science', ['i want to study computer science'], r => /Informática|Software|Computer|Cyber|Data|Programmer/i.test(r.reply)],
    // tipeo y jerga
    ['SMS dnde keda', ['dnde keda la sede d maipu'], r => r.actions[0]?.sedeIds?.[0] === 'maipu'],
    ['typo matriculs', ['cuando abren las matriculs?'], r => r.actions[0]?.type === 'showCalendar'],
    ['typo enfermeia', ['cuanto dura enfermeia'], r => /5 semestres/.test(r.reply)],
    ['MAYÚSCULAS', ['DONDE QUEDA LA SEDE DE PLAZA NORTE????'], r => r.actions[0]?.sedeIds?.[0] === 'plaza-norte'],
    ['pto montt', ['ola donde keda la sede de pto montt'], r => r.actions[0]?.sedeIds?.[0] === 'puerto-montt'],
    // cortesía
    ['cortesía mapa', ['Disculpa, ¿podrías por favor indicarme dónde queda la sede de Maipú? Muchas gracias'], r => r.actions[0]?.sedeIds?.[0] === 'maipu'],
    ['cortesía menú', ['sería tan amable de abrir el menú de admisión'], r => r.actions[0]?.type === 'dropdown'],
    ['cortesía navegación', ['oye porfa llevame a la pagina de carreras'], r => toCareers(r)],
    ['cortesía fechas', ['buenas tardes, quisiera saber cuando abren las matriculas'], r => r.actions[0]?.type === 'showCalendar'],
    ['cortesía sedes', ['me podrías decir cuántas sedes tienen?'], r => /19/.test(r.reply)],
    // fechas calculadas
    ['día de la semana', ['que dia de la semana empiezan las clases online?'], r => /martes/i.test(r.reply)],
    ['días de matrícula abierta', ['cuantos dias dura la matricula abierta?'], r => /15[23]|154/.test(r.reply)],
    ['días para el inicio de clases', ['cuantos dias faltan para el inicio de clases online?'], r => new RegExp('\\b' + Math.round((Date.UTC(2027, 2, 9) - Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000) + '\\b').test(r.reply)],
    ['inicio de clases presencial', ['cuando es el inicio de clases?'], r => /online/i.test(r.reply)],
    // ubicación + carrera
    ['desde Ñuñoa', ['estoy en nunoa y quiero estudiar enfermeria, cual sede me queda mas cerca?'], r => /más cercana/.test(r.reply)],
    ['Providencia gastronomía', ['vivo en providencia, donde puedo estudiar gastronomia?'], r => /Gastronom/.test(r.reply) && /más cercana|Antonio Varas/.test(r.reply)],
    ['sede cerca de Rancagua', ['cual es la sede mas cercana a rancagua?'], r => /más cercana/.test(r.reply) && r.actions[0]?.type === 'showMap'],
    ['sede cerca de La Serena', ['hay sede cerca de la serena?'], r => /más cercana/.test(r.reply)],
    // ambigüedad
    ['llévame allá', ['llevame alla'], r => !T(r.actions) && !r.actions.some(a => a.type === 'showMap')],
    ['busca la carrera (sin nombre)', ['busca la carrera'], r => !T(r.actions) && /Qué carrera/.test(r.reply)],
    ['muéstrame eso', ['muestrame eso'], r => !T(r.actions) && !r.actions.some(a => a.type === 'showMap')],
    ['la otra', ['la otra'], r => !T(r.actions)],
    ['"sí" suelto', ['si'], r => !T(r.actions) && !r.actions.length],
    // tres pedidos
    ['tres pedidos en uno', ['abre el menu de admision, luego muestrame la sede de maipu y despues dime cuando abren las matriculas'], r => types(r) === 'dropdown>showMap>showCalendar'],
    // meta
    ['nombre', ['como te llamas?'], r => /Duco/.test(r.reply)],
    ['modelo', ['que modelo de ia eres?'], r => r.reply.length > 10],
    ['creador', ['quien te creo?'], r => r.reply.length > 10],
    ['robot', ['eres un robot?'], r => r.reply.length > 10]
  ];
  window.__languageTests = async () => {
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
      if (ok) pass++; else failures.push(`FAIL ${label}: "${messages.at(-1).slice(0, 70)}"\n   => ${(reply.reply || '').slice(0, 170).replace(/\n/g, ' ⏎ ')} | ${types(reply) || '-'}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
