/**
 * Sistema de Chat para Duco Assistant
 * Maneja la conversación y el historial de mensajes
 */

class ChatHandler {
  constructor() {
    this.messages = [];
    this.dialogue = [];
    this.maxMessages = 50; // Limitar historial
    this.typingSpeed = 30; // ms por carácter
    this.storageKey = 'duco-chat-session';
    this.sessionId = this.createSessionId();
    this.documentId = this.createSessionId();
    this.conversationContext = {
      currentIntent: null,
      lastIntentTime: null,
      visitedSections: new Set(),
      actionOutcomes: [],
      actionPlans: []
    };
    this.initializeFromSession();
  }

  /**
   * Inicializar mensajes desde sessionStorage
   * Se limpia automáticamente al cerrar la pestaña
   */
  initializeFromSession() {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.messages = Array.isArray(data.messages) ? data.messages : [];
        this.dialogue = (Array.isArray(data.dialogue) ? data.dialogue : this.messages)
          .filter(message=>this.isDialogueMessage(message)).slice(-40);
        this.sessionId = data.sessionId || this.sessionId;
        this.conversationContext = {
          ...this.conversationContext,
          ...(data.context || {}),
          actionOutcomes: Array.isArray(data.context?.actionOutcomes) ? data.context.actionOutcomes : []
        };
        // Convertir Set de visitedSections de vuelta
        if (data.context?.visitedSections) {
          this.conversationContext.visitedSections = new Set(data.context.visitedSections);
        }
      }
    } catch (error) {
      console.error('[Duco] Error cargando sesión:', error);
      this.clearSession();
    }
  }

  /**
   * Guardar sesión en sessionStorage
   */
  saveToSession() {
    try {
      const data = {
        messages: this.messages,
        dialogue: this.dialogue,
        sessionId: this.sessionId,
        context: {
          ...this.conversationContext,
          visitedSections: Array.from(this.conversationContext.visitedSections)
        }
      };
      sessionStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('[Duco] No se pudo guardar sesión:', error);
    }
  }

  /**
   * Limpiar sesión
   */
  clearSession() {
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('[Duco] Error limpiando sesión:', error);
    }
  }

  /**
   * Registrar sección visitada
   */
  markSectionVisited(sectionKey) {
    this.conversationContext.visitedSections.add(sectionKey);
    this.saveToSession();
  }

  /**
   * Obtener contexto de conversación
   */
  getContext() {
    return { ...this.conversationContext };
  }

  recordActionOutcome(action, result = {}, request = '') {
    const actionOutcomes = Array.isArray(this.conversationContext.actionOutcomes)
      ? this.conversationContext.actionOutcomes
      : [];
    actionOutcomes.push({
      type: String(action?.type || 'unknown'),
      request: String(request || '').slice(0, 2000),
      scope: action?.scope === 'opened_menu' ? 'opened_menu' : 'page',
      menuTerms: Array.isArray(action?.menuTerms) ? action.menuTerms.map(String).slice(0,4) : [],
      evidenceTexts: action?.type === 'showEvidence' && Array.isArray(action.evidenceTexts) ? action.evidenceTexts.slice(0,8).map(String) : [],
      pagePath: window.location?.pathname || '',
      target: (Array.isArray(action?.terms) ? action.terms : [])
        .map(term => String(term || '').trim()).filter(Boolean).slice(0, 4),
      success: result.success === true,
      detail: String(result.detail || '').slice(0, 220),
      documentId: this.documentId,
      timestamp: Date.now()
    });
    this.conversationContext.actionOutcomes = actionOutcomes.slice(-6);
    this.saveToSession();
  }

  getActionOutcomes() {
    return Array.isArray(this.conversationContext.actionOutcomes)
      ? this.conversationContext.actionOutcomes.slice(-6).map(item => ({ ...item, historical: item.documentId !== this.documentId }))
      : [];
  }

  recordActionPlan(request, actions, outcomes) {
    // Solo datos serializables: nunca guardar referencias al DOM en la sesión.
    const steps = actions.filter(action=>['dropdown','closeDropdown','highlightTerms','highlight','clearHighlights','scroll','viewport','move','goto','clickControl','selectPageControl','showEvidence'].includes(action.type))
      .map(action=>Object.fromEntries(['type','terms','scope','menuTerms','careerCard','dialogId','evidenceTexts','duration','pauseAfter','target','top','left','deltaY','deltaX','align','offset','behavior']
        .filter(key=>action[key] !== undefined && (action[key] === null || typeof action[key] !== 'object' || Array.isArray(action[key])))
        .map(key=>[key,action[key]])));
    if (!steps.length) return;
    const plans = Array.isArray(this.conversationContext.actionPlans) ? this.conversationContext.actionPlans : [];
    plans.push({request:String(request || '').slice(0,2000),actions:steps,
      outcomes:outcomes.map(item=>({success:item.success === true,detail:String(item.detail || '').slice(0,220)})),timestamp:Date.now()});
    this.conversationContext.actionPlans = plans.slice(-6);
    this.saveToSession();
  }

  getActionPlans() {
    return JSON.parse(JSON.stringify(this.conversationContext.actionPlans || []));
  }

  /**
   * Actualizar intención actual
   */
  setCurrentIntent(intentKey) {
    this.conversationContext.currentIntent = intentKey;
    this.conversationContext.lastIntentTime = Date.now();
    this.saveToSession();
  }

  /**
   * Agregar mensaje del usuario
   * @param {string} text - Texto del mensaje
   */
  addUserMessage(text) {
    const message = {
      id: Date.now(),
      type: 'user',
      text: text,
      timestamp: new Date().toISOString(),
      displayed: false
    };
    this.messages.push(message);
    if (this.isDialogueMessage(message)) this.dialogue = [...this.dialogue,message].slice(-40);
    this.limitMessages();
    this.saveToSession();
    return message;
  }

  /**
   * Agregar mensaje del asistente
   * @param {string} text - Texto del mensaje
   * @param {boolean} isTyping - Si debe simular escritura
   */
  addAssistantMessage(text, isTyping = true, metadata = {}) {
    const message = {
      id: Date.now(),
      type: 'assistant',
      text: text,
      timestamp: new Date().toISOString(),
      displayed: false,
      isTyping: isTyping,
      category: metadata.category || (Array.isArray(metadata.highlightTerms) ? 'action' : 'dialogue'),
      ...(Array.isArray(metadata.highlightTerms) ? {
        highlightTerms: metadata.highlightTerms.map(term => String(term || '').trim()).filter(Boolean).slice(0, 6)
      } : {})
    };
    this.messages.push(message);
    if (this.isDialogueMessage(message)) this.dialogue = [...this.dialogue,message].slice(-40);
    this.limitMessages();
    this.saveToSession();
    return message;
  }

  /**
   * Limitar el número de mensajes en el historial
   */
  limitMessages() {
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  /**
   * Obtener el último mensaje
   */
  getLastMessage() {
    return this.messages[this.messages.length - 1] || null;
  }

  /**
   * Obtener todos los mensajes
   */
  isDialogueMessage(message) {
    if (message?.type==='user') return true;
    return message?.type==='assistant' && message.category!=='action' &&
      !/^(?:🔎|🔍|🖍|📂|🚫|🖱|📄)/u.test(String(message.text || '').trim());
  }

  getDialogueMessages() {
    return this.dialogue.map(message=>({...message}));
  }

  getAllMessages() {
    return [...this.messages];
  }

  /**
   * Limpiar historial de mensajes
   */
  clearHistory() {
    this.messages = [];
    this.dialogue = [];
    this.sessionId = this.createSessionId();
    this.conversationContext = {
      currentIntent: null,
      lastIntentTime: null,
      visitedSections: new Set(),
      actionOutcomes: [],
      actionPlans: []
    };
    this.clearSession();
  }

  getSessionId() {
    return this.sessionId;
  }

  createSessionId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
      const random = Math.random() * 16 | 0;
      return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
    });
  }

  /**
   * Respuesta automática reservada para la futura capa de IA.
   * Por ahora no devuelve texto hardcodeado.
   */
  getAutoResponse() {
    return '';
  }

  /**
   * Generar flujo contextual basado en la intención
   * @param {string} intentKey - La clave de intención
   * @returns {Array<Object>} - Secuencia de mensajes y acciones
   */
  getContextualResponse(intentKey) {
    return null;
  }

  /**
   * Obtener una secuencia de acciones contextuales para mostrarla por pasos.
   * @param {string} intentKey - La clave de intención
   * @returns {Array<Object>} - Secuencia de mensajes y acciones
   */
  getContextualResponseFlow(intentKey) {
    const flows = {
      carreras: [
        {
          text: 'En Duoc UC ofrecemos más de 70 carreras técnicas y profesionales. Puedes explorarlas en el menú de Oferta Académica.',
          pauseAfter: 400
        },
        {
          action: {
            type: 'highlightTerms',
            terms: ['carreras', 'oferta académica'],
            duration: 5000
          }
        }
      ],
      admision: [
        {
          text: 'El proceso de admisión te permite postular a nuestras carreras. ¡Conoce los requisitos y fechas importantes!',
          pauseAfter: 400
        },
        {
          action: {
            type: 'highlightTerms',
            terms: ['admisión', 'postulación', 'matricúlate'],
            duration: 5000
          }
        }
      ],
      vida_estudiantil: [
        {
          text: 'Vida Estudiantil incluye programas de apoyo, bienestar, deportes, pastoral, convivencia e inclusión y más beneficios para ti.',
          pauseAfter: 400
        },
        {
          action: {
            type: 'highlightTerms',
            terms: ['vida estudiantil', 'bienestar', 'deportes', 'pastoral', 'convivencia'],
            duration: 5000
          }
        }
      ],
      sedes: [
        {
          text: 'Duoc UC cuenta con 18 sedes distribuidas a lo largo de todo Chile. ¡Encuentra la más cercana a ti!',
          pauseAfter: 400
        },
        {
          action: {
            type: 'highlightTerms',
            terms: ['sedes', 'campus', 'ubicaciones'],
            duration: 5000
          }
        }
      ],
      contacto: [
        {
          text: 'Puedes contactarnos por teléfono, WhatsApp o correo electrónico. Estamos aquí para ayudarte.',
          pauseAfter: 400
        },
        {
          action: {
            type: 'highlightTerms',
            terms: ['contacto', 'teléfono', 'whatsapp'],
            duration: 5000
          }
        }
      ],
      nosotros: [
        {
          text: 'Conoce nuestra historia, misión, visión y valores como institución educativa.',
          pauseAfter: 400
        },
        {
          action: {
            type: 'highlightTerms',
            terms: ['nosotros', 'historia', 'misión', 'valores'],
            duration: 5000
          }
        }
      ],
      duoc_online: [
        {
          text: 'Duoc Online te permite estudiar 100% en línea con la misma calidad de nuestras carreras presenciales.',
          pauseAfter: 400
        },
        {
          action: {
            type: 'highlightTerms',
            terms: ['online', 'en línea', 'duoc online'],
            duration: 5000
          }
        }
      ],
      escuelas: [
        {
          text: 'Contamos con 9 escuelas especializadas: Administración y Negocios, Comunicación, Construcción, Diseño, Gastronomía, Informática y Telecomunicaciones, Ingeniería y Medio Ambiente, Salud y Bienestar, y Turismo y Hospitalidad.',
          pauseAfter: 400
        },
        {
          action: {
            type: 'highlightTerms',
            terms: ['escuelas', 'administración', 'comunicación', 'diseño', 'salud'],
            duration: 5000
          }
        }
      ]
    };

    return flows[intentKey] || [];
  }

  /**
   * Simular escritura de un mensaje
   * @param {string} text - Texto a "escribir"
   * @returns {Promise} - Se resuelve cuando termina
   */
  simulateTyping(text) {
    return new Promise(resolve => {
      setTimeout(() => resolve(text), text.length * this.typingSpeed);
    });
  }

  /**
   * Obtener resumen del chat (para debugging)
   */
  getSummary() {
    return {
      totalMessages: this.messages.length,
      userMessages: this.messages.filter(m => m.type === 'user').length,
      assistantMessages: this.messages.filter(m => m.type === 'assistant').length,
      lastMessage: this.getLastMessage()
    };
  }
}

// Crear instancia global
window.chatHandler = new ChatHandler();
