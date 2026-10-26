/**
 * Calcular distancia de Levenshtein entre dos strings
 * Útil para fuzzy matching
 * @param {string} str1 - Primer string
 * @param {string} str2 - Segundo string
 * @returns {number} - Distancia
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calcular similitud entre dos strings (0-1)
 * @param {string} str1 - Primer string
 * @param {string} str2 - Segundo string
 * @returns {number} - Similitud (0 = nada similar, 1 = idéntico)
 */
function stringSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Sistema de Mapeo de Navegación para Duco Assistant
 * Mapea intenciones de usuario a secciones del sitio usando data-* attributes
 * 
 * NOTA: Requiere que el HTML tenga data-duco-section="<section-key>"
 * Ejemplo: <a data-duco-section="carreras">Carreras</a>
 */

const navigationMap = {
  // Sección: Carreras y Programas
  carreras: {
    keywords: ['carreras', 'programas', 'oferta académica', 'estudiar', 'plan de estudios', 'malla'],
    dataAttribute: 'duco-section-carreras',
    fallbackSelectors: ['[href*="oferta-academica"]', 'a:contains("Carreras")'],
    heading: {
      title: 'Carreras y Programas',
      description: 'Aquí encontrarás todas nuestras carreras técnicas y profesionales'
    },
    action: () => {
      const elem = findSectionElement('carreras');
      if (elem) {
        if (elem.tagName === 'A') elem.click();
        scrollToElement(elem);
      }
    }
  },

  // Sección: Admisión
  admision: {
    keywords: ['admisión', 'matricúlate', 'inscripción', 'postulación', 'proceso de admisión', 'admitirme', 'postulo'],
    dataAttribute: 'duco-section-admision',
    fallbackSelectors: ['[href*="admision"]', '[href*="duoc.cl/admision"]'],
    heading: {
      title: 'Admisión Duoc UC',
      description: 'Conoce cómo postular y comenzar tus estudios con nosotros'
    },
    action: () => {
      const elem = findSectionElement('admision');
      if (elem) {
        if (elem.tagName === 'A') elem.click();
        scrollToElement(elem);
      }
    }
  },

  // Sección: Escuelas
  escuelas: {
    keywords: ['escuelas', 'facultades', 'áreas de estudio', 'administración', 'ingeniería', 'diseño', 'gastronomía', 'artes'],
    dataAttribute: 'duco-section-escuelas',
    fallbackSelectors: ['[href*="escuela"]', 'a:contains("Escuelas")'],
    heading: {
      title: 'Nuestras Escuelas',
      description: 'Explora nuestras 9 escuelas de formación profesional'
    },
    action: () => {
      const elem = findSectionElement('escuelas');
      if (elem) {
        if (elem.tagName === 'A') elem.click();
        scrollToElement(elem);
      }
    }
  },

  // Sección: Vida Estudiantil
  vida_estudiantil: {
    keywords: ['vida estudiantil', 'apoyo estudiantil', 'becas', 'financiamiento', 'bienestar', 'deportes', 'actividades', 'beneficios'],
    dataAttribute: 'duco-section-vida-estudiantil',
    fallbackSelectors: ['[href*="vida-estudiantil"]', 'a:contains("Vida")'],
    heading: {
      title: 'Vida Estudiantil',
      description: 'Conoce los programas de apoyo y beneficios para nuestros estudiantes'
    },
    action: () => {
      const elem = findSectionElement('vida_estudiantil');
      if (elem) {
        if (elem.tagName === 'A') elem.click();
        scrollToElement(elem);
      }
    }
  },

  // Sección: Sedes y Campus
  sedes: {
    keywords: ['sedes', 'campus', 'dónde estamos', 'ubicaciones', 'regiones', 'localización', 'donde'],
    dataAttribute: 'duco-section-sedes',
    fallbackSelectors: ['[href*="sedes"]', '[href*="donde-estamos"]'],
    heading: {
      title: 'Sedes y Campus',
      description: 'Tenemos 18 sedes distribuidas a lo largo del país'
    },
    action: () => {
      const elem = findSectionElement('sedes');
      if (elem) {
        if (elem.tagName === 'A') elem.click();
        scrollToElement(elem);
      }
    }
  },

  // Sección: Contacto
  contacto: {
    keywords: ['contacto', 'contactar', 'teléfono', 'whatsapp', 'correo', 'ayuda', 'soporte', 'llamar', 'email'],
    dataAttribute: 'duco-section-contacto',
    fallbackSelectors: ['[href*="contacto"]', 'footer', 'a:contains("Contáctanos")'],
    heading: {
      title: 'Contáctanos',
      description: 'Estamos aquí para ayudarte. ¡Comunícate con nosotros!'
    },
    action: () => {
      const elem = findSectionElement('contacto');
      if (elem) {
        if (elem.tagName === 'A') elem.click();
        scrollToElement(elem);
      }
    }
  },

  // Sección: Sobre Nosotros
  nosotros: {
    keywords: ['nosotros', 'quiénes somos', 'sobre duoc', 'misión', 'visión', 'historia', 'acerca', 'valores'],
    dataAttribute: 'duco-section-nosotros',
    fallbackSelectors: ['[href*="nosotros"]', '[href*="sobre-duoc"]'],
    heading: {
      title: 'Sobre Duoc UC',
      description: 'Conoce nuestra historia, misión y valores'
    },
    action: () => {
      const elem = findSectionElement('nosotros');
      if (elem) {
        if (elem.tagName === 'A') elem.click();
        scrollToElement(elem);
      }
    }
  },

  // Sección: Duoc Online
  duoc_online: {
    keywords: ['online', 'en línea', 'duoc online', 'remoto', 'virtual', 'modalidad online', 'línea'],
    dataAttribute: 'duco-section-duoc-online',
    fallbackSelectors: ['[href*="duoconline"]', '[href*="duoc-online"]'],
    heading: {
      title: 'Duoc Online',
      description: 'Estudia 100% en línea desde donde quieras'
    },
    action: () => {
      const elem = findSectionElement('duoc_online');
      if (elem) {
        if (elem.tagName === 'A') elem.click();
        scrollToElement(elem);
      }
    }
  }
};

/**
 * Funcionalidad auxiliar para hacer scroll suave a un elemento
 * @param {HTMLElement} element - El elemento a donde hacer scroll
 */
function scrollToElement(element) {
  try {
    if (!element) return;

    if (isElementInsideFixedHeader(element)) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error('[Duco] Error en scrollToElement:', error);
  }
}

/**
 * Verificar si elemento está dentro de header fijo
 * @param {HTMLElement} element - Elemento a verificar
 * @returns {boolean}
 */
function isElementInsideFixedHeader(element) {
  if (!element || typeof element.closest !== 'function') return false;
  return Boolean(element.closest('header.fixed-top, header.sticky-top, .fixed-top, .sticky-top'));
}

/**
 * Buscar elemento de sección usando data-* attributes primero, luego fallback
 * @param {string} intentKey - La clave de la intención
 * @returns {HTMLElement|null} - El elemento encontrado o null
 */
function findSectionElement(intentKey) {
  try {
    const intentData = navigationMap[intentKey];
    if (!intentData) {
      console.warn(`[Duco] Intención no encontrada: ${intentKey}`);
      return null;
    }

    // 1. Intenta buscar por data-* attribute principal
    const dataSelector = `[data-${intentData.dataAttribute}]`;
    let elem = document.querySelector(dataSelector);
    
    if (elem) {
      console.log(`[Duco] Elemento encontrado por data-attribute: ${dataSelector}`);
      return elem;
    }

    // 2. Si no, intenta con fallback selectors
    if (intentData.fallbackSelectors && Array.isArray(intentData.fallbackSelectors)) {
      for (const selector of intentData.fallbackSelectors) {
        try {
          elem = document.querySelector(selector);
          if (elem) {
            console.log(`[Duco] Elemento encontrado por fallback selector: ${selector}`);
            return elem;
          }
        } catch (error) {
          console.warn(`[Duco] Selector inválido: ${selector}`);
        }
      }
    }

    // 3. Si aún no encuentra nada, busca por data-duco-section genérico
    const genericSelector = `[data-duco-section="${intentKey}"]`;
    elem = document.querySelector(genericSelector);
    
    if (elem) {
      console.log(`[Duco] Elemento encontrado por data-duco-section: ${genericSelector}`);
      return elem;
    }

    console.warn(`[Duco] No se encontró elemento para: ${intentKey}`);
    return null;
  } catch (error) {
    console.error(`[Duco] Error en findSectionElement(${intentKey}):`, error);
    return null;
  }
}

/**
 * Busca intención del usuario en el texto
 * Usa fuzzy matching para detectar incluso con typos
 * @param {string} userInput - Texto ingresado por el usuario
 * @returns {string|null} - La clave de la intención encontrada o null
 */
function detectIntent(userInput) {
  const lowerInput = userInput.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0.6;

  // Detectar intención de "abrir" dropdown/menú
  const openPatterns = [
    /^abrir\s+(.+)/,
    /^ver\s+(.+)/,
    /^(?:puedes?|puedo)\s+abrir\s+(.+)/,
    /(?:click|clic)\s+(?:en|a)\s+(.+)/,
    /^(?:muéstrame|mostrar)\s+(?:el\s+)?(?:menú|de\s+)?(.+)/,
    /(?:expandir|desplegar)\s+(.+)/,
    /^(?:ir a|ver)\s+(?:la\s+)?sección\s+(de\s+)?(.+)/
  ];

  for (const pattern of openPatterns) {
    const match = lowerInput.match(pattern);
    if (match && match[1]) {
      const target = match[1].trim();
      for (const [intentKey, intentData] of Object.entries(navigationMap)) {
        for (const keyword of intentData.keywords) {
          if (target.includes(keyword) || keyword.includes(target)) {
            return intentKey;
          }
        }
      }
      for (const [intentKey, intentData] of Object.entries(navigationMap)) {
        for (const keyword of intentData.keywords) {
          const similarity = stringSimilarity(target, keyword);
          if (similarity > 0.7) {
            return intentKey;
          }
        }
      }
    }
  }

  // Buscar coincidencias exactas primero
  for (const [intentKey, intentData] of Object.entries(navigationMap)) {
    for (const keyword of intentData.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (lowerInput.includes(keywordLower)) {
        return intentKey;
      }
    }
  }

  // Fuzzy matching
  for (const [intentKey, intentData] of Object.entries(navigationMap)) {
    for (const keyword of intentData.keywords) {
      const keywordLower = keyword.toLowerCase();
      const inputWords = lowerInput.split(/\s+/);
      const keywordWords = keywordLower.split(/\s+/);

      for (const inputWord of inputWords) {
        for (const keywordWord of keywordWords) {
          if (inputWord.length >= 3 && keywordWord.length >= 3) {
            const similarity = stringSimilarity(inputWord, keywordWord);
            if (similarity > bestScore) {
              bestScore = similarity;
              bestMatch = intentKey;
            }
          }
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Obtiene los datos de una intención
 * @param {string} intentKey - La clave de la intención
 * @returns {Object|null} - Los datos de la intención o null
 */
function getIntentData(intentKey) {
  return navigationMap[intentKey] || null;
}

/**
 * Ejecuta la acción asociada a una intención
 * @param {string} intentKey - La clave de la intención
 */
function executeIntent(intentKey) {
  const intentData = getIntentData(intentKey);
  if (intentData && intentData.action) {
    intentData.action();
  }
}

// Exportar funciones para uso global
window.navigationSystem = {
  navigationMap,
  detectIntent,
  getIntentData,
  executeIntent,
  scrollToElement,
  findSectionElement
};
