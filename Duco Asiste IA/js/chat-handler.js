/**
 * Sistema de Chat para Duco Assistant
 * Maneja la conversación y el historial de mensajes
 */

class ChatHandler {
  constructor() {
    this.messages = [];
    this.maxMessages = 50; // Limitar historial
    this.typingSpeed = 30; // ms por carácter
    this.storageKey = 'duco-chat-session';
    this.conversationContext = {
      currentIntent: null,
      lastIntentTime: null,
      visitedSections: new Set()
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
        this.messages = data.messages || [];
        this.conversationContext = {
          ...this.conversationContext,
          ...(data.context || {})
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
    this.limitMessages();
    this.saveToSession();
    return message;
  }

  /**
   * Agregar mensaje del asistente
   * @param {string} text - Texto del mensaje
   * @param {boolean} isTyping - Si debe simular escritura
   */
  addAssistantMessage(text, isTyping = true) {
    const message = {
      id: Date.now(),
      type: 'assistant',
      text: text,
      timestamp: new Date().toISOString(),
      displayed: false,
      isTyping: isTyping
    };
    this.messages.push(message);
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
  getAllMessages() {
    return [...this.messages];
  }

  /**
   * Limpiar historial de mensajes
   */
  clearHistory() {
    this.messages = [];
    this.conversationContext = {
      currentIntent: null,
      lastIntentTime: null,
      visitedSections: new Set()
    };
    this.clearSession();
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
