/**
 * Duco Places: ubicaciones de sedes (mapa OpenStreetMap + Leaflet) y calendario de admisión.
 *
 * Alcance deliberadamente cerrado: solo se muestran sedes y campus de Duoc UC y solo se agregan al
 * calendario fechas oficiales de admisión. Cualquier otro lugar o evento se rechaza con una respuesta
 * explícita. Los datos viven en assets/sedes-duoc.json y assets/eventos-duoc.json (revisables).
 * No usa API keys: Google Calendar se abre por enlace y el calendario también se ofrece como .ics.
 */
(function () {
  const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';

  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ').replace(/(.)\1{2,}/g, '$1').trim();
  const has =(text, phrase) => (' ' + text + ' ').includes(' ' + phrase + ' ');

  const places = {
    sedes: [],
    events: [],
    ready: null,

    load(base = '') {
      if (this.ready) return this.ready;
      // no-cache: el navegador revalida con el servidor, así los cambios en los JSON se ven sin recarga forzada.
      const get = url => fetch(base + url, {cache: 'no-cache'}).then(r => (r.ok ? r.json() : [])).catch(() => []);
      this.ready = Promise.all([get('/assets/sedes-duoc.json'), get('/assets/eventos-duoc.json'), get('/assets/faq-duoc.json')]).then(([sedes, events, faq]) => {
        this.sedes = Array.isArray(sedes) ? sedes : (sedes.sedes || []);
        this.events = Array.isArray(events) ? events : (events.events || []);
        this.faq = Array.isArray(faq) ? faq : (faq.entries || []);
        return this;
      });
      return this.ready;
    },

    // ---------- Interpretación (sin modelo) ----------

    findSedes(text) {
      const t = norm(text);
      const byAlias = this.sedes.filter(sede => (sede.aliases || []).some(alias => has(t, norm(alias))));
      if (byAlias.length) return byAlias;
      // "santiago centro", "puente alto": también se reconoce por la comuna cuando tiene dos palabras o más.
      return this.sedes.filter(sede => sede.comuna && norm(sede.comuna).includes(' ') && has(t, norm(sede.comuna)));
    },

    listSedes() {
      return this.sedes.filter(sede => sede.lat != null).map(sede => sede.name.replace(/^(?:Sede|Campus) /, ''));
    },

    // Ciudades y comunas sin sede de Duoc UC (coordenadas aproximadas del centro urbano, solo para calcular la sede más cercana).
    cities: [
      ['Arica', -18.4783, -70.3126], ['Iquique', -20.2307, -70.1357], ['Antofagasta', -23.6509, -70.3975], ['Calama', -22.4667, -68.9333],
      ['Copiapó', -27.3668, -70.3314], ['La Serena', -29.9027, -71.2519], ['Coquimbo', -29.9533, -71.3436], ['Los Andes', -32.8337, -70.5983],
      ['San Felipe', -32.75, -70.725], ['Quillota', -32.8833, -71.25], ['Rancagua', -34.1708, -70.7444], ['San Fernando', -34.5833, -70.9833],
      ['Curicó', -34.9828, -71.2394], ['Talca', -35.4264, -71.6554], ['Linares', -35.8467, -71.5986], ['Chillán', -36.6063, -72.1034],
      ['Los Ángeles', -37.4697, -72.3537], ['Temuco', -38.7359, -72.5904], ['Valdivia', -39.8196, -73.2452], ['Osorno', -40.5739, -73.1317],
      ['Castro', -42.4824, -73.7645], ['Coyhaique', -45.5712, -72.0685], ['Punta Arenas', -53.1638, -70.9171], ['Talagante', -33.6644, -70.9272],
      ['Buin', -33.7333, -70.75], ['Quilicura', -33.3667, -70.7333], ['Ñuñoa', -33.4569, -70.5975], ['Recoleta', -33.4067, -70.6397],
      ['Peñalolén', -33.485, -70.5372], ['Pudahuel', -33.4417, -70.765], ['Lo Barnechea', -33.35, -70.5167], ['Vitacura', -33.3833, -70.5667]
    ].map(([name, lat, lng]) => ({name, lat, lng})),

    findCity(t) {
      return this.cities.find(city => has(t, norm(city.name))) || null;
    },

    /** Sede más cercana a un punto {lat, lng}; opcionalmente restringida a una lista de sedes candidatas. */
    nearestSede(point, candidates = this.sedes) {
      const rad = degrees => degrees * Math.PI / 180;
      const km = (a, b) => 6371 * 2 * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2));
      const ranked = candidates.filter(sede => sede.lat != null).map(sede => ({sede, km: km(point, sede)})).sort((a, b) => a.km - b.km);
      return ranked.length ? {sede: ranked[0].sede, km: Math.round(ranked[0].km)} : null;
    },

    refusal(extra = '') {
      return this.answer('Solo puedo mostrarte ubicaciones de sedes y campus de Duoc UC, y agregar a tu calendario fechas oficiales de admisión.' + (extra ? ' ' + extra : ''));
    },

    answer(reply, actions = []) {
      return {reply, actions, intent: {kind: 'answer', reference: 'resolved_action', action: 'none'},
        turnDecision: {mode: 'answer', operation: 'none', operations: [], destination: 'none', needsClarification: false}};
    },

    getResponse(userText) {
      if (!this.sedes.length && !this.events.length) return null;
      const t = norm(userText);
      if (!t) return null;
      return this.getLocationResponse(t, userText) || this.getCalendarResponse(t, userText);
    },

    getLocationResponse(t, raw) {
      const locationVerb = /\b(?:donde (?:esta|estan|queda|quedan|se ubica|se ubican|se encuentra|se encuentran|puedo encontrar|hay|es)|ubicacion|ubicaciones|direccion|direcciones|como llego|como llegar|como ir|como voy|mapa|mapas|ruta|llegar|ubicad[oa]s?|queda|quedan)\b/.test(t);
      const sedeWord = /\b(?:sede|sedes|campus)\b/.test(t);
      const found = this.findSedes(t);
      // "No me muestres el mapa, solo la dirección": se responde en texto, sin mapa.
      const noMap = /\b(?:no|nunca)\s+(?:me\s+)?(?:\w+\s+){0,4}mapa\b|\bsin (?:el |ningun )?mapa\b|\bsolo (?:el |la )?(?:direccion|texto)\b/.test(t);
      if (noMap && found.length) {
        const physical = found.filter(sede => sede.lat != null).slice(0, 4);
        if (!physical.length) return null;
        return this.answer(physical.map(sede => `${sede.name}: ${sede.address}, ${sede.comuna}.`).join('\n'));
      }
      const negated = /\b(?:no|nunca|sin)\s+(?:\w+\s+){0,2}(?:mapa|ubicacion|direccion|muestr\w*|mostr\w*)\b/.test(t);
      if (negated) return null;
      const wantsRoute = /\b(?:como llego|como llegar|como ir|como voy|ruta|llegar|indicaciones)\b/.test(t);

      // Datos de contacto de una sede: no están cargados; se remite a su página oficial (sin inventar teléfonos ni correos).
      if (found.length && /\b(?:telefono|fono|celular|correo|mail|email|director\w*|contacto|whatsapp|horarios? de atencion|atencion)\b/.test(t)) {
        const sede = found[0];
        return this.answer(`No tengo teléfonos propios ni horarios de atención de cada sede. Los datos de contacto generales están en el pie de página del sitio: central (+56) 2 2999 3862 y Admisión (+56) 227 120 640. Para esta sede, la página oficial es: ${sede.name}: ${sede.url}`);
      }
      // "¿Qué carreras hay en la sede X?" / "¿qué puedo estudiar en X?": es una consulta de catálogo, no de ubicación.
      if (found.length && /\b(?:carreras?|estudiar|imparte\w*|ofrece\w*|programas?)\b/.test(t) &&
          !/\b(?:mapa|ubicacion|direccion|como llego|como llegar|donde queda|donde esta|ruta)\b/.test(t)) return null;

      // Geografía o datos generales ajenos a Duoc ("la capital de Francia", "el clima en Lima").
      if (!found.length && !/\bduoc\b/.test(t) && /\b(?:capital|poblacion|clima|moneda|bandera|habitantes|huso horario|hora en)\s*(?:de|del|en)?\b/.test(t) &&
          /\b(?:capital|poblacion|clima|moneda|bandera|habitantes|hora)\s+(?:de|del|en)\b/.test(t)) return this.refusal();

      // Superlativos geográficos («¿cuál está más al sur?»): se calculan con las coordenadas; si venían hablando de una zona, solo esa zona.
      const superlative = t.match(/\b(?:mas|ma) (?:al|hacia el|en el) (sur|norte|este|oriente|oeste|poniente)\b/);
      if (superlative && (sedeWord || this.lastZone || /\b(?:cual|que)\b/.test(t)) && !/\b(?:carrera|ficha|menu)\b/.test(t)) {
        const fresh = this.lastZone && Date.now() - this.lastZone.at < 10 * 60 * 1000;
        const pool = this.sedes.filter(sede => sede.lat != null && (!fresh || this.lastZone.ids.includes(sede.id)));
        const dir = superlative[1];
        const key = /sur|norte/.test(dir) ? 'lat' : 'lng';
        const sign = /^(?:norte|este|oriente)$/.test(dir) ? -1 : 1;
        const best = [...pool].sort((a, b) => sign * (a[key] - b[key]))[0];
        if (best) return this.answer(`${fresh ? 'De esa zona, la' : 'La'} sede más al ${dir} es ${best.name} (${best.address}, ${best.comuna}). Te la muestro en el mapa.`,
          [{type: 'showMap', terms: [best.name], sedeIds: [best.id]}]);
      }

      if (found.length && (locationVerb || sedeWord) && !/\bregion metropolitana\b/.test(t)) {
        const physical = found.filter(sede => sede.lat != null);
        if (!physical.length) return this.answer(`${found[0].name} es ${found[0].address.toLowerCase()}, así que no tiene una sede física que mostrar en el mapa.`);
        const shown = physical.slice(0, 4);
        const lines = shown.map(sede => `${sede.name}: ${sede.address}, ${sede.comuna}.`);
        // Si además pide otros lugares cercanos (comida, metro, hoteles...), se aclara el límite.
        const nearby = /\b(?:comer|almorzar|restaurante\w*|restoran\w*|cafe|cafes|hotel\w*|metro|micro|bus|buses|colectivo\w*|estacionamiento|supermercado|farmacia|banco|cerca|alrededor|vecin\w*|hospedaje|arriendo|alojamiento)\b/.test(t);
        const limit = nearby ? ' No tengo información de otros lugares ni del transporte cercano; solo puedo mostrarte la ubicación de la sede.' : '';
        const reply = shown.length === 1
          ? `${lines[0]}${wantsRoute ? ' Abajo tienes el mapa y el botón para trazar la ruta.' : ' Te la muestro en el mapa.'}${shown[0].coordsPrecision === 'aproximada' ? ' El punto del mapa es aproximado; guíate por la dirección.' : ''}${limit}`
          : `Estas son las sedes que mencionas:\n${lines.join('\n')}${limit}`;
        return this.answer(reply, [{type: 'showMap', terms: shown.map(sede => sede.name), sedeIds: shown.map(sede => sede.id)}]);
      }

      // Sedes de una zona ("¿cuáles están en Santiago?", "sedes en el sur", "¿hay sedes en el norte?").
      const regions = [
        {label: 'Santiago (Región Metropolitana)', re: /\b(?:santiago|region metropolitana|gran santiago|rm)\b/, ids: ['alameda', 'alonso-ovalle', 'antonio-varas', 'maipu', 'melipilla', 'plaza-norte', 'plaza-oeste', 'plaza-vespucio', 'puente-alto', 'san-bernardo', 'san-carlos', 'san-joaquin']},
        {label: 'la Región de Valparaíso', re: /\b(?:region de valparaiso|quinta region|v region)\b/, ids: ['valparaiso', 'vina-del-mar']},
        {label: 'el sur del país', re: /\b(?:el sur|region del biobio|biobio|bio bio|araucania|los lagos)\b/, ids: ['concepcion', 'arauco', 'nacimiento', 'villarrica', 'puerto-montt']}
      ];
      const zoneAsk = /\b(?:cuales|cuantas|que sedes|hay sedes|sedes|campus)\b/.test(t) && /\b(?:en|de)\b/.test(t);
      if (zoneAsk && (!found.length || /\bregion metropolitana\b/.test(t))) {
        const region = regions.find(zone => zone.re.test(t));
        if (region) {
          const list = region.ids.map(id => this.sedes.find(sede => sede.id === id)).filter(Boolean);
          this.lastZone = {ids: region.ids, at: Date.now()};
          return this.answer(`En ${region.label} Duoc UC tiene ${list.length} sede(s) o campus: ${list.map(sede => sede.name.replace(/^(?:Sede|Campus) /, '')).join(', ')}. Te las muestro en el mapa.`,
            [{type: 'showMap', terms: list.map(sede => sede.name), sedeIds: list.map(sede => sede.id)}]);
        }
        if (/\b(?:el norte|norte grande|norte del pais|antofagasta|arica|iquique)\b/.test(t) && !/\bplaza norte\b/.test(t)) {
          const north = [...this.sedes].filter(sede => sede.lat != null).sort((a, b) => b.lat - a.lat)[0];
          return this.answer(`Duoc UC no tiene sedes ni campus en el norte del país. La más al norte es ${north.name} (${north.comuna}).`,
            [{type: 'showMap', terms: [north.name], sedeIds: [north.id]}]);
        }
      }

      // Todas las sedes.
      if (/\b(?:sedes|campus)\b/.test(t) && (locationVerb || /\b(?:cuales|cuantas|lista|listado|todas|muestr\w*|mostr\w*)\b/.test(t))) {
        const names = this.listSedes();
        return this.answer(`Duoc UC tiene ${names.length} sedes y campus con ubicación física: ${names.join(', ')}. Te muestro el mapa con todas.`,
          [{type: 'showMap', terms: ['Sedes y campus de Duoc UC'], sedeIds: this.sedes.filter(sede => sede.lat != null).map(sede => sede.id)}]);
      }

      // Una ciudad sin sede ("la sede de Temuco", "y la de Temuco"): se dice que no hay y cuál es la más cercana.
      const city = !found.length && (locationVerb || sedeWord) ? this.findCity(t) : null;
      if (city && (sedeWord || /\bduoc\b|\bla de\b/.test(t))) {
        const nearest = this.nearestSede(city);
        if (nearest) {
          return this.answer(`Duoc UC no tiene sede ni campus en ${city.name}. La más cercana es ${nearest.sede.name}: ${nearest.sede.address}, ${nearest.sede.comuna}, a unos ${nearest.km} km en línea recta (distancia aproximada).`,
            [{type: 'showMap', terms: [nearest.sede.name], sedeIds: [nearest.sede.id]}]);
        }
      }

      // Pregunta por una ciudad sin mencionar a Duoc ("¿dónde queda Temuco?"): es geografía ajena, se rechaza al instante.
      if (city && !(sedeWord || /\bduoc\b|\bla de\b/.test(t))) return this.refusal();

      // Pide una sede que no existe ("la sede de Temuco").
      const unknown = raw.match(/\b(?:sede|campus)\s+(?:de\s+|en\s+|del\s+)?([A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,40})/i);
      if (unknown && locationVerb && !found.length) {
        return this.answer(`No encuentro una sede o campus de Duoc UC llamado «${unknown[1].trim().replace(/[?.!]+$/, '')}». Las sedes son: ${this.listSedes().join(', ')}.`);
      }

      // Lugares ajenos a Duoc: se rechazan con claridad.
      const geographic = /\b(?:como llego|como llegar|como ir|como voy|direccion|ruta|mapa|metro|estacion|mall|calle|avenida|aeropuerto|terminal|hotel|restaurante|restoran|supermercado|farmacia|hospital|clinica|banco|parque|cerro|playa|ciudad|comuna|region|pais|torre|cerca de mi|cerca de aqui|gps|restaurant|cafe|cine|estadio|museo|plaza)\b/.test(t);
      const pageTarget = /\b(?:menu|menus|boton|seccion|pagina|enlace|link|carrera|carreras|formulario|buscador|pestana|logo|banner|video|texto|titulo)\b/.test(t);
      if (locationVerb && geographic && !pageTarget) return this.refusal();
      return null;
    },

    /** Fecha de hoy (hora local) como AAAA-MM-DD. */
    todayISO(now = new Date()) {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },

    daysBetween(fromISO, toISO) {
      return Math.round((Date.UTC(...toISO.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))) - Date.UTC(...fromISO.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))))) / 86400000);
    },

    /** Estado de un evento respecto de hoy: ya terminó, aún no empieza o está vigente (con días restantes). */
    describeStatus(event, today = this.todayISO()) {
      const end = event.end || event.start;
      const plural = n => `${n} ${n === 1 ? 'día' : 'días'}`;
      if (today > end) return `ya terminó el ${this.formatDate(end)} (hace ${plural(this.daysBetween(end, today))})`;
      if (today < event.start) return `aún no empieza: comienza el ${this.formatDate(event.start)} (faltan ${plural(this.daysBetween(today, event.start))})`;
      return `está vigente hasta el ${this.formatDate(end)} (faltan ${plural(this.daysBetween(today, end))})`;
    },

    upcomingEvents(now = new Date()) {
      const today = this.todayISO(now);
      return this.events.filter(event => (event.end || event.start) >= today);
    },

    getCalendarResponse(t) {
      const calendarWord = /\b(?:calendario|agenda|agendar|agendame|recordatorio|recordatorios|recuerdame|recordarme|anotame|anota)\b/.test(t);
      const relativeWord = /\b(?:ya (?:paso|cerro|abrio|termino|empezo|comenzo|abrieron|cerraron)|sigue (?:abierta|abierto|vigente)|esta (?:abierta|abierto|vigente)|aun (?:puedo|se puede|esta)|todavia (?:puedo|se puede|esta)|cuanto falta|cuantos dias|faltan|a tiempo)\b/.test(t);
      const dateWord = relativeWord || /\b(?:dia de la semana|que dia (?:cae|es|empieza|empiezan|comienza|comienzan|abre|abren|cierra|cierran|termina)|cuantos (?:dias|meses)|cuantas semanas|cuanto (?:tiempo )?dura|fecha|fechas|plazo|plazos|cuando (?:empieza|empiezan|comienza|comienzan|abre|abren|cierra|cierran|termina|terminan|inicia|inician|es|son|puedo|hay)|hasta cuando|desde cuando|calendario)\b/.test(t);
      if (!calendarWord && !dateWord) return null;
      const topics = {
        reserva: /\b(?:reserva|reservar|cupo)\b/, matricula: /\b(?:matricula|matricular|matriculas|matricularme)\b/,
        postulacion: /\b(?:postula\w*|postulacion|admision especial|reconocimiento)\b/, clases: /\b(?:inicio de clases|clases comienzan|empiezan las clases|comienzo de clases|clases)\b/,
        online: /\b(?:online|segundo ingreso)\b/, interna: /\b(?:interna|cambio de carrera)\b/, admision: /\b(?:admision|ingreso|admision 2027|2027)\b/
      };
      topics.especial = /\b(?:admision especial|especial)\b/;
      let asked = Object.entries(topics).filter(([, re]) => re.test(t)).map(([key]) => key);
      if (!asked.length) {
        // Pide agendar o ver fechas sin tema de Duoc (cumpleaños, feriados, reuniones...): se rechaza.
        if (calendarWord) return this.refusal('Por ejemplo, puedo agregar la matrícula, la postulación o el inicio de clases.');
        return null;
      }
      // "Admisión" es genérico: si hay un tema más específico (matrícula, postulación...), manda ese.
      const specific = asked.filter(topic => topic !== 'admision');
      if (specific.length) asked = specific;
      const hasTopic = event => (event.topics || []);
      const allTopics = this.events.filter(event => asked.every(topic => hasTopic(event).includes(topic)));
      const anyTopic = this.events.filter(event => asked.some(topic => hasTopic(event).includes(topic)));
      const pool = allTopics.length ? allTopics : anyTopic;

      // Cálculos con las fechas: día de la semana y duración ("¿qué día empiezan las clases?", "¿cuántos días dura la matrícula?").
      const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const weekdayOf = iso => weekdays[new Date(iso + 'T00:00:00Z').getUTCDay()];
      if (pool.length && /\b(?:dia de la semana|que dia (?:cae|es|empieza|empiezan|comienza|comienzan|abre|abren|cierra|cierran|termina|terminan))\b/.test(t)) {
        const lines = pool.slice(0, 3).map(event => {
          const end = event.end || event.start;
          return end !== event.start ? `• ${event.title}: empieza el ${weekdayOf(event.start)} ${this.formatDate(event.start)} y termina el ${weekdayOf(end)} ${this.formatDate(end)}.` : `• ${event.title}: ${weekdayOf(event.start)} ${this.formatDate(event.start)}.`;
        });
        return this.answer(lines.join('\n'));
      }
      if (pool.length && /\b(?:cuantos (?:dias|meses)|cuantas semanas)\s+(?:dura|duran|abarca|abarcan|son|tiene)\b|\bcuanto (?:tiempo )?dura\b/.test(t) && !/\b(?:falta|faltan)\b/.test(t)) {
        const lines = pool.slice(0, 3).map(event => {
          const end = event.end || event.start;
          const days = this.daysBetween(event.start, end) + 1;
          const months = Math.round(days / 30.4 * 10) / 10;
          return days <= 1 ? `• ${event.title}: es un solo día (${this.formatDate(event.start)}).` : `• ${event.title}: dura ${days} días (unas ${Math.round(days / 7)} semanas, cerca de ${months} meses), del ${this.formatDate(event.start)} al ${this.formatDate(end)}.`;
        });
        return this.answer(lines.join('\n'));
      }

      // Preguntas relativas a hoy ("¿ya pasó?", "¿cuánto falta?", "¿hasta cuándo?"): se responde con el estado real.
      const wantsStatus = relativeWord || /\b(?:hasta cuando|cuando (?:cierra|cierran|termina|terminan|abre|abren|empieza|empiezan|comienza|comienzan|inicia|inician))\b/.test(t);
      if (wantsStatus && pool.length) {
        const shownEvents = pool.slice(0, 3);
        const lines = shownEvents.map(event => `• ${event.title}: ${this.describeStatus(event)}.`);
        const open = shownEvents.filter(event => (event.end || event.start) >= this.todayISO());
        return this.answer(`Hoy es ${this.formatDate(this.todayISO())}.\n${lines.join('\n')}\nLas fechas pueden cambiar: confírmalas en admision.duoc.cl.`,
          open.length ? [{type: 'showCalendar', terms: open.map(event => event.title), eventIds: open.map(event => event.id)}] : []);
      }

      const upcoming = this.upcomingEvents();
      const matching = pool.filter(event => upcoming.includes(event));
      const events = (matching.length ? matching : upcoming).slice(0, 5);
      if (!events.length) return this.answer('No tengo fechas vigentes de admisión cargadas. Revisa admision.duoc.cl.');
      const lines = events.map(event => `• ${event.title}: ${this.formatRange(event)}`);
      return this.answer(`Estas son las fechas oficiales de Duoc UC:\n${lines.join('\n')}\nPuedes agregarlas a tu calendario con los botones de abajo. Las fechas pueden cambiar: confírmalas en admision.duoc.cl.`,
        [{type: 'showCalendar', terms: events.map(event => event.title), eventIds: events.map(event => event.id)}]);
    },

    // ---------- Calendario ----------

    formatDate(iso) {
      const [year, month, day] = iso.split('-').map(Number);
      const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return `${day} de ${months[month - 1]} de ${year}`;
    },

    formatRange(event) {
      return event.end && event.end !== event.start ? `del ${this.formatDate(event.start)} al ${this.formatDate(event.end)}` : this.formatDate(event.start);
    },

    compactDate(iso, plusDays = 0) {
      const date = new Date(iso + 'T00:00:00Z');
      date.setUTCDate(date.getUTCDate() + plusDays);
      return date.toISOString().slice(0, 10).replace(/-/g, '');
    },

    googleCalendarUrl(event) {
      const params = new URLSearchParams({
        action: 'TEMPLATE', text: event.title,
        dates: `${this.compactDate(event.start)}/${this.compactDate(event.end || event.start, 1)}`,
        details: `${event.details || ''}\nFuente oficial: ${event.source}\nLas fechas pueden cambiar; confírmalas en el sitio de Duoc UC.`.trim()
      });
      return 'https://calendar.google.com/calendar/render?' + params.toString();
    },

    icsFor(events) {
      const esc = text => String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const body = events.map(event => [
        'BEGIN:VEVENT', `UID:${event.id}@duco-asiste`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${this.compactDate(event.start)}`, `DTEND;VALUE=DATE:${this.compactDate(event.end || event.start, 1)}`,
        `SUMMARY:${esc(event.title)}`, `DESCRIPTION:${esc((event.details || '') + '\nFuente: ' + event.source)}`, `URL:${event.source}`, 'END:VEVENT'
      ].join('\r\n'));
      // RFC 5545: las líneas no pueden pasar de 75 octetos; se pliegan con CRLF + espacio sin partir caracteres UTF-8.
      const fold = line => {
        const encoder = new TextEncoder();
        if (encoder.encode(line).length <= 75) return line;
        const parts = [];
        let current = '';
        for (const char of line) {
          const limit = parts.length === 0 ? 75 : 74; // las continuaciones llevan un espacio inicial
          if (encoder.encode(current + char).length > limit) { parts.push(current); current = char; } else current += char;
        }
        parts.push(current);
        return parts.map((part, index) => (index === 0 ? part : ' ' + part)).join('\r\n');
      };
      const calendarLines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Duco Asiste//Admision Duoc UC//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Admisión Duoc UC', ...body.flatMap(block => block.split('\r\n')), 'END:VCALENDAR'];
      return calendarLines.map(fold).join('\r\n') + '\r\n';
    },

    renderCalendar(container, eventIds) {
      const events = this.events.filter(event => eventIds.includes(event.id));
      container.classList.add('duco-card', 'duco-calendar-card');
      for (const event of events) {
        const row = document.createElement('div');
        row.className = 'duco-calendar-row';
        const title = document.createElement('strong');
        title.textContent = event.title;
        const when = document.createElement('span');
        when.textContent = this.formatRange(event);
        const actions = document.createElement('div');
        actions.className = 'duco-card-actions';
        const google = document.createElement('a');
        google.href = this.googleCalendarUrl(event);
        google.target = '_blank';
        google.rel = 'noopener noreferrer';
        google.textContent = 'Agregar a Google Calendar';
        const ics = document.createElement('button');
        ics.type = 'button';
        ics.textContent = 'Descargar .ics';
        ics.addEventListener('click', () => this.downloadIcs([event]));
        actions.append(google, ics);
        row.append(title, when, actions);
        container.appendChild(row);
      }
      if (events.length > 1) {
        const all = document.createElement('button');
        all.type = 'button';
        all.className = 'duco-card-all';
        all.textContent = 'Descargar todas (.ics)';
        all.addEventListener('click', () => this.downloadIcs(events));
        container.appendChild(all);
      }
      return events.length;
    },

    downloadIcs(events) {
      const blob = new Blob([this.icsFor(events)], {type: 'text/calendar;charset=utf-8'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = events.length === 1 ? `${events[0].id}.ics` : 'admision-duoc-uc.ics';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    },

    // ---------- Mapa ----------

    directionsUrl(sede) {
      return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${sede.lat}%2C${sede.lng}`;
    },

    googleDirectionsUrl(sede) {
      return `https://www.google.com/maps/dir/?api=1&destination=${sede.lat},${sede.lng}`;
    },

    loadLeaflet() {
      if (window.L?.map) return Promise.resolve(window.L);
      if (this._leaflet) return this._leaflet;
      this._leaflet = new Promise((resolve, reject) => {
        if (!document.querySelector('link[data-duco-leaflet]')) {
          const css = document.createElement('link');
          css.rel = 'stylesheet';
          css.href = LEAFLET_CSS;
          css.dataset.ducoLeaflet = '1';
          document.head.appendChild(css);
        }
        const script = document.createElement('script');
        script.src = LEAFLET_JS;
        script.onload = () => (window.L?.map ? resolve(window.L) : reject(new Error('Leaflet no disponible')));
        script.onerror = () => reject(new Error('No se pudo cargar Leaflet'));
        document.head.appendChild(script);
      });
      this._leaflet.catch(() => { this._leaflet = null; });
      return this._leaflet;
    },

    async renderMap(container, sedeIds, options = {}) {
      const sedes = this.sedes.filter(sede => sedeIds.includes(sede.id) && sede.lat != null);
      container.classList.add('duco-card', 'duco-map-card');
      if (!sedes.length) { container.textContent = 'No tengo coordenadas para mostrar esa sede.'; return 0; }

      const mapEl = document.createElement('div');
      mapEl.className = 'duco-map';
      container.appendChild(mapEl);
      const list = document.createElement('div');
      list.className = 'duco-map-links';
      for (const sede of sedes.slice(0, 6)) {
        const row = document.createElement('div');
        const label = document.createElement('span');
        label.textContent = `${sede.name} · ${sede.address}${sede.coordsPrecision === 'aproximada' ? ' (ubicación aproximada en el mapa)' : ''}`;
        const route = document.createElement('a');
        route.href = this.googleDirectionsUrl(sede);
        route.target = '_blank';
        route.rel = 'noopener noreferrer';
        route.textContent = 'Cómo llegar';
        row.append(label, route);
        list.appendChild(row);
      }
      container.appendChild(list);
      const credit = document.createElement('small');
      credit.className = 'duco-map-credit';
      credit.textContent = 'Mapa © OpenStreetMap';
      container.appendChild(credit);

      try {
        const L = await this.loadLeaflet();
        const map = L.map(mapEl, {scrollWheelZoom: false, attributionControl: false}).setView([sedes[0].lat, sedes[0].lng], 15);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);
        const bounds = [];
        for (const sede of sedes) {
          const marker = L.marker([sede.lat, sede.lng], {
            title: sede.name,
            icon: L.divIcon({className: 'duco-pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 22]})
          }).addTo(map);
          const popup = document.createElement('div');
          const strong = document.createElement('strong');
          strong.textContent = sede.name;
          popup.append(strong, document.createElement('br'), document.createTextNode(`${sede.address}, ${sede.comuna}`));
          marker.bindPopup(popup);
          bounds.push([sede.lat, sede.lng]);
        }
        // Ruta por calle calculada con OSRM: trazado entre el origen del usuario y la sede, con su distancia y tiempo.
        const route = options.route;
        if (route?.points?.length > 1) {
          const line = L.polyline(route.points, {color: '#0b5cad', weight: 5, opacity: 0.85}).addTo(map);
          const start = L.circleMarker([route.from.lat, route.from.lng], {radius: 8, color: '#0b5cad', fillColor: '#ffffff', fillOpacity: 1, weight: 3}).addTo(map);
          const startPopup = document.createElement('span');
          startPopup.textContent = `${route.from.label || 'Origen'} · ${route.distanceKm} km · ${route.durationMin} min en auto`;
          start.bindPopup(startPopup);
          map.fitBounds(line.getBounds(), {padding: [28, 28]});
          const summary = document.createElement('small');
          summary.className = 'duco-map-credit';
          summary.textContent = `Ruta en auto: ${route.distanceKm} km · ${route.durationMin} min (OSRM, sin tráfico)`;
          container.appendChild(summary);
        } else if (bounds.length > 1) map.fitBounds(bounds, {padding: [24, 24]});
        else if (sedes[0]) map.setView(bounds[0], 16);
        setTimeout(() => map.invalidateSize(), 150);
        container._ducoMap = map;
      } catch (error) {
        // Sin Leaflet/Internet queda la lista con enlaces: el mapa estático no es imprescindible.
        mapEl.textContent = 'No pude cargar el mapa interactivo; usa los enlaces de abajo.';
        mapEl.classList.add('duco-map-fallback');
      }
      return sedes.length;
    }
  };

  window.ducoPlaces = places;
  const start = () => places.load(window.ducoConfig?.assetsBase || '');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
