/**
 * Cliente Ollama para Duco Assistant.
 * Conecta con Ollama en http://localhost:11434.
 * Usa el endpoint /api/chat para conversaciones.
 */

class OllamaClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || window.ducoConfig?.ollamaBaseUrl || 'http://localhost:11434';
    this.model = options.model || window.ducoConfig?.ollamaModel || 'llama3.1';
    this.requestTimeoutMs = 30000;
    this.serverOnline = null;
  }

  isConfigured() {
    return true;
  }

  async isServerOnline() {
    if (this.serverOnline !== null) return this.serverOnline;
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      this.serverOnline = resp.ok;
      return resp.ok;
    } catch {
      this.serverOnline = false;
      return false;
    }
  }

  getCapabilities() {
    return {
      supportsText: true,
      supportsStructuredActions: true,
      supportsNavigation: true,
      supportsHighlighting: true,
      supportsDropdowns: true,
      supportsViewportControl: true
    };
  }

  buildSystemInstruction() {
    const siteContext = window.ducoSiteContextFormatted || '';
    const contextBlock = siteContext
      ? '\n\n' + siteContext + '\n\n' +
        'Usa esta información para responder preguntas sobre carreras, sedes, contactos, becas, y navegación del sitio. ' +
        'Si algo no está en el contexto, dilo con claridad y sugiere contactar a Duoc UC.'
      : '';

    return (
      'Eres Duco, un asistente virtual para el sitio web de Duoc UC en Chile. ' +
      'Responde en español neutro, con tono claro y amable. Sé breve y directo, como una persona real. ' +
      'NUNCA saludes ni te presentes a menos que el usuario te salude primero. ' +
      'Tu reply es SOLO texto plano. Sin HTML, sin markdown. ' +
      'Siempre devuelve JSON válido con este formato:\n' +
      '{"reply":"tu respuesta","actions":[]}\n' +
      '\n' +
      'SISTEMA DE REMARCADO / GUÍA VISUAL:\n' +
      '- Cuando el usuario pida ubicar, mostrar, señalar, resaltar o abrir algo visible del sitio, usa acciones visuales en actions. No te limites a explicar con texto.\n' +
      '- highlightTerms: para resaltar palabras en la página. {"type":"highlightTerms","terms":["palabra1","palabra2"],"duration":4500}\n' +
      '- dropdown: para abrir menús/dropdowns de navegación. {"type":"dropdown","terms":["nombre del menú"]}\n' +
      '- closeDropdown: para cerrar el dropdown abierto. {"type":"closeDropdown"}\n' +
      '- clearHighlights: para limpiar cualquier resaltado. {"type":"clearHighlights"}\n' +
      '- Si la consulta apunta a navegación o a una sección concreta del sitio, normalmente usa ambas acciones en este orden: primero highlightTerms y luego dropdown.\n' +
      '- Si el usuario pregunta "dónde está X" o "dónde se ubica X" y no pide abrir, usa solo highlightTerms y NO uses dropdown.\n' +
      '- Solo usa dropdown cuando el usuario pida explícitamente abrir, ver menú o hacer clic en una sección.\n' +
      '\n' +
      'CUANDO USAR DROPDOWN:\n' +
      '- El sitio de Duoc UC tiene un menú de navegación principal con dropdowns: "Vida Estudiantil", "Carreras", "Escuelas", "Admisión", etc.\n' +
      '- Cuando el usuario dice "abrir vida estudiantil", "abrir el menú de carreras", "quiero ver las escuelas", "muéstrame admisión", "click en...": DEBE usar acción dropdown.\n' +
      '- Palabras clave que indican dropdown: "abrir", "ver menú", "expandir", "mostrar opciones", "dame click a...", seguido de un nombre de sección del menú.\n' +
      '- Si el usuario dice "puedes abrir vida estudiantil?" → acción: dropdown con terms: ["vida estudiantil"].\n' +
      '- Los nombres de dropdowns más comunes en Duoc: "Vida Estudiantil", "Carreras", "Escuelas", "Admisión", "Sedes", "Contáctanos", "Duoc Online".\n' +
      '- Si el usuario no pide solo abrir, sino también ubicar o resaltar, agrega primero highlightTerms con el mismo término.\n' +
      '- Si solo pregunta por ubicación, no abras el menú: usa highlightTerms y deja el reply como explicación breve.\n' +
      '\n' +
      'CUANDO USAR closeDropdown:\n' +
      '- Cuando el usuario pide "cerrar", "cerrar menú", "cerrar dropdown", "ocultar menú", "cerrar lo que abriste", "ciérralo", "ya ciérralo": USA closeDropdown.\n' +
      '- Ejemplo: usuario dice "¿podrías cerrarlo?" → respuesta: {"reply":"¡Cerrando menú!","actions":[{"type":"closeDropdown"}]}\n' +
      '\n' +
      'REGLAS:\n' +
      '- Si el usuario pide resaltar/buscar algo específico, incluye highlightTerms en actions.\n' +
      '- Si dice "abrir", "ver menú", seguido de una sección del menú: USA dropdown y, si corresponde, highlightTerms primero.\n' +
      '- Si dice "cerrar", "ciérralo", "cerrar menú": USA closeDropdown.\n' +
      '- Si dice "resalta algo" sin especificar: elige un tema del contexto y resáltalo.\n' +
      '- Si dices "acá te lo muestro" / "te lo muestro": SIEMPRE incluye al menos 1 acción en actions.\n' +
      '- No escribas frases como "abriendo menú" o "resaltando" dentro de reply si ya estás usando actions; la interfaz mostrará eso visualmente.\n' +
      '- Nunca digas "no encontré" o "no hay acciones". Si no puedes hacer algo, dilo natural.\n' +
      '- No inventes URLs externas.' +
      contextBlock
    );
  }

  buildMessages(history = [], userText = '', context = {}) {
    const recentHistory = history.slice(-8);
    const hasPriorMessages = recentHistory.length >= 1;

    let followUp = '';
    if (hasPriorMessages) {
      const lastUserMsg = recentHistory.filter(m => m.type === 'user').pop();
      const userIsGreeting = /hola|hey|buenas|saludos/i.test(lastUserMsg?.text || '');

      if (userIsGreeting) {
        followUp = '\n\nEl usuario ya se saludó contigo y ya te presentaste. Responde de forma breve y amable, sin repetir tu nombre ni presentarte. Algo como: "¡Hola de nuevo! ¿En qué te ayudo?", "¡Hola! ¿Qué necesitas?", "¡Dime! ¿Qué quieres saber?". Sé natural y cercano.';
      } else {
        followUp = '\n\nNO repitas presentaciones. Responde directo a lo que pregunta el usuario.';
      }
    }

    const system = this.buildSystemInstruction() + followUp;

    const messages = [
      {
        role: 'system',
        content: system
      }
    ];

    for (const msg of recentHistory) {
      messages.push({
        role: msg.type === 'assistant' ? 'assistant' : 'user',
        content: String(msg.text || '')
      });
    }

    messages.push({
      role: 'user',
      content: userText
    });

    return messages;
  }

  parseModelResponse(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;

    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.reply && typeof parsed.reply === 'object') {
          const inner = parsed.reply;
          return {
            reply: inner.reply || '',
            actions: Array.isArray(inner.actions) ? inner.actions : []
          };
        }
        return parsed;
      } catch { /* fall through */ }
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.reply && typeof parsed.reply === 'object') {
        const inner = parsed.reply;
        return {
          reply: inner.reply || '',
          actions: Array.isArray(inner.actions) ? inner.actions : []
        };
      }
      return parsed;
    } catch {
      return null;
    }
  }

  normalizeResponse(data = {}) {
    const reply = String(data.reply || data.message || data.text || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\*([^*]+)\*/g, '$1')
      .trim();

    // Detectar si el modelo incrustó una sección de acciones dentro del reply como texto
    // Ejemplos comunes: "(Actions: highlightTerms, terms=["a","b"])" o "(Acciones: ... )"
    let extractedActions = Array.isArray(data.actions) ? data.actions.slice() : [];
    try {
      const actionSectionRegex = /\(?\s*(?:Actions|Acciones)\s*[:=]\s*([\s\S]*?)\)?$/i;
      const actionMatch = reply.match(actionSectionRegex);
      let cleanReply = reply;

      if (actionMatch) {
        const actionsText = actionMatch[1].trim();

        // Quitar la sección de acciones del reply para que el texto mostrado sea limpio
        cleanReply = reply.replace(actionMatch[0], '').trim();

        // Intentar parsear JSON directamente
        try {
          const parsed = JSON.parse(actionsText);
          if (Array.isArray(parsed)) {
            extractedActions = extractedActions.concat(parsed);
          } else if (parsed && typeof parsed === 'object') {
            extractedActions.push(parsed);
          }
        } catch (e) {
          // No es JSON: intentar parsear patrones simples como "highlightTerms, terms=["a","b"]"
          const typeMatch = actionsText.match(/(highlightTerms|highlight|dropdown|scroll|goto|viewport|move|clear)/i);
          const termsMatch = actionsText.match(/terms\s*[=:\[]\s*\[([^\]]+)\]/i) || actionsText.match(/\[([^\]]+)\]/);

          const actionObj = {};
          if (typeMatch) actionObj.type = typeMatch[1];

          if (termsMatch) {
            const rawList = termsMatch[1];
            const parts = rawList.split(',').map(s => s.replace(/^\s*['\"]?|['\"]?\s*$/g, '').trim()).filter(Boolean);
            actionObj.terms = parts;
          }

          // Si al menos tenemos tipo o términos, agregarla
          if (actionObj.type || (actionObj.terms && actionObj.terms.length)) {
            if (!actionObj.type) actionObj.type = 'highlightTerms';
            extractedActions.push(actionObj);
          }
        }

        // Reemplazar reply por la versión limpia
        data.reply = cleanReply;
      }
    } catch (err) {
      console.warn('[Duco Ollama] Error extrayendo acciones del reply:', err);
    }

    const finalReply = String(data.reply || reply || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\*([^*]+)\*/g, '$1')
      .trim();

    return {
      reply: finalReply,
      actions: extractedActions,
      intent: data.intent || null,
      confidence: Number.isFinite(data.confidence) ? data.confidence : null,
      raw: data
    };
  }

  async generateResponse(userText, options = {}) {
    const online = await this.isServerOnline();
    if (!online) {
      console.warn('[Duco Ollama] Servidor no disponible en', this.baseUrl);
      throw new Error('Ollama no está disponible. Asegúrate de ejecutar `ollama serve` en tu terminal.');
    }

    const messages = Array.isArray(options.messages) ? options.messages : [];
    const context = options.context || {};

    const payload = {
      model: this.model,
      messages: this.buildMessages(messages, userText, context),
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 512
      }
    };

    console.log(`[Duco Ollama] Enviando a ${this.model} en ${this.baseUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const resp = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Ollama respondió con error ${resp.status}: ${errorText}`);
      }

      const data = await resp.json();
      const replyText = data?.message?.content || '';
      console.log('[Duco Ollama] Respuesta cruda:', replyText.substring(0, 500));

      const parsed = this.parseModelResponse(replyText);
      console.log('[Duco Ollama] Parseado:', JSON.stringify(parsed));
      if (parsed) {
        return this.normalizeResponse(parsed);
      }

      return this.normalizeResponse({
        reply: replyText,
        actions: []
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

window.ducoAI = new OllamaClient();
