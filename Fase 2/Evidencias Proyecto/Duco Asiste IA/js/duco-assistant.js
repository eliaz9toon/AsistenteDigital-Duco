/**
 * Asistente Virtual Duco - Sistema Principal
 * Integra navegación, chat y UI en una experiencia conversacional
 */

class DucoAssistant {
  constructor() {
    this.isOpen = false;
    this.typewriterSpeed = 36;
    this.containerId = 'duco-assistant-container';
    this.chatPanelId = 'duco-chat-panel';
    this.inputId = 'duco-input';
    this.messagesId = 'duco-messages';
    this.typingIndicatorId = 'duco-typing-indicator';
    this.aiClient = null;
    this.init();
  }

  /**
   * Inicializar el asistente
   */
  init() {
    // Esperar a que DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  /**
   * Configurar UI y event listeners
   */
  setup() {
    try {
      this.aiClient = window.ducoAI || null;
      this.createUI();
      this.attachEventListeners();
      this.ensureLauncherVisible();
      this.showWelcomeMessage();
      this.refreshSiteContext();
      this.listenForNavigationChanges();
    } catch (error) {
      console.error('[Duco] Error en setup:', error);
      this.logError('Error inicializando asistente', error);
    }
  }

  /**
   * Refresca el contexto del sitio para que la IA tenga info actualizada.
   */
  refreshSiteContext() {
    if (typeof window.ducoSiteContext?.extractAll === 'function' || typeof UniversalContextExtractor !== 'undefined') {
      const extractor = window.ducoSiteContext?.extractAll ? window.ducoSiteContext : new UniversalContextExtractor();
      window.ducoSiteContext = extractor.extractAll();
      window.ducoSiteContextFormatted = window.formatContextForAI(window.ducoSiteContext);
      console.log('[Duco] Contexto actualizado para:', window.ducoSiteContext.page.title);
    }
  }

  /**
   * Escucha cambios de navegación para refrescar contexto automáticamente.
   * Detecta cambios de URL (SPA), popstate, y navegación por clicks.
   */
  listenForNavigationChanges() {
    let lastPath = window.location.pathname;

    const checkAndRefresh = () => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        setTimeout(() => this.refreshSiteContext(), 300);
      }
    };

    window.addEventListener('popstate', checkAndRefresh);
    window.addEventListener('hashchange', checkAndRefresh);

    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;
    history.pushState = function (...args) {
      origPushState.apply(this, args);
      checkAndRefresh();
    };
    history.replaceState = function (...args) {
      origReplaceState.apply(this, args);
      checkAndRefresh();
    };

    const interval = setInterval(checkAndRefresh, 2000);
    setTimeout(() => clearInterval(interval), 300000);
  }

  /**
   * Verificar si la IA está disponible y loguear estado.
   */
  async checkAiStatus() {
    if (!this.aiClient || typeof this.aiClient.isServerOnline !== 'function') {
      console.log('[Duco] IA local: no configurada (usando respuestas locales)');
      return;
    }
    const online = await this.aiClient.isServerOnline();
    if (online) {
      console.log(`[Duco] IA local: conectada (${this.aiClient.model})`);
    } else {
      console.log('[Duco] IA local: Ollama no detectado (ejecuta `ollama serve`)');
    }
  }

  /**
   * Garantiza que el botón launcher esté visible cuando el panel está cerrado.
   */
  ensureLauncherVisible() {
    const avatarBtn = document.querySelector('.duco-avatar-button');
    if (!avatarBtn) return;

    avatarBtn.style.display = 'flex';
    avatarBtn.style.visibility = 'visible';
    avatarBtn.style.opacity = '1';
    avatarBtn.style.pointerEvents = 'auto';
  }

  /**
   * Log de errores (preparado para futuro sistema de analytics)
   */
  logError(message, error) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: message,
      error: error?.message || String(error)
    };
    console.warn('[Duco Error]', errorLog);
  }

  /**
   * Crear la interfaz del asistente
   */
  createUI() {
    try {
      // Verificar si ya existe
      if (document.getElementById(this.containerId)) {
        console.warn('[Duco] UI ya existe');
        return;
      }

      // Contenedor principal
      const container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'duco-container';

      container.innerHTML = `
        <div class="duco-widget">
          <!-- Avatar y botón de apertura -->
          <div class="duco-avatar-button">
            <div class="duco-avatar">
              <img src="./dibujos/duco asiste.png" alt="Duco Avatar" class="duco-avatar-img">
            </div>
          </div>

          <!-- Panel de Chat -->
          <div id="${this.chatPanelId}" class="duco-chat-panel">
            <!-- Avatar Grande expandido -->
            <div class="duco-avatar-expanded">
              <img src="./dibujos/Duco idle.png" alt="Duco Avatar" class="duco-avatar-expanded-img">
            </div>

            <div class="duco-header">
              <h3>Duco - Tu Asistente Virtual</h3>
              <button class="duco-close" id="duco-close-btn">&times;</button>
            </div>

            <div id="${this.messagesId}" class="duco-messages"></div>

            <!-- Indicador de escritura -->
            <div id="${this.typingIndicatorId}" class="duco-typing-indicator" style="display:none;">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div class="duco-input-area">
              <input 
                type="text" 
                id="${this.inputId}" 
                class="duco-input" 
                placeholder="Escribe tu pregunta..."
                aria-label="Escribe tu mensaje para Duco"
              />
              <button class="duco-send-btn" id="duco-send-btn" aria-label="Enviar mensaje">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,2.89206329 C3.34915502,2.59915986 2.40734225,2.71077881 1.77946707,3.17846707 C0.994623095,3.80718627 0.837654301,4.89646205 1.15159189,5.68194892 L3.03521743,12.1229419 C3.03521743,12.2800393 3.19218622,12.4371367 3.50612381,12.4371367 L16.6915026,13.2226236 C16.6915026,13.2226236 17.1624089,13.2226236 17.1624089,12.8495722 L17.1624089,12.0641045 C17.1624089,11.6910531 16.6915026,11.6910531 16.6915026,12.4744748 Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);
    } catch (error) {
      console.error('[Duco] Error creando UI:', error);
      throw error;
    }
  }

  /**
   * Adjuntar event listeners
   */
  attachEventListeners() {
    try {
      const avatarBtn = document.querySelector('.duco-avatar-button');
      const closeBtn = document.getElementById('duco-close-btn');
      const sendBtn = document.getElementById('duco-send-btn');
      const input = document.getElementById(this.inputId);

      if (!avatarBtn || !closeBtn || !sendBtn || !input) {
        console.warn('[Duco] No se encontraron todos los elementos necesarios');
        return;
      }

      avatarBtn.addEventListener('click', () => {
        try {
          this.togglePanel();
        } catch (error) {
          console.error('[Duco] Error en toggle:', error);
        }
      });

      closeBtn.addEventListener('click', () => {
        try {
          this.closePanel();
        } catch (error) {
          console.error('[Duco] Error en close:', error);
        }
      });

      sendBtn.addEventListener('click', () => {
        try {
          this.handleUserInput();
        } catch (error) {
          console.error('[Duco] Error en send:', error);
        }
      });

      input.addEventListener('keypress', (e) => {
        try {
          if (e.key === 'Enter') this.handleUserInput();
        } catch (error) {
          console.error('[Duco] Error en keypress:', error);
        }
      });
    } catch (error) {
      console.error('[Duco] Error adjuntando event listeners:', error);
    }
  }

  /**
   * Alternar panel de chat
   */
  togglePanel() {
    if (this.isOpen) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  /**
   * Abrir panel de chat
   */
  openPanel() {
    const panel = document.getElementById(this.chatPanelId);
    const avatarBtn = document.querySelector('.duco-avatar-button');
    if (panel) {
      panel.classList.add('open');
      avatarBtn?.classList.add('hidden');
      this.isOpen = true;
      document.getElementById(this.inputId)?.focus();
    }
  }

  /**
   * Cerrar panel de chat
   */
  closePanel() {
    const panel = document.getElementById(this.chatPanelId);
    const avatarBtn = document.querySelector('.duco-avatar-button');
    if (panel) {
      panel.classList.remove('open');
      avatarBtn?.classList.remove('hidden');
      this.ensureLauncherVisible();
      this.isOpen = false;
    }
  }

  /**
   * Procesar entrada del usuario
   */
  async handleUserInput() {
    try {
      const input = document.getElementById(this.inputId);
      if (!input) {
        console.error('[Duco] Input no encontrado');
        return;
      }

      const text = input.value.trim();
      if (!text) return;

      // Limpiar input
      input.value = '';

      // Agregar mensaje del usuario
      if (!window.chatHandler) {
        console.error('[Duco] ChatHandler no disponible');
        return;
      }

      window.chatHandler.addUserMessage(text);
      this.displayMessage(text, 'user');

      // Mostrar indicador de escritura
      this.showTypingIndicator();

      // Procesar la entrada
      await this.processUserInput(text);
    } catch (error) {
      console.error('[Duco] Error procesando entrada:', error);
      this.hideTypingIndicator();
      this.displayMessage('Disculpa, ocurrió un error procesando tu pregunta. Intenta de nuevo.', 'assistant');
    }
  }

  /**
   * Procesar entrada y generar respuesta
   */
  async processUserInput(text) {
    try {
      if (!window.chatHandler) {
        throw new Error('Chat handler no disponible');
      }

      const quotedTerms = this.extractQuotedTerms(text);

      const aiResponse = await this.requestAiResponse(text);
      if (!aiResponse) {
        this.hideTypingIndicator();
        this.displayMessage('No pude conectarme con la IA. Intenta de nuevo.', 'assistant');
        return;
      }

      const cleanActions = this.sanitizeActions(aiResponse.actions || []);
      const orderedActions = this.reorderAndAdjustActionsForQuery(cleanActions, text);
      if (quotedTerms.length) {
        orderedActions.forEach((action) => {
          if (!action) return;
          if (action.type === 'highlight' || action.type === 'highlightTerms') {
            action.terms = quotedTerms.slice(0, 4);
            action.maxMatches = Math.min(action.maxMatches || 40, 12);
            action.singleOpen = true;
          }
        });
      }
      const hasAiActions = orderedActions.length > 0;
      const hasAiReply = typeof aiResponse.reply === 'string' && aiResponse.reply.trim().length > 0;

      let responseFlow = [];

      if (hasAiReply || hasAiActions) {
        responseFlow = this.buildFlowFromAiResponse({
          ...aiResponse,
          actions: orderedActions
        });
      }

      let fallbackActionsForButtons = [];
      if (hasAiReply && !hasAiActions && this.replySuggestsShowing(aiResponse.reply)) {
        const fallbackSteps = this.buildFallbackActionSteps(text);
        if (fallbackSteps.length) {
          responseFlow = responseFlow.concat(fallbackSteps);
          fallbackActionsForButtons = this.sanitizeActions(fallbackSteps.map(s => s?.action).filter(Boolean));
        }
      }

      await this.sleep(250);
      this.hideTypingIndicator();

      if (!responseFlow || responseFlow.length === 0) {
        responseFlow = [{ text: 'No tengo una respuesta para eso ahora mismo.' }];
      }

      await this.runAssistantFlow(responseFlow, {
        aiResponse,
        userText: text,
        quotedTerms
      });

      const hasFlowActions = responseFlow.some(s => s && s.action);
      if (hasFlowActions) {
        const actionsForButtons = hasAiActions
          ? orderedActions
          : (fallbackActionsForButtons.length ? fallbackActionsForButtons : []);
        this.addActionButtons({ reply: aiResponse.reply || '', actions: actionsForButtons });
      }
    } catch (error) {
      console.error('[Duco] Error procesando entrada:', error);
      this.hideTypingIndicator();
      this.displayMessage('Ocurrió un error. Intenta de nuevo.', 'assistant');
    }
  }

  /**
   * Solicita respuesta a Ollama si está disponible.
   */
  async requestAiResponse(text) {
    if (!this.aiClient || typeof this.aiClient.generateResponse !== 'function') {
      return null;
    }

    if (!this.aiClient.isConfigured?.()) {
      return null;
    }

    const conversation = window.chatHandler?.getAllMessages ? window.chatHandler.getAllMessages() : [];

    try {
      return await this.aiClient.generateResponse(text, {
        context: {
          navigationCapabilities: window.ducoHighlightSystem?.capabilities ? window.ducoHighlightSystem.capabilities() : {}
        },
        messages: conversation
      });
    } catch (error) {
      console.warn('[Duco] IA no disponible:', error.message);
      return null;
    }
  }

  isValidHighlightTerm(term) {
    const t = String(term || '').trim().toLowerCase();
    const stopWords = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'o', 'que', 'un', 'una', 'por', 'para', 'con', 'sin', 'se', 'su', 'al', 'es', 'son', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'todo', 'toda', 'todos', 'todas', 'mas', 'pero', 'como', 'cuando', 'donde', 'quien', 'muy', 'si', 'no', 'me', 'te', 'le', 'les', 'nos', 'mi', 'tu', 'hay', 'ser', 'estar', 'tener', 'hacer']);
    return t.length >= 3 && !stopWords.has(t) && !/^\d+$/.test(t) && !/[+@#$%^&*=<>{}|\\/~`]/.test(t);
  }

  sanitizeActions(actions) {
    const actionsWithoutTerms = ['closeDropdown', 'clearHighlights', 'close'];
    return (actions || []).filter(Boolean).map(action => {
      const sanitized = { ...action };
      if (sanitized.terms) {
        sanitized.terms = sanitized.terms.filter(t => this.isValidHighlightTerm(t));
      }
      return sanitized;
    }).filter(action => {
      if (!action.type) return false;
      if (actionsWithoutTerms.includes(action.type)) return true;
      return action.terms && action.terms.length > 0;
    });
  }

  isExplicitOpenRequest(text) {
    const lowerInput = String(text || '').toLowerCase().trim();
    return /^(?:abrir|ver|click|clic|mu[eé]strame|mostrar|expandir|desplegar|ir a)/.test(lowerInput) ||
      /(?:puedes?|puedo)\s+abrir/.test(lowerInput) ||
      /(?:click|clic)\s+(?:en|a)\s+/.test(lowerInput);
  }

  isLocationInquiry(text) {
    const lowerInput = String(text || '').toLowerCase();
    return /\b(d[oó]nde|ubicaci[oó]n|se\s+ubica|se\s+encuentra|queda|ubicado|ubicada|localiza|localizaci[oó]n)\b/.test(lowerInput);
  }

  reorderAndAdjustActionsForQuery(actions, text) {
    const preferHighlightOnly = this.isLocationInquiry(text) && !this.isExplicitOpenRequest(text);
    const priority = {
      highlightTerms: 0,
      highlight: 0,
      clearHighlights: 1,
      closeDropdown: 1,
      dropdown: 2,
      scroll: 3,
      viewport: 3,
      move: 3,
      goto: 3
    };

    const adjusted = (actions || []).map((action) => {
      if (!action) return null;

      if (preferHighlightOnly && action.type === 'dropdown') {
        return {
          ...action,
          type: 'highlightTerms',
          terms: Array.isArray(action.terms) ? action.terms : [],
          duration: action.duration || 4500,
          singleOpen: true,
          autoGuide: action.autoGuide !== false
        };
      }

      return action;
    }).filter(Boolean);

    return adjusted.sort((left, right) => {
      const leftPriority = priority[left.type] ?? 99;
      const rightPriority = priority[right.type] ?? 99;
      return leftPriority - rightPriority;
    });
  }

  replySuggestsShowing(replyText) {
    const reply = String(replyText || '').toLowerCase();
    return /\b(ac[áa]|aqu[íi])\s+te\s+lo\s+(muestro|se[ñn]alo)\b|\bte\s+lo\s+(muestro|se[ñn]alo)\b/.test(reply);
  }

  extractQuotedTerms(text) {
    const raw = String(text || '');
    const matches = [];
    const patterns = [
      /"([^"\n]{2,120})"/g,
      /“([^”\n]{2,120})”/g,
      /'([^'\n]{2,120})'/g
    ];

    patterns.forEach((re) => {
      let m;
      // eslint-disable-next-line no-cond-assign
      while ((m = re.exec(raw)) !== null) {
        const term = String(m[1] || '').trim();
        if (term.length >= 2) matches.push(term);
      }
    });

    const unique = [];
    const seen = new Set();
    matches.forEach((t) => {
      const key = t.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(t);
    });

    return unique;
  }

  /**
   * Fallback: si el modelo promete "mostrar" pero no entrega actions,
   * inferimos intención y aplicamos un highlight predefinido.
   */
  buildFallbackActionSteps(userText) {
    const steps = [];
    const detectIntent = window.navigationSystem?.detectIntent;
    const getIntentData = window.navigationSystem?.getIntentData;

    const quotedTerms = this.extractQuotedTerms(userText);
    const lowerInput = String(userText || '').toLowerCase();

    if (typeof detectIntent !== 'function') return steps;

    const intentKey = detectIntent(String(userText || ''));
    if (!intentKey) return steps;

    if (typeof window.chatHandler?.setCurrentIntent === 'function') {
      window.chatHandler.setCurrentIntent(intentKey);
    }

    // Detectar si el usuario quiere "abrir" un dropdown/menú
    const wantsToOpen = /^(?:abrir|ver|click|clic|muéstrame|mostrar|expandir|desplegar|ir a)/.test(lowerInput.trim()) ||
      /(?:puedes?|puedo)\s+abrir/.test(lowerInput) ||
      /(?:click|clic)\s+(?:en|a)\s+/.test(lowerInput);

    const wantsToClose = /^(?:cerrar|ciérralo|cierra|ocultar|desactivar|quit[ar])|(?:ya|cerrado|listo)\s+(?:cerralo?|cierralo|ciérralo)/.test(lowerInput.trim()) ||
      /(?:puedes?|puedo)\s+cerrar/.test(lowerInput) ||
      /(?:cerrar|ocultar)\s+(?:el\s+)?(?:menú|dropdown)/.test(lowerInput);

    if (wantsToClose) {
      steps.push({
        action: {
          type: 'closeDropdown',
          closeTransientUi: false
        }
      });
      return steps;
    }

    if (wantsToOpen) {
      const intentData = getIntentData ? getIntentData(intentKey) : null;
      const primaryKeywords = Array.isArray(intentData?.keywords) ? [intentData.keywords[0]] : [];
      const terms = primaryKeywords.filter((t) => this.isValidHighlightTerm(t));

      if (terms.length) {
        steps.push({
          action: {
            type: 'dropdown',
            terms: terms,
            closeTransientUi: false
          }
        });
        return steps;
      }
    }

    const contextualFlow = typeof window.chatHandler?.getContextualResponseFlow === 'function'
      ? window.chatHandler.getContextualResponseFlow(intentKey)
      : [];

    if (Array.isArray(contextualFlow) && contextualFlow.length) {
      contextualFlow.forEach((step) => {
        if (step?.action) {
          const action = { ...step.action, intentKey };
          if (quotedTerms.length && (action.type === 'highlight' || action.type === 'highlightTerms')) {
            action.terms = quotedTerms.slice(0, 4);
            action.maxMatches = Math.min(action.maxMatches || 40, 12);
            action.singleOpen = true;
          }
          steps.push({
            action,
            pauseAfter: step.pauseAfter,
            actionDelay: step.actionDelay
          });
        }
      });
    }

    if (!steps.length && typeof getIntentData === 'function') {
      const intentData = getIntentData(intentKey);
      const keywords = Array.isArray(intentData?.keywords) ? intentData.keywords : [];
      const terms = keywords.filter((t) => this.isValidHighlightTerm(t)).slice(0, 6);
      if (terms.length) {
        steps.push({
          action: {
            type: 'highlightTerms',
            terms: quotedTerms.length ? quotedTerms.slice(0, 4) : terms,
            duration: 5000,
            autoGuide: true,
            intentKey
          }
        });
      }
    }

    return steps;
  }

  /**
     * Convierte la respuesta JSON de la IA a un flujo de pasos.
    */
  buildFlowFromAiResponse(aiResponse) {
    const flow = [];

    console.log('[Duco] AI Response:', JSON.stringify(aiResponse, null, 2));

    if (aiResponse?.reply) {
      flow.push({ text: aiResponse.reply });
    }

    if (Array.isArray(aiResponse?.actions)) {
      console.log('[Duco] Acciones de IA:', aiResponse.actions);
      const cleanActions = this.sanitizeActions(aiResponse.actions);
      console.log('[Duco] Acciones sanitizadas:', cleanActions);
      cleanActions.forEach((action) => {
        if (!action) return;

        if (action.type === 'highlight' || action.type === 'highlightTerms') {
          flow.push({
            action: {
              type: 'highlightTerms',
              terms: action.terms || [],
              duration: action.duration,
              styleVariant: action.styleVariant,
              endAt: action.endAt,
              maxMatches: action.maxMatches,
              autoGuide: action.autoGuide !== false,
              singleOpen: action.singleOpen,
              openLimit: action.openLimit,
              closeTransientUi: action.closeTransientUi !== false
            },
            pauseAfter: action.pauseAfter
          });
        } else if (action.type === 'dropdown') {
          flow.push({
            action: {
              type: 'dropdown',
              selector: action.selector,
              trigger: action.trigger,
              terms: action.terms,
              container: action.container,
              menu: action.menu,
              reveal: action.reveal,
              click: action.click,
              closeTransientUi: action.closeTransientUi !== false
            },
            pauseAfter: action.pauseAfter
          });
        } else if (action.type === 'closeDropdown') {
          flow.push({
            action: {
              type: 'closeDropdown'
            },
            pauseAfter: action.pauseAfter
          });
        } else if (action.type === 'scroll' || action.type === 'viewport' || action.type === 'move' || action.type === 'goto') {
          flow.push({
            action: {
              type: action.type,
              target: action.target,
              selector: action.selector,
              element: action.element,
              terms: action.terms,
              top: action.top,
              left: action.left,
              deltaY: action.deltaY,
              deltaX: action.deltaX,
              offset: action.offset,
              align: action.align,
              behavior: action.behavior,
              reveal: action.reveal,
              singleOpen: action.singleOpen,
              closeTransientUi: action.closeTransientUi !== false
            },
            pauseAfter: action.pauseAfter
          });
        } else if (action.type === 'clear') {
          flow.push({
            action: { type: 'clearHighlights' },
            pauseAfter: action.pauseAfter
          });
        }
      });
    }

    return flow;
  }

  /**
   * Ejecuta una respuesta en secuencia para mostrar textos y acciones en orden.
   */
  async runAssistantFlow(steps, context = {}) {
    const flowSteps = Array.isArray(steps) ? steps : [];

    for (const step of flowSteps) {
      if (!step) continue;

      if (step.pauseBefore) {
        await this.sleep(step.pauseBefore);
      }

      if (step.text) {
        window.chatHandler.addAssistantMessage(step.text);
        await this.displayMessage(step.text, 'assistant');
      }

      if (step.action) {
        await this.sleep(step.actionDelay ?? 550);

        if (step.action.type === 'highlightTerms' && step.action.terms?.length) {
          const flatTerms = step.action.terms.flatMap(t => t.includes(' ') ? t.split(/\s+/) : [t]);
          const target = this.findScrollTargetByTerms(flatTerms);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.sleep(600);
          }
          const actionMsg = `🔍 Resaltando: ${flatTerms.slice(0, 6).join(', ')}`;
          window.chatHandler.addAssistantMessage(actionMsg);
          await this.displayMessage(actionMsg, 'assistant');
        } else if (step.action.type === 'dropdown' && step.action.terms?.length) {
          const actionMsg = `📂 Abriendo menú: ${step.action.terms.join(', ')}`;
          window.chatHandler.addAssistantMessage(actionMsg);
          await this.displayMessage(actionMsg, 'assistant');
        } else if (step.action.type === 'closeDropdown') {
          const actionMsg = `🚫 Cerrando menú`;
          window.chatHandler.addAssistantMessage(actionMsg);
          await this.displayMessage(actionMsg, 'assistant');
        }

        await this.executeFlowAction(step.action, context);
      }

      if (step.pauseAfter) {
        await this.sleep(step.pauseAfter);
      }
    }
  }

  /**
   * Agrega botones clickeables para repetir acciones de la IA dentro del mensaje del chat.
   */
  addActionButtons(aiResponse) {
    const messagesContainer = document.getElementById(this.messagesId);
    const lastAssistantMsg = messagesContainer?.querySelector('.duco-message-assistant:last-of-type');
    if (!lastAssistantMsg || !aiResponse?.actions?.length) return;

    const cleanActions = this.sanitizeActions(aiResponse.actions);
    if (!cleanActions.length) return;

    const actionLabels = {
      highlightTerms: '🔍 Resaltar',
      highlight: '🔍 Resaltar',
      dropdown: '📂 Abrir menú',
      closeDropdown: '🚫 Cerrar menú',
      clearHighlights: '✨ Limpiar',
      scroll: '📍 Ir a sección',
      viewport: '📍 Ir a sección',
      move: '📍 Ir a sección',
      goto: '📍 Ir a sección'
    };

    cleanActions.forEach((action) => {
      if (!action || !action.type) return;
      const label = actionLabels[action.type] || '▶️ Ver';

      const btn = document.createElement('button');
      btn.className = 'duco-action-btn';
      btn.textContent = label;
      btn.dataset.lastClick = '0';

      btn.addEventListener('click', (e) => this.handleActionClick(e, action, btn));
      lastAssistantMsg.appendChild(btn);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Maneja el click en botones de acción con cooldown anti-spam.
   */
  async handleActionClick(e, action, btn) {
    const now = Date.now();
    const lastClick = parseInt(btn.dataset.lastClick || '0', 10);

    if (now - lastClick < 3000) {
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => btn.style.transform = '', 150);
      return;
    }

    btn.dataset.lastClick = now;
    btn.classList.add('duco-action-btn-active');
    btn.disabled = true;

    console.log('[Duco] Re-ejecutando acción desde botón:', action.type);
    await this.executeFlowAction(action, {});

    setTimeout(() => {
      btn.classList.remove('duco-action-btn-active');
      btn.disabled = false;
    }, 1500);
  }

  /**
   * Ejecuta una acción declarada dentro de una secuencia de respuesta.
   */
  async executeFlowAction(action, context = {}) {
    if (!action) return;

    console.log('[Duco] Ejecutando acción:', JSON.stringify(action));

    if (action.type === 'clearHighlights') {
      window.ducoHighlightSystem?.clear?.();
      return;
    }

    if (action.type === 'closeDropdown') {
      console.log('[Duco] Ejecutando closeDropdown');
      if (window.ducoHighlighter?.cleanupAllTransientState) {
        window.ducoHighlighter.cleanupAllTransientState();
      } else if (window.ducoHighlighter?.closeTransientUi) {
        window.ducoHighlighter.closeTransientUi();
      }
      document.querySelectorAll('.dropdown-menu.show, .nav-item.show').forEach(el => {
        el.classList.remove('show');
      });
      document.querySelectorAll('[aria-expanded="true"]').forEach(el => {
        el.setAttribute('aria-expanded', 'false');
      });
      return;
    }

    if (action.type === 'dropdown') {
      if (action.closeTransientUi !== false) {
        if (window.ducoHighlighter?.cleanupAllTransientState) {
          window.ducoHighlighter.cleanupAllTransientState();
        } else if (window.ducoHighlighter?.closeTransientUi) {
          window.ducoHighlighter.closeTransientUi();
        }
        await this.sleep(action.closeDelay ?? 150);
      }

      let trigger = action.trigger || action.selector;
      if (!trigger && action.terms?.length) {
        const found = this.findButtonOrLinkByTerms(action.terms);
        if (found) trigger = found;
      }

      if (trigger) {
        const dropdownAction = {
          trigger: typeof trigger === 'string' ? trigger : trigger,
          selector: typeof trigger === 'string' ? trigger : undefined,
          container: action.container,
          menu: action.menu,
          reveal: action.reveal,
          click: action.click,
          closeTransientUi: action.closeTransientUi !== false
        };
        if (window.ducoHighlightSystem?.openDropdown) {
          window.ducoHighlightSystem.openDropdown(dropdownAction);
        }
      }
      return;
    }

    if (action.type === 'scroll' || action.type === 'viewport' || action.type === 'move' || action.type === 'goto') {
      let targetEl = action.target || action.element || action.selector;
      if (!targetEl && action.terms?.length) {
        targetEl = this.findScrollTargetByTerms(action.terms);
      }

      if (targetEl) {
        const scrollTarget = typeof targetEl === 'string' ? document.querySelector(targetEl) : targetEl;
        if (scrollTarget) {
          scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (window.ducoHighlightSystem?.scrollViewport) {
        window.ducoHighlightSystem.scrollViewport(action);
      } else if (window.ducoHighlightSystem?.requestInteraction) {
        window.ducoHighlightSystem.requestInteraction(action);
      }
      return;
    }

    if (action.targetSelector || action.targetTextTerms) {
      if (action.closeTransientUi !== false && window.ducoHighlighter?.closeTransientUi) {
        window.ducoHighlighter.closeTransientUi();
        await this.sleep(action.closeDelay ?? 160);
      }

      let targetElement = null;
      if (action.targetSelector) {
        targetElement = document.querySelector(action.targetSelector);
      }

      if (!targetElement && action.targetTextTerms?.length) {
        targetElement = this.findTextElementByTerms(action.targetTextTerms);
      }

      if (targetElement && window.ducoHighlighter?.highlight) {
        if (window.ducoHighlighter?.revealAncestorsForElement) {
          window.ducoHighlighter.revealAncestorsForElement(targetElement, {
            singleOpen: action.singleOpen === true
          });
        }

        window.ducoHighlighter.highlight(targetElement, action.duration || 4500, {
          guide: action.guide !== false
        });
      }

      return;
    }

    if (action.type === 'highlightTerms') {
      if (action.closeTransientUi !== false && window.ducoHighlighter?.closeTransientUi) {
        window.ducoHighlighter.closeTransientUi();
        await this.sleep(action.closeDelay ?? 120);
      }

      const mergedTerms = [
        ...(Array.isArray(context?.quotedTerms) ? context.quotedTerms : []),
        ...(action.terms || [])
      ];

      const terms = mergedTerms
        .map((term) => String(term || '').trim())
        .filter((term) => term.length >= 3);

      console.log('[Duco] highlightTerms:', terms);

      // Si el usuario pidió una frase exacta (entre comillas) o hay un término multi-palabra,
      // priorizar resaltar el control (botón/link) en navegación para evitar desvíos.
      const phraseTerms = terms
        .filter((t) => t.includes(' '))
        .sort((a, b) => b.length - a.length);

      if (phraseTerms.length) {
        const control = this.findButtonOrLinkByTerms(phraseTerms);
        const isNavControl = control && typeof control.closest === 'function'
          ? Boolean(control.closest('nav, header, .navbar, .dropdown, .dropdown-menu, .collapse, .menu'))
          : false;

        if (control && isNavControl && window.ducoHighlighter?.highlight) {
          if (typeof window.ducoHighlighter?.revealAncestorsForElement === 'function') {
            window.ducoHighlighter.revealAncestorsForElement(control, {
              singleOpen: action.singleOpen === true
            });
          }

          window.ducoHighlighter.highlight(control, action.duration || 4500, {
            guide: action.autoGuide !== false
          });
          return;
        }
      }

      if (terms.length && window.ducoHighlighter?.highlightByTerms) {
        const count = window.ducoHighlighter.highlightByTerms(terms, {
          styleVariant: action.styleVariant || 'background',
          duration: action.duration || 4500,
          endAt: action.endAt,
          maxMatches: action.maxMatches || 40,
          autoGuide: action.autoGuide !== false,
          openLimit: 3,
          singleOpen: action.singleOpen === true
        });
        console.log('[Duco] highlightByTerms encontró', count, 'coincidencias');

        if (count === 0) {
          const fallbackTarget = this.findTextElementByTerms(terms);
          if (fallbackTarget && window.ducoHighlighter?.highlight) {
            window.ducoHighlighter.highlight(fallbackTarget, action.duration || 4500, {
              guide: action.autoGuide !== false
            });
            return;
          }

          const intentFromAction = action.intentKey || action.intent || null;
          const intentFromChat = typeof window.chatHandler?.getContext === 'function'
            ? window.chatHandler.getContext()?.currentIntent
            : null;
          const intentFromTerms = typeof window.navigationSystem?.detectIntent === 'function'
            ? window.navigationSystem.detectIntent(terms.join(' '))
            : null;

          const intentKey = intentFromAction || intentFromChat || intentFromTerms;
          const sectionEl = intentKey && typeof window.navigationSystem?.findSectionElement === 'function'
            ? window.navigationSystem.findSectionElement(intentKey)
            : null;

          if (sectionEl && window.ducoHighlighter?.highlight) {
            if (typeof window.ducoHighlighter?.revealAncestorsForElement === 'function') {
              window.ducoHighlighter.revealAncestorsForElement(sectionEl, {
                singleOpen: action.singleOpen === true
              });
            }

            window.ducoHighlighter.highlight(sectionEl, action.duration || 4500, {
              guide: action.autoGuide !== false
            });
            return;
          }

          const navToggle = document.querySelector('.navbar-toggler')
            || document.querySelector('button[aria-label="Toggle navigation"]')
            || document.querySelector('button.navbar-toggler');

          if (navToggle && window.ducoHighlighter?.highlight) {
            window.ducoHighlighter.highlight(navToggle, action.duration || 4500, {
              guide: true
            });
          }
        }
      } else if (!terms.length) {
        console.warn('[Duco] highlightTerms: sin términos válidos');
      }

      return;
    }

    if (action.type === 'sleep' && action.duration) {
      await this.sleep(action.duration);
    }
  }

  /**
   * Mostrar mensaje en el chat
   */
  async displayMessage(text, type = 'assistant') {
    try {
      const messagesContainer = document.getElementById(this.messagesId);
      if (!messagesContainer) {
        console.error('[Duco] Contenedor de mensajes no encontrado');
        return;
      }

      const messageEl = document.createElement('div');
      messageEl.className = `duco-message duco-message-${type}`;

      const contentEl = document.createElement('div');
      contentEl.className = 'duco-message-content';

      messageEl.appendChild(contentEl);
      messagesContainer.appendChild(messageEl);

      if (type === 'assistant') {
        await this.typewriteMessage(contentEl, text, messagesContainer);
      } else {
        contentEl.textContent = text;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    } catch (error) {
      console.error('[Duco] Error mostrando mensaje:', error);
    }
  }

  /**
   * Efecto de escritura para mensajes del asistente
   */
  async typewriteMessage(contentEl, text, messagesContainer) {
    let currentText = '';

    const maxChars = Math.min(text.length, 2000);
    for (let i = 0; i < maxChars; i++) {
      const char = text[i];
      currentText += char;
      contentEl.textContent = currentText;

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      await this.sleep(this.typewriterSpeed);
    }
  }

  /**
   * Escapar HTML para evitar inyección en mensajes
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * Espera utilitaria
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Mostrar indicador de escritura
   */
  showTypingIndicator() {
    const indicator = document.getElementById(this.typingIndicatorId);
    if (indicator) {
      indicator.style.display = 'flex';
    }
  }

  /**
   * Ocultar indicador de escritura
   */
  hideTypingIndicator() {
    const indicator = document.getElementById(this.typingIndicatorId);
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  /**
   * Mostrar mensaje de bienvenida (solo si es la primera vez)
   */
  showWelcomeMessage() {
    setTimeout(async () => {
      try {
        if (window.chatHandler && window.chatHandler.messages.length === 0) {
          const welcome = '¡Hola! 👋 Soy Duco, tu asistente virtual de Duoc UC. ¿Cómo puedo ayudarte hoy?';
          window.chatHandler.addAssistantMessage(welcome);
          await this.displayMessage(welcome, 'assistant');
        } else if (window.chatHandler && window.chatHandler.messages.length > 0) {
          const messagesContainer = document.getElementById(this.messagesId);
          if (messagesContainer) {
            messagesContainer.innerHTML = '';
            for (const msg of window.chatHandler.messages) {
              if (msg.type === 'user') {
                await this.displayMessage(msg.text, 'user');
              } else {
                const messageEl = document.createElement('div');
                messageEl.className = `duco-message duco-message-assistant`;
                const contentEl = document.createElement('div');
                contentEl.className = 'duco-message-content';
                contentEl.textContent = msg.text;
                messageEl.appendChild(contentEl);
                messagesContainer.appendChild(messageEl);
              }
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      } catch (error) {
        console.error('[Duco] Error mostrando bienvenida:', error);
      }
    }, 500);
  }

  /**
   * Encuentra enlaces/botones por múltiples términos (exacto o parcial).
   */
  findButtonOrLinkByTerms(terms) {
    const normalizedTerms = (terms || [])
      .map((term) => String(term || '').trim().toLowerCase())
      .filter((term) => term.length >= 3);

    if (!normalizedTerms.length) return null;

    const candidates = Array.from(document.querySelectorAll('a, button, [role="button"]'));

    for (const term of normalizedTerms) {
      const exactMatch = candidates.find((el) => this.getElementSearchText(el) === term);
      if (exactMatch) return exactMatch;
    }

    for (const term of normalizedTerms) {
      const partialMatch = candidates.find((el) => this.getElementSearchText(el).includes(term));
      if (partialMatch) return partialMatch;
    }

    return null;
  }

  /**
   * Busca un elemento de texto visible por términos, no solo botones o enlaces.
   */
  findScrollTargetByTerms(terms) {
    const flatTerms = terms.flatMap(t => t.includes(' ') ? t.split(/\s+/) : [t]);
    const normalized = flatTerms.map(t => t.trim().toLowerCase()).filter(t => t.length >= 3);
    if (!normalized.length) return null;

    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5'))
      .filter(h => {
        const rect = h.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

    for (const term of normalized) {
      const match = headings.find(h => h.textContent.trim().toLowerCase().includes(term));
      if (match) return match;
    }

    const mainContent = document.querySelector('main, [role="main"], article, .main-content, .page-content');
    if (mainContent) {
      const contentTextEls = Array.from(mainContent.querySelectorAll('p, span, li, a, div, h1, h2, h3'))
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

      for (const term of normalized) {
        const match = contentTextEls.find(el => el.textContent.trim().toLowerCase().includes(term));
        if (match) return match;
      }
    }

    return null;
  }

  findTextElementByTerms(terms) {
    const normalizedTerms = (terms || [])
      .map((term) => String(term || '').trim().toLowerCase())
      .filter((term) => term.length >= 3);

    if (!normalizedTerms.length) return null;

    const candidates = Array.from(document.querySelectorAll('a, button, li, p, span, div, h1, h2, h3, h4, h5, h6'))
      .filter((el) => el && el.textContent)
      .filter((el) => !el.closest('#duco-assistant-container'))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

    for (const term of normalizedTerms) {
      const exactMatch = candidates.find((el) => this.getElementSearchText(el) === term);
      if (exactMatch) return exactMatch;
    }

    for (const term of normalizedTerms) {
      const partialMatch = candidates.find((el) => this.getElementSearchText(el).includes(term));
      if (partialMatch) return partialMatch;
    }

    return null;
  }

  getElementSearchText(el) {
    const text = (el.textContent || '').trim().toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
    const title = (el.getAttribute('title') || '').trim().toLowerCase();
    return `${text} ${aria} ${title}`.trim();
  }

  /**
   * Mueve la vista a un elemento dado. Útil para futuras respuestas con IA.
   * @param {HTMLElement|string} target - Elemento o selector a mostrar
   * @param {Object} options - Opciones de navegación visual
   */
  moveTo(target, options = {}) {
    if (!window.ducoHighlighter) return false;
    return window.ducoHighlighter.moveViewportTo(target, options);
  }
}

// Inicializar Duco cuando están listos todos los módulos
window.addEventListener('load', () => {
  // Verificar que los módulos estén disponibles
  if (window.chatHandler && window.ducoHighlighter) {
    window.duco = new DucoAssistant();
  } else {
    console.error('❌ Módulos de Duco no cargados correctamente');
  }
});
