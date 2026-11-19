/**
 * Regresión del asistente Duco en el navegador (sin Node). Se ejecuta en cualquier página con Duco:
 *   const s = document.createElement('script'); s.src = '/tests/regression-chat.js'; document.head.appendChild(s);
 *   await window.__regression();   // devuelve "N/M pasan" y la lista de fallos
 *
 * Cubre: navegación por carreras, errores de tipeo, mapas y sedes, calendario con fechas relativas, comparaciones,
 * filtros por sede/jornada, seguimientos con elipsis, acciones vagas, rechazos de lugares ajenos a Duoc y guardas
 * contra falsos positivos. Casi todo se resuelve sin modelo; unas pocas preguntas usan Ollama.
 */
(function () {
  // Las pruebas comparan textos exactos: sin el redactor del modo híbrido (que varía las frases).
  window.ducoConfig = Object.assign(window.ducoConfig || {}, {humanizeReplies: false});
  const T = actions => (actions || []).filter(a => a.type === 'navigate' && a.target).map(a => a.terms[0]).pop() || null;
  const noNav = r => !T(r.actions);
  // [etiqueta, mensajes encadenados (el último se evalúa), comprobación]
  const CASES = [
    ['seg: y la de enfermería', ['busca ingenieria en informatica', 'y la de enfermeria?'], r => T(r.actions) === 'Técnico en Enfermería'],
    ['seg: y cuánto dura', ['explicame gastronomia', 'y cuanto dura?'], r => /5 semestres/.test(r.reply)],
    ['seg: no, la internacional', ['quiero ver gastronomia', 'no, la internacional'], r => T(r.actions) === 'Gastronomía Internacional'],
    ['seg: y la de Puente Alto', ['donde queda la sede de maipu', 'y la de puente alto?'], r => r.actions[0]?.sedeIds?.join() === 'puente-alto'],
    ['seg: y las de online', ['cuando abren las matriculas', 'y las de online?'], r => /Online/.test(r.reply) && !/Matrículas abiertas Admisión 2027/.test(r.reply)],
    ['seg: más corta de salud', ['carreras de salud', 'cual es la mas corta?'], r => /escuela de Salud y Bienestar/.test(r.reply) && /más cortas/.test(r.reply)],
    ['seg: en vespertino', ['busca TENS', 'y en vespertino?'], r => /Puente Alto/.test(r.reply) && /San Bernardo/.test(r.reply)],
    ['seg: dónde se estudia', ['que es TENS?', 'y donde se estudia?'], r => /se imparte en/.test(r.reply)],
    ['seg: cuáles en Santiago', ['cuantas sedes hay?', 'y cuales estan en santiago?'], r => /Región Metropolitana/.test(r.reply) && /Melipilla/.test(r.reply)],
    ['sedes en el norte', ['hay sedes en el norte?'], r => /no tiene sedes ni campus en el norte/.test(r.reply)],
    ['tecnología genérica', ['tengo 18 años y me gusta la tecnologia'], r => noNav(r) && /Informática|Software|Ciberseguridad|Programador|Datos/.test(r.reply)],
    ['"me gusta la tecnología" no navega', ['me gusta la tecnologia'], r => noNav(r)],
    ['no inventa dirección', ['y la de puente alto?'], r => !/San Martín 2345/.test(r.reply)],
    ['comparar duración', ['cual dura mas, enfermeria o ingenieria en informatica?'], r => /más larga es Ingeniería en Informática/.test(r.reply)],
    ['comparar gastronomías', ['cual es mas corta, gastronomia o gastronomia internacional?'], r => /más corta es Gastronomía\./.test(r.reply)],
    ['cuántas carreras', ['cuantas carreras tiene duoc?'], r => /81 carreras/.test(r.reply)],
    ['carreras por sede', ['que carreras hay en la sede de maipu?'], r => /carreras en Sede Maipú/.test(r.reply)],
    ['enfermería vespertino', ['puedo estudiar enfermeria en vespertino?'], r => /vespertina/.test(r.reply)],
    ['cerca de La Florida', ['donde se imparte enfermeria cerca de la florida?'], r => /más cercana a La Florida/.test(r.reply)],
    ['¿ya pasó la reserva?', ['ya paso la reserva de cupo?'], r => /ya terminó/.test(r.reply)],
    ['hasta cuándo admisión especial', ['hasta cuando puedo postular a admision especial?'], r => /27 de febrero/.test(r.reply)],
    ['gritos y repeticiones', ['HOLAAA QUIERO ESTUDIAR ENFERMERIAAA!!!'], r => T(r.actions) === 'Técnico en Enfermería'],
    ['teléfono del director', ['dame el telefono del director de la sede de maipu'], r => /No tengo teléfonos/.test(r.reply)],
    ['capital de Francia', ['cual es la capital de francia?'], r => /Solo puedo mostrarte/.test(r.reply)],
    ['técnica vs profesional', ['me puedes explicar la diferencia entre una carrera tecnica y una profesional?'], r => /Carreras técnicas: 39/.test(r.reply)],
    ['TENS', ['busca TENS'], r => T(r.actions) === 'Técnico en Enfermería'],
    ['typo informatika', ['quiero ver ingenieria en informatika'], r => T(r.actions) === 'Ingeniería en Informática'],
    ['astronomía no existe', ['buscame la carrera de astronomia'], r => /no hay una carrera/.test(r.reply)],
    ['informática ambigua', ['informatica'], r => /Hay varias carreras/.test(r.reply)],
    ['Temuco sin sede', ['y la de temuco donde queda?'], r => /no tiene sede ni campus en Temuco/.test(r.reply)],
    ['todas las sedes', ['donde estan las sedes'], r => r.actions[0]?.sedeIds?.length === 19],
    ['lugar ajeno', ['como llego al costanera center'], r => /Solo puedo mostrarte/.test(r.reply)],
    ['carreras de salud', ['carreras de salud'], r => /hay 6 carreras/.test(r.reply)],
    ['carrera corta', ['quiero una carrera corta'], r => /más cortas/.test(r.reply)],
    ['pedido compuesto', ['abre el menu de admision y luego muestrame la sede de maipu'], r => r.actions.map(a => a.type).join() === 'dropdown,showMap'],
    ['explicación guiada', ['explicame la carrera de gastronomia'], r => r.actions.at(-1)?.guided === true],
    ['duración sin carrera', ['cuanto dura?'], r => /De qué carrera/.test(r.reply)],
    ['remarca algo', ['remarca algo'], r => r.actions[0]?.type === 'highlightTerms'],
    ['capacidades', ['hola, que puedes hacer?'], r => /Recomendarte/.test(r.reply)],
    ['animales (modelo)', ['quiero trabajar con animales, que puedo estudiar?'], r => /Veterinario/.test(r.reply)],
    ['guarda: vida estudiantil', ['llevame a vida estudiantil'], r => noNav(r)],
    ['guarda: hablar con admisión', ['quiero hablar con alguien de admision'], r => noNav(r)],
    ['guarda: becas', ['muestrame informacion sobre las becas'], r => noNav(r)],
    ['guarda: botón postular', ['donde esta el boton de postular'], r => noNav(r) && !r.actions.some(a => a.type === 'showMap')],
    ['guarda: gracias', ['gracias por la informacion'], r => noNav(r)],
    ['guarda: "no me lleves"', ['no me lleves a ninguna carrera'], r => noNav(r)]
  ];

  window.__regression = async () => {
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
        if (reply.actions?.length) window.chatHandler.recordActionOutcome?.(reply.actions[0], {success: true, detail: 'ok'}, text);
      }
      let ok = false;
      try { ok = !!check(reply); } catch { ok = false; }
      if (ok) pass++;
      else failures.push(`FAIL ${label}: "${messages.join('" → "')}"\n   => ${(reply.reply || '').slice(0, 200).replace(/\n/g, ' ⏎ ')} | ${(reply.actions || []).map(a => a.type).join('>') || '-'}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
