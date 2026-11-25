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
    this.isProcessing = false;
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
      const pendingNavigation = this.getPendingNavigation();
      this.userName = pendingNavigation ? this.getUserName() : '';
      if (!pendingNavigation) {
        this.clearUserName();
        if (this.nameRequired()) window.chatHandler?.clearHistory();
      }
      this.setProcessing(false);
      this.showWelcomeMessage();
      // Registro de quién usa el chat: se pide el nombre (o apodo) y se guarda la sesión en la base.
      if (!this.userName && this.nameRequired()) this.showNameGate();
      else this.registerSession();
      this.refreshSiteContext();
      this.listenForNavigationChanges();
      const previousPage = sessionStorage.getItem('duco-navigation-current');
      if (previousPage && previousPage !== window.location.pathname) sessionStorage.setItem('duco-navigation-previous',previousPage);
      sessionStorage.setItem('duco-navigation-current',window.location.pathname);
      this.rememberCurrentCareer();
      this.resumeNavigationFlow(pendingNavigation);
      this.checkAiStatus();
    } catch (error) {
      console.error('[Duco] Error en setup:', error);
      this.logError('Error inicializando asistente', error);
    }
  }

  async rememberCurrentCareer() {
    if (!/^\/carreras-detalle\/[a-z0-9-]+\.html$/i.test(location.pathname) || !window.chatHandler) return;
    try {
      const response=await fetch('/assets/carreras-catalogo.json');
      const catalog=response.ok ? await response.json() : [];
      const career=catalog.find(item=>'/'+item.local_link===location.pathname);
      if (career) {
        window.chatHandler.conversationContext.lastCareer={title:career.title,source:career.link,localLink:career.local_link};
        const visited=window.chatHandler.conversationContext.visitedCareers || [];
        window.chatHandler.conversationContext.visitedCareers=[...new Set([...visited,career.title])].slice(-81);
        window.chatHandler.saveToSession();
      }
    } catch (error) { console.warn('[Duco] No se pudo guardar la carrera actual:',error); }
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
      console.log('[Duco] IA local no disponible. Inicia la aplicación con Iniciar_Duco.cmd.');
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
          <button type="button" class="duco-avatar-button" aria-label="Abrir chat con Duco" aria-expanded="false" aria-controls="${this.chatPanelId}">
            <div class="duco-avatar">
              <img src="/dibujos/Duco idle.png" alt="Duco Avatar" class="duco-avatar-img">
            </div>
          </button>

          <!-- Panel de Chat -->
          <div id="${this.chatPanelId}" class="duco-chat-panel" role="region" aria-label="Chat con Duco" aria-hidden="true" inert>
            <div class="duco-header">
              <div class="duco-identity">
                <img src="/dibujos/Duco idle.png" alt="" class="duco-header-avatar">
                <div class="duco-identity-text">
                  <h3>Duco</h3>
                  <span>Tu asistente Duoc UC</span>
                </div>
              </div>
              <div class="duco-header-actions">
                <button type="button" class="duco-reset" id="duco-reset-btn" aria-label="Iniciar nueva conversación" title="Nueva conversación">Nueva conversación</button>
                <button type="button" class="duco-close" id="duco-close-btn" aria-label="Cerrar chat">&times;</button>
              </div>
            </div>

            <div id="${this.messagesId}" class="duco-messages" role="log" aria-live="polite"></div>

            <!-- Indicador de escritura -->
            <div id="${this.typingIndicatorId}" class="duco-typing-indicator" style="display:none;">
              <strong class="duco-typing-label" aria-live="polite"></strong>
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div class="duco-input-area">
              <div class="duco-composer">
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
              <p class="duco-input-note">Carreras, admisión y orientación en el sitio.</p>
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
      const resetBtn = document.getElementById('duco-reset-btn');
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

      resetBtn?.addEventListener('click', () => this.resetConversation());

      sendBtn.addEventListener('click', () => {
        try {
          this.handleUserInput();
        } catch (error) {
          console.error('[Duco] Error en send:', error);
        }
      });

      input.addEventListener('keydown', (e) => {
        try {
          if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            this.handleUserInput();
          }
        } catch (error) {
          console.error('[Duco] Error en keypress:', error);
        }
      });
      document.getElementById(this.chatPanelId)?.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); this.closePanel(); }
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
      panel.inert = false;
      panel.setAttribute('aria-hidden', 'false');
      avatarBtn?.setAttribute('aria-expanded', 'true');
      document.documentElement.classList.add('duco-chat-open');
      avatarBtn?.classList.add('hidden');
      this.isOpen = true;
      document.getElementById(this.inputId)?.focus();
      // Wait for the opening styles without stealing focus from another control.
      const focusDeadline = performance.now() + 1000;
      const focusWhenVisible = () => {
        if (!this.isOpen || ![document.body, avatarBtn].includes(document.activeElement)) return;
        const input = document.getElementById(this.inputId);
        if (input && getComputedStyle(input).visibility === 'visible') input.focus({ preventScroll: true });
        if (document.activeElement !== input && performance.now() < focusDeadline) requestAnimationFrame(focusWhenVisible);
      };
      requestAnimationFrame(focusWhenVisible);
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
      panel.inert = true;
      panel.setAttribute('aria-hidden', 'true');
      avatarBtn?.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('duco-chat-open');
      avatarBtn?.classList.remove('hidden');
      this.ensureLauncherVisible();
      this.isOpen = false;
      avatarBtn?.focus();
    }
  }

  /**
   * CU-07 Iniciar una nueva conversación. Si ya hay conversación se pide confirmación (A2: se puede cancelar y se conserva);
   * sin conversación previa (A1) se reinicia igual. Un error local (A3) se informa y se puede reintentar.
   */
  resetConversation(force = false) {
    if (this.isProcessing) return;
    try {
      const hasConversation = (window.chatHandler?.getDialogueMessages?.() || []).some(message => message.type === 'user');
      if (hasConversation && !force) { this.showResetConfirmation(); return; }
      this.performReset();
    } catch (error) {
      console.error('[Duco] No se pudo reiniciar la conversación:', error);
      this.showTransientMessage('No se pudo reiniciar la conversación. Puedes intentarlo de nuevo.', [{label: '🔄 Reintentar', onClick: () => this.resetConversation(true)}]);
    }
  }

  /** Borra historial, borrador, resaltados y contexto de sesión, y muestra la bienvenida. */
  performReset() {
    sessionStorage.removeItem('duco-navigation-pending');
    sessionStorage.removeItem('duco-navigation-previous');
    this.resetPermissions();
    window.ducoHighlighter?.clearAllHighlights?.();
    window.ducoHighlighter?.cleanupAllTransientState?.();
    window.chatHandler?.clearHistory();
    const messages = document.getElementById(this.messagesId);
    if (messages) messages.replaceChildren();
    this.hideTypingIndicator();
    this.clearUserName();
    this.showWelcomeMessage();
    const input = document.getElementById(this.inputId);
    if (input) input.value = '';
    if (this.nameRequired()) this.showNameGate(true);
    else input?.focus();
  }

  // ---- Nombre de quien usa el chat -----------------------------------------------------------------------------
  nameRequired() { return window.ducoConfig?.requireUserName !== false; }

  getUserName() {
    try { return sessionStorage.getItem('ducoUserName') || ''; } catch (error) { return ''; }
  }

  setUserName(name) {
    this.userName = name;
    this.setProcessing(this.isProcessing);
    try { sessionStorage.setItem('ducoUserName', name); } catch (error) { /* sin almacenamiento: se vuelve a pedir en la próxima visita */ }
  }

  clearUserName() {
    this.userName = '';
    this.setProcessing(this.isProcessing);
    try { sessionStorage.removeItem('ducoUserName'); } catch (error) { /* nada que borrar */ }
  }

  /** El nombre es lo único que se pide: sin RUT, correo ni teléfono. */
  validateUserName(raw) {
    const name = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .'\-]{1,39}$/u.test(name)) return {error: 'Escribe entre 2 y 40 caracteres: letras, números, espacios, punto, guion o apóstrofo.'};
    if (/\d{5,}|@/.test(name)) return {error: 'Escribe solo tu nombre o un apodo, sin números largos ni correos.'};
    return {name};
  }

  /** Registra (o actualiza) la sesión del chat con el nombre en la base de datos; falla en silencio si no hay servicio local. */
  async registerSession() {
    if (!this.userName || !this.isLocalKnowledgeApi() || !window.chatHandler) return;
    try {
      await fetch(this.knowledgeApiUrl('/api/duco/session'), {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sessionId: window.chatHandler.getSessionId(), userName: this.userName})
      });
    } catch (error) { console.warn('[Duco] No se pudo registrar la sesión:', error); }
  }

  /** Formulario de nombre dentro del chat (no entra al historial). */
  showNameGate(focus = false) {
    const messages = document.getElementById(this.messagesId);
    if (!messages || messages.querySelector('.duco-name-gate')) return;
    const row = document.createElement('div');
    row.className = 'duco-message duco-message-assistant duco-name-gate';
    const content = document.createElement('div');
    content.className = 'duco-message-content';
    const text = document.createElement('p');
    text.textContent = 'Antes de empezar, ¿cómo te llamas? Solo tu nombre o un apodo: lo guardo para llevar el registro de quién usa el asistente. No pido RUT, correo ni teléfono.';
    const form = document.createElement('form');
    form.className = 'duco-name-form';
    const input = document.createElement('input');
    input.type = 'text'; input.maxLength = 40; input.placeholder = 'Tu nombre'; input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Tu nombre o apodo');
    const submit = document.createElement('button');
    submit.type = 'submit'; submit.className = 'duco-action-btn'; submit.textContent = 'Continuar';
    const error = document.createElement('div');
    error.className = 'duco-name-error'; error.setAttribute('role', 'alert');
    form.append(input, submit);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const result = this.validateUserName(input.value);
      if (result.error) { error.textContent = result.error; input.focus(); return; }
      this.setUserName(result.name);
      row.remove();
      const greeting = `Mucho gusto, ${result.name} 😊 ¿En qué puedo ayudarte?`;
      window.chatHandler?.addAssistantMessage(greeting, false);
      this.displayMessage(greeting, 'assistant');
      this.registerSession();
      document.getElementById(this.inputId)?.focus();
    });
    content.append(text, form, error);
    row.appendChild(content);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    if (focus) input.focus();
  }

  /** Mensaje del asistente que vive solo en pantalla (no entra al historial), con botones opcionales. Devuelve la fila. */
  showTransientMessage(text, buttons = []) {
    const messages = document.getElementById(this.messagesId);
    if (!messages) return null;
    const row = document.createElement('div');
    row.className = 'duco-message duco-message-assistant duco-message-transient';
    row.setAttribute('role', 'alert');
    const content = document.createElement('div');
    content.className = 'duco-message-content';
    content.textContent = text;
    row.appendChild(content);
    if (buttons.length) {
      const bar = document.createElement('div');
      bar.className = 'duco-transient-actions';
      buttons.forEach(({label, onClick}) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'duco-action-btn';
        button.textContent = label;
        button.addEventListener('click', () => { row.remove(); onClick?.(); });
        bar.appendChild(button);
      });
      row.appendChild(bar);
    }
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    return row;
  }

  /**
   * Permiso Sí/No antes de enviar datos personales (una dirección o la ubicación) a un servicio externo.
   * La decisión se recuerda solo durante la sesión (sessionStorage) y se puede revocar escribiendo «cambiar permisos».
   */
  askPermission(kind, text) {
    const key = 'ducoPermissions';
    let store = {};
    try { store = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch (error) { store = {}; }
    if (typeof store[kind] === 'boolean') return Promise.resolve(store[kind]);
    return new Promise(resolve => {
      let settled = false;
      const decide = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        store[kind] = value;
        try { sessionStorage.setItem(key, JSON.stringify(store)); } catch (error) { /* sin almacenamiento: se vuelve a preguntar */ }
        resolve(value);
      };
      // Sin respuesta en 2 minutos se toma como «No» sin recordarlo.
      const timer = setTimeout(() => { if (!settled) { settled = true; row?.remove(); resolve(false); } }, 120000);
      const row = this.showTransientMessage(text, [
        {label: '✅ Sí, doy permiso', onClick: () => decide(true)},
        {label: '❌ No, gracias', onClick: () => decide(false)}
      ]);
      row?.classList.add('duco-permission');
      row?.querySelector('button')?.focus();
    });
  }

  resetPermissions() {
    try { sessionStorage.removeItem('ducoPermissions'); } catch (error) { /* nada que borrar */ }
  }

  /** Llamada al backend local para las APIs externas; nunca lanza: devuelve {found:false} si algo falla. */
  async callExternalApi(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(this.knowledgeApiUrl(path), {signal: controller.signal});
      return response.ok ? await response.json() : {found: false};
    } catch (error) {
      return {found: false};
    } finally {
      clearTimeout(timer);
    }
  }

  /** Ubicación del navegador (API de Geolocalización): se usa una sola vez y no se guarda. */
  getBrowserLocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        position => resolve({lat: position.coords.latitude, lng: position.coords.longitude}),
        () => resolve(null),
        {enableHighAccuracy: false, timeout: 12000, maximumAge: 0});
    });
  }

  /** CU-07 A2: pide confirmar antes de borrar la conversación; «Cancelar» la conserva. */
  showResetConfirmation() {
    const messages = document.getElementById(this.messagesId);
    messages?.querySelectorAll('.duco-reset-confirm').forEach(node => node.remove());
    const row = this.showTransientMessage('¿Quieres empezar una conversación nueva? Se borrará el historial de esta.', [
      {label: 'Sí, empezar de nuevo', onClick: () => this.resetConversation(true)},
      {label: 'Cancelar', onClick: () => { this.showTransientMessage('Listo, seguimos con esta conversación.'); }}
    ]);
    row?.classList.add('duco-reset-confirm');
    row?.querySelector('button')?.focus();
  }

  /** CU-01/02/03/06 A3: tras una falla se ofrece reintentar la misma consulta sin volver a escribirla. */
  addRetryButton(text, messageElement = null) {
    const messages = document.getElementById(this.messagesId);
    const row = messageElement || messages?.querySelector('.duco-message-assistant:last-of-type');
    if (!row || row.querySelector('.duco-retry-btn')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'duco-action-btn duco-retry-btn';
    button.textContent = '🔄 Reintentar';
    button.setAttribute('aria-label', 'Reintentar la consulta anterior');
    button.addEventListener('click', async () => {
      if (this.isProcessing) return;
      button.remove();
      this.setProcessing(true);
      try {
        this.showTypingIndicator();
        await this.processUserInput(text);
      } finally { this.setProcessing(false); }
    });
    row.appendChild(button);
  }

  /** Evita preguntas simultáneas que mezclan respuestas y acciones visuales. */
  setProcessing(value) {
    this.isProcessing = Boolean(value);
    const send = document.getElementById('duco-send-btn');
    const reset = document.getElementById('duco-reset-btn');
    const needsName = this.nameRequired() && !this.userName;
    const input = document.getElementById(this.inputId);
    if (input) input.disabled = needsName;
    if (send) send.disabled = this.isProcessing || needsName;
    if (reset) reset.disabled = this.isProcessing;
  }

  /**
   * Procesar entrada del usuario
   */
  async handleUserInput() {
    if (this.isProcessing) return;
    try {
      const input = document.getElementById(this.inputId);
      if (!input) {
        console.error('[Duco] Input no encontrado');
        return;
      }

      const text = input.value.trim();
      // «Cambiar mi nombre»: se borra el nombre guardado y se vuelve a pedir.
      if (/^(?:cambiar|cambia|cambio|borrar|borra|olvida|olvidar)\s+(?:mi\s+)?nombre$/i.test(text)) {
        input.value = '';
        this.clearUserName();
        this.showNameGate(true);
        return;
      }
      if (!this.userName && this.nameRequired()) {
        this.showNameGate(true);
        this.displayMessage('Primero dime tu nombre (o un apodo) para empezar.', 'assistant');
        return;
      }
      if (!text) {
        this.displayMessage('Escribe una pregunta antes de enviar.', 'assistant');
        return;
      }
      if (text.length > 2000) {
        this.displayMessage('La pregunta es demasiado larga. Máximo 2000 caracteres.', 'assistant');
        return;
      }
      this.setProcessing(true);
      this._lastSubmittedText = text;

      // Limpiar input
      input.value = '';

      // Agregar mensaje del usuario
      if (!window.chatHandler) {
        console.error('[Duco] ChatHandler no disponible');
        return;
      }

      // Datos sensibles (claves, tarjetas, RUT...): se tapan, se muestra el mensaje ya tachado y no se consulta a la IA.
      const privacy = window.ducoPrivacy?.inspect(text);
      if (privacy?.sensitive || privacy?.ask) {
        window.chatHandler.addUserMessage(text);
        this.displayMessage(privacy.redacted, 'user');
        const message = window.ducoPrivacy.reply(privacy);
        window.chatHandler.addAssistantMessage(message, false);
        await this.displayMessage(message, 'assistant');
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
      const message = 'Disculpa, ocurrió un error procesando tu pregunta. Puedes reintentar cuando quieras.';
      window.chatHandler?.addAssistantMessage(message);
      const element = await this.displayMessage(message, 'assistant');
      if (this._lastSubmittedText) this.addRetryButton(this._lastSubmittedText, element?.nodeType === 1 ? element : null);
    } finally {
      this.setProcessing(false);
    }
  }

  /**
   * Procesar entrada y generar respuesta
   */
  async processUserInput(text) {
    let transientCloseDelay = 4500;
    try {
      if (!window.chatHandler) {
        throw new Error('Chat handler no disponible');
      }

      const quotedTerms = this.extractQuotedTerms(text);
      const normalizedRequest = text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      if (quotedTerms.length && /\b(?:senala\w*|resalta\w*|remarca\w*|marca\w*|busca\w*|seleccion\w*|abre\w*|lleva\w*)\b/.test(normalizedRequest)) {
        const target=quotedTerms[0].replace(/^[«»“”"'\s]+|[«»“”"'\s]+$/g,'');
        if (target.length>=3) {
          window.chatHandler.conversationContext.lastRequestedTarget={target,request:text,
            operation:/\b(?:seleccion\w*|abre\w*)\b/.test(normalizedRequest)?'select':'highlight',pending:true};
          window.chatHandler.saveToSession();
        }
      }

      const greeting = normalizedRequest.trim().replace(/^[¿¡\s]+|[?!.,\s]+$/g, '');
      const greetingOnly = /^(?:hola+|holi+|hey|buenas|buenos dias|buenas tardes|buenas noches|saludos)(?:\s+duco)?$/.test(greeting);
      let aiResponse = greetingOnly
        ? { reply: '¡Hola! ¿En qué puedo ayudarte?', actions: [], intent: { kind: 'answer', reference: 'resolved_action', action: 'none' } }
        : await this.requestAiResponse(text);
      if (!aiResponse) {
        this.hideTypingIndicator();
        const message = 'No pude conectarme con la IA. Puedes reintentar cuando quieras.';
        window.chatHandler.addAssistantMessage(message);
        const element = await this.displayMessage(message, 'assistant');
        this.addRetryButton(text, element?.nodeType === 1 ? element : null);
        return;
      }

      // Si se pidió una acción visual explícita pero Ollama solo devolvió texto,
      // solicita una corrección estructurada con el historial y su borrador.
      if (this.isHighlightRequest(text) && !(aiResponse.intent?.reference === 'resolved_action' && aiResponse.intent?.action === 'none') &&
          !this.sanitizeActions(aiResponse.actions || []).some(action => ['highlight', 'highlightTerms', 'showEvidence'].includes(action.type))) {
        try {
          const repairedResponse = await this.requestAiResponse(text, {
            actionRepair: true,
            draftResponse: aiResponse.reply
          });
          if (repairedResponse) {
            const repairedHighlight = this.sanitizeActions(repairedResponse.actions || [])
              .some(action => ['highlight', 'highlightTerms'].includes(action.type));
            if (repairedHighlight) {
              aiResponse = {
                ...repairedResponse,
                reply: repairedResponse.reply || aiResponse.reply
              };
            } else {
              // No afirmar que se completó una acción si el modelo tampoco pudo
              // identificar un objetivo ejecutable después de revisar el contexto.
              aiResponse = {
                ...aiResponse,
                reply: repairedResponse.reply || 'No pude identificar un objetivo claro en el contexto. ¿Qué texto o sección quieres que resalte?',
                actions: []
              };
            }
          }
        } catch (error) {
          console.warn('[Duco] No se pudo corregir la acción visual propuesta:', error);
          aiResponse = {
            ...aiResponse,
            reply: 'No pude identificar un objetivo claro para resaltarlo. ¿Qué texto o sección quieres que marque?',
            actions: []
          };
        }
      }

      const cleanActions = this.sanitizeActions(aiResponse.actions || []).filter(action =>
        action.type !== 'proposeKnowledge' || this.isExplicitKnowledgeSaveRequest(text)
      );
      let orderedActions = this.reorderAndAdjustActionsForQuery(cleanActions, text);
      const referenceResolved = aiResponse.intent?.reference === 'resolved_action';
      if (quotedTerms.length && !referenceResolved) {
        orderedActions.forEach((action) => {
          if (!action) return;
          if ((action.type === 'highlight' || action.type === 'highlightTerms') && !action.careerCard) {
            action.terms = quotedTerms.slice(0, 4);
            action.maxMatches = Math.min(action.maxMatches || 40, 12);
            action.singleOpen = true;
          }
        });
      }

      // Ollama a veces dice que resaltó un término pero omite la acción visual.
      // Si el usuario pidió marcar, convertir el término elegido por la IA en una
      // acción real; nunca escoger un término arbitrario de la página.
      if (this.isHighlightRequest(text) && !(aiResponse.intent?.reference === 'resolved_action' && aiResponse.intent?.action === 'none') &&
          !orderedActions.some(action => ['highlight', 'highlightTerms', 'showEvidence'].includes(action.type))) {
        const responseTerms = this.extractHighlightTargets(aiResponse.reply);
        const termsToHighlight = responseTerms.length ? responseTerms : quotedTerms;
        if (termsToHighlight.length) {
          orderedActions = this.reorderAndAdjustActionsForQuery([
            ...orderedActions,
            { type: 'highlightTerms', terms: termsToHighlight.slice(0, 4), duration: 4500 }
          ], text);
        }
      }

      if (!referenceResolved && orderedActions.some(action => ['highlight', 'highlightTerms'].includes(action.type))) {
        const preferredTerms = this.extractHighlightTargets(aiResponse.reply);
        orderedActions = this.consolidateHighlightActions(orderedActions, preferredTerms, text);
      }
      orderedActions = this.canonicalizeHighlightTargets(orderedActions, quotedTerms);
      orderedActions = this.bindMenuActions(orderedActions);
      transientCloseDelay = Math.max(4500, ...orderedActions.map(action => Math.min(15000, Number(action.duration) || 0)));
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

      const flowOutcomes = await this.runAssistantFlow(responseFlow, {
        aiResponse,
        userText: text,
        quotedTerms: referenceResolved ? [] : quotedTerms,
        feedbackInteraction: this.isLocalKnowledgeApi() ? {
          sessionId: window.chatHandler.getSessionId(),
          interactionId: window.crypto?.randomUUID?.() || window.chatHandler.createSessionId(),
          question: text,
          answer: aiResponse.reply,
          userName: this.userName || undefined,
          experience: {page:location.pathname,steps:[]},
          interactionType: responseFlow.some(step => step.action && step.action.type !== 'proposeKnowledge') ? 'navigation' : 'knowledge'
        } : null
      });

      const failedAction = flowOutcomes.find(outcome => outcome.success === false);
      if (failedAction) {
        try {
          const recovery = await this.requestAiResponse(text, { actionReview: true });
          if (recovery?.reply) {
            window.chatHandler.addAssistantMessage(recovery.reply);
            await this.displayMessage(recovery.reply, 'assistant');
          }
        } catch (error) {
          console.warn('[Duco] No se pudo generar la explicación posterior a la acción:', error);
          const fallback = 'No pude completar esa acción con el contenido visible. Indícame el texto o la sección exacta y lo intento de nuevo.';
          window.chatHandler.addAssistantMessage(fallback);
          await this.displayMessage(fallback, 'assistant');
        }
      }

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
      const message = this.getUserFacingError(error);
      window.chatHandler?.addAssistantMessage(message);
      const element = await this.displayMessage(message, 'assistant');
      this.addRetryButton(text, element?.nodeType === 1 ? element : null);
    } finally {
      this.discardLiveStream();
      const highlighter = window.ducoHighlighter;
      if (highlighter?.transientDropdownState?.size || highlighter?.transientCollapseState?.size || highlighter?.transientDetailsState?.size) {
        highlighter.scheduleTransientUiClose(transientCloseDelay);
      }
    }
  }

  /**
   * Solicita respuesta a Ollama si está disponible.
   */
  async requestAiResponse(text, options = {}) {
    if (!this.aiClient || typeof this.aiClient.generateResponse !== 'function') {
      return null;
    }

    if (!this.aiClient.isConfigured?.()) {
      return null;
    }

    const conversation = window.chatHandler?.getDialogueMessages?.() || [];

    try {
      let databaseKnowledge = [];
      let actionExperiences = [];
      let careerAlternatives = [];
      {
        try {
          const catalogResponse=await fetch('/assets/carreras-catalogo.json');
          const catalog=catalogResponse.ok ? await catalogResponse.json() : [];
          careerAlternatives=catalog.filter(item=>item.title && item.local_link).map(item=>({title:item.title,source:item.link,localLink:item.local_link,escuela:item.escuela || [],duracion:item.duracion || '',tipo:item.tipo || [],sedes_modalidades:item.sedes_modalidades || []}));
        } catch (error) { console.warn('[Duco] No se pudo consultar el catálogo:',error); }
      }
      if (!window.chatHandler.conversationContext.lastRequestedTarget) {
        const previous=[...conversation].reverse().find(message=>message.type==='user' && this.extractQuotedTerms(message.text || '').length &&
          /\b(?:se[ñn]ala\w*|resalta\w*|remarca\w*|marca\w*|busca\w*|seleccion\w*|abre\w*|lleva\w*)\b/i.test(message.text || ''));
        if (previous) {
          const target=this.extractQuotedTerms(previous.text)[0].replace(/^[«»“”"'\s]+|[«»“”"'\s]+$/g,'');
          window.chatHandler.conversationContext.lastRequestedTarget={target,request:previous.text,
            operation:/\b(?:seleccion\w*|abre\w*)\b/i.test(previous.text)?'select':'highlight',pending:true};
          window.chatHandler.saveToSession();
        }
      }
      const pageResearch = await this.findPageResearch(text);
      const selectedCareers = pageResearch.filter(item=>item.kind === 'catalogo');
      // Seguimientos sin nombre ("¿cuánto dura esa carrera?", "¿y en qué sedes?"): se adjuntan los datos de la carrera activa.
      if (!selectedCareers.length) {
        const active=this.getActiveLastCareer(text,careerAlternatives);
        const item=active && careerAlternatives.find(candidate=>candidate.title===active.title);
        if (item) pageResearch.unshift({kind:'catalogo',title:item.title,source:item.source,localLink:item.localLink,fromContext:true,
          detail:{duracion:item.duracion,tipo:item.tipo,escuela:item.escuela,sedes_modalidades:item.sedes_modalidades},captured:'2026-10-29'});
      }
      if (selectedCareers.length === 1) {
        window.chatHandler.conversationContext.lastCareer = selectedCareers[0];
        window.chatHandler.saveToSession();
      } else if (!window.chatHandler.conversationContext.lastCareer) {
        // Recuperar la carrera destacada en sesiones creadas antes de guardar
        // explícitamente el contexto de navegación.
        const target = window.chatHandler.getActionOutcomes?.().slice().reverse()
          .find(item=>item.type === 'highlightTerms' && item.target?.length)?.target?.[0];
        if (target) {
          const previous = (await this.findPageResearch(target)).filter(item=>item.kind === 'catalogo');
          if (previous.length === 1) {
            window.chatHandler.conversationContext.lastCareer = previous[0];
            window.chatHandler.saveToSession();
          }
        }
      }
      if (!window.chatHandler.conversationContext.lastCareer) {
        const previousPath=sessionStorage.getItem('duco-navigation-previous') || '';
        if (/^\/carreras-detalle\/[a-z0-9-]+\.html$/i.test(previousPath)) {
          try {
            const response=await fetch('/assets/carreras-catalogo.json');
            const catalog=response.ok ? await response.json() : [];
            const career=catalog.find(item=>'/'+item.local_link===previousPath);
            if (career) {
              window.chatHandler.conversationContext.lastCareer={title:career.title,source:career.link,localLink:career.local_link};
              window.chatHandler.saveToSession();
            }
          } catch (error) { console.warn('[Duco] No se pudo recuperar la carrera anterior:',error); }
        }
      }
      if (this.isLocalKnowledgeApi()) {
        try {
          const knowledgeResponse = await fetch(this.knowledgeApiUrl(`/api/duco/knowledge?query=${encodeURIComponent(text)}`));
          if (knowledgeResponse.ok) {
            const knowledge = await knowledgeResponse.json();
            databaseKnowledge = Array.isArray(knowledge.items) ? knowledge.items : [];
          }
        } catch (error) {
          console.warn('[Duco] No se pudo consultar el conocimiento de Oracle:', error);
        }
      }

      actionExperiences=await this.getActionExperiences(text);
      this.discardLiveStream();
      const response = await this.aiClient.generateResponse(text, {
        // Streaming: la respuesta conversacional aparece mientras el modelo la escribe.
        // Sin streaming en preguntas de direcciones o contactos: un dato inventado no debe llegar a mostrarse ni un instante.
        onToken: (options.actionReview || options.actionRepair || options.actionRecovery || /\b(?:direccion|telefono|correo|mail|sede|sedes|ubicacion|donde)\b/i.test(String(text).normalize('NFD').replace(/[̀-ͯ]/g,''))) ? undefined : partial => this.updateLiveStream(partial),
        context: {
          navigationCapabilities: window.ducoHighlightSystem?.capabilities ? window.ducoHighlightSystem.capabilities() : {},
          databaseKnowledge,
          // Modo híbrido: el modelo redacta el aviso corto de cada acción; si falla se usa la frase fija.
          humanizeReplies: true,
          userName: this.userName || '',
          // APIs externas (Nominatim, OSRM, Nager.Date) vía el backend local; lo personal exige permiso Sí/No.
          externalApis: this.isLocalKnowledgeApi() ? {
            enabled: true,
            askPermission: (kind, text) => this.askPermission(kind, text),
            resetPermissions: () => this.resetPermissions(),
            geocode: query => this.callExternalApi('/api/duco/geocode?q=' + encodeURIComponent(query)),
            route: (from, sede) => this.callExternalApi(`/api/duco/route?fromLat=${from.lat}&fromLng=${from.lng}&toLat=${sede.lat}&toLng=${sede.lng}`),
            holidays: year => this.callExternalApi('/api/duco/holidays?year=' + encodeURIComponent(year)),
            geolocate: () => this.getBrowserLocation()
          } : null,
          // Consulta limitada a duoc.cl (vía el backend local); si no hay backend o falla, el asistente sigue sin ella.
          webLookup: this.isLocalKnowledgeApi() ? async query => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 9000);
            try {
              const response = await fetch(this.knowledgeApiUrl('/api/duco/web?q=' + encodeURIComponent(query)), {signal: controller.signal});
              return response.ok ? await response.json() : {results: []};
            } catch (error) { return {results: []}; } finally { clearTimeout(timer); }
          } : null,
          actionExperiences,
          lastCorrection:window.chatHandler?.conversationContext?.lastCorrection || null,
          pageResearch,
          lastCareer: this.getActiveLastCareer(text, careerAlternatives),
          pendingCareerSuggestion: window.chatHandler?.conversationContext?.pendingCareerSuggestion || null,
          lastRequestedTarget: window.chatHandler?.conversationContext?.lastRequestedTarget || null,
          careerCandidates: selectedCareers.map(item=>item.title),
          careerAlternatives,
          visitedCareers: window.chatHandler?.conversationContext?.visitedCareers || [],
          onCareerDetail: /\/carreras-detalle\//.test(location.pathname),
          currentPage: location.pathname,
          viewportContext: this.getViewportContext(),
          currentPageText: [...document.querySelectorAll('main, nav, header, [role="tab"], h1, h2, h3')]
            .filter(el=>!el.closest('#duco-assistant-container') && el.getClientRects().length)
            .map(el=>el.innerText || '').join('\n').slice(0,30000),
          evidenceContext: this.getEvidenceContext(),
          pageVisibleContent: this.getVisiblePageContentForAi(),
          navigationMenus: this.getNavigationMenus(),
          dialogControls: this.getDialogControls(),
          namedPageTargets: this.getNamedPageTargets(text,conversation),
          actionOutcomes: window.chatHandler?.getActionOutcomes?.() || [],
          actionPlans: window.chatHandler?.getActionPlans?.() || [],
          actionRecovery: options.actionRecovery === true,
          actionReview: options.actionReview === true,
          actionRepair: options.actionRepair === true,
          draftResponse: options.draftResponse || ''
        },
        messages: conversation
      });
      if (!response || typeof response.reply !== 'string' || !response.reply.trim()) {
        this.discardLiveStream();
        throw new Error('OLLAMA_INVALID_RESPONSE');
      }
      // Si la respuesta ya se mostró en vivo, displayMessage reutiliza ese mismo elemento al final.
      if (this._live) this._live.finalText = response.reply;
      if (response.turnDecision?.mode==='correction') await this.recordUserCorrection(text,response.turnDecision);
      else if (['new','alternative','explain'].includes(response.turnDecision?.mode)) {
        delete window.chatHandler.conversationContext.lastCorrection;
        window.chatHandler.saveToSession();
      }
      // La sugerencia "¿Quisiste decir X?" solo vale para el mensaje siguiente.
      if (response.suggestedCareer) window.chatHandler.conversationContext.pendingCareerSuggestion=response.suggestedCareer;
      else delete window.chatHandler.conversationContext.pendingCareerSuggestion;
      window.chatHandler.saveToSession();
      if (response.selectedCareer) {
        window.chatHandler.conversationContext.lastCareer=response.selectedCareer;
        const visited=window.chatHandler.conversationContext.visitedCareers || [];
        window.chatHandler.conversationContext.visitedCareers=[...new Set([...visited,response.selectedCareer.title])].slice(-81);
        window.chatHandler.saveToSession();
      }
      const careers = pageResearch.filter(item=>item.kind === 'catalogo' && !item.fromContext);
      if (!options.actionReview && !options.actionRepair && response.intent?.reference!=='resolved_action' && careers.length === 1 &&
          !(response.actions || []).some(action=>['navigate','explainCareer'].includes(action.type)) &&
          !/\b(?:abre|cerrar|cierra|selecciona|navega|volver)\b/i.test(text)) {
        const onCareerPage = /carreras\.html$/i.test(location.pathname);
        const careersLink = [...document.querySelectorAll('a[href]')].find(link=> {
          try { const url = new URL(link.href,location.href); return url.origin === location.origin && /\/carreras\.html$/i.test(url.pathname); } catch { return false; }
        });
        if (onCareerPage || careersLink) {
        response.actions = (response.actions || []).filter(action=>!['highlight','highlightTerms'].includes(action.type));
        if (!onCareerPage) response.actions.push({type:'navigate',terms:[this.getElementContentText(careersLink)]});
        response.actions.push({type:'highlightTerms',terms:[careers[0].title],careerCard:true,duration:6000});
        }
      }
      return response;
    } catch (error) {
      console.warn('[Duco] IA no disponible:', error.message);
      throw error;
    }
  }

  /**
   * La última carrera vista solo cuenta como contexto mientras el usuario sigue en su ficha
   * o la menciona ("esa carrera", "ve hacia allá", su nombre). Si volvió al menú o a otra
   * página y pide algo distinto, arrastrarla hace que el asistente siga "en la carrera".
   */
  getActiveLastCareer(text, careerAlternatives = []) {
    const last = window.chatHandler?.conversationContext?.lastCareer || null;
    if (!last) return null;
    if (/\/carreras-detalle\//.test(location.pathname)) return last;
    const normalize = value=>String(value || '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    const current = normalize(text);
    const referential = /\b(?:esa|esta|aquella|la misma|misma|dicha)\s+(?:carrera|ficha|informacion)\b|\b(?:ficha|alla|ahi|de nuevo|otra vez|vuelve|volver|regresa\w*|anterior|ultima|antes)\b/.test(current);
    const named = current.includes(normalize(last.title));
    // Seguimiento natural ("¿y en qué sedes?", "¿cuánto dura?"): la carrera sigue activa si se habló de ella en los últimos mensajes.
    const recent = (window.chatHandler?.getDialogueMessages?.() || []).slice(-6).some(message => message.type === 'assistant' && normalize(message.text).includes(normalize(last.title)));
    const followUp = recent && /\b(?:y|ademas|tambien)\b|\b(?:sedes?|duracion|dura|jornadas?|horarios?|modalidad\w*|escuela|tipo|malla|requisitos?|cuesta|arancel|esa|esta|ella)\b/.test(current) && current.split(' ').length <= 12;
    return referential || named || followUp ? last : null;
  }

  /** Muestra (o actualiza) un mensaje del asistente con el texto parcial que llega del modelo. */
  updateLiveStream(partial) {
    const container = document.getElementById(this.messagesId);
    if (!container || !partial) return;
    if (!this._live) {
      this.hideTypingIndicator();
      const el = document.createElement('div');
      el.className = 'duco-message duco-message-assistant duco-message-live';
      const contentEl = document.createElement('div');
      contentEl.className = 'duco-message-content';
      el.appendChild(contentEl);
      container.appendChild(el);
      this._live = {el, contentEl, finalText: null};
    }
    // Se oculta un posible arranque de JSON mientras llega ("{"reply":"..."): solo se muestra texto legible.
    this._live.contentEl.textContent = String(partial).replace(/^\s*\{\s*"reply"\s*:\s*"?/, '');
    container.scrollTop = container.scrollHeight;
  }

  /** Descarta un mensaje en vivo que no llegó a ser la respuesta final (error, reparación, etc.). */
  discardLiveStream() {
    if (this._live?.el?.isConnected) this._live.el.remove();
    this._live = null;
  }

  getSourceParagraphElements() {
    // Los controles y las rutas de navegación no son contenido explicativo.
    return [...document.querySelectorAll('main p, main li')].filter(element=>
      !element.closest('#duco-assistant-container, nav, header, footer, aside, form, button, [role="navigation"], [role="menu"], [role="tablist"], .breadcrumb, .breadcrumb-carrera, .breadcrumbs') &&
      !(element.matches('li') && element.querySelector('p, ul, ol')) &&
      element.textContent.replace(/\s+/g,' ').trim().length>=25);
  }

  getEvidenceContext() {
    if (!/\/carreras-detalle\//.test(location.pathname)) return null;
    const saved=window.chatHandler?.conversationContext?.lastExplanation;
    const answer = saved?.path === location.pathname ? saved.answer :
      [...(window.chatHandler?.getAllMessages?.() || [])].reverse().find(m=>m.type==='assistant' && m.text?.length>100 && !/^(🔎|📂|🚫)/u.test(m.text))?.text;
    if (!answer) return null;
    const sourceBlocks = saved?.path === location.pathname && Array.isArray(saved.blocks) ? new Set(saved.blocks) : null;
    const blocks=this.getSourceParagraphElements()
      .filter(el=>!el.closest('#duco-assistant-container'))
      .map(el=>el.textContent.replace(/\s+/g,' ').trim())
      .filter(text=>text.length>=25 && text.length<=800 && (!sourceBlocks || sourceBlocks.has(text))).slice(0,60);
    return blocks.length ? {answer,blocks} : null;
  }

  getViewportContext() {
    const headings=[...document.querySelectorAll('h1,h2,h3,[role="tab"][aria-selected="true"]')]
      .filter(el=>!el.closest('#duco-assistant-container'))
      .filter(el=>{const rect=el.getBoundingClientRect();return rect.width>0 && rect.height>0 && rect.bottom>0 && rect.top<innerHeight;})
      .map(el=>this.getElementContentText(el)).filter(Boolean).slice(0,8);
    const expandedControls=[...document.querySelectorAll('[aria-expanded="true"]')]
      .filter(el=>!el.closest('#duco-assistant-container') && el.getClientRects().length)
      .map(el=>this.getElementContentText(el)).filter(Boolean).slice(0,12);
    return {page:location.pathname,scrollY:Math.round(window.scrollY),visibleHeadings:headings,expandedControls};
  }

  getDialogControls() {
    return [...document.querySelectorAll('button[aria-controls][aria-haspopup="dialog"]')]
      .filter(button=>!button.disabled && button.getClientRects().length && !button.closest('#duco-assistant-container'))
      .map(button=>({label:button.textContent.replace(/\s+/g,' ').trim(),dialogId:button.getAttribute('aria-controls')}))
      .filter(control=>control.label && document.getElementById(control.dialogId)?.getAttribute('role') === 'dialog')
      .slice(0,20);
  }

  getNamedPageTargets(question, history) {
    const normalize = value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    const previous = (history || []).filter(m=>m.type==='user' && m.text!==question).slice(-1)[0]?.text || '';
    const currentText=normalize(question), previousText=normalize(previous);
    const seen=new Set();
    return [...document.querySelectorAll('a,button,h1,h2,h3,h4,[role="button"]')]
      .filter(el=>!el.closest('#duco-assistant-container') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
      .map(el=>({label:this.getElementContentText(el),isTab:el.matches('a[role="tab"][href^="#"],a[data-tab][href^="#"]')})).filter(({label})=>{
        const key=normalize(label);
        if(key.length<10 || key.length>120 || seen.has(key)) return false;
        if (!currentText.includes(key) && !previousText.includes(key)) return false;
        seen.add(key); return true;
      }).map(item=>({...item,inCurrent:currentText.includes(normalize(item.label))})).slice(0,15);
  }

  async findPageResearch(question) {
    const normalize = text=>String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const stop = new Set(['todo','toda','sobre','carrera','carreras','quiero','saber','informacion','busca','buscar','dame','puedes','necesito','tienes','pagina','sitio','tiene','datos','muestra','dime','estudiar','estudio','profesional','tecnica']);
    const words = [...new Set(normalize(question).match(/[a-z0-9]{4,}/g) || [])].filter(word=>!stop.has(word));
    if (!words.length) return [];
    const score = value => { const normalized=normalize(value); return words.filter(word=>normalized.includes(word)).length; };
    const results = [];
    try {
      const response=await fetch('/assets/carreras-catalogo.json');
      if (response.ok) {
        const catalog=await response.json();
        const matches=catalog.map(item=>({item,score:score(item.title)})).filter(entry=>entry.score>0)
          .sort((a,b)=>b.score-a.score);
        const best=matches[0];
        if (best && (best.score >= 2 || words.some(word=>word.length>=6 && normalize(best.item.title).includes(word)))) {
          const ties=matches.filter(entry=>entry.score===best.score).slice(0,4);
          ties.forEach(({item})=>results.push({kind:'catalogo',title:item.title,source:item.link,localLink:item.local_link,
            detail:{duracion:item.duracion,tipo:item.tipo,escuela:item.escuela,sedes_modalidades:item.sedes_modalidades},
            captured:'2026-10-29'}));
        }
        if (!results.length && typeof this.aiClient?.resolveCareerMentions === 'function') {
          // Sin coincidencia literal: probar siglas (TENS) y nombres parecidos antes de rendirse.
          const careerCue=/\b(?:carreras?|ficha|tecnico|ingenieria)\b/.test(normalize(question));
          const similar=this.aiClient.resolveCareerMentions(question,catalog,{allowFuzzy:careerCue});
          similar.matches.slice(0,3).forEach(item=>results.push({kind:'catalogo',title:item.title,source:item.link,localLink:item.local_link,
            detail:{duracion:item.duracion,tipo:item.tipo,escuela:item.escuela,sedes_modalidades:item.sedes_modalidades},
            captured:'2026-10-29',matchedBy:similar.kind}));
        }
      }
    } catch (error) { console.warn('[Duco] Catálogo local no disponible:',error); }
    const elements=[...document.querySelectorAll('main h1,main h2,main h3,main p,article h1,article h2,article h3,article p,[role="main"] h1,[role="main"] h2,[role="main"] p')];
    const entries=elements.filter(el=>!el.closest('#duco-assistant-container'))
      .map(el=>({text:this.getElementContentText(el),score:score(this.getElementContentText(el))}))
      .filter(entry=>entry.score>0 && entry.text.length>=20 && entry.text.length<=700)
      .sort((a,b)=>b.score-a.score).slice(0,8);
    entries.forEach(entry=>results.push({kind:'pagina_actual',title:document.title,detail:entry.text,source:this.getOriginalPageUrl()}));
    return results;
  }

  /** Dirección oficial de la página que se está viendo (la copia local no debe citarse como fuente). */
  getOriginalPageUrl() {
    const official={'/duoc.html':'https://www.duoc.cl/','/duco':'https://www.duoc.cl/','/carreras.html':'https://www.duoc.cl/oferta-academica/carreras/',
      '/admision.html':'https://www.duoc.cl/admision/','/financiamiento.html':'https://www.duoc.cl/admision/preguntas-frecuentes/financiamiento-gratuidad-y-becas/',
      '/sedes.html':'https://www.duoc.cl/nosotros/donde-estamos/sedes/','/vida-estudiantil.html':'https://www.duoc.cl/vida-estudiantil/','/nosotros.html':'https://www.duoc.cl/nosotros/'};
    return official[location.pathname] || location.href;
  }

  isLocalKnowledgeApi() {
    const localHosts = ['localhost', '127.0.0.1'];
    const apiBase = window.ducoConfig?.knowledgeApiBaseUrl || window.location.origin;
    try {
      const apiHost = new URL(apiBase, window.location.href).hostname;
      return localHosts.includes(window.location.hostname) && localHosts.includes(apiHost);
    } catch {
      return false;
    }
  }

  async recordUserCorrection(text,decision) {
    const handler=window.chatHandler;
    const previous=handler.conversationContext.lastActionInteraction;
    handler.conversationContext.lastCorrection={request:text,goal:decision.goal || '',constraints:decision.constraints || [],timestamp:Date.now()};
    handler.saveToSession();
    if (!this.isLocalKnowledgeApi() || !previous?.experience?.steps?.length || previous.rejectedByUser) return;
    const rejected=JSON.parse(JSON.stringify(previous));
    rejected.experience.correction={message:text,goal:decision.goal || '',constraints:decision.constraints || []};
    try {
      const response=await fetch(this.knowledgeApiUrl('/api/duco/feedback'),{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...rejected,rating:-1})});
      if (!response.ok) throw new Error('No se pudo registrar la corrección');
      previous.rejectedByUser=true;
      handler.saveToSession();
    } catch(error) { console.warn('[Duco] La corrección sigue en el contexto, pero no pudo guardarse en Oracle:',error); }
  }

  async getActionExperiences(text) {
    if (!this.isLocalKnowledgeApi()) return [];
    try {
      const result=await fetch(this.knowledgeApiUrl('/api/duco/experiences?query='+encodeURIComponent(text)+'&page='+encodeURIComponent(location.pathname)));
      if (result.ok) return (await result.json()).items || [];
    } catch(error) { console.warn('[Duco] No se pudieron consultar experiencias:',error); }
    return [];
  }

  knowledgeApiUrl(path) {
    return new URL(path, window.ducoConfig?.knowledgeApiBaseUrl || window.location.origin).toString();
  }

  getVisiblePageContentForAi() {
    const selector = 'main h1, main h2, main h3, main h4, main p, main a, main button, [role="main"] h1, [role="main"] h2, [role="main"] h3, [role="main"] h4, [role="main"] p, [role="main"] a, [role="main"] button, nav a, header a';
    const seen = new Set();
    return [...document.querySelectorAll(selector)]
      .filter(element => !element.closest('#duco-assistant-container'))
      .filter(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map(element => this.getElementContentText(element))
      .filter(text => text.length >= 3 && text.length <= 220 && !seen.has(text) && seen.add(text))
      .slice(0, 45);
  }

  getNavigationMenus() {
    return [...document.querySelectorAll('.dropdown-menu[aria-labelledby]')].map(menu => {
      const trigger = document.getElementById(menu.getAttribute('aria-labelledby'));
      if (!trigger?.closest('nav, header, .navbar')) return null;
      return {
        label:this.getElementContentText(trigger),
        items:[...menu.querySelectorAll(':scope > a, :scope > button, :scope > .dropdown > a')]
          .filter(element=>getComputedStyle(element).display !== 'none')
          .map(element=>this.getElementContentText(element)).filter(Boolean).slice(0,12)
      };
    }).filter(menu=>menu?.label && menu.items.length).slice(0,12);
  }

  getUserFacingError(error) {
    const message = String(error?.message || '');
    if (message === 'OLLAMA_UNAVAILABLE' || /Ollama no está disponible/i.test(message)) {
      return 'No pude conectarme con la IA (Ollama). Verifica que esté iniciado e intenta nuevamente. Mientras tanto sigo pudiendo buscar carreras, mostrar sedes en el mapa, dar fechas de admisión y abrir menús.';
    }
    if (message === 'OLLAMA_TIMEOUT' || error?.name === 'AbortError') {
      return 'La IA tardó demasiado en responder. Intenta nuevamente; puedo seguir buscando carreras, sedes y fechas.';
    }
    if (message === 'OLLAMA_INVALID_RESPONSE') {
      return 'Ollama respondió con un resultado vacío o inválido. Intenta nuevamente.';
    }
    if (message === 'OLLAMA_NETWORK_ERROR' || /fetch|network|failed to fetch/i.test(message)) {
      return 'No se pudo establecer conexión con la IA (Ollama). Verifica que esté iniciado e intenta nuevamente. Mientras tanto sigo pudiendo buscar carreras, mostrar sedes en el mapa, dar fechas de admisión y abrir menús.';
    }
    // Se deja el detalle técnico para poder diagnosticar el fallo la próxima vez (y queda en window.__ducoLastError).
    try { window.__ducoLastError = {message: String(error?.message || error), stack: String(error?.stack || '').split('\n').slice(0, 6).join(' | '), at: new Date().toISOString()}; } catch { /* sin detalle */ }
    return `Ocurrió un error al procesar tu pregunta. Intenta nuevamente. (Detalle técnico: ${String(error?.message || error).replace(/\s+/g, ' ').slice(0, 140)})`;
  }

  isValidHighlightTerm(term) {
    const t = String(term || '').trim().toLowerCase();
    const stopWords = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'y', 'o', 'que', 'un', 'una', 'por', 'para', 'con', 'sin', 'se', 'su', 'al', 'es', 'son', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'todo', 'toda', 'todos', 'todas', 'mas', 'pero', 'como', 'cuando', 'donde', 'quien', 'muy', 'si', 'no', 'me', 'te', 'le', 'les', 'nos', 'mi', 'tu', 'hay', 'ser', 'estar', 'tener', 'hacer']);
    return t.length >= 3 && !stopWords.has(t) && !/^\d+$/.test(t) && !/[+@#$%^&*=<>{}|\\/~`]/.test(t);
  }

  isHighlightRequest(text) {
    const normalized = String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return /\b(?:marca(?:me)?|remarca(?:me)?|resalta(?:me)?|senala(?:me)?|destaca(?:me)?|subraya(?:me)?)\b/.test(normalized);
  }

  isExplicitKnowledgeSaveRequest(text) {
    const normalized = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/\b(?:no|nunca|jamas)\b.{0,24}\b(?:guarda|guardar|recuerd\w*|aprend\w*|memoriz\w*|ensen\w*|anota\w*|registra\w*)\b/.test(normalized)) return false;
    return /\b(?:guarda|guardar|recuerd\w*|aprend\w*|memoriz\w*|ensen\w*|anota\w*|registra\w*)\b/.test(normalized);
  }

  canonicalizeHighlightTargets(actions, quotedTerms = []) {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const quoted = new Set(quotedTerms.map(normalize));
    return (actions || []).map(action => {
      if (!['highlight', 'highlightTerms'].includes(action.type) || !Array.isArray(action.terms)) return action;
      // Estas etiquetas ya proceden del catálogo del menú. No corregirlas
      // contra títulos visibles del cuerpo o contra el botón padre.
      if (action.scope === 'opened_menu' || action.careerCard) return action;
      return {
        ...action,
        terms: action.terms.map(term => {
          const value = String(term || '').trim();
          if (quoted.has(normalize(value)) || !value.includes(' ')) return value;
          return this.findClosestVisiblePhrase(value)?.text || value;
        })
      };
    });
  }

  extractHighlightTargets(reply) {
    const quoted = this.extractQuotedTerms(reply);
    if (quoted.length) return quoted.filter(term => term.length >= 3 && term.length <= 120);

    const text = String(reply || '').trim();
    const match = text.match(/\b(?:te\s+)?(?:marqu[eé]|resalt[eé]|subray[eé]|señal[eé]|destaqu[eé])\s+(.+?)(?:[.!?]|$)/i);
    if (!match) {
      if (!text || text.length > 120) return [];
      const element = this.findTextElementByTerms([text]);
      const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
      const label = this.getElementContentText(element);
      return label && normalize(label) === normalize(text) ? [label] : [];
    }
    const target = match[1].replace(/^[«“"'\s]+|[»”"'\s]+$/g, '').trim();
    return target.length >= 3 && target.length <= 120 ? [target] : [];
  }

  consolidateHighlightActions(actions, preferredTerms = [], userText = '') {
    const highlightActions = actions.filter(action => ['highlight', 'highlightTerms'].includes(action.type));
    if (!highlightActions.length) return actions;

    const baseAction = highlightActions[0];
    let terms = preferredTerms.length
      ? preferredTerms
      : highlightActions.flatMap(action => Array.isArray(action.terms) ? action.terms : []);

    const uniqueTerms = [];
    const seen = new Set();
    terms.forEach(term => {
      const value = String(term || '').trim();
      const key = value.toLocaleLowerCase('es');
      if (!value || seen.has(key)) return;
      seen.add(key);
      uniqueTerms.push(value);
    });

    // Si la IA devolvió frase y además sus palabras separadas, conservar la frase.
    terms = uniqueTerms.filter(term => !uniqueTerms.some(other =>
      other.length > term.length && other.toLocaleLowerCase('es').includes(term.toLocaleLowerCase('es'))
    ));
    if (!terms.length) return actions;

    const consolidated = {
      ...baseAction,
      type: 'highlightTerms',
      terms: terms.slice(0, 4),
      duration: baseAction.duration || 4500
    };
    const firstHighlightIndex = actions.findIndex(action => ['highlight', 'highlightTerms'].includes(action.type));
    const nonHighlightActions = actions.filter(action => !['highlight', 'highlightTerms'].includes(action.type));
    nonHighlightActions.splice(Math.min(firstHighlightIndex, nonHighlightActions.length), 0, consolidated);
    return this.reorderAndAdjustActionsForQuery(nonHighlightActions, userText);
  }

  sanitizeActions(actions) {
    const actionsWithoutTerms = ['closeDropdown', 'clearHighlights', 'close'];
    const supported = new Set(['highlight','highlightTerms','dropdown','closeDropdown','clearHighlights','clear','close','scroll','viewport','move','goto','navigate','explainCareer','showEvidence','clickControl','selectPageControl','proposeKnowledge','showMap','showCalendar']);
    return (actions || []).filter(Boolean).map(action => {
      const sanitized = { ...action };
      if (sanitized.terms) {
        const seenTerms = new Set();
        sanitized.terms = sanitized.terms
          .filter(t => this.isValidHighlightTerm(t))
          .filter(term => {
            const key = String(term).trim().toLocaleLowerCase('es');
            if (seenTerms.has(key)) return false;
            seenTerms.add(key);
            return true;
          });
      }
      return sanitized;
    }).filter(action => {
      if (!supported.has(action.type)) return false;
      if (actionsWithoutTerms.includes(action.type)) return true;
      if (action.type === 'proposeKnowledge') {
        return typeof action.question === 'string' && action.question.trim().length > 0 && action.question.length <= 500 &&
          typeof action.answer === 'string' && action.answer.trim().length > 0 && action.answer.length <= 5000;
      }
      return action.terms && action.terms.length > 0;
    });
  }

  isExplicitOpenRequest(text) {
    const lowerInput = String(text || '').toLowerCase().trim();
    return /^(?:abrir|ver|click|clic|mu[eé]strame|mostrar|expandir|desplegar|ir a)/.test(lowerInput) ||
      /(?:puedes?|puedo)\s+abrir/.test(lowerInput) ||
      /(?:click|clic)\s+(?:en|a)\s+/.test(lowerInput);
  }

  resolveDropdownControl(terms = [], explicitTrigger) {
    const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const labels = terms.map(normalize).filter(Boolean);
    const controls = [...document.querySelectorAll('nav a, nav button, header a, header button, .navbar a, .navbar button')];
    const explicit = typeof explicitTrigger === 'string' ? document.querySelector(explicitTrigger) : explicitTrigger;
    const ranked = explicit ? [explicit] : controls.filter(el => !el.closest('#duco-assistant-container'))
      .map(el => ({el, text: normalize(this.getElementContentText(el))}))
      .filter(item => labels.some(label => item.text === label || item.text.includes(label)))
      .sort((a,b) => Number(labels.includes(b.text)) - Number(labels.includes(a.text)) || a.text.length-b.text.length)
      .map(item => item.el);
    for (const candidate of ranked) {
      let trigger = candidate;
      let menu = trigger.parentElement?.querySelector(':scope > .dropdown-menu');
      if (!menu) {
        // Un enlace dentro del menú identifica su menú propietario, no una
        // sección con el mismo nombre en el cuerpo de la página.
        menu = candidate.closest('.dropdown-menu');
        const ownerId = menu?.getAttribute('aria-labelledby');
        trigger = ownerId ? document.getElementById(ownerId) : null;
      }
      if (trigger && menu && trigger !== menu) {
        return {trigger, menu, label:this.getElementContentText(trigger)};
      }
    }
    return null;
  }

  bindMenuActions(actions) {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const bindings = [];
    const bound = actions.map(action => {
      if (action.type !== 'dropdown') return action;
      const target = this.resolveDropdownControl(action.terms, action.trigger || action.selector);
      if (!target) return action;
      bindings.push({terms:action.terms || [], ...target});
      return {...action, trigger:target.trigger, menu:target.menu, terms:[target.label]};
    });
    return bound.flatMap(action => {
      if (!['highlight', 'highlightTerms', 'scroll', 'viewport', 'move', 'goto'].includes(action.type)) return [action];
      // Señalar el control de un menú (sin abrirlo): se resalta el botón de la barra, no el mismo texto del pie de página.
      if (action.menuControl === true && action.type === 'highlightTerms') {
        const control = this.resolveDropdownControl(action.terms || []);
        if (control?.trigger?.getClientRects().length) {
          return [{...action, terms:[control.label], menuTrigger:control.trigger, menuElement:control.menu, autoGuide:false, closeTransientUi:false}];
        }
      }
      if (action.scope === 'opened_menu' && ['highlight','highlightTerms'].includes(action.type)) {
        const binding = bindings.find(item => (action.menuTerms || []).some(term=>normalize(term)===normalize(item.label))) || bindings[0];
        if (!binding) return [action];
        const option = [...binding.menu.querySelectorAll('a,button,[role="menuitem"]')]
          .find(element=>(action.terms || []).some(term=>normalize(term)===normalize(this.getElementContentText(element))));
        if (!option) return [action];
        return [{...action,menuTrigger:option,menuElement:binding.menu,autoGuide:false,closeTransientUi:false}];
      }
      const binding = bindings.find(item => (action.terms || []).some(term =>
        [...item.terms, item.label].some(label => normalize(term) === normalize(label))));
      if (!binding) return [action];
      if (!['highlight','highlightTerms'].includes(action.type)) return [];
      return [{...action, terms:[binding.label], menuTrigger:binding.trigger, menuElement:binding.menu,
        autoGuide:false, closeTransientUi:false}];
    });
  }

  isLocationInquiry(text) {
    const lowerInput = String(text || '').toLowerCase();
    return /\b(d[oó]nde|ubicaci[oó]n|se\s+ubica|se\s+encuentra|queda|ubicado|ubicada|localiza|localizaci[oó]n)\b/.test(lowerInput);
  }

  reorderAndAdjustActionsForQuery(actions, text) {
    if ((actions || []).some(action => action?.type === 'navigate')) return actions;
    const preferHighlightOnly = this.isLocationInquiry(text) && !this.isExplicitOpenRequest(text);
    const priority = {
      clearHighlights: 0,
      closeDropdown: 0,
      dropdown: 1,
      scroll: 2,
      viewport: 2,
      move: 2,
      goto: 2,
      highlightTerms: 3,
      highlight: 3
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

    // Un resaltado posterior no debe cerrar el menú que el mismo plan abrió.
    if (adjusted.some(action => action.type === 'dropdown')) {
      adjusted.forEach(action => {
        if (['highlight', 'highlightTerms'].includes(action.type)) action.closeTransientUi = false;
      });
    }
    const sortGroup = group => group.sort((left, right) => {
      const leftPriority = priority[left.type] ?? 99;
      const rightPriority = priority[right.type] ?? 99;
      return leftPriority - rightPriority;
    });
    // El cierre delimita etapas: abrir y luego cerrar no equivale a cerrar y abrir.
    const ordered = [];
    let group = [];
    adjusted.forEach(action => {
      if (action.type === 'closeDropdown') {
        ordered.push(...sortGroup(group), action);
        group = [];
      } else group.push(action);
    });
    return [...ordered, ...sortGroup(group)];
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
              careerCard: action.careerCard,
              menuTrigger: action.menuTrigger,
              guideFirst: action.guideFirst,
              menuElement: action.menuElement,
              scope: action.scope,
              menuTerms: action.menuTerms,
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
        } else if (action.type === 'navigate') {
          flow.push({action:{type:'navigate',terms:action.terms || [],target:action.target},pauseAfter:action.pauseAfter});
        } else if (action.type === 'showMap') {
          flow.push({action:{type:'showMap',terms:action.terms || [],sedeIds:action.sedeIds || [],route:action.route || null}});
        } else if (action.type === 'showCalendar') {
          flow.push({action:{type:'showCalendar',terms:action.terms || [],eventIds:action.eventIds || []}});
        } else if (action.type === 'explainCareer') {
          flow.push({action:{type:'explainCareer',terms:action.terms || [],guided:action.guided === true}});
        } else if (action.type === 'clickControl') {
          flow.push({action:{type:'clickControl',terms:action.terms || [],dialogId:action.dialogId}});
        } else if (action.type === 'selectPageControl') {
          flow.push({action:{type:'selectPageControl',terms:action.terms || []}});
        } else if (action.type === 'showEvidence') {
          flow.push({action:{type:'showEvidence',terms:action.terms || [],evidenceTexts:action.evidenceTexts || []}});
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
        } else if (action.type === 'clear' || action.type === 'clearHighlights') {
          flow.push({
            action: { type: 'clearHighlights' },
            pauseAfter: action.pauseAfter
          });
        } else if (action.type === 'proposeKnowledge') {
          flow.push({
            action: { type: 'proposeKnowledge', question: action.question, answer: action.answer },
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
    const feedback=context.feedbackInteraction;
    const actionOutcomes = [];

    for (let index = 0; index < flowSteps.length; index++) {
      const step = flowSteps[index];
      if (!step) continue;

      if (step.pauseBefore) {
        await this.sleep(step.pauseBefore);
      }

      if (step.text) {
        window.chatHandler.addAssistantMessage(step.text);
        const messageElement = await this.displayMessage(step.text, 'assistant');

      }

      if (step.action) {
        const trace={type:step.action.type,terms:step.action.terms || [],page:location.pathname,success:false,detail:'Resultado pendiente'};
        if (feedback?.experience) feedback.experience.steps.push(trace);
        await this.sleep(step.actionDelay ?? 550);

        if (step.action.type === 'navigate') {
          const destination = this.resolveNavigationDestination(step.action);
          if (!destination) {
            const message = 'No encontré un enlace local para continuar. ¿Qué página quieres abrir?';
            window.chatHandler.addAssistantMessage(message);
            await this.displayMessage(message, 'assistant');
            trace.detail=message;
            this.finishActionFeedback(context);
            return [{success:false,detail:message}];
          }
          if (destination.pathname===location.pathname) {
            const outcome={success:true,detail:'La página solicitada ya está abierta'};
            window.chatHandler?.recordActionOutcome?.(step.action,outcome,context.userText || '');
            Object.assign(trace,outcome);
            actionOutcomes.push(outcome);
            continue;
          }
          const link = [...document.querySelectorAll('a[href]')].find(element=> {
            try { return new URL(element.href,location.href).href === destination.href && element.getClientRects().length > 0; }
            catch { return false; }
          });
          const navigationLabel = this.describeHighlightTarget(step.action.terms || []);
          const navigationMessage = `${link ? '🖱️ Seleccionando' : '📄 Abriendo página'}: ${navigationLabel || 'enlace'}`;
          window.chatHandler.addAssistantMessage(navigationMessage);
          await this.displayMessage(navigationMessage, 'assistant', { action: true });
          if (link && window.ducoHighlighter?.guideToElement) {
            await window.ducoHighlighter.guideToElement(link);
            window.ducoHighlighter.highlight(link,1800,{guide:false});
            await this.sleep(1600);
          }
          const remaining = flowSteps.slice(index + 1).filter(item=>item?.action).map(item=>({
            type:item.action.type,terms:item.action.terms,target:item.action.target,scope:item.action.scope,
            menuTerms:item.action.menuTerms,careerCard:item.action.careerCard,guided:item.action.guided,duration:item.action.duration,pauseAfter:item.pauseAfter
          }));
          sessionStorage.setItem('duco-navigation-pending',JSON.stringify({destination:destination.pathname,
            remaining,feedbackInteraction:feedback,recoveryAttempted:!!context.recoveryAttempted,request:context.userText || '',open:this.isOpen,created:Date.now()}));
          sessionStorage.setItem('duco-navigation-previous',window.location.pathname);
          window.location.assign(destination.href);
          return actionOutcomes;
        }

        if (step.action.type === 'highlightTerms' && step.action.terms?.length) {
          const highlightTerms = step.action.terms.map(term => String(term || '').trim()).filter(Boolean).slice(0, 6);
          const actionMsg = `${step.action.careerCard ? '🔎 Buscando' : '🖍️ Resaltando'}: ${this.describeHighlightTarget(highlightTerms)}`;
          window.chatHandler.addAssistantMessage(actionMsg, true, { highlightTerms });
          await this.displayMessage(actionMsg, 'assistant', { action: true });
        } else if (step.action.type === 'dropdown' && step.action.terms?.length) {
          const actionMsg = `📂 Abriendo menú: ${step.action.terms.join(', ')}`;
          window.chatHandler.addAssistantMessage(actionMsg);
          await this.displayMessage(actionMsg, 'assistant', { action: true });
        } else if (step.action.type === 'closeDropdown') {
          const actionMsg = `🚫 Cerrando menú`;
          window.chatHandler.addAssistantMessage(actionMsg);
          await this.displayMessage(actionMsg, 'assistant', { action: true });
        } else if (step.action.type === 'clickControl' || step.action.type === 'selectPageControl') {
          const filterLabel = /^bc-[a-z]+-/.test(String(step.action.terms[0] || '')) ? (document.getElementById(step.action.terms[0])?.labels?.[0]?.textContent.trim() || 'filtro') : null;
          const actionMsg = `🖱️ Seleccionando: ${filterLabel || step.action.terms.join(', ')}`;
          window.chatHandler.addAssistantMessage(actionMsg);
          await this.displayMessage(actionMsg, 'assistant', { action: true });
        } else if (step.action.type === 'showEvidence') {
          const actionMsg = '🖍️ Resaltando el texto de la página';
          window.chatHandler.addAssistantMessage(actionMsg);
          await this.displayMessage(actionMsg, 'assistant', { action: true });
        }

        let outcome;
        try { outcome = await this.executeFlowAction(step.action, context); }
        catch (error) { console.warn('[Duco] Falló el paso:',error); outcome={success:false,detail:'La acción produjo un error'}; }
        outcome = outcome || {success:false,detail:'La acción no confirmó su resultado'};
        Object.assign(trace,outcome);
        actionOutcomes.push(outcome);
        const goal=window.chatHandler?.conversationContext?.lastRequestedTarget;
        if (outcome?.success && goal && (step.action.terms || []).some(term=>
          String(term).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===String(goal.target).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())) {
          goal.pending=false; window.chatHandler.saveToSession();
        }
        window.chatHandler?.recordActionOutcome?.(step.action, outcome || {
          success: false,
          detail: 'La acción no confirmó su resultado'
        }, context.userText || '');
        if (outcome.success !== true) {
          const message='No pude completar este paso: '+(outcome.detail || 'resultado no confirmado')+'.';
          window.chatHandler?.addAssistantMessage(message);
          await this.displayMessage(message,'assistant');
          if (context.userText) window.chatHandler?.recordActionPlan?.(context.userText,
            flowSteps.filter(item=>item?.action).map(item=>item.action),actionOutcomes);
          const isCorrection=context.aiResponse?.turnDecision?.mode==='correction' || window.chatHandler?.conversationContext?.lastCorrection?.request===context.userText;
          if (context.userText && !context.recoveryAttempted && !isCorrection && !(step.action.type === 'explainCareer' && step.action.guided)) {
            const retry = await this.requestAiResponse(context.userText,{actionRecovery:true});
            if (retry?.actions?.length) {
              const repaired = await this.runAssistantFlow(this.buildFlowFromAiResponse(retry),
                {...context,recoveryAttempted:true});
              return [...actionOutcomes,...repaired];
            }
          }
          this.finishActionFeedback(context);
          return actionOutcomes;
        }
      }

      if (step.pauseAfter) {
        await this.sleep(step.pauseAfter);
      }
    }
    if (context.userText) window.chatHandler?.recordActionPlan?.(context.userText,
      flowSteps.filter(step=>step?.action).map(step=>({...step.action,pauseAfter:step.pauseAfter})),actionOutcomes);
    try { await this.announceCompletion(flowSteps,actionOutcomes,context); } catch (error) { console.warn('[Duco] No se pudo anunciar el cierre:',error); }
    this.finishActionFeedback(context);
    return actionOutcomes;
  }

  /**
   * Al terminar una tarea con acciones en la página, el asistente avisa que terminó y ofrece el siguiente paso
   * ("Listo, ya estás en la ficha de «X». ¿Quieres que te la explique?"). Si algo falló, ya se dijo y aquí no se agrega nada.
   */
  async announceCompletion(flowSteps,outcomes,context) {
    if (context.silentCompletion) return;
    const actions=flowSteps.filter(step=>step?.action).map(step=>step.action);
    if (!actions.length && !context.arrived) return;
    if (outcomes.some(outcome=>outcome?.success!==true)) return;
    // Estas acciones ya entregan su propio contenido (explicación, mapa, calendario, texto resaltado).
    if (actions.some(action=>['explainCareer','showEvidence','showMap','showCalendar','proposeKnowledge'].includes(action.type))) return;
    const path=location.pathname;
    const pageName=()=>(document.querySelector('main h1, h1')?.textContent || document.title.split('–')[0]).replace(/\s+/g,' ').trim();
    let message=null;
    if (context.arrived || actions.some(action=>action.type==='navigate')) {
      if (/\/carreras-detalle\//.test(path)) message=`Listo, ya estás en la ficha de «${pageName()}». ¿Quieres que te la explique punto por punto, o prefieres ver en qué sedes y jornadas se imparte?`;
      else if (/\/carreras\.html$/.test(path)) message='Listo, estás en el catálogo de carreras. Dime qué área te interesa y aplico los filtros por ti, o pídeme una carrera por su nombre.';
      else if (['/duco','/duoc.html','/'].includes(path)) message='Listo, estás en la página de inicio. ¿Qué quieres ver ahora?';
      else message=`Listo, ya estás en «${pageName()}». ¿Qué necesitas ver aquí?`;
    } else if (actions.some(action=>action.type==='selectPageControl' && /^bc-[a-z]+-/.test(String(action.terms?.[0] || '')))) {
      const count=document.querySelector('.bc-count')?.textContent.replace(/\s+/g,' ').trim();
      message=count ? `Listo: ahora el catálogo muestra ${count}. ¿Quieres afinar más el filtro o abrir alguna carrera?` : 'Listo, apliqué el filtro. ¿Quieres afinarlo más?';
    } else {
      const last=actions.at(-1);
      if (last.type==='dropdown') message=`Listo, el menú «${last.terms?.[0] || ''}» está abierto. ¿Quieres que te señale alguna opción?`;
      else if (last.type==='closeDropdown') message='Listo, cerré el menú. ¿Seguimos con otra cosa?';
      else if ((last.type==='highlightTerms' || last.type==='highlight') && path==='/admision.html' && (last.terms || []).length>=3 && document.querySelector('.ad26-reserva-paso')) message='Listo, ya tienes los pasos señalados en pantalla. ¿Quieres que te lleve al catálogo para elegir tu carrera?';
      else if (last.type==='highlightTerms' || last.type==='highlight') message='Listo, ya lo tienes señalado en pantalla. ¿Quieres que te explique qué es o seguimos con otra cosa?';
      else if (['scroll','viewport','move','goto'].includes(last.type)) message='Listo, ya estás en esa parte de la página. ¿Necesitas algo más?';
      else if (last.type==='clearHighlights') message='Listo, quité los resaltados. ¿Seguimos?';
    }
    if (!message) return;
    window.chatHandler.addAssistantMessage(message,false,{closing:true});
    await this.displayMessage(message,'assistant');
  }

  finishActionFeedback(context) {
    const interaction=context.feedbackInteraction;
    if (!interaction || interaction.finished) return;
    const message=document.getElementById(this.messagesId)?.querySelector('.duco-message-assistant:last-of-type');
    if (!message) return;
    interaction.finished=true;
    const saved=window.chatHandler?.conversationContext?.lastExplanation;
    if (saved?.path===location.pathname && interaction.experience.steps.some(step=>step.type==='explainCareer' || step.type==='showEvidence')) {
      interaction.experience.evidenceTexts=saved.blocks || [];
    }
    window.chatHandler.conversationContext.lastActionInteraction=JSON.parse(JSON.stringify(interaction));
    window.chatHandler.saveToSession();
    this.addFeedbackControls(message,interaction);
  }

  resolveNavigationDestination(action) {
    const normalize = value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const terms = (action.terms || []).map(normalize);
    let href;
    if (action.target && /^(?:\/?(?:carreras|duoc|admision|financiamiento|sedes|vida-estudiantil|nosotros)\.html|\/?carreras-detalle\/[a-z0-9-]+\.html)$/i.test(action.target)) {
      href = new URL('/'+action.target.replace(/^\//,''),window.location.origin).href;
    } else if (terms.some(term=>['volver','atras','pagina anterior'].includes(term))) {
      href = sessionStorage.getItem('duco-navigation-previous');
    } else if (terms.some(term=>['logo','inicio','pagina principal'].includes(term))) {
      href = document.querySelector('a.navbar-brand[href]')?.getAttribute('href');
    } else {
      const links = [...document.querySelectorAll('a[href]')].filter(el=>!el.closest('#duco-assistant-container'));
      const match = links.find(el=>terms.includes(normalize(this.getElementContentText(el)))) ||
        links.find(el=>terms.some(term=>normalize(this.getElementContentText(el)).includes(term)));
      href = match?.getAttribute('href');
    }
    if (!href) return null;
    try {
      const url = new URL(href,window.location.href);
      return url.origin === window.location.origin &&
        /\.(html?)$/i.test(url.pathname) || url.origin === window.location.origin && url.pathname === '/duco' ? url : null;
    } catch { return null; }
  }

  getPendingNavigation() {
    try {
      const pending = JSON.parse(sessionStorage.getItem('duco-navigation-pending') || 'null');
      sessionStorage.removeItem('duco-navigation-pending');
      if (pending?.destination === window.location.pathname && Date.now() - pending.created <= 120000) return pending;
    } catch (error) { /* la navegación guiada requiere almacenamiento disponible */ }
    return null;
  }

  resumeNavigationFlow(pending) {
    if (!pending) return;
    if (pending.open) this.openPanel();
    if (!Array.isArray(pending.remaining)) return;
    const navigationTrace=pending.feedbackInteraction?.experience?.steps?.at(-1);
    if (navigationTrace?.type==='navigate') Object.assign(navigationTrace,{success:true,detail:'Se llegó a la página de destino'});
    this.setProcessing(true);
    setTimeout(async()=>{
      try {
        const actions = this.bindMenuActions(this.sanitizeActions(pending.remaining));
        await this.runAssistantFlow(this.buildFlowFromAiResponse({actions}),{userText:pending.request,feedbackInteraction:pending.feedbackInteraction,recoveryAttempted:pending.recoveryAttempted,arrived:true});
      } catch (error) {
        console.error('[Duco] Error al continuar la navegación:',error);
        const message = 'No pude continuar la acción en esta página.';
        window.chatHandler.addAssistantMessage(message);
        await this.displayMessage(message,'assistant');
      } finally { this.setProcessing(false); }
    },800);
  }

  /**
   * Agrega botones clickeables para repetir acciones de la IA dentro del mensaje del chat.
   */
  addActionButtons(aiResponse) {
    const messagesContainer = document.getElementById(this.messagesId);
    const lastAssistantMsg = messagesContainer?.querySelector('.duco-message-assistant:last-of-type');
    if (!lastAssistantMsg || !aiResponse?.actions?.length) return;

    const replayable = new Set(['highlight','highlightTerms','dropdown','closeDropdown','clearHighlights','scroll','viewport','move','goto','clickControl','selectPageControl','showEvidence']);
    const cleanActions = this.sanitizeActions(aiResponse.actions).filter(action => replayable.has(action.type));
    if (!cleanActions.length) return;

    const actionLabels = {
      highlightTerms: '🔍 Resaltar',
      clickControl: '🖱️ Seleccionar',
      selectPageControl: '🖱️ Seleccionar',
      showEvidence: '🖍️ Resaltar texto',
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
    try {
      const outcome = await this.executeFlowAction(action, {});
      window.chatHandler?.recordActionOutcome?.(action, outcome || {success:false,detail:'La acción no confirmó su resultado'});
      if (outcome?.success !== true) {
        const message='No pude volver a mostrar ese contenido en esta página.';
        window.chatHandler?.addAssistantMessage(message);
        await this.displayMessage(message,'assistant');
      }
    } catch (error) {
      console.error('[Duco] Error al repetir la acción:',error);
      window.chatHandler?.recordActionOutcome?.(action,{success:false,detail:'Error al repetir la acción'});
      const message='No pude volver a mostrar ese contenido en esta página.';
      window.chatHandler?.addAssistantMessage(message);
      await this.displayMessage(message,'assistant');
    } finally {
      setTimeout(() => {btn.classList.remove('duco-action-btn-active');btn.disabled=false;},1500);
    }
  }

  /**
   * Ejecuta una acción declarada dentro de una secuencia de respuesta.
   */
  getGuidedStepReadingDelay(text) {
    return Math.min(8000, Math.max(3000, String(text).length * 25));
  }

  async explainCareerWithGuidance(action, context = {}) {
    this.showTypingIndicator('Preparando explicación');
    try {
      const blocks = [...new Set(this.getSourceParagraphElements()
        .map(el => el.textContent.replace(/\s+/g, ' ').trim())
        .filter(text => text.length >= 60 && text.length <= 800))].slice(0,24);
      const steps = await this.aiClient.generateGuidedCareerExplanation(action.terms[0], blocks);
      this.hideTypingIndicator();
      const completed = [], evidence = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const readingDelay = this.getGuidedStepReadingDelay(step.explanation);
        const duration = Math.min(60000, Math.max(10000, step.explanation.length * this.typewriterSpeed + readingDelay + 1500));
        const evidenceAction = {type:'showEvidence',terms:['texto de la ficha'],evidenceTexts:[step.sourceText],duration};
        const outcome = await this.executeFlowAction(evidenceAction, context);
        window.chatHandler.recordActionOutcome(evidenceAction, outcome, context.userText || 'Explicación guiada');
        if (!outcome.success) return {success:false,detail:`No pude mostrar el respaldo de la parte ${i+1}. La explicación se detuvo.`};
        const message = `**Parte ${i+1} de ${steps.length}**\n${step.explanation}`;
        window.chatHandler.addAssistantMessage(message);
        await this.displayMessage(message, 'assistant', {guidedStep:i+1});
        completed.push(message); evidence.push(step.sourceText);
        if (context.feedbackInteraction) context.feedbackInteraction.answer = completed.join('\n\n');
        window.chatHandler.conversationContext.lastExplanation = {path:location.pathname,answer:completed.join('\n\n'),blocks:[...evidence]};
        window.chatHandler.saveToSession();
        await this.sleep(readingDelay);
      }
      this.addActionButtons({actions:[{type:'showEvidence',terms:['texto de la ficha'],evidenceTexts:evidence}]});
      return {success:true,detail:`Se explicaron ${steps.length} partes, resaltando su respaldo en secuencia`};
    } finally { this.hideTypingIndicator(); }
  }

  async executeFlowAction(action, context = {}) {
    if (!action) return;

    console.log('[Duco] Ejecutando acción:', JSON.stringify(action));

    if (action.type === 'showMap' || action.type === 'showCalendar') {
      const places = window.ducoPlaces;
      const container = document.getElementById(this.messagesId);
      if (!places || !container) return {success:false,detail:'El módulo de ubicaciones no está disponible'};
      const message = document.createElement('div');
      message.className = 'duco-message duco-message-assistant duco-message-card';
      const content = document.createElement('div');
      content.className = 'duco-message-content';
      message.appendChild(content);
      container.appendChild(message);
      const count = action.type === 'showMap' ? await places.renderMap(content, action.sedeIds || [], {route: action.route || null}) : places.renderCalendar(content, action.eventIds || []);
      container.scrollTop = container.scrollHeight;
      if (!count) { message.remove(); return {success:false,detail:'No hay datos para mostrar'}; }
      return {success:true,detail:action.type === 'showMap' ? `Se mostró el mapa con ${count} sede(s)` : `Se mostraron ${count} fecha(s) con botones para agregar al calendario`};
    }

    if (action.type === 'selectPageControl' && /^bc-[a-z]+-/.test(String(action.terms?.[0] || ''))) {
      // Filtro real del catálogo de carreras (Modalidad, Tipo, Escuela, Sede, Jornada): se abre su grupo, se señala y se marca.
      const input = document.getElementById(action.terms[0]);
      if (!input) return {success:false,detail:'No se encontró ese filtro en esta página'};
      const label = input.labels?.[0];
      if (!label?.getClientRects().length) {
        const header = [...document.querySelectorAll('.bc-filtro-header')].find(item => item.parentElement?.contains(input));
        header?.click();
        await this.sleep(450);
      }
      const target = input.labels?.[0]?.getClientRects().length ? input.labels[0] : input;
      await window.ducoHighlighter?.guideToElement?.(target);
      window.ducoHighlighter?.highlight?.(target,1400,{guide:false});
      await this.sleep(700);
      if (!input.checked) input.click();
      await this.sleep(500);
      const count = document.querySelector('.bc-count')?.textContent.replace(/\s+/g,' ').trim();
      return {success:input.checked,detail:`Filtro aplicado${count ? ` (${count})` : ''}`};
    }

    if (action.type === 'selectPageControl') {
      const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
      const desired=normalize(action.terms?.[0]);
      const candidates=[...document.querySelectorAll('a[role="tab"][href^="#"], a[data-tab][href^="#"]')]
        .filter(el=>el.getClientRects().length && normalize(el.textContent)===desired);
      const control=candidates[0];
      if (!control) return {success:false,detail:'No se encontró esa pestaña en la ficha actual'};
      const href=control.getAttribute('href');
      const panel=href && document.getElementById(href.slice(1));
      if (!panel) return {success:false,detail:'No se encontró el contenido de esa pestaña'};
      await window.ducoHighlighter?.guideToElement?.(control);
      window.ducoHighlighter?.highlight?.(control,1400,{guide:false});
      await this.sleep(800);
      control.click();
      await this.sleep(350);
      const opened=control.getAttribute('aria-selected')==='true' || panel.classList.contains('active');
      return {success:opened,detail:opened ? 'Pestaña seleccionada' : 'No se pudo abrir la pestaña'};
    }

    if (action.type === 'clickControl') {
      const control = this.getDialogControls().find(item=>item.dialogId===action.dialogId && item.label===action.terms?.[0]);
      const button = control && [...document.querySelectorAll('button[aria-controls][aria-haspopup="dialog"]')]
        .find(item=>item.getAttribute('aria-controls')===control.dialogId && item.textContent.replace(/\s+/g,' ').trim()===control.label && item.getClientRects().length);
      const dialog = control && document.getElementById(control.dialogId);
      if (!button || !dialog) return {success:false,detail:'No se encontró el control solicitado en esta página'};
      await window.ducoHighlighter?.guideToElement?.(button);
      window.ducoHighlighter?.highlight?.(button,1400,{guide:false});
      await this.sleep(800);
      button.click();
      await this.sleep(250);
      const open = !dialog.hidden && getComputedStyle(dialog).display !== 'none';
      return {success:open,detail:open ? 'Se abrió el contenido solicitado' : 'El contenido no se abrió'};
    }

    if (action.type === 'explainCareer') {
      if (action.guided === true) return this.explainCareerWithGuidance(action, context);
      this.showTypingIndicator('Leyendo');
      try {
      const blocks = this.getSourceParagraphElements()
        .map(el=>el.textContent.replace(/\s+/g,' ').trim())
        .filter(text=>text.length >= 25 && text.length <= 800).slice(0,35);
      const source = window.chatHandler?.conversationContext?.lastCareer?.source;
      const actionExperiences=await this.getActionExperiences(context.userText || 'Explica la carrera '+action.terms[0]);
      if (!blocks.length) return {success:false,detail:'La página no contiene información legible de la carrera'};
      const answer = await this.aiClient.generateResponse(`Explica la carrera ${action.terms[0]} usando la información de esta página.`,{
        context:{actionExperiences,explanationBlocks:blocks,pageResearch:[{kind:'pagina_actual',title:action.terms[0],source,detail:blocks}],sourceVisible:true,pageVisibleContent:[],navigationMenus:[]},messages:[]});
      this.hideTypingIndicator();
      const message = answer.reply;
      const indices=answer.raw?.sourceIndices;
      const evidenceTexts=[...new Set((Array.isArray(indices) ? indices : []).filter(Number.isInteger))]
        .map(index=>blocks[index]).filter(Boolean);
      window.chatHandler.conversationContext.lastExplanation = {path:location.pathname,answer:message,blocks:evidenceTexts};
      window.chatHandler.saveToSession();
      window.chatHandler.addAssistantMessage(message);
      await this.displayMessage(message,'assistant');
      if (!evidenceTexts.length) return {success:false,detail:'No se identificaron párrafos de respaldo para resaltar'};
      const evidenceAction={type:'showEvidence',terms:['texto de la ficha'],evidenceTexts};
      const result=await this.executeFlowAction(evidenceAction,context);
      window.chatHandler.recordActionOutcome(evidenceAction,result,context.userText || 'Explicar la carrera');
      if (result.success) this.addActionButtons({actions:[evidenceAction]});
      return {...result,detail:result.success ? 'Información explicada y párrafos de respaldo resaltados' : result.detail};
      } finally { this.hideTypingIndicator(); }
    }

    if (action.type === 'showEvidence') {
      const duration = Math.min(60000, Math.max(4500, Number(action.duration) || 10000));
      const normalize=value=>String(value || '').replace(/\s+/g,' ').trim();
      const wanted=new Set((action.evidenceTexts || []).map(normalize));
      const matches=this.getSourceParagraphElements()
        .filter(el=>wanted.has(normalize(el.textContent)));
      const highlighter=window.ducoHighlighter;
      highlighter.clearTermHighlights?.();
      for (const el of matches) highlighter.revealAncestorsForElement?.(el);
      if (matches.length) await this.sleep(300);
      const elements=matches.filter(el=>el.getClientRects().length);
      if (!elements.length) return {success:false,detail:'No se encontró el texto de respaldo en esta página'};
      await highlighter.guideToElement(elements[0]);
      highlighter.avoidChatPanelOverlap?.(elements[0],duration);
      const terms=[];
      for (const element of elements) {
        const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
        let node;
        while ((node=walker.nextNode())) if (node.nodeValue.trim().length>=3) terms.push(node.nodeValue.trim());
      }
      const count=highlighter.highlightByTerms(terms,{roots:elements,duration,autoGuide:false,maxMatches:200});
      return {success:count>0,detail:count ? 'Se destacaron los textos de la ficha' : 'No se pudo destacar el texto'};
    }

    if (action.careerCard && action.type === 'highlightTerms') {
      const input = document.querySelector('#carrera-search');
      const button = document.querySelector('.bc-btn-buscar');
      const normalize = value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      if (!input || !button) return {success:false,detail:'El buscador de carreras no está disponible'};
      input.value = action.terms[0];
      input.dispatchEvent(new Event('input',{bubbles:true}));
      button.click();
      // El buscador vuelve a pintar sus resultados tras 200 ms.
      await this.sleep(350);
      const title = [...document.querySelectorAll('#resultados-carreras h3')].find(el=>normalize(el.textContent) === normalize(action.terms[0]));
      const card = title?.closest('.bc-card, .bc-row') || title;
      if (!card || !card.getClientRects().length) return {success:false,detail:'La carrera no aparece en el buscador actual'};
      const highlighter = window.ducoHighlighter;
      if (!highlighter?.guideToElement || !highlighter?.highlight) return {success:false,detail:'El resaltador no está disponible'};
      await highlighter.guideToElement(card);
      highlighter.avoidChatPanelOverlap?.(card,action.duration || 6000);
      highlighter.highlight(card,action.duration || 6000,{guide:false});
      return {success:true,detail:'Ficha de carrera encontrada y destacada'};
    }

    if (action.type === 'proposeKnowledge') {
      let confirmation;
      try {
        const response = await fetch(this.knowledgeApiUrl('/api/duco/proposals'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: action.question, answer: action.answer, userName: this.userName || undefined })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo registrar la propuesta');
        confirmation = 'Se mandó a revisión.';
      } catch (error) {
        console.warn('[Duco] No se pudo enviar la propuesta de conocimiento:', error);
        confirmation = 'No pude guardar la propuesta. Abre Duco desde http://127.0.0.1:8765/duco con la aplicación local iniciada e inténtalo otra vez.';
      }
      window.chatHandler?.addAssistantMessage(confirmation);
      await this.displayMessage(confirmation, 'assistant');
      return;
    }

    if (action.type === 'clearHighlights') {
      window.ducoHighlightSystem?.clear?.();
      return { success: true, detail: 'Se limpiaron los resaltados activos' };
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
      document.querySelectorAll('.dropdown-toggle[aria-expanded="true"], [data-toggle="dropdown"][aria-expanded="true"], [data-bs-toggle="dropdown"][aria-expanded="true"]').forEach(el => {
        el.setAttribute('aria-expanded', 'false');
      });
      return { success: true, detail: 'Se cerraron los menús transitorios' };
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

      const resolved = this.resolveDropdownControl(action.terms, action.trigger || action.selector);
      const trigger = resolved?.trigger;

      if (trigger?.isConnected && !trigger.disabled && trigger.getAttribute('aria-disabled') !== 'true') {
        window.ducoHighlighter?.revealAncestorsForElement?.(trigger);
        const dropdownAction = {
          cleanFirst: false,
          trigger: typeof trigger === 'string' ? trigger : trigger,
          selector: typeof trigger === 'string' ? trigger : undefined,
          container: action.container,
          menu: resolved.menu,
          reveal: false,
          click: false,
          closeTransientUi: action.closeTransientUi !== false
        };
        const success = Boolean(window.ducoHighlightSystem?.openDropdown?.(dropdownAction));
        if (success) {
          await window.ducoHighlighter?.guideToElement?.(trigger);
          window.ducoHighlighter?.avoidChatPanelOverlap?.(resolved.menu, 0);
        }
        return {
          success,
          detail: success ? 'El menú se abrió' : 'No se encontró o no se pudo abrir el control del menú'
        };
      }
      return { success: false, detail: 'No se encontró un control para abrir el menú' };
    }

    if (action.type === 'scroll' || action.type === 'viewport' || action.type === 'move' || action.type === 'goto') {
      let targetEl = action.target || action.element || action.selector;
      if (!targetEl && action.terms?.length) {
        targetEl = this.findScrollTargetByTerms(action.terms);
        if (!targetEl) return { success: false, detail: 'No se encontró el destino del desplazamiento' };
      }

      if (targetEl) {
        const scrollTarget = typeof targetEl === 'string' ? document.querySelector(targetEl) : targetEl;
        if (scrollTarget?.isConnected) {
          if (window.ducoHighlighter?.guideToElement) {
            await window.ducoHighlighter.guideToElement(scrollTarget);
          } else {
            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return { success: true, detail: 'Se desplazó la página al elemento' };
        }
      } else if (window.ducoHighlightSystem?.scrollViewport) {
        const success = window.ducoHighlightSystem.scrollViewport(action) === true;
        return { success, detail: success ? 'Se desplazó la página' : 'No se encontró el destino del desplazamiento' };
      } else if (window.ducoHighlightSystem?.requestInteraction) {
        window.ducoHighlightSystem.requestInteraction(action);
        return { success: true, detail: 'Se solicitó el desplazamiento' };
      }
      return { success: false, detail: 'No se encontró el destino del desplazamiento' };
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
        return { success: true, detail: 'El elemento quedó resaltado' };
      }

      return { success: false, detail: 'No se encontró un elemento visible que coincida con el objetivo' };
    }

    if (action.type === 'highlightTerms') {
      if (action.scope === 'opened_menu' && !action.menuTrigger?.isConnected) {
        return { success: false, detail: 'No se encontró la opción solicitada dentro del menú' };
      }
      // Si una ventana abierta cubre la página, cerrarla antes de guiar hacia
      // un objetivo externo usando su propio botón de cierre.
      document.querySelectorAll('[role="dialog"][aria-modal="true"]:not([hidden])').forEach(dialog=>{
        const content=String(dialog.textContent || '').toLowerCase();
        if ((action.terms || []).some(term=>content.includes(String(term).toLowerCase()))) return;
        const close=[...dialog.querySelectorAll('button')].find(button=>/cerrar|close/i.test(button.getAttribute('aria-label') || ''));
        if (close && dialog.getClientRects().length) close.click();
      });
      if (action.menuTrigger?.isConnected) {
        const style = getComputedStyle(action.menuTrigger);
        if (!action.menuTrigger.getClientRects().length || style.visibility === 'hidden' || style.display === 'none') {
          return { success: false, detail: 'La opción del menú no está visible' };
        }
        // Elemento de contenido (no de menú) fuera de pantalla: primero se baja hasta él y se espera a que termine el desplazamiento;
        // si no, el resaltado se dibujaba durante el scroll y se borraba al terminar de moverse la página.
        if (action.guideFirst && window.ducoHighlighter.guideToElement) {
          await window.ducoHighlighter.guideToElement(action.menuTrigger);
          await this.sleep(350);
        }
        window.ducoHighlighter.highlight(action.menuTrigger, action.duration || 4500, {guide:false});
        window.ducoHighlighter.avoidChatPanelOverlap(action.menuElement || action.menuTrigger, 0);
        return {success:true, detail:action.guideFirst ? 'Se resaltó el título de la página' : 'Se resaltó el control del menú abierto'};
      }
      // El efecto necesita tiempo visible suficiente aunque el modelo proponga
      // una duración demasiado corta.
      action = { ...action, duration: Math.min(15000, Math.max(4500, Number(action.duration) || 4500)) };
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

      const highlighter = window.ducoHighlighter;
      // El contador visual empieza al llegar al destino, no durante el scroll.
      // Ambos caminos (automático y botón) pasan por esta misma preparación.
      if (action.autoGuide !== false && highlighter?.guideToElement) {
        highlighter.prepareContentForHighlight?.(terms, { openLimit: 3 });
        const guideTarget = this.findTextElementByTerms(terms);
        if (guideTarget) {
          highlighter.revealAncestorsForElement?.(guideTarget, { singleOpen: action.singleOpen === true });
          await highlighter.guideToElement(guideTarget);
          highlighter.avoidChatPanelOverlap?.(guideTarget, action.duration || 4500);
          action = { ...action, autoGuide: false };
        }
      }
      // Un plazo absoluto recibido del modelo puede haber vencido mientras se
      // escribía la respuesta; cada ejecución necesita su duración completa.
      action = { ...action, endAt: undefined };

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
          return { success: true, detail: 'El control de navegación quedó resaltado' };
        }
      }

      // Pintar también objetivos de una sola palabra. El efecto del contenedor
      // es solo un respaldo; un contorno no sustituye al marcador de texto.
      if (terms.length && window.ducoHighlighter?.highlightByTerms) {
        const exactCount = window.ducoHighlighter.highlightByTerms(terms, {
          styleVariant: 'background',
          duration: action.duration || 4500,
          endAt: action.endAt,
          maxMatches: action.maxMatches || 40,
          autoGuide: action.autoGuide !== false,
          openLimit: 3,
          singleOpen: action.singleOpen === true
        });
        if (exactCount > 0) {
          return { success: true, detail: `Se resaltó la frase completa en ${exactCount} coincidencia(s)` };
        }
      }

      // Preferir el elemento real del texto: además de ser más visible que un
      // cambio de color inline, evita que una frase coincidente solo desplace la página.
      const visibleTarget = this.findTextElementByTerms(phraseTerms.length ? phraseTerms : terms);
      if (visibleTarget && window.ducoHighlighter?.highlight) {
        window.ducoHighlighter.highlight(visibleTarget, action.duration || 4500, {
          guide: action.autoGuide !== false
        });
        return { success: true, detail: 'El texto quedó resaltado' };
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

        if (count > 0) {
          return { success: true, detail: `Se resaltaron ${count} coincidencias visibles` };
        }

        if (count === 0) {
          const fallbackTarget = this.findTextElementByTerms(terms);
          if (fallbackTarget && window.ducoHighlighter?.highlight) {
            window.ducoHighlighter.highlight(fallbackTarget, action.duration || 4500, {
              guide: action.autoGuide !== false
            });
            return { success: true, detail: 'El elemento coincidente quedó resaltado' };
          }

          const intentFromAction = action.intentKey || action.intent || null;
          const intentFromTerms = typeof window.navigationSystem?.detectIntent === 'function'
            ? window.navigationSystem.detectIntent(terms.join(' '))
            : null;

          const intentKey = intentFromAction || intentFromTerms;
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
            return { success: true, detail: 'La sección asociada a la intención quedó resaltada' };
          }

        }
      } else if (!terms.length) {
        console.warn('[Duco] highlightTerms: sin términos válidos');
      }

      return {
        success: false,
        detail: terms.length ? 'No se encontró contenido visible que coincidiera con el objetivo' : 'La acción no contenía un objetivo válido'
      };
    }

    if (action.type === 'sleep' && action.duration) {
      await this.sleep(action.duration);
    }
  }

  /**
   * Mostrar mensaje en el chat
   */
  async displayMessage(text, type = 'assistant', options = {}) {
    try {
      const messagesContainer = document.getElementById(this.messagesId);
      if (!messagesContainer) {
        console.error('[Duco] Contenedor de mensajes no encontrado');
        return;
      }

      // La respuesta ya apareció en streaming: se conserva ese elemento y solo se fija su texto final.
      if (type === 'assistant' && this._live && this._live.finalText === text) {
        const live = this._live;
        this._live = null;
        live.el.classList.remove('duco-message-live');
        this.linkifyAssistantMessage(live.contentEl, text);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return live.el;
      }

      const messageEl = document.createElement('div');
      messageEl.className = `duco-message duco-message-${type}`;
      if (options.action) messageEl.classList.add('duco-message-action');
      if (options.guidedStep) messageEl.dataset.guidedStep = String(options.guidedStep);

      const contentEl = document.createElement('div');
      contentEl.className = 'duco-message-content';

      messageEl.appendChild(contentEl);
      messagesContainer.appendChild(messageEl);

      if (type === 'assistant' && !options.instant) {
        await this.typewriteMessage(contentEl, text, messagesContainer);
      } else if (type === 'assistant') {
        this.linkifyAssistantMessage(contentEl, text);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      } else {
        contentEl.textContent = text;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      return messageEl;
    } catch (error) {
      console.error('[Duco] Error mostrando mensaje:', error);
      return null;
    }
  }

  addFeedbackControls(messageElement, interaction) {
    const controls = document.createElement('div');
    controls.className = 'duco-feedback-controls';
    const label = document.createElement('span');
    label.textContent = '¿Te sirvió esta respuesta?';
    const buttons = document.createElement('div');
    buttons.className = 'duco-feedback-buttons';
    const status = document.createElement('span');
    status.className = 'duco-feedback-status';
    status.setAttribute('role', 'status');

    for (const [rating, text, labelText] of [[1, '👍', 'Sí, me sirvió'], [-1, '👎', 'No me sirvió']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'duco-feedback-btn';
      button.textContent = text;
      button.setAttribute('aria-label', labelText);
      button.title = labelText;
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        buttons.querySelectorAll('button').forEach(item => item.disabled = true);
        status.textContent = 'Guardando valoración…';
        try {
          const response = await fetch(this.knowledgeApiUrl('/api/duco/feedback'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...interaction, rating })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'No se pudo guardar la valoración');
          if (rating < 0) {
            status.textContent = 'Valoración registrada.';
          } else if (result.proposalStatus === 'created') {
            status.textContent = 'Se mandó a revisión.';
          } else {
            status.textContent = 'Valoración registrada.';
          }
        } catch (error) {
          console.warn('[Duco] No se pudo registrar la valoración:', error);
          status.textContent = 'No se pudo guardar. Comprueba que la administración local siga iniciada e inténtalo otra vez.';
          buttons.querySelectorAll('button').forEach(item => item.disabled = false);
        }
      });
      buttons.appendChild(button);
    }
    controls.append(label, buttons, status);
    const bubble = messageElement.querySelector('.duco-message-content');
    (bubble || messageElement).appendChild(controls);
  }

  /**
   * Efecto de escritura para mensajes del asistente
   */
  async typewriteMessage(contentEl, text, messagesContainer) {
    if (this.typewriterSpeed <= 0) {
      this.linkifyAssistantMessage(contentEl, text);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }
    let currentText = '';

    const maxChars = Math.min(text.length, 2000);
    for (let i = 0; i < maxChars; i++) {
      if (!contentEl.isConnected) return;
      const char = text[i];
      currentText += char;
      this.linkifyAssistantMessage(contentEl, currentText);

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      await this.sleep(this.typewriterSpeed);
    }
    if (contentEl.isConnected) this.linkifyAssistantMessage(contentEl, text);
  }

  /** Renderiza negritas y URLs como nodos seguros, nunca como HTML del modelo. */
  linkifyAssistantMessage(element, text) {
    const value = String(text || '');
    const fragment = document.createDocumentFragment();
    const appendLinks = (parent, content) => {
      const urlPattern = /https?:\/\/[^\s<>{}"'*]+/gi;
      let offset = 0;
      let match;
      while ((match = urlPattern.exec(content))) {
        let rawUrl = match[0];
        const trailing = rawUrl.match(/[),.;!?]+$/)?.[0] || '';
        rawUrl = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
        let parsed;
        try { parsed = new URL(rawUrl); } catch { continue; }
        if (!['http:', 'https:'].includes(parsed.protocol)) continue;
        parent.append(document.createTextNode(content.slice(offset, match.index)));
        const anchor = document.createElement('a');
        anchor.href = parsed.href;
        anchor.textContent = rawUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        parent.append(anchor, document.createTextNode(trailing));
        offset = match.index + match[0].length;
      }
      parent.append(document.createTextNode(content.slice(offset)));
    };
    const boldPattern = /\*\*(?=\S)([\s\S]*?\S)\*\*/g;
    let offset = 0;
    let match;
    while ((match = boldPattern.exec(value))) {
      appendLinks(fragment, value.slice(offset, match.index));
      const strong = document.createElement('strong');
      appendLinks(strong, match[1]);
      fragment.append(strong);
      offset = match.index + match[0].length;
    }
    appendLinks(fragment, value.slice(offset));
    element.replaceChildren(fragment);
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
  showTypingIndicator(label = '') {
    const indicator = document.getElementById(this.typingIndicatorId);
    if (indicator) {
      const text = indicator.querySelector('.duco-typing-label');
      if (text) { text.textContent = label; text.hidden = !label; }
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
      try {
        if (window.chatHandler && window.chatHandler.messages.length === 0) {
          const welcome = '¡Hola! 👋 Soy Duco, tu asistente virtual de Duoc UC. ¿Cómo puedo ayudarte hoy?';
          window.chatHandler.addAssistantMessage(welcome);
          this.displayMessage(welcome, 'assistant');
        } else if (window.chatHandler && window.chatHandler.messages.length > 0) {
          const messagesContainer = document.getElementById(this.messagesId);
          if (messagesContainer) {
            messagesContainer.innerHTML = '';
            for (const msg of window.chatHandler.messages) {
              if (msg.type === 'user') {
                this.displayMessage(msg.text, 'user');
              } else {
                const messageEl = document.createElement('div');
                messageEl.className = `duco-message duco-message-assistant${msg.category === 'action' ? ' duco-message-action' : ''}`;
                const contentEl = document.createElement('div');
                contentEl.className = 'duco-message-content';
                this.linkifyAssistantMessage(contentEl, msg.text);
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
  }

  /**
   * Encuentra enlaces/botones por múltiples términos (exacto o parcial).
   */
  findButtonOrLinkByTerms(terms) {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedTerms = (terms || []).map(normalize).filter(term => term.length >= 3);

    if (!normalizedTerms.length) return null;

    const candidates = Array.from(document.querySelectorAll('a, button, [role="button"]'))
      .filter(el => !el.closest('#duco-assistant-container'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map(el => ({ el, text: normalize(el.innerText || el.textContent) }))
      .filter(candidate => candidate.text)
      .sort((a, b) => a.text.length - b.text.length);

    const words = normalizedTerms.flatMap(term => term.split(' ')).filter(word => word.length >= 3);
    const phraseTerms = normalizedTerms.filter(term => term.includes(' '));

    for (const term of [...phraseTerms].sort((a, b) => b.length - a.length)) {
      const phraseMatch = candidates.find(candidate => candidate.text.includes(term));
      if (phraseMatch) return phraseMatch.el;
    }

    if (words.length > 1) {
      const allWordsMatch = candidates.find(candidate => words.every(word => candidate.text.includes(word)));
      if (allWordsMatch) return allWordsMatch.el;
    }

    for (const term of [...normalizedTerms].sort((a, b) => b.length - a.length)) {
      const exactMatch = candidates.find(candidate => candidate.text === term);
      if (exactMatch) return exactMatch.el;
    }

    for (const term of [...normalizedTerms].sort((a, b) => b.length - a.length)) {
      const phraseMatch = candidates.find(candidate => candidate.text.includes(term));
      if (phraseMatch) return phraseMatch.el;
    }

    for (const term of normalizedTerms) {
      const partialMatch = candidates.find(candidate => candidate.text.includes(term));
      if (partialMatch) return partialMatch.el;
    }

    return null;
  }

  describeHighlightTarget(terms) {
    // La etiqueta describe los objetivos solicitados, nunca el texto completo
    // del contenedor DOM que también puede contener botones o enlaces.
    return terms.join(' y ');
  }

  getElementContentText(element) {
    if (!element) return '';
    const copy = element.cloneNode(true);
    const sourceNodes = [...element.querySelectorAll('*')];
    const copiedNodes = [...copy.querySelectorAll('*')];
    sourceNodes.forEach((source, index) => {
      const style = getComputedStyle(source);
      if (source.hidden || style.display === 'none' || style.visibility === 'hidden') copiedNodes[index]?.remove();
    });
    if (!element.matches('a, button, input, select, [role="button"], [role="link"], [role="menuitem"]')) {
      copy.querySelectorAll('a, button, input, select, [role="button"], [role="link"], [role="menuitem"]').forEach(control => control.remove());
    }
    return String(copy.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Busca un elemento de texto visible por términos, no solo botones o enlaces.
   */
  findScrollTargetByTerms(terms) {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const phrases = terms.map(normalize).filter(Boolean);
    // A fixed navbar can be outside view while its controls still identify the destination.
    const navigation = [...document.querySelectorAll('header a, header button, nav a, nav button')]
      .filter(el => !el.closest('#duco-assistant-container, .dropdown-menu') && el.getClientRects().length &&
        getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
    const namedControl = navigation.find(el => phrases.includes(normalize(this.getElementContentText(el))));
    if (namedControl) return namedControl;
    const flatTerms = terms.flatMap(t => t.includes(' ') ? t.split(/\s+/) : [t]);
    const normalized = flatTerms.map(normalize).filter(t => t.length >= 3);
    if (!normalized.length) return null;

    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5'))
      .filter(h => !h.closest('#duco-assistant-container'))
      .filter(h => {
        const rect = h.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

    for (const term of normalized) {
      const match = headings.find(h => normalize(h.textContent).includes(term));
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
        const match = contentTextEls.find(el => !el.closest('#duco-assistant-container') && normalize(el.textContent).includes(term));
        if (match) return match;
      }
    }

    return null;
  }

  findTextElementByTerms(terms) {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedTerms = (terms || []).map(normalize).filter(term => term.length >= 3);

    if (!normalizedTerms.length) return null;

    const candidates = Array.from(document.querySelectorAll('a, button, li, p, span, div, h1, h2, h3, h4, h5, h6'))
      .filter((el) => el && el.textContent)
      .filter((el) => !el.closest('#duco-assistant-container'))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map(el => ({ el, text: normalize(this.getElementContentText(el)) }))
      .sort((a, b) => a.text.length - b.text.length);

    const words = normalizedTerms.flatMap(term => term.split(' ')).filter(word => word.length >= 3);
    const phraseTerms = normalizedTerms.filter(term => term.includes(' '));
    if (words.length > 1) {
      const allWordsMatch = candidates.find(candidate => words.every(word => candidate.text.includes(word)));
      if (allWordsMatch) return allWordsMatch.el;
    }

    const termsBySpecificity = [...normalizedTerms].sort((a, b) => b.length - a.length);

    for (const term of termsBySpecificity) {
      const exactMatch = candidates.find(candidate => candidate.text.trim() === term);
      if (exactMatch) return exactMatch.el;
    }

    for (const term of termsBySpecificity) {
      const partialMatch = candidates.find(candidate => candidate.text.includes(term));
      if (partialMatch) return partialMatch.el;
    }

    for (const term of phraseTerms) {
      const closest = this.findClosestVisiblePhrase(term);
      if (closest) return closest.el;
    }

    // No reducir una frase a su primera palabra coincidente: eso causa falsos
    // resaltados cuando el modelo cambia u omite una palabra del objetivo.
    if (phraseTerms.length) return null;

    for (const word of words) {
      const partialMatch = candidates.find(candidate => candidate.text.includes(word));
      if (partialMatch) return partialMatch.el;
    }

    return null;
  }

  findClosestVisiblePhrase(term) {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const target = normalize(term);
    const targetWordCount = (String(term).match(/[\p{L}\p{N}]+/gu) || []).length;
    if (target.length < 10 || target.length > 120 || targetWordCount < 2) return null;

    const candidates = Array.from(document.querySelectorAll('a, button, li, p, span, div, h1, h2, h3, h4, h5, h6'))
      .filter(el => el && el.textContent && !el.closest('#duco-assistant-container'))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map(el => ({ el, text: this.getElementContentText(el) }))
      .filter(candidate => candidate.text.length >= target.length - 4 && candidate.text.length <= 240)
      .sort((a, b) => a.text.length - b.text.length);

    let best = null;
    const maxDistance = Math.max(1, Math.floor(target.length * 0.08));
    for (const candidate of candidates) {
      const tokens = [...candidate.text.matchAll(/[\p{L}\p{N}]+/gu)];
      for (let start = 0; start <= tokens.length - targetWordCount; start++) {
        const first = tokens[start];
        const last = tokens[start + targetWordCount - 1];
        const phrase = candidate.text.slice(first.index, last.index + last[0].length);
        const distance = this.getEditDistance(target, normalize(phrase));
        if (distance > maxDistance) continue;
        if (!best || distance < best.distance ||
            (distance === best.distance && candidate.text.length < best.candidateLength)) {
          best = { el: candidate.el, text: phrase, distance, candidateLength: candidate.text.length };
        }
      }
    }
    return best;
  }

  getEditDistance(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i++) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= right.length; j++) {
        const above = previous[j];
        previous[j] = Math.min(
          previous[j] + 1,
          previous[j - 1] + 1,
          diagonal + (left[i - 1] === right[j - 1] ? 0 : 1)
        );
        diagonal = above;
      }
    }
    return previous[right.length];
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
