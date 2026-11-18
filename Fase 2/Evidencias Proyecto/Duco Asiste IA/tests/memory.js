/**
 * Memoria de la conversación (navegador, sin Node; correr en duoc.html)
 *   const s = document.createElement('script'); s.src = '/tests/memory.js'; document.head.appendChild(s);
 *   await window.__memoryTests();
 * La persistencia entre páginas/recargas se comprueba aparte: window.__memoryPersist() y luego, tras recargar, window.__memoryPersistCheck().
 */
(function () {
  const types = r => (r.actions || []).map(a => a.type).join('>');
  const SCENARIOS = [
    ['datos personales', [
      ['me llamo Elias y tengo 17 anos', r => /Elias/.test(r.reply) && /17/.test(r.reply)],
      ['vivo en maipu', r => /Maipú|maipu/i.test(r.reply)],
      ['me gusta la informatica y los videojuegos', r => /Informática|Software|Programador/.test(r.reply)],
      ['como me llamo?', r => /Elias/.test(r.reply)],
      ['cuantos anos tengo?', r => /17/.test(r.reply)],
      ['donde vivo?', r => /maipu/i.test(r.reply)],
      ['que sede me queda mas cerca?', r => /Maipú/.test(r.reply) && r.actions[0]?.type === 'showMap'],
      ['que te dije que me gustaba?', r => /inform[aá]tica/i.test(r.reply) && /videojuegos/i.test(r.reply)],
      ['que sabes de mi?', r => /Elias/.test(r.reply) && /17/.test(r.reply) && /maipu/i.test(r.reply)],
      ['recomiendame algo segun lo que te dije', r => /Informática|Software|Programador|Videojuego|Desarrollo/.test(r.reply) && !/No encuentro/.test(r.reply)]]],
    ['sin datos no inventa', [
      ['como me llamo?', r => /Aún no me has dicho tu nombre/.test(r.reply)],
      ['donde vivo?', r => /Aún no me has dicho dónde vives/.test(r.reply)],
      ['que sede me queda mas cerca?', r => /dónde vives/.test(r.reply)],
      ['que sabes de mi?', r => /Todavía no me has contado nada/.test(r.reply)]]],
    ['cambio de lugar', [
      ['soy de puerto montt', r => /Puerto Montt/.test(r.reply)],
      ['quiero estudiar enfermeria', r => /navigate/.test(types(r))],
      ['y si me cambio a santiago?', r => /sede|Sede/.test(r.reply) && !/vespertina para esta/.test(r.reply)],
      ['donde vivo?', r => /Puerto Montt/.test(r.reply) || /santiago/i.test(r.reply)]]],
    ['historial de carreras', [
      ['hablame de enfermeria', r => /Enfermer/.test(r.reply)],
      ['hablame de gastronomia', r => /Gastronom/.test(r.reply)],
      ['cual fue la primera carrera que te pregunte?', r => /Enfermer/.test(r.reply)],
      ['y la segunda carrera que te pregunte?', r => /Gastronom/.test(r.reply)],
      ['cuantas carreras te he preguntado?', r => /2 carrera/.test(r.reply)],
      ['cual fue la ultima carrera que te pregunte?', r => /Gastronom/.test(r.reply)]]],
    ['trabajo y presupuesto', [
      ['trabajo de dia', r => /vespertina|online/.test(r.reply)],
      ['tengo poco presupuesto', r => /Gratuidad|becas/i.test(r.reply) && !/sección de Becas/.test(r.reply)],
      ['que sabes de mi?', r => /trabajas de día/.test(r.reply) && /poco presupuesto/.test(r.reply)]]],
    ['olvida al limpiar', [
      ['me llamo Camila', r => /Camila/.test(r.reply)],
      ['__clear__', null],
      ['como me llamo?', r => /Aún no me has dicho tu nombre/.test(r.reply)]]],
    ['memoria larga (12 turnos)', [
      ['me llamo Pablo', null], ['cuantas sedes hay?', null], ['donde queda la sede de maipu', null], ['cuando abren las matriculas?', null],
      ['que carreras hay de salud?', null], ['hay becas?', null], ['necesito requisitos', null], ['abre el menu de admision', null],
      ['cierra el menu', null], ['hay deportes?', null], ['gracias', null],
      ['como me llamo?', r => /Pablo/.test(r.reply)]]]
  ];
  window.__memoryTests = async () => {
    const failures = [];
    let pass = 0, total = 0;
    for (const [name, turns] of SCENARIOS) {
      window.chatHandler.clearHistory?.();
      for (const [text, check] of turns) {
        if (text === '__clear__') { window.chatHandler.clearHistory?.(); continue; }
        window.chatHandler.addUserMessage(text);
        let reply;
        try { reply = await window.duco.requestAiResponse(text); } catch (error) { reply = {reply: 'ERROR ' + error.message, actions: []}; }
        window.duco.discardLiveStream?.();
        window.chatHandler.addAssistantMessage(reply.reply || '', false);
        if (!check) continue;
        total++;
        let ok = false;
        try { ok = !!check(reply); } catch { ok = false; }
        if (ok) pass++; else failures.push(`FAIL [${name}] "${text}"\n   => ${(reply.reply || '').slice(0, 170).replace(/\n/g, ' ⏎ ')} | ${types(reply) || '-'}`);
      }
    }
    return `${pass}/${total} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
  // Persistencia: se guarda una conversación, se recarga la página y se comprueba que se recuerda.
  window.__memoryPersist = async () => {
    window.chatHandler.clearHistory?.();
    for (const text of ['me llamo Valentina', 'vivo en puente alto']) {
      window.chatHandler.addUserMessage(text);
      const reply = await window.duco.requestAiResponse(text);
      window.duco.discardLiveStream?.();
      window.chatHandler.addAssistantMessage(reply.reply || '', false);
    }
    return 'guardado';
  };
  window.__memoryPersistCheck = async () => {
    window.chatHandler.addUserMessage('como me llamo y donde vivo?');
    const a = await window.duco.requestAiResponse('como me llamo?');
    window.duco.discardLiveStream?.();
    const b = await window.duco.requestAiResponse('donde vivo?');
    window.duco.discardLiveStream?.();
    return `${a.reply} | ${b.reply} | mensajes guardados: ${window.chatHandler.getDialogueMessages().length}`;
  };
})();
