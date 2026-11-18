/**
 * Preguntas clásicas de postulantes: ¿responde con datos oficiales, sin inventar? (navegador, sin Node)
 *   const s = document.createElement('script'); s.src = '/tests/classic-questions.js'; document.head.appendChild(s);
 *   await window.__classicTests();
 */
(function () {
  const types = r => (r.actions || []).map(a => a.type).join('>');
  const CASES = [
    ['universidad', 'duoc es una universidad?', r => /Instituto Profesional/.test(r.reply) && /no es una universidad/i.test(r.reply)],
    ['tipo de institución', 'que tipo de institucion es duoc uc?', r => /Instituto Profesional/.test(r.reply)],
    ['acreditación', 'esta acreditada duoc?', r => /CNA|Comisión Nacional/.test(r.reply) && /7 años/.test(r.reply)],
    ['PAES', 'necesito dar la PAES para entrar?', r => /^No\./.test(r.reply) && /Licencia de Enseñanza Media/.test(r.reply)],
    ['PSU', 'piden puntaje psu?', r => /^No\./.test(r.reply)],
    ['requisitos', 'que requisitos necesito para entrar a duoc?', r => /Licencia de Enseñanza Media/.test(r.reply) && /4\.0/.test(r.reply)],
    ['documentos', 'que documentos necesito para matricularme', r => /cédula/i.test(r.reply)],
    ['cómo ingreso', 'como puedo ingresar a duoc?', r => /Licencia de Enseñanza Media/.test(r.reply)],
    ['reserva de cupo', 'como reservo mi cupo?', r => /18 días/.test(r.reply)],
    ['arancel', 'cuanto cuesta estudiar en duoc?', r => /ficha de la carrera/.test(r.reply) && !/\$\s?\d/.test(r.reply)],
    ['pago', 'como puedo pagar la matricula?', r => /Webpay|Servipag/.test(r.reply) && r.actions.length > 0],
    ['gratuidad', 'duoc tiene gratuidad?', r => /FUAS/.test(r.reply) && /online/.test(r.reply)],
    ['becas', 'que becas hay?', r => /Beca/.test(r.reply) && /un beneficio interno/.test(r.reply)],
    ['CAE', 'sirve el cae en duoc?', r => /CAE/.test(r.reply)],
    ['DICOM', 'si estoy en dicom puedo matricularme?', r => /DICOM/.test(r.reply) && /no impide/i.test(r.reply)],
    ['convalidación', 'puedo convalidar ramos de otra universidad?', r => /convalidaci/i.test(r.reply) && /Admisión Especial/.test(r.reply)],
    ['cambio de carrera', 'puedo cambiarme de carrera?', r => /vacantes/.test(r.reply)],
    ['Semestre Cero', 'que es el semestre cero?', r => /gratuito/.test(r.reply) && /nivelar/.test(r.reply) && !/dificultades/.test(r.reply)],
    ['online', 'puedo estudiar online?', r => /23 carreras/.test(r.reply) && /bimestres/.test(r.reply)],
    ['a distancia', 'se puede estudiar a distancia?', r => /Duoc UC Online/.test(r.reply)],
    ['técnico vs profesional', 'cual es la diferencia entre tecnico y profesional?', r => r.reply.length > 40 && !/universidad/i.test(r.reply.replace(/no es una universidad/i, ''))],
    ['título profesional', 'dan titulo profesional?', r => /profesional/i.test(r.reply)],
    ['calendario académico', 'donde veo el calendario academico?', r => /Calendario 2026/.test(r.reply) && /dropdown/.test(types(r))],
    ['deportes', 'hay deportes en duoc?', r => /Deportes/.test(r.reply) && /highlightTerms/.test(types(r))],
    ['biblioteca', 'donde esta la biblioteca?', r => /Biblioteca/.test(r.reply) && /highlightTerms/.test(types(r))],
    ['pastoral', 'tienen pastoral?', r => /Pastoral/.test(r.reply)],
    ['intercambio', 'hay intercambio al extranjero?', r => /Relaciones Internacionales/.test(r.reply)],
    ['reintegro', 'quiero volver a estudiar, ya fui alumno', r => /reintegro/i.test(r.reply)],
    ['titulados', 'soy titulado, donde veo mi informacion?', r => /Titulados/.test(r.reply)],
    ['contacto', 'como me comunico con admision?', r => /Contáctanos/.test(r.reply)],
    ['reprobar', 'que pasa si repruebo un ramo?', r => /no tengo publicada/i.test(r.reply) && !/\b\d+(?:\.\d+)?\b.*nota/i.test(r.reply)],
    ['empleabilidad', 'cuanto gana un tecnico en enfermeria?', r => /no tengo cifras/i.test(r.reply)],
    ['mejor carrera', 'cual es la mejor carrera de duoc?', r => /no tengo cifras|ranking/i.test(r.reply)],
    ['trabajar y estudiar', 'puedo estudiar y trabajar?', r => /vespertina|online/i.test(r.reply)],
    ['menor de edad', 'soy menor de edad, puedo matricularme?', r => /apoderado/.test(r.reply)],
    ['uniforme', 'piden uniforme o materiales?', r => /Gastronomía/.test(r.reply)],
    ['sin licencia', 'y si no tengo la licencia de media?', r => /Licencia de Enseñanza Media/.test(r.reply) && /condicional/.test(r.reply)],
    ['NEM', 'duoc exige nem?', r => /4\.0/.test(r.reply)],
    ['cuotas', 'se puede pagar en cuotas?', r => /No tengo publicadas/.test(r.reply)],
    ['cómo funciona online', 'como funciona duoc online?', r => /bimestres/.test(r.reply)],
    ['bimestre', 'que es un bimestre?', r => /9 semanas/.test(r.reply) && !/dos meses/.test(r.reply)],
    ['cómo me titulo', 'como me titulo?', r => /Titulados/.test(r.reply)],
    ['semestre cero y convalidar', 'el semestre cero sirve para convalidar?', r => /70%/.test(r.reply)],
    ['gastronomía internacional no es intercambio', 'cual es mas corta, gastronomia o gastronomia internacional?', r => !/Relaciones Internacionales/.test(r.reply)],
    ['quiero hablar con una persona', 'quiero hablar con una persona', r => /Contáctanos/.test(r.reply)],
    ['fechas siguen en calendario', 'cuando abren las matriculas?', r => r.actions[0]?.type === 'showCalendar'],
    ['sede sigue en mapa', 'donde queda la sede de maipu?', r => r.actions[0]?.type === 'showMap'],
    ['carreras online siguen en catálogo', 'que carreras online hay de informatica?', r => !/Duoc UC Online tiene 23/.test(r.reply)],
    ['duración sigue en catálogo', 'cuanto dura enfermeria', r => /5 semestres/.test(r.reply)],
    ['fuera de alcance', 'cual es la capital de francia?', r => !/par[ií]s/i.test(r.reply)]
  ];
  window.__classicTests = async () => {
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
      if (ok) pass++; else failures.push(`FAIL ${label}: "${text}"\n   => ${(reply.reply || '').slice(0, 200).replace(/\n/g, ' ⏎ ')} | ${types(reply) || '-'}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
