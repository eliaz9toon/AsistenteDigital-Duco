/**
 * Instrucciones de formato: ¿el asistente hace lo que se le pide? (en el navegador, sin Node)
 *   const s = document.createElement('script'); s.src = '/tests/format-instructions.js'; document.head.appendChild(s);
 *   await window.__formatTests();
 */
(function () {
  const sentences = t => (t.trim().match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || []).filter(s => s.trim()).length;
  const bullets = t => t.split('\n').filter(l => /^\s*(?:[•\-*]|\d+[.)])\s/.test(l)).length;
  const words = t => t.trim().split(/\s+/).length;
  const CASES = [
    ['explicame que es TENS en una sola frase', r => sentences(r) <= 1 && /enfermer/i.test(r)],
    ['dame 3 carreras de informatica en lista', r => bullets(r) === 3],
    ['responde solo con el numero: cuantas sedes tiene duoc?', r => /^\s*19\s*$/.test(r)],
    ['dime solo si o no: existe la carrera de TENS?', r => /^\s*s[ií]\.?\s*$/i.test(r)],
    ['dime solo si o no: existe la carrera de astronomia?', r => /^\s*no\.?\s*$/i.test(r)],
    ['hablame de ingenieria en informatica en dos frases', r => sentences(r) === 2],
    ['resumelo en 10 palabras o menos: que es TENS', r => words(r) <= 10],
    ['cuantas carreras de salud hay? solo el numero', r => /^\s*6\s*$/.test(r)],
    ['lista las escuelas de duoc separadas por comas', r => !r.includes('\n') && (r.match(/,/g) || []).length >= 6 && /Salud y Bienestar/.test(r)],
    ['numera las carreras de diseno', r => /^1[.)]/m.test(r) && /^6[.)]/m.test(r)],
    ['dime 5 sedes de santiago', r => bullets(r) === 5],
    ['ordenalas de la mas corta a la mas larga: carreras de salud', r => bullets(r) >= 2],
    ['responde en ingles: que carreras de salud hay?', r => /\b(?:careers?|health|there|are)\b/i.test(r) && !/\bhay\b/i.test(r)],
    ['dime solo los nombres de las sedes de maipu y puente alto', r => !/Av\.|Concha|Esquina/.test(r) && /Maip/.test(r) && /Puente Alto/.test(r)],
    ['dame las 3 carreras mas cortas de salud en lista', r => bullets(r) === 3],
    ['que escuelas tiene duoc? solo los nombres', r => !/\d/.test(r) && /Salud y Bienestar/.test(r) && /Ingeniería y Recursos Naturales/.test(r)],
    ['dime en una palabra: cuantas carreras tiene duoc?', r => words(r) <= 2],
    ['cuantas carreras tiene duoc? responde solo con el numero', r => /^\s*81\s*$/.test(r)],
    ['en tres frases, que es una carrera tecnica?', r => sentences(r) <= 3],
    ['responde solo con si o no: puedo estudiar enfermeria en vespertino?', r => /^\s*s[ií]\.?\s*$/i.test(r)]
  ];
  window.__formatTests = async () => {
    const failures = [];
    let pass = 0;
    for (const [question, check] of CASES) {
      window.chatHandler.clearHistory?.();
      window.chatHandler.addUserMessage(question);
      let response;
      try { response = await window.duco.requestAiResponse(question); } catch (error) { response = {reply: 'ERROR ' + error.message, actions: []}; }
      window.duco.discardLiveStream?.();
      let ok = false;
      try { ok = !!check(response.reply || ''); } catch { ok = false; }
      if (ok) pass++; else failures.push(`FAIL "${question}"\n   => ${(response.reply || '').slice(0, 190).replace(/\n/g, ' ⏎ ')}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
