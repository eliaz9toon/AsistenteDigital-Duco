/**
 * APIs externas (Nominatim, OSRM, Nager.Date) y permiso Sí/No, con servicios simulados (navegador, sin Node):
 *   const s = document.createElement('script'); s.src = '/tests/external-apis.js'; document.head.appendChild(s);
 *   await window.__externalApiTests();
 */
(function () {
  window.ducoConfig = Object.assign(window.ducoConfig || {}, {humanizeReplies: false});

  const holidays = year => ({found: true, items: [
    {date: `${year}-03-26`, name: 'Viernes Santo'}, {date: `${year}-03-27`, name: 'Sábado Santo'},
    {date: `${year}-09-18`, name: 'Fiestas Patrias'}, {date: `${year}-09-19`, name: 'Día de las Glorias del Ejército'}]});

  function makeApi(options = {}) {
    const calls = {ask: [], geocode: [], route: [], geolocate: 0, holidays: []};
    const api = {
      enabled: true,
      askPermission: async (kind, text) => { calls.ask.push({kind, text}); return options.allow !== false; },
      resetPermissions: () => { calls.reset = true; },
      geocode: async query => { calls.geocode.push(query); return options.geocode || {found: true, lat: -33.4249, lng: -70.6116}; },
      route: async (from, sede) => { calls.route.push(sede.name); return options.route || {found: true, distanceKm: 16.3, durationMin: 20, points: [[-33.4, -70.6], [-33.5, -70.7]]}; },
      holidays: async year => { calls.holidays.push(year); return options.holidays || holidays(year); },
      geolocate: async () => { calls.geolocate++; return options.location === undefined ? {lat: -33.4249, lng: -70.6116} : options.location; }
    };
    return {api, calls};
  }

  const CASES = [
    ['dirección con permiso: ruta y mapa', 'cuanto demoro a la sede de maipu desde Av. Matta 123, Santiago', {},
      (r, c) => /16\.3 km/.test(r.reply) && /Maipú/.test(r.reply) && r.actions?.[0]?.type === 'showMap' && r.actions[0].route?.points?.length === 2 && c.ask[0]?.kind === 'address' && c.geocode[0] === 'Av. Matta 123, Santiago'],
    ['dirección: sede más cercana', 'cual es la sede mas cercana a Av. Providencia 1234, Providencia', {},
      (r, c) => /sede más cercana/i.test(r.reply) && r.actions?.[0]?.type === 'showMap' && c.route.length === 1],
    ['dirección sin permiso: no envía nada', 'cual es la sede mas cercana a Av. Providencia 1234, Providencia', {allow: false},
      (r, c) => /no uso tu dirección/i.test(r.reply) && !c.geocode.length && !c.route.length && !(r.actions || []).length],
    ['dirección no encontrada', 'vivo en Calle Inventada 99999, Nowhere y quiero la sede mas cercana', {geocode: {found: false}},
      (r, c) => /No pude ubicar esa dirección/.test(r.reply) && !c.route.length],
    ['ruta sin servicio: usa línea recta', 'cuanto demoro a la sede de maipu desde Av. Matta 123, Santiago', {route: {found: false}},
      (r) => /línea recta/.test(r.reply) && r.actions?.[0]?.type === 'showMap' && !r.actions[0].route],
    ['ubicación del navegador con permiso', 'cual es la sede mas cercana a mi ubicacion', {},
      (r, c) => c.ask[0]?.kind === 'geo' && c.geolocate === 1 && /sede más cercana/i.test(r.reply) && r.actions?.[0]?.route],
    ['ubicación sin permiso: no pide la del navegador', 'cual es la sede mas cercana a mi ubicacion', {allow: false},
      (r, c) => /no uso tu ubicación/i.test(r.reply) && c.geolocate === 0],
    ['ubicación denegada por el navegador', 'sede mas cercana a mi ubicacion', {location: null},
      (r) => /No pude obtener tu ubicación/.test(r.reply)],
    ['comuna conocida: sin APIs ni permiso', 'sede mas cercana a providencia', {},
      (r, c) => r === null && !c.ask.length && !c.geocode.length],
    ['feriados de un mes', 'feriados de marzo 2027', {},
      (r, c) => /26\/03: Viernes Santo/.test(r.reply) && !/Fiestas Patrias/.test(r.reply) && c.holidays[0] === 2027 && !c.ask.length],
    ['feriados de abril (no se confunde con «abrir»)', 'cuando son los feriados de abril', {holidays: {found: true, items: [{date: '2026-04-03', name: 'Viernes Santo'}]}},
      (r) => /abril/.test(r.reply) && /Viernes Santo/.test(r.reply)],
    ['¿es feriado el día X?', 'es feriado el 18 de septiembre de 2027', {},
      (r) => /^Sí/.test(r.reply) && /Fiestas Patrias/.test(r.reply)],
    ['no es feriado', 'el 9 de marzo de 2027 es feriado?', {},
      (r) => /^No/.test(r.reply)],
    ['servicio de feriados caído', 'feriados de 2027', {holidays: {found: false}},
      (r) => /No pude consultar los feriados/.test(r.reply)],
    ['cambiar permisos', 'quiero cambiar los permisos', {},
      (r, c) => c.reset === true && /volveré a preguntarte/.test(r.reply)],
    ['sin APIs (modo sin backend): no actúa', 'cuanto demoro a la sede de maipu desde Av. Matta 123, Santiago', {disabled: true},
      (r) => r === null]
  ];

  window.__externalApiTests = async function () {
    const failures = [];
    let pass = 0;
    for (const [label, text, options, check] of CASES) {
      const {api, calls} = makeApi(options);
      if (options.disabled) api.enabled = false;
      let reply;
      try { reply = await window.ducoAI.getExternalApiResponse(text, {messages: [], context: {externalApis: api}}); } catch (error) { reply = {reply: 'ERROR ' + error.message, actions: []}; }
      let ok = false;
      try { ok = !!check(reply, calls); } catch (error) { ok = false; }
      if (ok) pass++; else failures.push(`FAIL ${label}: "${text}"\n   => ${reply ? String(reply.reply).slice(0, 200) : reply} | ${JSON.stringify(calls).slice(0, 160)}`);
    }
    return `${pass}/${CASES.length} pasan` + (failures.length ? '\n' + failures.join('\n') : '');
  };
})();
