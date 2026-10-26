/**
 * Sistema de Destacado Visual para Elementos
 * Proporciona efectos visuales para guiar al usuario a elementos importantes
 */

class UIHighlighter {
  constructor() {
    this.highlightedElement = null;
    this.pageHighlightTimers = [];
    this.fadeOutDuration = 700;
    this.guidedScrollCooldown = 900;
    this.lastGuidedScrollAt = 0;
    this.guidedScrollRunning = false;
    this.guidedScrollPendingTarget = null;
    this.guidedScrollSettleDelay = 140;
    this.guidedScrollMaxWaitMs = 2600;
    this.scrollLocked = false;
    this.scrollBlockHandlers = [];
    this.panelRestoreTimer = null;
    this.panelBaseInlineStyle = null;
    this.transientDropdownState = new Map();
    this.transientCollapseState = new Map();
    this.transientDetailsState = new Set();
    this.transientUiCloseTimer = null;
    this.transientUiCloseAt = 0;
    this.highlightStyle = document.createElement('style');
    this.setupStyles();
  }

  /**
   * Configura los estilos CSS para el destacado
   */
  setupStyles() {
    this.highlightStyle.id = 'duco-highlight-styles';
    this.highlightStyle.textContent = `
      .duco-highlight {
        position: relative !important;
        z-index: 2147483646 !important;
        isolation: isolate !important;
      }

      .duco-highlight::before {
        content: '';
        position: absolute;
        top: -10px;
        left: -10px;
        right: -10px;
        bottom: -10px;
        border: 3px solid #FFB800;
        border-radius: 8px;
        box-shadow: 0 0 0 4px rgba(255, 184, 0, 0.2);
        animation: duco-pulse 2s ease-in-out infinite;
        pointer-events: none;
        z-index: 2147483646 !important;
      }

      nav .duco-highlight::before,
      .navbar .duco-highlight::before,
      .header .duco-highlight::before {
        box-shadow: 0 0 0 4px rgba(255, 184, 0, 0.4),
                    0 0 12px rgba(255, 184, 0, 0.6);
        border-width: 4px;
      }

      @keyframes duco-pulse {
        0% {
          box-shadow: 0 0 0 4px rgba(255, 184, 0, 0.2), 
                      0 0 0 8px rgba(255, 184, 0, 0.1);
        }
        50% {
          box-shadow: 0 0 0 8px rgba(255, 184, 0, 0.3), 
                      0 0 0 12px rgba(255, 184, 0, 0.15);
        }
        100% {
          box-shadow: 0 0 0 4px rgba(255, 184, 0, 0.2), 
                      0 0 0 8px rgba(255, 184, 0, 0.1);
        }
      }

      .duco-glow {
        animation: duco-glow 2s ease-in-out infinite !important;
      }

      @keyframes duco-glow {
        0%, 100% {
          filter: drop-shadow(0 0 5px rgba(255, 184, 0, 0.5));
        }
        50% {
          filter: drop-shadow(0 0 15px rgba(255, 184, 0, 0.8));
        }
      }

      .duco-highlight-arrow {
        position: fixed;
        width: 0;
        height: 0;
        border-left: 15px solid transparent;
        border-right: 15px solid transparent;
        border-top: 20px solid #FFB800;
        border-bottom: none;
        animation: duco-bounce 1.5s ease-in-out infinite;
        z-index: 2147483647 !important;
        pointer-events: none;
        filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
        transition: opacity 0.3s ease;
      }

      @keyframes duco-bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-20px);
        }
      }

      .duco-page-highlight {
        display: inline;
        vertical-align: baseline;
        line-height: inherit;
        transition: all 0.25s ease;
      }

      .duco-page-highlight-grow {
        font-weight: 700;
        text-decoration: underline;
        text-decoration-color: rgba(255, 184, 0, 0.75);
        text-decoration-thickness: 2px;
      }

      .duco-page-highlight-bg {
        background: rgba(255, 184, 0, 0.42);
        color: inherit;
        border-radius: 0.35em;
        box-shadow: inset 0 -0.52em 0 rgba(255, 184, 0, 0.24);
        text-decoration: none;
      }

      .duco-page-highlight-text {
        color: #035bb3;
        font-weight: 700;
      }

      .duco-page-highlight-combo {
        color: #035bb3;
        background: rgba(255, 184, 0, 0.35);
        border-radius: 0.35em;
        box-shadow: inset 0 -0.52em 0 rgba(255, 184, 0, 0.2);
        font-weight: 700;
      }

      .duco-page-text-highlight-grow {
        transition: all 0.25s ease;
        font-weight: 700;
        text-decoration: underline;
        text-decoration-color: rgba(255, 184, 0, 0.75);
        text-decoration-thickness: 2px;
      }

      .duco-page-text-highlight-bg {
        transition: background-color 0.25s ease;
        background-color: rgba(255, 184, 0, 0.2) !important;
        border-radius: 0.25em;
        box-shadow: inset 0 -0.45em 0 rgba(255, 184, 0, 0.18);
      }

      .duco-page-text-highlight-text {
        transition: color 0.25s ease;
        color: #035bb3 !important;
      }

      .duco-page-text-highlight-combo {
        transition: all 0.25s ease;
        background-color: rgba(255, 184, 0, 0.2) !important;
        border-radius: 0.25em;
        box-shadow: inset 0 -0.45em 0 rgba(255, 184, 0, 0.16);
        color: #035bb3 !important;
        font-weight: 700;
      }

      .duco-option-highlight {
        outline: 2px solid rgba(255, 184, 0, 0.9);
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(255, 184, 0, 0.2);
        border-radius: 6px;
        transition: all 0.25s ease;
      }

      .duco-option-highlight-fade-out {
        outline-color: rgba(255, 184, 0, 0) !important;
        box-shadow: none !important;
        transition: box-shadow 0.7s ease, outline-color 0.7s ease !important;
      }

      .duco-highlight-fade-out {
        background: transparent !important;
        color: inherit !important;
        transform: none !important;
        font-weight: inherit !important;
        box-shadow: none !important;
        transition: all 0.7s ease !important;
      }

      .duco-page-element-fade-out {
        background-color: transparent !important;
        color: inherit !important;
        transform: none !important;
        box-shadow: none !important;
        transition: all 0.7s ease !important;
      }

      .duco-transient-ui-fade-out {
        opacity: 0 !important;
        transition: opacity 0.22s ease !important;
      }
    `;

    if (!document.head.querySelector('#duco-highlight-styles')) {
      document.head.appendChild(this.highlightStyle);
    }
  }

  /**
   * Destaca un elemento con efecto de pulso
   * @param {HTMLElement|string} element - El elemento o selector a destacar
   * @param {number} duration - Duración del destacado en ms (0 = indefinido)
   */
  highlight(element, duration = 3000, options = {}) {
    // Limpiar destacado anterior
    this.removeHighlight();

    // Obtener elemento si es string
    const target = typeof element === 'string' 
      ? document.querySelector(element) 
      : element;

    if (!target) {
      console.warn('Elemento no encontrado para destacar');
      return;
    }

    this.highlightedElement = target;
    target.classList.add('duco-highlight', 'duco-glow');
    this.avoidChatPanelOverlap(target, duration);

    const { guide = true, closeTransientUi = false } = options;

    if (guide !== false) {
      this.guideToElement(target);
    }

    // Auto remover si se especifica duración
    if (duration > 0) {
      if (closeTransientUi) {
        this.scheduleTransientUiClose(duration + this.fadeOutDuration);
      }
      setTimeout(() => this.removeHighlight(), duration);
    }
  }

  /**
   * Quita el destacado del elemento actual
   */
  removeHighlight() {
    if (this.highlightedElement) {
      this.highlightedElement.classList.remove('duco-highlight', 'duco-glow');
      this.highlightedElement = null;
    }
  }

  /**
   * Limpia el estado visual temporal para dejar la página sin resaltados activos.
   */
  clearAllHighlights() {
    this.removeHighlight();
    this.closeTransientUi();
    this.pageHighlightTimers.forEach((timerId) => clearTimeout(timerId));
    this.pageHighlightTimers = [];
    document.querySelectorAll('.duco-highlight, .duco-glow, .duco-option-highlight, .duco-option-highlight-fade-out, .duco-page-element-fade-out').forEach((element) => {
      element.classList.remove('duco-highlight', 'duco-glow', 'duco-option-highlight', 'duco-option-highlight-fade-out', 'duco-page-element-fade-out');
    });
    document.querySelectorAll('.duco-page-highlight, .duco-page-highlight-grow, .duco-page-highlight-bg, .duco-page-highlight-text, .duco-page-highlight-combo, .duco-page-text-highlight-grow, .duco-page-text-highlight-bg, .duco-page-text-highlight-text, .duco-page-text-highlight-combo').forEach((element) => {
      element.classList.remove(
        'duco-page-highlight',
        'duco-page-highlight-grow',
        'duco-page-highlight-bg',
        'duco-page-highlight-text',
        'duco-page-highlight-combo',
        'duco-page-text-highlight-grow',
        'duco-page-text-highlight-bg',
        'duco-page-text-highlight-text',
        'duco-page-text-highlight-combo'
      );
    });
  }

  /**
   * Devuelve las capacidades disponibles para la IA.
   */
  getCapabilities() {
    return {
      requestTypes: ['element', 'terms', 'page', 'phone', 'sequence', 'dropdown', 'collapse', 'menu', 'scroll', 'viewport', 'move', 'goto'],
      styleVariants: ['background', 'grow', 'text', 'combo'],
      supportsAutoGuide: true,
      supportsSingleOpen: true,
      supportsDuration: true,
      supportsDropdowns: true,
      supportsViewportControl: true
    };
  }

  /**
   * Normaliza una solicitud de resaltado generada por IA.
   * @param {Object} request - Solicitud declarativa.
   * @returns {Object|null}
   */
  normalizeHighlightRequest(request = {}) {
    if (!request || typeof request !== 'object') return null;

    const rawType = String(request.type || request.mode || '').trim().toLowerCase();
    const typeAliases = {
      'whole-page': 'page',
      'full-page': 'page',
      'page-text': 'page',
      'page-highlight': 'page',
      'text': 'terms',
      'words': 'terms',
      'term': 'terms',
      'terms': 'terms',
      'element': 'element',
      'target': 'element',
      'selector': 'element',
      'phone-number': 'phone',
      'phone': 'phone',
      'sequence': 'sequence',
      'steps': 'sequence'
    };
    const type = typeAliases[rawType] || rawType;
    const styleVariant = ['background', 'grow', 'text', 'combo'].includes(request.styleVariant)
      ? request.styleVariant
      : 'background';

    return {
      type,
      targetSelector: request.targetSelector || request.selector || null,
      targetTextTerms: Array.isArray(request.targetTextTerms) ? request.targetTextTerms : (Array.isArray(request.textTerms) ? request.textTerms : []),
      terms: Array.isArray(request.terms) ? request.terms : (Array.isArray(request.phrases) ? request.phrases : []),
      duration: Number.isFinite(request.duration) ? request.duration : 4500,
      highlightDuration: Number.isFinite(request.highlightDuration) ? request.highlightDuration : undefined,
      endAt: Number.isFinite(request.endAt) ? request.endAt : undefined,
      layoutSafe: request.layoutSafe !== false,
      styleVariant,
      autoGuide: request.autoGuide !== false,
      guide: request.guide !== false,
      closeTransientUi: request.closeTransientUi !== false,
      singleOpen: request.singleOpen === true,
      openLimit: Number.isFinite(request.openLimit) ? request.openLimit : undefined,
      maxMatches: Number.isFinite(request.maxMatches) ? request.maxMatches : undefined,
      actionDelay: Number.isFinite(request.actionDelay) ? request.actionDelay : undefined,
      afterHighlightDelay: Number.isFinite(request.afterHighlightDelay) ? request.afterHighlightDelay : undefined
    };
  }

  /**
   * Punto de entrada estable para que la IA pida un resaltado.
   * @param {Object} request - Solicitud declarativa.
   * @returns {Promise<Object|number|null>}
   */
  async requestHighlight(request = {}) {
    const normalized = this.normalizeHighlightRequest(request);
    if (!normalized || !normalized.type) return null;

    if (normalized.closeTransientUi) {
      this.closeTransientUi();
    }

    switch (normalized.type) {
      case 'element': {
        const targetElement = normalized.targetSelector
          ? document.querySelector(normalized.targetSelector)
          : this.findTextElementByTerms(normalized.targetTextTerms);

        if (!targetElement) return null;

        if (this.revealAncestorsForElement) {
          this.revealAncestorsForElement(targetElement, { singleOpen: normalized.singleOpen });
        }

        this.highlight(targetElement, normalized.duration, { guide: normalized.guide });
        return { type: 'element', success: true };
      }

      case 'terms': {
        const terms = normalized.terms
          .map((term) => String(term || '').trim())
          .filter((term) => term.length >= 3);

        if (!terms.length) return null;

        const styleVariant = normalized.layoutSafe ? 'background' : normalized.styleVariant;

        const matches = this.highlightByTerms(terms, {
          styleVariant,
          duration: normalized.duration,
          endAt: normalized.endAt,
          maxMatches: normalized.maxMatches || 160,
          autoGuide: normalized.autoGuide,
          openLimit: normalized.singleOpen ? 1 : normalized.openLimit,
          singleOpen: normalized.singleOpen
        });

        return { type: 'terms', success: matches > 0, matches };
      }

      case 'page': {
        const styleVariant = normalized.layoutSafe ? 'background' : normalized.styleVariant;
        const matches = this.highlightWholePageText({
          styleVariant,
          duration: normalized.duration,
          endAt: normalized.endAt,
          autoGuide: normalized.autoGuide
        });

        return { type: 'page', success: matches > 0, matches };
      }

      case 'phone': {
        const styleVariant = normalized.layoutSafe ? 'background' : normalized.styleVariant;
        const matches = this.highlightPhoneNumbers({
          styleVariant,
          duration: normalized.duration,
          endAt: normalized.endAt,
          maxMatches: normalized.maxMatches || 100,
          autoGuide: normalized.autoGuide
        });

        return { type: 'phone', success: matches > 0, matches };
      }

      case 'sequence':
        if (Array.isArray(request.steps) && request.steps.length) {
          for (const step of request.steps) {
            await this.requestHighlight(step);
            if (Number.isFinite(step?.pauseAfter) && step.pauseAfter > 0) {
              await new Promise((resolve) => setTimeout(resolve, step.pauseAfter));
            }
          }
          return { type: 'sequence', success: true };
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Crea una flecha animada que apunta a un elemento
   * @param {HTMLElement|string} targetElement - El elemento objetivo
   * @param {number} duration - Duración en ms
   */
  createArrowPointer(targetElement, duration = 5000) {
    const target = typeof targetElement === 'string'
      ? document.querySelector(targetElement)
      : targetElement;

    if (!target) return;

    const arrow = document.createElement('div');
    arrow.className = 'duco-highlight-arrow';
    arrow.style.opacity = '0';

    const updateArrowPosition = () => {
      const rect = target.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      let arrowX = rect.left + rect.width / 2 - 15;
      let arrowY;

      if (rect.top > 60) {
        arrowY = rect.top - 30;
        arrow.style.transform = 'rotate(180deg)';
        arrow.style.borderTop = '20px solid #FFB800';
        arrow.style.borderBottom = 'none';
      } else {
        arrowY = rect.bottom + 10;
        arrow.style.transform = 'rotate(0deg)';
        arrow.style.borderBottom = '20px solid #FFB800';
        arrow.style.borderTop = 'none';
      }

      arrow.style.left = arrowX + 'px';
      arrow.style.top = arrowY + 'px';
      arrow.style.opacity = '1';
    };

    updateArrowPosition();
    const resizeListener = () => updateArrowPosition();
    const scrollListener = () => updateArrowPosition();
    window.addEventListener('resize', resizeListener);
    window.addEventListener('scroll', scrollListener);

    document.body.appendChild(arrow);

    setTimeout(() => {
      arrow.remove();
      window.removeEventListener('resize', resizeListener);
      window.removeEventListener('scroll', scrollListener);
    }, duration);
  }

  /**
   * Destaca múltiples elementos con efecto secuencial
   * @param {Array} selectors - Array de selectores
   * @param {number} delay - Delay entre elementos en ms
   */
  highlightSequence(selectors, delay = 2000) {
    selectors.forEach((selector, index) => {
      setTimeout(() => {
        this.highlight(selector, delay - 500);
      }, index * delay);
    });
  }

  /**
   * Parpadeo rápido en un elemento (efecto "llamada de atención")
   * @param {HTMLElement|string} element - El elemento
   * @param {number} flashes - Número de parpadeos
   */
  blink(element, flashes = 3) {
    const target = typeof element === 'string' 
      ? document.querySelector(element) 
      : element;

    if (!target) return;

    let count = 0;
    const interval = setInterval(() => {
      target.style.opacity = target.style.opacity === '0' ? '1' : '0';
      count++;

      if (count >= flashes * 2) {
        clearInterval(interval);
        target.style.opacity = '1';
      }
    }, 200);
  }

  /**
   * Resalta coincidencias de texto en toda la página por un tiempo limitado.
   * @param {string[]} terms - Términos a buscar
   * @param {Object} options - Configuración del resaltado
   */
  highlightByTerms(terms = [], options = {}) {
    const normalizedTerms = terms
      .filter(Boolean)
      .map((term) => String(term).trim())
      .filter((term) => term.length >= 3)
      .flatMap((term) => {
        if (term.includes(' ') || term.includes('-')) {
          return [term, ...term.split(/[\s\-]+/).filter(w => w.length >= 3)];
        }
        return [term];
      });

    const uniqueTerms = [...new Set(normalizedTerms)];
    if (!uniqueTerms.length) return 0;

    const {
      duration = 5000,
      styleVariant = 'background',
      maxMatches = 40,
      autoGuide = true,
      openLimit = Infinity,
      singleOpen = false,
      closeTransientUi = false
    } = options;
    const effectiveDuration = this.resolveDuration(duration, options.endAt);
    const limitAncestorsToOne = singleOpen || openLimit === 1;

    this.prepareContentForHighlight(uniqueTerms, { openLimit });

    const regex = new RegExp(`(${uniqueTerms.map((term) => this.escapeRegExp(term)).join('|')})`, 'gi');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => this.acceptTextNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    });

    let totalMatches = 0;
    const createdHighlights = [];
    const optionContainers = new Set();
    let currentNode = walker.nextNode();
    let stopAfterFirstMatch = false;

    while (currentNode && totalMatches < maxMatches && !stopAfterFirstMatch) {
      const result = this.wrapMatchesInTextNode(currentNode, regex, styleVariant, maxMatches - totalMatches);
      totalMatches += result.matches;
      createdHighlights.push(...result.highlights);
      result.highlights.forEach((span) => {
        this.revealAncestorsForElement(span, { singleOpen: limitAncestorsToOne });
        const optionContainer = this.findOptionContainer(span);
        if (optionContainer) {
          optionContainer.classList.add('duco-option-highlight');
          optionContainers.add(optionContainer);

          // Si ya estamos marcando el control (botón/link/card), no duplicar con highlight en el texto.
          span.classList.remove(
            'duco-page-highlight-bg',
            'duco-page-highlight-grow',
            'duco-page-highlight-text',
            'duco-page-highlight-combo'
          );
        }
      });

      if (limitAncestorsToOne && result.matches > 0) {
        stopAfterFirstMatch = true;
      }

      currentNode = walker.nextNode();
    }

    if (totalMatches > maxMatches * 0.8) {
      console.warn(`[Duco] highlightByTerms: ${totalMatches} coincidencias (límite ${maxMatches}). Términos muy genéricos.`);
    }

    if (createdHighlights.length) {
      const guideCandidates = optionContainers.size ? Array.from(optionContainers) : createdHighlights;
      const guideTarget = this.getBestGuideTarget(guideCandidates);
      if (autoGuide) {
        this.guideToElement(guideTarget);
        this.avoidChatPanelOverlap(guideTarget, effectiveDuration);
      }
    }

    if (createdHighlights.length && effectiveDuration > 0) {
      this.scheduleCleanup(() => {
        this.fadeOutSpanHighlights(createdHighlights);
        this.fadeOutElements(Array.from(optionContainers), 'duco-option-highlight');
      }, effectiveDuration, { closeTransientUi });
    }

    return totalMatches;
  }

  /**
   * Resalta los textos visibles de la página completa de forma temporal.
   * @param {Object} options - Configuración del resaltado
   */
  highlightWholePageText(options = {}) {
    const {
      duration = 4500,
      styleVariant = 'background',
      maxElements = 250,
      autoGuide = true,
      closeTransientUi = false
    } = options;
    const effectiveDuration = this.resolveDuration(duration, options.endAt);

    const className = this.getPageTextClass(styleVariant);
    const selector = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'li', 'a', 'span', 'strong', 'em', 'small',
      'td', 'th', 'label', 'button'
    ].join(',');

    const candidates = Array.from(document.querySelectorAll(selector))
      .filter((el) => this.shouldHighlightElement(el))
      .slice(0, maxElements);

    candidates.forEach((el) => el.classList.add(className));

    if (candidates.length) {
      const guideTarget = this.getBestGuideTarget(candidates);
      if (autoGuide) {
        this.guideToElement(guideTarget);
        this.avoidChatPanelOverlap(guideTarget, effectiveDuration);
      }
    }

    if (candidates.length && effectiveDuration > 0) {
      this.scheduleCleanup(() => {
        this.fadeOutElements(candidates, className);
      }, effectiveDuration, { closeTransientUi });
    }

    return candidates.length;
  }

  /**
   * Resalta números telefónicos visibles y enlaces tel:/whatsapp en la página.
   * @param {Object} options - Configuración del resaltado
   */
  highlightPhoneNumbers(options = {}) {
    const {
      duration = 8000,
      styleVariant = 'background',
      maxMatches = 80,
      autoGuide = true,
      closeTransientUi = false
    } = options;
    const effectiveDuration = this.resolveDuration(duration, options.endAt);

    this.prepareContentForHighlight(['telefono', 'telefonos', 'contacto', 'whatsapp', 'admision']);

    const createdHighlights = [];
    const elementClass = this.getPageTextClass(styleVariant);
    const matchedTextElements = [];
    const contactLinks = Array.from(document.querySelectorAll('a[href^="tel:"], a[href*="whatsapp"], a[href*="wa.me"]'))
      .filter((el) => this.shouldHighlightElement(el) && this.isTextOnlyElement(el));

    // Solo aplicar resaltado de elemento a links claramente textuales para evitar pintar cards completas.
    contactLinks
      .filter((el) => {
        const text = (el.textContent || '').trim();
        return text.length > 0 && text.length <= 90;
      })
      .forEach((el) => {
        el.classList.add(elementClass);
      });

    const phoneRegex = /((?:\(\+\d{1,3}\)|\+\d{1,3})?[\s\u00A0.-]*(?:\d[\s\u00A0().-]*){8,14}\d)/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => this.acceptTextNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    });

    let totalMatches = contactLinks.length;
    let currentNode = walker.nextNode();

    while (currentNode && totalMatches < maxMatches) {
      const result = this.wrapMatchesInTextNode(currentNode, phoneRegex, styleVariant, maxMatches - totalMatches);
      totalMatches += result.matches;
      createdHighlights.push(...result.highlights);
      result.highlights.forEach((span) => this.revealAncestorsForElement(span));
      currentNode = walker.nextNode();
    }

    // Refuerzo para formatos de teléfono puntuales que el regex podría omitir por maquetación.
    const explicitPhoneTerms = options.explicitPhoneTerms || [
      '(+56) 227 120640',
      '(+56) 227 120 640',
      '(+56) 442 201 098',
      '(+56) 227 120 245'
    ];

    const explicitPhoneDigits = explicitPhoneTerms
      .map((term) => this.onlyDigits(term))
      .filter(Boolean);

    if (explicitPhoneTerms.length && totalMatches < maxMatches) {
      const explicitRegex = new RegExp(`(${explicitPhoneTerms.map((term) => this.escapeRegExp(term)).join('|')})`, 'gi');
      const explicitWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => this.acceptTextNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT
      });

      let explicitNode = explicitWalker.nextNode();
      while (explicitNode && totalMatches < maxMatches) {
        const result = this.wrapMatchesInTextNode(explicitNode, explicitRegex, styleVariant, maxMatches - totalMatches);
        totalMatches += result.matches;
        createdHighlights.push(...result.highlights);
        explicitNode = explicitWalker.nextNode();
      }
    }

    // Refuerzo por bloque solo en elementos de texto, nunca contenedores tipo card.
    const textElements = Array.from(document.querySelectorAll('p, li, a, span, strong, small, td, th, label'))
      .filter((el) => this.shouldHighlightElement(el) && this.isTextOnlyElement(el));

    textElements.forEach((el) => {
      if (totalMatches >= maxMatches) return;
      const rawText = (el.textContent || '').trim();
      const digits = this.onlyDigits(rawText);
      if (digits.length < 8) return;

      const matchesExplicit = explicitPhoneDigits.some((phoneDigits) => digits.includes(phoneDigits));
      if (matchesExplicit) {
        el.classList.add(elementClass);
        matchedTextElements.push(el);
        totalMatches += 1;
      }
    });

    if (autoGuide) {
      if (createdHighlights.length) {
        const guideTarget = this.getBestGuideTarget(createdHighlights);
        this.guideToElement(guideTarget);
        this.avoidChatPanelOverlap(guideTarget, effectiveDuration);
      } else if (contactLinks.length) {
        const guideTarget = this.getBestGuideTarget(contactLinks);
        this.guideToElement(guideTarget);
        this.avoidChatPanelOverlap(guideTarget, effectiveDuration);
      }
    }

    if ((createdHighlights.length || contactLinks.length || matchedTextElements.length) && effectiveDuration > 0) {
      this.scheduleCleanup(() => {
        this.fadeOutSpanHighlights(createdHighlights);
        this.fadeOutElements([...contactLinks, ...matchedTextElements], elementClass);
      }, effectiveDuration, { closeTransientUi });
    }

    return totalMatches;
  }

  /**
   * Limpia cualquier temporizador pendiente de resaltado.
   */
  clearPendingPageHighlights() {
    this.pageHighlightTimers.forEach((timerId) => clearTimeout(timerId));
    this.pageHighlightTimers = [];
  }

  acceptTextNode(node) {
    if (!node || !node.parentElement) return false;

    const parent = node.parentElement;
    const blockedTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'];
    if (blockedTags.includes(parent.tagName)) return false;
    if (parent.closest('#duco-assistant-container')) return false;
    if (parent.closest('.duco-page-highlight')) return false;

    const content = node.textContent ? node.textContent.trim() : '';
    return content.length >= 3;
  }

  wrapMatchesInTextNode(textNode, regex, styleVariant, availableMatches) {
    const source = textNode.textContent || '';
    regex.lastIndex = 0;

    const found = [];
    let match;
    while ((match = regex.exec(source)) !== null && found.length < availableMatches) {
      found.push({ index: match.index, text: match[0] });
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }

    if (!found.length) {
      return { matches: 0, highlights: [] };
    }

    const fragment = document.createDocumentFragment();
    const highlights = [];
    let cursor = 0;
    const variantClass = this.getInlineHighlightClass(styleVariant);

    found.forEach(({ index, text }) => {
      if (index > cursor) {
        fragment.appendChild(document.createTextNode(source.slice(cursor, index)));
      }

      const span = document.createElement('span');
      span.className = `duco-page-highlight ${variantClass}`;
      span.textContent = text;
      fragment.appendChild(span);
      highlights.push(span);

      cursor = index + text.length;
    });

    if (cursor < source.length) {
      fragment.appendChild(document.createTextNode(source.slice(cursor)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
    return { matches: found.length, highlights };
  }

  removeSpanHighlights(spans) {
    const parentsToNormalize = new Set();

    spans.forEach((span) => {
      if (!span || !span.parentNode) return;
      const parent = span.parentNode;
      const text = document.createTextNode(span.textContent || '');
      parent.replaceChild(text, span);
      parentsToNormalize.add(parent);
    });

    parentsToNormalize.forEach((parent) => {
      try {
        parent.normalize();
      } catch {
        // noop
      }
    });
  }

  fadeOutSpanHighlights(spans) {
    const activeSpans = spans.filter((span) => span && span.parentNode);
    if (!activeSpans.length) return;

    activeSpans.forEach((span) => span.classList.add('duco-highlight-fade-out'));

    // Limpiar spans una vez finalice la transición.
    this.scheduleCleanup(() => {
      this.removeSpanHighlights(activeSpans);
    }, this.fadeOutDuration, { closeTransientUi: false });
  }

  fadeOutElements(elements, className) {
    const activeElements = (elements || [])
      .filter((el) => el && el.classList && el.classList.contains(className));
    if (!activeElements.length) return;

    const fadeClass = className === 'duco-option-highlight'
      ? 'duco-option-highlight-fade-out'
      : 'duco-page-element-fade-out';

    activeElements.forEach((el) => el.classList.add(fadeClass));

    this.scheduleCleanup(() => {
      activeElements.forEach((el) => {
        el.classList.remove(className);
        el.classList.remove(fadeClass);
      });
    }, this.fadeOutDuration, { closeTransientUi: false });
  }

  shouldHighlightElement(el) {
    if (!el) return false;
    if (el.closest('#duco-assistant-container')) return false;
    const text = (el.textContent || '').trim();
    return text.length >= 2;
  }

  isTextOnlyElement(el) {
    if (!el) return false;
    if (el.querySelector('img, picture, svg, canvas, video, iframe')) return false;
    const text = (el.textContent || '').trim();
    return text.length > 0;
  }

  getInlineHighlightClass(styleVariant) {
    switch (styleVariant) {
      case 'grow':
        return 'duco-page-highlight-grow';
      case 'text':
        return 'duco-page-highlight-text';
      case 'combo':
        return 'duco-page-highlight-combo';
      case 'background':
      default:
        return 'duco-page-highlight-bg';
    }
  }

  getPageTextClass(styleVariant) {
    switch (styleVariant) {
      case 'grow':
        return 'duco-page-text-highlight-grow';
      case 'text':
        return 'duco-page-text-highlight-text';
      case 'combo':
        return 'duco-page-text-highlight-combo';
      case 'background':
      default:
        return 'duco-page-text-highlight-bg';
    }
  }

  scheduleCleanup(callback, duration, options = {}) {
    if (options.closeTransientUi !== false) {
      this.scheduleTransientUiClose(duration + this.fadeOutDuration);
    }
    const timerId = setTimeout(() => {
      callback();
      this.pageHighlightTimers = this.pageHighlightTimers.filter((id) => id !== timerId);
    }, duration);
    this.pageHighlightTimers.push(timerId);
  }

  scheduleTransientUiClose(duration) {
    if (duration <= 0) return;

    const closeAt = Date.now() + duration;
    if (closeAt <= this.transientUiCloseAt) return;

    this.transientUiCloseAt = closeAt;
    if (this.transientUiCloseTimer) {
      clearTimeout(this.transientUiCloseTimer);
    }

    this.transientUiCloseTimer = setTimeout(() => {
      this.closeTransientUi();
    }, duration);
  }

  closeTransientUi() {
    if (this.transientUiFadeTimer) {
      clearTimeout(this.transientUiFadeTimer);
      this.transientUiFadeTimer = null;
    }

    const activeMenus = Array.from(this.transientDropdownState.keys()).filter(Boolean);
    const activeCollapses = Array.from(this.transientCollapseState.keys()).filter(Boolean);
    const activeDetails = Array.from(this.transientDetailsState).filter(Boolean);

    if (!activeMenus.length && !activeCollapses.length && !activeDetails.length) {
      if (this.transientUiCloseTimer) {
        clearTimeout(this.transientUiCloseTimer);
        this.transientUiCloseTimer = null;
      }
      this.transientUiCloseAt = 0;
      return;
    }

    const finalizeClose = () => {
      this.transientDropdownState.forEach((state, menu) => {
        if (!menu) return;

        menu.classList.remove('duco-transient-ui-fade-out');

        if (state.hadHide) {
          menu.classList.add('hide');
        } else {
          menu.classList.remove('hide');
        }
        menu.classList.remove('show');

        if (state.inlineDisplay) {
          menu.style.display = state.inlineDisplay;
        } else {
          menu.style.removeProperty('display');
        }

        if (state.inlineVisibility) {
          menu.style.visibility = state.inlineVisibility;
        } else {
          menu.style.removeProperty('visibility');
        }

        menu.style.removeProperty('opacity');
        menu.style.removeProperty('transform');

        if (state.wasHidden) {
          menu.hidden = true;
        } else {
          menu.hidden = false;
        }

        state.container?.classList?.remove('show');
        state.trigger?.classList?.remove('show');
        state.trigger?.setAttribute('aria-expanded', 'false');
      });
      this.transientDropdownState.clear();

      this.transientCollapseState.forEach((state, element) => {
        if (!element) return;

        element.classList.remove('duco-transient-ui-fade-out');
        element.classList.remove('show', 'in');
        if (state.inlineDisplay) {
          element.style.display = state.inlineDisplay;
        } else {
          element.style.removeProperty('display');
        }
        element.style.removeProperty('opacity');
        element.style.removeProperty('transform');

        if (state.control) {
          state.control.classList.remove('show');
          state.control.setAttribute('aria-expanded', 'false');
        }
      });
      this.transientCollapseState.clear();

      this.transientDetailsState.forEach((detailsEl) => {
        if (detailsEl?.tagName === 'DETAILS') {
          detailsEl.open = false;
          detailsEl.style.removeProperty('opacity');
          detailsEl.style.removeProperty('transform');
        }
      });
      this.transientDetailsState.clear();

      if (this.transientUiCloseTimer) {
        clearTimeout(this.transientUiCloseTimer);
        this.transientUiCloseTimer = null;
      }
      this.transientUiCloseAt = 0;
    };

    activeMenus.forEach((menu) => menu.classList.add('duco-transient-ui-fade-out'));
    activeCollapses.forEach((element) => element.classList.add('duco-transient-ui-fade-out'));
    activeDetails.forEach((detailsEl) => detailsEl.style.opacity = '0');

    this.transientUiFadeTimer = setTimeout(finalizeClose, 220);
  }

  trackTransientDropdown(trigger, menu, container = null) {
    if (!menu || this.transientDropdownState.has(menu)) return;

    this.transientDropdownState.set(menu, {
      trigger: trigger || null,
      container: container || menu.closest('.dropdown, .dropright, .dropup, .dropleft, .nav-item') || menu.parentElement,
      hadHide: menu.classList.contains('hide'),
      inlineDisplay: menu.style.display || '',
      inlineVisibility: menu.style.visibility || '',
      wasHidden: Boolean(menu.hidden)
    });
  }

  trackTransientCollapse(element, control = null) {
    if (!element || this.transientCollapseState.has(element)) return;

    this.transientCollapseState.set(element, {
      control: control || null,
      inlineDisplay: element.style.display || ''
    });
  }

  trackTransientDetails(detailsEl) {
    if (!detailsEl) return;
    this.transientDetailsState.add(detailsEl);
  }

  resolveDuration(defaultDuration, endAt) {
    if (typeof endAt === 'number' && Number.isFinite(endAt)) {
      return Math.max(0, endAt - Date.now());
    }
    return defaultDuration;
  }

  prepareContentForHighlight(terms = [], options = {}) {
    const normalizedTerms = (terms || [])
      .map((term) => this.normalizeForMatch(term))
      .filter((term) => term.length >= 3);

    if (!normalizedTerms.length) return;

    const openLimit = Number.isFinite(options.openLimit)
      ? Math.max(0, options.openLimit)
      : Infinity;

    let remaining = openLimit;
    remaining = this.openMatchingDetails(normalizedTerms, remaining);
    remaining = this.activateMatchingTabs(normalizedTerms, remaining);
    remaining = this.expandMatchingAccordions(normalizedTerms, remaining);
    this.expandContainersByContent(normalizedTerms, remaining);
  }

  openMatchingDetails(normalizedTerms, openLimit = Infinity) {
    let remaining = openLimit;
    const detailsList = Array.from(document.querySelectorAll('details:not([open])'));
    detailsList.forEach((detailsEl) => {
      if (remaining <= 0) return;
      const summaryText = this.normalizeForMatch(detailsEl.querySelector('summary')?.textContent || '');
      if (this.matchesAnyTerm(summaryText, normalizedTerms)) {
        this.trackTransientDetails(detailsEl);
        detailsEl.open = true;
        remaining -= 1;
      }
    });

    return remaining;
  }

  activateMatchingTabs(normalizedTerms, openLimit = Infinity) {
    let remaining = openLimit;
    const tabControls = Array.from(document.querySelectorAll('[data-bs-toggle="tab"], [data-toggle="tab"], [role="tab"]'));

    tabControls.forEach((control) => {
      if (remaining <= 0) return;
      const content = this.getControlSearchText(control);
      if (!this.matchesAnyTerm(content, normalizedTerms)) return;
      this.safeClickControl(control);
      remaining -= 1;
    });

    // Si el contenido de un tab-pane matchea, activar su tab asociado.
    const panes = Array.from(document.querySelectorAll('.tab-pane[id], [role="tabpanel"][id]'));
    panes.forEach((pane) => {
      if (remaining <= 0) return;
      const paneText = this.normalizeForMatch(pane.textContent || '');
      if (!this.matchesAnyTerm(paneText, normalizedTerms)) return;

      const paneId = pane.id;
      if (!paneId) return;
      const selector = `[data-bs-target="#${paneId}"], [data-target="#${paneId}"], a[href="#${paneId}"], [aria-controls="${paneId}"]`;
      const control = document.querySelector(selector);
      if (control) {
        this.safeClickControl(control);
      } else {
        pane.classList.add('active', 'show', 'in');
      }
      remaining -= 1;
    });

    return remaining;
  }

  expandMatchingAccordions(normalizedTerms, openLimit = Infinity) {
    let remaining = openLimit;
    const controls = Array.from(document.querySelectorAll('[data-bs-toggle="collapse"], [data-toggle="collapse"], [aria-controls]'));

    controls.forEach((control) => {
      if (remaining <= 0) return;
      const content = this.getControlSearchText(control);
      if (!this.matchesAnyTerm(content, normalizedTerms)) return;

      const targetSelector = control.getAttribute('data-bs-target') || control.getAttribute('data-target');
      const targetId = control.getAttribute('aria-controls');
      const target = targetSelector && targetSelector.startsWith('#')
        ? document.querySelector(targetSelector)
        : (targetId ? document.getElementById(targetId) : null);

      if (target && target.classList && target.classList.contains('collapse') && !target.classList.contains('show')) {
        this.trackTransientCollapse(target, control);
      }

      let opened = this.safeClickControl(control);

      if (!opened && targetSelector && targetSelector.startsWith('#')) {
        const target = document.querySelector(targetSelector);
        if (target) {
          target.classList.add('show', 'in');
          target.style.display = '';
          opened = true;
        }
      }

      if (!opened && targetId) {
        const target = document.getElementById(targetId);
        if (target) {
          target.classList.add('show', 'in');
          target.style.display = '';
        }
      }

      remaining -= 1;
    });

    return remaining;
  }

  expandContainersByContent(normalizedTerms, openLimit = Infinity) {
    let remaining = openLimit;
    const collapses = Array.from(document.querySelectorAll('.collapse[id], .tab-pane[id], [role="tabpanel"][id]'));

    collapses.forEach((container) => {
      if (remaining <= 0) return;
      const content = this.normalizeForMatch(container.textContent || '');
      if (!this.matchesAnyTerm(content, normalizedTerms)) return;

      if (container.classList.contains('collapse') && !container.classList.contains('show')) {
        this.trackTransientCollapse(container);
      }
      container.classList.add('show', 'in', 'active');
      container.style.display = '';

      const containerId = container.id;
      if (!containerId) return;

      const controlSelector = `[data-bs-target="#${containerId}"], [data-target="#${containerId}"], a[href="#${containerId}"], [aria-controls="${containerId}"]`;
      const control = document.querySelector(controlSelector);
      if (control) {
        this.safeClickControl(control);
      }

      remaining -= 1;
    });
  }

  revealAncestorsForElement(element, options = {}) {
    if (!element || !element.closest) return;

    const hiddenAncestors = [];
    let current = element.parentElement;

    while (current && current !== document.body) {
      const isHiddenCollapse = current.classList && (current.classList.contains('collapse') || current.classList.contains('tab-pane'));
      const isHiddenRole = current.getAttribute && current.getAttribute('role') === 'tabpanel';
      const isDetails = current.tagName === 'DETAILS';
      const isCollapsed = current.classList && current.classList.contains('collapsed');
      const isActuallyHidden = this.isVisuallyHidden(current);

      if (isDetails || isHiddenCollapse || isHiddenRole || isCollapsed || isActuallyHidden) {
        hiddenAncestors.push(current);
      }

      current = current.parentElement;
    }

    const singleOpen = options.singleOpen === true;
    for (const ancestor of hiddenAncestors) {
      const opened = this.openHiddenAncestor(ancestor);
      if (singleOpen && opened) {
        break;
      }
    }
  }

  isVisuallyHidden(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || element.hidden;
  }

  openHiddenAncestor(element) {
    if (!element) return false;

    if (element.tagName === 'DETAILS') {
      if (!element.open) {
        this.trackTransientDetails(element);
      }
      element.open = true;
      return true;
    }

    if (element.classList && element.classList.contains('tab-pane')) {
      const paneId = element.id;
      if (paneId) {
        const control = document.querySelector(`[data-bs-target="#${paneId}"], [data-target="#${paneId}"], a[href="#${paneId}"], [aria-controls="${paneId}"]`);
        if (control) {
          this.openViaBootstrapControl(control);
          return true;
        }
      }

      element.classList.add('active', 'show', 'in');
      element.style.display = 'block';
      return true;
    }

    if (element.classList && element.classList.contains('collapse')) {
      const collapseId = element.id;
      if (collapseId) {
        const control = document.querySelector(`[data-bs-target="#${collapseId}"], [data-target="#${collapseId}"], [aria-controls="${collapseId}"]`);
        if (control) {
          if (!element.classList.contains('show')) {
            this.trackTransientCollapse(element, control);
          }
          this.openViaBootstrapControl(control);
          return true;
        }
      }

      if (!element.classList.contains('show')) {
        this.trackTransientCollapse(element);
      }
      element.classList.add('show', 'in');
      element.style.display = 'block';
      return true;
    }

    if (element.classList && element.classList.contains('dropdown-menu')) {
      const labelledBy = element.getAttribute('aria-labelledby');
      const control =
        (labelledBy ? document.getElementById(labelledBy) : null)
        || element.previousElementSibling
        || element.parentElement?.querySelector(':scope > .dropdown-toggle');

      this.forceDropdownOpen(control, element);
      return true;
    }

    return false;
  }

  openViaBootstrapControl(control) {
    if (!control) return false;

    const targetSelector = control.getAttribute('data-bs-target') || control.getAttribute('data-target') || control.getAttribute('href');
    if (!targetSelector) {
      if (this.forceDropdownOpen(control, dropdownMenu)) {
        return true;
      }
      return this.safeClickControl(control);
    }

    const target = targetSelector.startsWith('#') ? document.querySelector(targetSelector) : null;
    const isTab = control.getAttribute('data-bs-toggle') === 'tab' || control.getAttribute('data-toggle') === 'tab' || control.getAttribute('role') === 'tab' || (target && target.classList.contains('tab-pane'));
    const isCollapse = control.getAttribute('data-bs-toggle') === 'collapse' || control.getAttribute('data-toggle') === 'collapse' || (target && target.classList.contains('collapse'));
    const isDropdown = control.getAttribute('data-bs-toggle') === 'dropdown' || control.getAttribute('data-toggle') === 'dropdown' || control.classList.contains('dropdown-toggle');

    try {
      if (window.jQuery) {
        const $control = window.jQuery(control);
        if (isTab) {
          const $target = target ? window.jQuery(target) : null;
          if ($target && typeof $target.tab === 'function') {
            $target.tab('show');
            return true;
          }
          if (typeof $control.tab === 'function') {
            $control.tab('show');
            return true;
          }
        }

        if (isCollapse) {
          const $target = target ? window.jQuery(target) : null;
          if ($target && typeof $target.collapse === 'function') {
            $target.collapse('show');
            return true;
          }
          if (typeof $control.collapse === 'function') {
            $control.collapse('show');
            return true;
          }
        }

        if (isDropdown && typeof $control.dropdown === 'function') {
          const dropdownItem = control.closest('.dropdown, .nav-item') || control.parentElement;
          const dropdownMenu =
            (dropdownItem && dropdownItem.querySelector(':scope > .dropdown-menu'))
            || control.nextElementSibling
            || (control.id ? document.querySelector(`.dropdown-menu[aria-labelledby="${control.id}"]`) : null);
          if (dropdownMenu && !dropdownMenu.classList.contains('show')) {
            this.trackTransientDropdown(control, dropdownMenu, dropdownItem);
          }
          $control.dropdown('show');
          return true;
        }
      }
    } catch {
      // Fallback below.
    }

    if (target) {
      if (isTab) {
        target.classList.add('active', 'show', 'in');
        control.classList.add('active');
        control.setAttribute('aria-expanded', 'true');
        return true;
      }

      if (isCollapse) {
        target.classList.add('show', 'in');
        target.style.display = 'block';
        control.setAttribute('aria-expanded', 'true');
        return true;
      }
    }

    if (isDropdown) {
      // Para dropdowns, si no está visible, hacer click para que Bootstrap maneje el toggle
      const dropdownItem = control.closest('.dropdown, .nav-item') || control.parentElement;
      const dropdownMenu =
        (dropdownItem && dropdownItem.querySelector(':scope > .dropdown-menu'))
        || control.nextElementSibling
        || (control.id ? document.querySelector(`.dropdown-menu[aria-labelledby="${control.id}"]`) : null);

      // Si el dropdown ya está abierto, no hacer click nuevamente
      const isCurrentlyOpen = dropdownMenu && dropdownMenu.classList.contains('show');
      if (isCurrentlyOpen) {
        return true;  // Ya está abierto
      }

      // Si no está abierto, hacer click para que Bootstrap lo abra
      return this.safeClickControl(control);
    }

    return this.safeClickControl(control);
  }

  forceDropdownOpen(control, dropdownMenu = null) {
    if (!control && !dropdownMenu) return false;

    const labelledBy = dropdownMenu?.getAttribute('aria-labelledby');
    const trigger = control
      || (labelledBy ? document.getElementById(labelledBy) : null);
    const menu = dropdownMenu
      || trigger?.nextElementSibling
      || (trigger?.id ? document.querySelector(`.dropdown-menu[aria-labelledby="${trigger.id}"]`) : null);

    if (!menu) return false;

    this.closeOpenDropdowns(menu);

    const dropdownItem = trigger?.closest('.dropdown, .dropright, .dropup, .dropleft, .nav-item')
      || menu.closest('.dropdown, .dropright, .dropup, .dropleft, .nav-item')
      || menu.parentElement;

    if (!menu.classList.contains('show')) {
      this.trackTransientDropdown(trigger, menu, dropdownItem);
    }

    menu.classList.remove('hide');
    menu.classList.add('show');
    menu.style.display = 'block';
    menu.style.visibility = 'visible';
    menu.hidden = false;

    if (dropdownItem?.classList) {
      dropdownItem.classList.add('show');
    }

    if (trigger) {
      trigger.classList.add('show');
      trigger.setAttribute('aria-expanded', 'true');
    }

    return true;
  }

  closeOpenDropdowns(exceptMenu = null) {
    const openMenus = Array.from(document.querySelectorAll('.dropdown-menu.show'));
    openMenus.forEach((menu) => {
      if (!menu || menu === exceptMenu) return;

      const labelledBy = menu.getAttribute('aria-labelledby');
      const trigger = (labelledBy ? document.getElementById(labelledBy) : null)
        || menu.previousElementSibling
        || menu.parentElement?.querySelector(':scope > .dropdown-toggle');

      if (trigger) {
        trigger.classList.remove('show');
        trigger.setAttribute('aria-expanded', 'false');
      }

      const dropdownItem = trigger?.closest('.dropdown, .dropright, .dropup, .dropleft, .nav-item')
        || menu.closest('.dropdown, .dropright, .dropup, .dropleft, .nav-item');

      dropdownItem?.classList?.remove('show');
      menu.classList.remove('show');
      menu.hidden = true;
      menu.style.removeProperty('display');
      menu.style.removeProperty('visibility');
    });
  }

  guideToElement(target) {
    if (!target || typeof target.getBoundingClientRect !== 'function') {
      return Promise.resolve(false);
    }

    this.guidedScrollPendingTarget = target;

    if (this.guidedScrollRunning) {
      return this.guidedScrollPromise || Promise.resolve(true);
    }

    this.guidedScrollPromise = this.runGuidedScrollQueue();
    return this.guidedScrollPromise;
  }

  async runGuidedScrollQueue() {
    this.guidedScrollRunning = true;
    this.lockScroll();

    try {
      while (this.guidedScrollPendingTarget) {
        const target = this.guidedScrollPendingTarget;
        this.guidedScrollPendingTarget = null;

        const targetState = this.performGuidedScroll(target);
        await this.waitForScrollSettled(targetState);
      }
    } finally {
      this.guidedScrollRunning = false;
      this.unlockScroll();
    }

    return true;
  }

  lockScroll() {
    if (this.scrollLocked) return;
    this.scrollLocked = true;

    const preventScroll = (e) => {
      if (this.scrollLocked) {
        e.preventDefault();
      }
    };

    const preventWheel = (e) => {
      if (this.scrollLocked) {
        e.preventDefault();
      }
    };

    // Bloquear scroll con métodos múltiples
    document.body.style.overflow = 'hidden';
    window.addEventListener('scroll', preventScroll, { passive: false });
    window.addEventListener('wheel', preventWheel, { passive: false });
    window.addEventListener('touchmove', preventWheel, { passive: false });

    this.scrollBlockHandlers = [
      { event: 'scroll', handler: preventScroll },
      { event: 'wheel', handler: preventWheel },
      { event: 'touchmove', handler: preventWheel }
    ];
  }

  unlockScroll() {
    if (!this.scrollLocked) return;
    this.scrollLocked = false;

    // Remover listeners
    this.scrollBlockHandlers.forEach(({ event, handler }) => {
      window.removeEventListener(event, handler);
    });
    this.scrollBlockHandlers = [];

    // Restaurar scroll
    document.body.style.overflow = '';
  }

  performGuidedScroll(target) {
    if (!target || typeof target.getBoundingClientRect !== 'function') return null;

    const fixedHeaderState = this.getFixedHeaderGuideState(target);
    if (fixedHeaderState) {
      const currentY = window.scrollY || 0;
      const targetY = fixedHeaderState.targetY;
      const deltaY = targetY - currentY;

      if (Math.abs(deltaY) <= 2) {
        return { targetY, deltaY: 0 };
      }

      window.scrollTo({ top: targetY, left: 0, behavior: 'smooth' });
      return { targetY, deltaY };
    }

    const headerOffset = this.getStickyHeaderOffset();
    const rect = target.getBoundingClientRect();
    const desiredViewportTop = headerOffset + 24;
    const deltaY = rect.top - desiredViewportTop;
    const targetY = Math.max(0, Math.round((window.scrollY || 0) + deltaY));

    if (Math.abs(deltaY) <= 2) {
      return { targetY, deltaY: 0 };
    }

    window.scrollBy({ top: deltaY, left: 0, behavior: 'smooth' });
    return { targetY, deltaY };
  }

  async waitForScrollSettled(targetState) {
    if (!targetState || typeof targetState.targetY !== 'number' || !Number.isFinite(targetState.targetY)) {
      await this.wait(this.guidedScrollSettleDelay);
      return;
    }

    const startedAt = Date.now();
    let stableFrames = 0;
    let lastScrollY = window.scrollY;

    while (Date.now() - startedAt < this.guidedScrollMaxWaitMs) {
      await this.wait(this.guidedScrollSettleDelay);

      const currentScrollY = window.scrollY;
      const delta = Math.abs(currentScrollY - lastScrollY);
      const distanceToTarget = Math.abs(currentScrollY - targetState.targetY);

      if (delta <= 1 && distanceToTarget <= 2) {
        stableFrames += 1;
        if (stableFrames >= 2) {
          return;
        }
      } else {
        stableFrames = 0;
      }

      lastScrollY = currentScrollY;
    }
  }

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async prepareViewportForTarget(target) {
    const element = typeof target === 'string'
      ? document.querySelector(target)
      : target;

    if (!element) return false;

    const fixedHeaderState = this.getFixedHeaderGuideState(element);
    if (!fixedHeaderState) return false;

    const currentY = window.scrollY || 0;
    const deltaY = fixedHeaderState.targetY - currentY;
    if (Math.abs(deltaY) <= 2) {
      return true;
    }

    window.scrollTo({ top: fixedHeaderState.targetY, left: 0, behavior: 'auto' });
    await this.waitForScrollSettled({
      targetY: fixedHeaderState.targetY,
      deltaY
    });
    return true;
  }

  getFixedHeaderGuideState(target) {
    const pinnedAncestor = this.findPinnedViewportAncestor(target);
    if (!pinnedAncestor) return null;

    const fixedHeader = pinnedAncestor.closest
      ? pinnedAncestor.closest('header.fixed-top, header.sticky-top')
      : null;
    const isHeaderTarget = Boolean(fixedHeader)
      || this.matchesFixedHeaderSelector(pinnedAncestor);

    if (!isHeaderTarget) return null;

    return { targetY: 0 };
  }

  findPinnedViewportAncestor(element) {
    let current = element;

    while (current && current !== document.body) {
      if (this.isPinnedToViewport(current)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  isPinnedToViewport(element) {
    if (!element || typeof window.getComputedStyle !== 'function') return false;

    const style = window.getComputedStyle(element);
    if (style.position === 'fixed' || style.position === 'sticky') {
      return true;
    }

    return this.matchesFixedHeaderSelector(element);
  }

  matchesFixedHeaderSelector(element) {
    return Boolean(
      element
      && typeof element.matches === 'function'
      && element.matches('header.fixed-top, header.sticky-top, .fixed-top, .sticky-top')
    );
  }

  getStickyHeaderOffset() {
    const candidates = Array.from(document.querySelectorAll('header.fixed-top, header.sticky-top, .fixed-top, .sticky-top'));
    const visibleHeights = candidates
      .filter((el) => this.isElementVisible(el))
      .map((el) => el.getBoundingClientRect().height || 0)
      .filter((height) => height > 0);

    const maxHeader = visibleHeights.length ? Math.max(...visibleHeights) : 0;
    return Math.min(Math.max(maxHeader, 0), Math.round(window.innerHeight * 0.28));
  }

  isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  moveViewportTo(target, options = {}) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return false;

    const { reveal = true } = options;
    if (reveal) {
      this.revealAncestorsForElement(element);
    }

    this.guideToElement(element);
    return true;
  }

  /**
   * Abre un dropdown o collapse de forma controlada para la IA.
   * @param {Object} request - Solicitud declarativa.
   * @returns {boolean}
   */
  openDropdown(request = {}) {
    const trigger = request.trigger
      ? (typeof request.trigger === 'string' ? document.querySelector(request.trigger) : request.trigger)
      : (request.selector ? document.querySelector(request.selector) : null);

    if (!trigger) return false;

    if (request.cleanFirst !== false) {
      this.cleanupAllTransientState();
    }

    const dropdownItem = request.container
      ? (typeof request.container === 'string' ? document.querySelector(request.container) : request.container)
      : trigger.closest('.dropdown, .nav-item, .collapse, .accordion-item') || trigger.parentElement;

    const dropdownMenu = request.menu
      ? (typeof request.menu === 'string' ? document.querySelector(request.menu) : request.menu)
      : (dropdownItem && dropdownItem.querySelector(':scope > .dropdown-menu'))
        || trigger.nextElementSibling
        || (trigger.id ? document.querySelector(`.dropdown-menu[aria-labelledby="${trigger.id}"]`) : null);

    if (dropdownMenu && !dropdownMenu.classList.contains('show')) {
      this.trackTransientDropdown(trigger, dropdownMenu, dropdownItem);
    }

    if (dropdownMenu) {
      dropdownMenu.classList.remove('hide');
      dropdownMenu.classList.add('show');
      dropdownMenu.style.display = '';
      dropdownMenu.style.visibility = '';
      dropdownMenu.hidden = false;
      if (request.reveal !== false) {
        this.guideToElement(dropdownMenu);
      }
    }

    if (dropdownItem?.classList) {
      dropdownItem.classList.add('show');
    }

    if (trigger.classList) {
      trigger.classList.add('show');
      trigger.setAttribute('aria-expanded', 'true');
    }

    if (request.click !== false) {
      return this.safeClickControl(trigger);
    }

    return true;
  }

  cleanupAllTransientState() {
    this.transientDropdownState.forEach((state, menu) => {
      if (!menu) return;
      menu.classList.remove('duco-transient-ui-fade-out', 'show', 'hide');
      menu.style.removeProperty('display');
      menu.style.removeProperty('visibility');
      menu.style.removeProperty('opacity');
      menu.style.removeProperty('transform');
      menu.hidden = false;
      if (state.container) state.container.classList?.remove('show');
      if (state.trigger) {
        state.trigger.classList?.remove('show');
        state.trigger.removeAttribute('aria-expanded');
      }
    });
    this.transientDropdownState.clear();

    this.transientCollapseState.forEach((state, element) => {
      if (!element) return;
      element.classList.remove('duco-transient-ui-fade-out', 'show', 'in');
      element.style.removeProperty('display');
      element.style.removeProperty('opacity');
      element.style.removeProperty('transform');
      if (state.control) {
        state.control.classList.remove('show');
        state.control.setAttribute('aria-expanded', 'false');
      }
    });
    this.transientCollapseState.clear();

    this.transientDetailsState.forEach((detailsEl) => {
      if (detailsEl?.tagName === 'DETAILS') {
        detailsEl.open = false;
        detailsEl.style.removeProperty('opacity');
        detailsEl.style.removeProperty('transform');
      }
    });
    this.transientDetailsState.clear();

    this.removeHighlight();
  }

  /**
   * Mueve el viewport de forma controlada para la IA.
   * @param {Object} request - Solicitud declarativa.
   * @returns {boolean}
   */
  scrollViewport(request = {}) {
    const behavior = ['auto', 'instant', 'smooth'].includes(request.behavior) ? request.behavior : 'smooth';
    const top = Number.isFinite(request.top) ? request.top : null;
    const left = Number.isFinite(request.left) ? request.left : null;
    const deltaY = Number.isFinite(request.deltaY) ? request.deltaY : 0;
    const deltaX = Number.isFinite(request.deltaX) ? request.deltaX : 0;

    if (request.target) {
      const target = typeof request.target === 'string' ? document.querySelector(request.target) : request.target;
      if (!target) return false;

      const rect = target.getBoundingClientRect();
      const offset = Number.isFinite(request.offset) ? request.offset : 0;
      const align = request.align || 'start';
      const targetTop = window.scrollY + rect.top + offset;
      const centeredTop = window.scrollY + rect.top - (window.innerHeight / 2) + (rect.height / 2) + offset;
      const finalTop = align === 'center' ? centeredTop : targetTop;

      window.scrollTo({
        top: Math.max(0, finalTop),
        left: window.scrollX,
        behavior
      });

      if (request.reveal !== false) {
        this.revealAncestorsForElement(target, { singleOpen: request.singleOpen === true });
      }
      return true;
    }

    if (top !== null || left !== null) {
      window.scrollTo({
        top: top !== null ? Math.max(0, top) : window.scrollY + deltaY,
        left: left !== null ? Math.max(0, left) : window.scrollX + deltaX,
        behavior
      });
      return true;
    }

    if (deltaY !== 0 || deltaX !== 0) {
      window.scrollBy({
        top: deltaY,
        left: deltaX,
        behavior
      });
      return true;
    }

    return false;
  }

  /**
   * Ejecuta una acción visual declarativa: dropdown o scroll.
   * @param {Object} request - Solicitud declarativa.
   * @returns {Promise<Object|boolean|null>}
   */
  async requestInteraction(request = {}) {
    const action = String(request.action || request.type || '').trim().toLowerCase();

    if (action === 'dropdown' || action === 'collapse' || action === 'menu') {
      return this.openDropdown(request);
    }

    if (action === 'scroll' || action === 'viewport' || action === 'move') {
      return this.scrollViewport(request);
    }

    if (action === 'goto') {
      return this.moveViewportTo(request.target || request.selector || request.element, request);
    }

    return null;
  }

  getBestGuideTarget(elements = []) {
    const valid = elements.filter((el) => el && typeof el.getBoundingClientRect === 'function');
    if (!valid.length) return null;

    const viewportCenter = window.innerHeight * 0.42;
    const scored = valid.map((el) => {
      const rect = el.getBoundingClientRect();
      const offscreen = rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth;
      const tooHigh = rect.top < 96;
      const tooLow = rect.top > window.innerHeight * 0.82;
      const distanceFromCenter = Math.abs(rect.top - viewportCenter);
      const verticalPreference = rect.top >= 0 ? rect.top : Math.abs(rect.bottom);
      const score = distanceFromCenter + (tooHigh ? 650 : 0) + (tooLow ? 140 : 0) + (offscreen ? 220 : 0) + verticalPreference * 0.12;
      return { el, rect, score };
    });

    scored.sort((a, b) => a.score - b.score);
    return scored[0]?.el || valid[0];
  }

  safeClickControl(control) {
    if (!control || control.disabled) return false;

    if (control.tagName === 'A') {
      const href = (control.getAttribute('href') || '').trim();
      const isInPageHref = href.startsWith('#') || href.toLowerCase().startsWith('javascript:') || href === '';
      if (!isInPageHref) return false;
    }

    try {
      control.click();
      return true;
    } catch {
      return false;
    }
  }

  getControlSearchText(control) {
    const text = this.normalizeForMatch(control.textContent || '');
    const aria = this.normalizeForMatch(control.getAttribute('aria-label') || '');
    const title = this.normalizeForMatch(control.getAttribute('title') || '');
    return `${text} ${aria} ${title}`.trim();
  }

  matchesAnyTerm(content, normalizedTerms) {
    if (!content) return false;
    return normalizedTerms.some((term) => content.includes(term));
  }

  normalizeForMatch(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  findOptionContainer(element) {
    if (!element || !element.closest) return null;

    // Priorizar controles clickeables para que el resaltado se vea como “botón”, no como texto.
    const container = element.closest('button, a, [role="button"], [role="menuitem"], li, .list-group-item, .card, .item, .option, .menu-item, .media, .acordeon .card-header, .nav-item, .navbar-toggler, .heading');
    if (!container) return null;
    if (container.closest('#duco-assistant-container')) return null;

    // Evitar contenedores gigantes (secciones enteras) para no pintar media página.
    const rect = container.getBoundingClientRect();
    const role = container.getAttribute ? container.getAttribute('role') : null;
    const isControl = container.tagName === 'BUTTON'
      || container.tagName === 'A'
      || role === 'button'
      || role === 'menuitem';

    // Para controles (botones/links) permitimos ancho completo (menús móviles),
    // pero seguimos evitando alturas enormes.
    if (rect.height > window.innerHeight * 0.45) {
      return null;
    }

    if (!isControl && rect.width > window.innerWidth * 0.9) {
      return null;
    }

    return container;
  }

  avoidChatPanelOverlap(targetElement, duration = 3000) {
    const panel = document.getElementById('duco-chat-panel');
    if (!panel || !panel.classList.contains('open') || !targetElement) return;

    const targetRectRaw = targetElement.getBoundingClientRect();
    const targetRect = {
      left: Math.max(0, targetRectRaw.left - 24),
      top: Math.max(0, targetRectRaw.top - 24),
      right: Math.min(window.innerWidth, targetRectRaw.right + 24),
      bottom: Math.min(window.innerHeight, targetRectRaw.bottom + 24)
    };
    const panelRect = panel.getBoundingClientRect();

    if (this.getIntersectionArea(panelRect, targetRect) === 0) {
      return;
    }

    const candidatePositions = this.getPanelCandidatePositions(panelRect.width, panelRect.height);
    let best = null;
    let bestOverlap = Number.POSITIVE_INFINITY;

    candidatePositions.forEach((pos) => {
      const simulated = this.simulatePanelRect(pos, panelRect.width, panelRect.height);
      const overlap = this.getIntersectionArea(simulated, targetRect);
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        best = pos;
      }
    });

    if (!best) return;

    const currentOverlap = this.getIntersectionArea(panelRect, targetRect);
    if (bestOverlap >= currentOverlap) return;

    this.storePanelBaseInlineStyle(panel);
    panel.style.left = best.left;
    panel.style.right = best.right;
    panel.style.top = best.top;
    panel.style.bottom = best.bottom;

    this.schedulePanelRestore(duration + this.fadeOutDuration + 150);
  }

  storePanelBaseInlineStyle(panel) {
    if (this.panelBaseInlineStyle) return;
    this.panelBaseInlineStyle = {
      left: panel.style.left || '',
      right: panel.style.right || '',
      top: panel.style.top || '',
      bottom: panel.style.bottom || ''
    };
  }

  schedulePanelRestore(delayMs) {
    if (this.panelRestoreTimer) {
      clearTimeout(this.panelRestoreTimer);
    }

    this.panelRestoreTimer = setTimeout(() => {
      const panel = document.getElementById('duco-chat-panel');
      if (!panel || !this.panelBaseInlineStyle) return;
      panel.style.left = this.panelBaseInlineStyle.left;
      panel.style.right = this.panelBaseInlineStyle.right;
      panel.style.top = this.panelBaseInlineStyle.top;
      panel.style.bottom = this.panelBaseInlineStyle.bottom;
      this.panelBaseInlineStyle = null;
      this.panelRestoreTimer = null;
    }, Math.max(0, delayMs));
  }

  getPanelCandidatePositions(panelWidth, panelHeight) {
    const margin = 20;
    const footerOffset = 100;
    const fitsTop = panelHeight + margin * 2 <= window.innerHeight;
    const fitsBottom = panelHeight + footerOffset + margin <= window.innerHeight;

    const positions = [];
    if (fitsBottom) {
      positions.push({ left: `${margin}px`, right: 'auto', top: 'auto', bottom: `${footerOffset}px` });
      positions.push({ left: 'auto', right: `${margin}px`, top: 'auto', bottom: `${footerOffset}px` });
    }
    if (fitsTop) {
      positions.push({ left: `${margin}px`, right: 'auto', top: `${margin}px`, bottom: 'auto' });
      positions.push({ left: 'auto', right: `${margin}px`, top: `${margin}px`, bottom: 'auto' });
    }

    // Fallback por si viewport es muy pequeño.
    if (!positions.length) {
      positions.push({ left: `${margin}px`, right: 'auto', top: `${margin}px`, bottom: 'auto' });
    }

    return positions;
  }

  simulatePanelRect(position, width, height) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const left = position.left !== 'auto'
      ? parseInt(position.left, 10)
      : viewportWidth - parseInt(position.right, 10) - width;
    const top = position.top !== 'auto'
      ? parseInt(position.top, 10)
      : viewportHeight - parseInt(position.bottom, 10) - height;

    return {
      left,
      top,
      right: left + width,
      bottom: top + height
    };
  }

  getIntersectionArea(a, b) {
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.right, b.right);
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.bottom, b.bottom);

    if (right <= left || bottom <= top) return 0;
    return (right - left) * (bottom - top);
  }

  escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }
}

// Crear instancia global
window.ducoHighlighter = new UIHighlighter();

// Controlador estable para consumo desde IA o integraciones futuras.
window.ducoHighlightSystem = {
  request: (request) => window.ducoHighlighter.requestHighlight(request),
  clear: () => window.ducoHighlighter.clearAllHighlights(),
  capabilities: () => window.ducoHighlighter.getCapabilities(),
  highlightElement: (target, duration, options) => window.ducoHighlighter.highlight(target, duration, options),
  highlightTerms: (terms, options) => window.ducoHighlighter.highlightByTerms(terms, options),
  highlightPage: (options) => window.ducoHighlighter.highlightWholePageText(options),
  highlightPhones: (options) => window.ducoHighlighter.highlightPhoneNumbers(options),
  openDropdown: (request) => window.ducoHighlighter.openDropdown(request),
  scrollViewport: (request) => window.ducoHighlighter.scrollViewport(request),
  requestInteraction: (request) => window.ducoHighlighter.requestInteraction(request)
};
