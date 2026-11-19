/**
 * Peticiones por categoría combinada contra el catálogo real: se calcula la respuesta correcta a partir del JSON y se compara
 * con lo que responde el asistente (cantidad y títulos). (navegador, sin Node)
 *   const s = document.createElement('script'); s.src = '/tests/category-requests.js'; document.head.appendChild(s);
 *   window.__categoryTests().then(x => window.__cat = x);
 */
(function () {
  // Las pruebas comparan textos exactos: sin el redactor del modo híbrido (que varía las frases).
  window.ducoConfig = Object.assign(window.ducoConfig || {}, {humanizeReplies: false});
  const norm = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();
  const months = item => [...String(item.duracion || '').matchAll(/(\d+)\s*(semestres?|bimestres?)/gi)].map(m => Number(m[1]) * (/^semestre/i.test(m[2]) ? 6 : 3));
  const hasJ = (item, j) => (item.sedes_modalidades || []).some(sm => (sm.modalidades || []).some(m => norm(m).includes(j)));
  const online = item => (item.sedes_modalidades || []).some(sm => /online/.test(norm(sm.sede)) || (sm.modalidades || []).some(m => /online/.test(norm(m))));
  const inSede = (item, sede) => (item.sedes_modalidades || []).some(sm => norm(sm.sede) === norm(sede));
  const tipo = (item, t) => (item.tipo || []).some(x => norm(x) === t);
  const esc = (item, s) => (item.escuela || []).includes(s);
  const CASES = [
    ['carreras tecnicas de informatica', i => tipo(i, 'tecnica') && esc(i, 'Informática y Telecomunicaciones')],
    ['carreras profesionales de diseno', i => tipo(i, 'profesional') && esc(i, 'Diseño')],
    ['las carreras online de administracion', i => online(i) && esc(i, 'Administración y Negocios')],
    ['carreras vespertinas de construccion', i => hasJ(i, 'vespertin') && esc(i, 'Construcción')],
    ['carreras diurnas de salud', i => hasJ(i, 'diurn') && esc(i, 'Salud y Bienestar')],
    ['carreras tecnicas de la escuela de salud en vespertino', i => tipo(i, 'tecnica') && esc(i, 'Salud y Bienestar') && hasJ(i, 'vespertin')],
    ['carreras de salud en la sede de maipu', i => esc(i, 'Salud y Bienestar') && inSede(i, 'Sede Maipú')],
    ['cuales son las carreras de construccion en puente alto', i => esc(i, 'Construcción') && inSede(i, 'Sede Puente Alto')],
    ['carreras tecnicas vespertinas', i => tipo(i, 'tecnica') && hasJ(i, 'vespertin')],
    ['carreras profesionales online', i => tipo(i, 'profesional') && online(i)],
    ['carreras de 4 semestres', i => months(i).some(m => m === 24)],
    ['carreras de mas de 8 semestres', i => months(i).some(m => m > 48)],
    ['carreras de menos de 8 semestres', i => months(i).some(m => m < 48)],
    ['carreras tecnicas de 5 semestres', i => tipo(i, 'tecnica') && months(i).some(m => m === 30)],
    ['carreras de 10 bimestres', i => months(i).some(m => m === 30)],
    ['las ingenierias', i => norm(i.title).includes('ingenieria')],
    ['ingenierias de la escuela de informatica', i => norm(i.title).includes('ingenieria') && esc(i, 'Informática y Telecomunicaciones')],
    ['ingenierias online', i => norm(i.title).includes('ingenieria') && online(i)],
    ['carreras que tengan administracion en el nombre', i => norm(i.title).includes('administracion')],
    ['carreras que tengan diseno en el nombre', i => norm(i.title).includes('diseno')],
    ['solo las profesionales de negocios', i => tipo(i, 'profesional') && esc(i, 'Administración y Negocios')],
    ['cuantas carreras profesionales hay en diseno', i => tipo(i, 'profesional') && esc(i, 'Diseño')],
    ['carreras de comunicacion online', i => esc(i, 'Comunicación') && online(i)],
    ['carreras de salud que no sean tecnicas', i => esc(i, 'Salud y Bienestar') && !tipo(i, 'tecnica')],
    ['carreras de informatica que no sean profesionales', i => esc(i, 'Informática y Telecomunicaciones') && !tipo(i, 'profesional')],
    ['carreras tecnicas de diseno en vespertino', i => tipo(i, 'tecnica') && esc(i, 'Diseño') && hasJ(i, 'vespertin')],
    ['carreras profesionales diurnas de la escuela de gastronomia', i => tipo(i, 'profesional') && esc(i, 'Gastronomía') && hasJ(i, 'diurn')]
  ];
  window.__categoryTests = async () => {
    const catalog = (await fetch('/assets/carreras-catalogo.json').then(r => r.json())).filter(i => i.title && i.local_link);
    const failures = [];
    let pass = 0;
    for (const [query, pred] of CASES) {
      window.chatHandler.clearHistory?.();
      window.chatHandler.addUserMessage(query);
      let reply;
      try { reply = await window.duco.requestAiResponse(query); } catch (error) { reply = {reply: 'ERROR ' + error.message, actions: []}; }
      window.duco.discardLiveStream?.();
      const expected = catalog.filter(pred);
      const text = reply.reply || '';
      let ok;
      if (!expected.length) ok = /No encuentro|no hay/i.test(text);
      else {
        const count = (text.match(/\bHay (\d+)\b/) || [])[1];
        ok = Number(count) === expected.length;
        // Con 15 títulos o menos, además, deben aparecer todos y ninguno de más.
        if (ok && expected.length <= 15) ok = expected.every(i => text.includes(i.title)) && catalog.filter(i => !pred(i)).every(i => !text.split('\n').some(line => line.replace(/^•\s*/, '').replace(/ \(.*\)$/, '').trim() === i.title));
      }
      if (ok) pass++; else failures.push(`FAIL "${query}": esperadas ${expected.length}\n   => ${text.slice(0, 200).replace(/\n/g, ' ⏎ ')}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
