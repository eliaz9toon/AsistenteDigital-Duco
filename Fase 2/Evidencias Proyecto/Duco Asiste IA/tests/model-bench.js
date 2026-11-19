/**
 * Comparador de modelos de Ollama para Duco (se ejecuta en el navegador, en cualquier página con Duco).
 *
 * Uso: abre http://127.0.0.1:5599/duoc.html y, en la consola del navegador:
 *   const s = document.createElement('script'); s.src = '/tests/model-bench.js'; document.head.appendChild(s);
 *   await window.__bench('qwen3.5:4b');   // ejecuta la batería con ese modelo (carga el modelo antes, sin cronometrarlo)
 *   await window.__bench('qwen3.5:9b');
 *   window.__report();                    // resumen comparado
 *
 * Cada caso tiene una comprobación automática (✓/✗). Las preguntas SEQ| son parte de una conversación.
 * El modelo por defecto de la app se cambia en un solo lugar: window.ducoConfig.ollamaModel (duoc.html)
 * o la propiedad `model` de OllamaClient.
 */
(function () {
  // Las pruebas comparan textos exactos: sin el redactor del modo híbrido (que varía las frases).
  window.ducoConfig = Object.assign(window.ducoConfig || {}, {humanizeReplies: false});
  window.__bres = window.__bres || {};
  window.__battery = [
    ['hola, que puedes hacer?', r => /Recomendarte carreras/.test(r)],
    ['me puedes explicar la diferencia entre una carrera tecnica y una profesional?', r => /técnic/i.test(r) && /profesional/i.test(r)],
    ['cual es la mejor carrera?', r => /no\b.*(mejor|ranking|depend)|depende|no existe|no hay/i.test(r)],
    ['cual carrera tiene mas sueldo?', r => !/\$\s?\d|\d+\s?(pesos|clp|millones)/i.test(r) && /no (tengo|cuento|dispongo)|no hay|no puedo|no consta/i.test(r)],
    ['cuanto cuesta la matricula?', r => !/\$\s?\d|\d{3}\.\d{3}/.test(r) && /no (tengo|cuento|dispongo)|no consta|no hay|no puedo|contacta|admisión/i.test(r)],
    ['que es TENS?', r => /enfermer/i.test(r) && !/nerviosa|transcut/i.test(r)],
    ['tengo 17 años y me gusta dibujar, que me recomiendas?', r => /Diseño|Ilustración/.test(r) && !/Fotografía|Temuco/.test(r)],
    ['quiero trabajar con animales, que puedo estudiar?', r => /Veterinario/.test(r)],
    ['me gusta cocinar y quiero abrir mi propio restaurante', r => /Gastronom/.test(r)],
    ['quiero estudiar derecho', r => /No encuentro/.test(r)],
    ['i want to study nursing', r => /Enfermería/.test(r)],
    ['wena, quiero estudiar pa trabajar con compus', r => /Informática|Software|Ciberseguridad|Programador/.test(r.split('\n').slice(0, 3).join(' ')) && !/Sonido/.test(r.split('\n').slice(0, 2).join(' '))],
    ['me interesa la mineria y la naturaleza', r => /Minas|Recursos Naturales|Ambiente|Sostenib/.test(r)],
    ['quiero construir casas y edificios', r => /Construcci|Obras|Arquitect/.test(r)],
    ['me gusta el cine y editar videos', r => /Audiovisual|Comunicaci|Cine/.test(r)],
    ['quiero cuidar adultos mayores y enfermos', r => /Enfermería/.test(r)],
    ['me gustan los numeros y las empresas', r => /Contabilidad|Administración|Finanzas|Auditor/.test(r)],
    ['quiero hackear sistemas de forma etica', r => /Ciberseguridad/.test(r)],
    ['me gusta el deporte y quiero entrenar personas', r => /Preparador Físico/.test(r)],
    ['quiero ser chef', r => /Gastronom/.test(r)],
    ['cual es la direccion de la biblioteca de duoc?', r => !/\d{2,4}\s*,?\s*(santiago|maip|providencia)/i.test(r) && /no (tengo|cuento|dispongo)|no consta|no hay|solo/i.test(r)],
    ['SEQ|me llamo Camila y trabajo de dia', 'x'],
    ['SEQ|como me llamo?', r => /Camila/.test(r) && !/Online/.test(r)],
    ['SEQ|y a que hora trabajo?', r => !/\d{1,2}\s*(am|pm|:|horas)/i.test(r) && /no (tengo|sé|se|cuento)|día|dia|no mencion/i.test(r)]
  ];

  window.__bench = async model => {
    const ai = window.ducoAI;
    ai.model = model;
    window.__bres[model] = {rows: [], running: true};
    await fetch(`${ai.baseUrl}/api/generate`, {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({model, prompt: '', keep_alive: '30m', stream: false})});
    window.chatHandler.clearHistory?.();
    for (const [raw, check] of window.__battery) {
      const seq = raw.startsWith('SEQ|');
      const q = seq ? raw.slice(4) : raw;
      if (!seq) window.chatHandler.clearHistory?.();
      window.chatHandler.addUserMessage(q);
      const t0 = performance.now();
      let r;
      try { r = await window.duco.requestAiResponse(q); } catch (e) { r = {reply: 'ERROR ' + e.message, actions: []}; }
      const ms = performance.now() - t0;
      window.chatHandler.addAssistantMessage(r.reply || '', false);
      window.duco.discardLiveStream?.();
      let ok = null;
      if (check !== 'x') { try { ok = !!check(r.reply || ''); } catch { ok = false; } }
      window.__bres[model].rows.push({q, ok, s: Math.round(ms / 100) / 10, reply: (r.reply || '').slice(0, 200).replace(/\n/g, ' ')});
    }
    window.__bres[model].running = false;
    return window.__bres[model];
  };

  window.__report = () => {
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    return Object.entries(window.__bres).map(([model, b]) =>
      `${model}: ${b.rows.filter(x => x.ok === true).length}/${b.rows.filter(x => x.ok !== null).length} ok | total ${b.rows.reduce((a, x) => a + x.s, 0).toFixed(0)}s | mediana ${med(b.rows.map(x => x.s))}s` +
      b.rows.filter(x => x.ok === false).map(x => `\n   ✗ "${x.q}" → ${x.reply.slice(0, 120)}`).join('')).join('\n');
  };
})();
