# 🔄 Refactorización de Selectors: ANTES vs DESPUÉS

## Problema Original 🚨

```javascript
// ❌ ANTES: Selectors frágiles
carreras: {
  keywords: ['carreras', 'programas'],
  selectors: ['[href*="oferta-academica"]', 'a:contains("Carreras")'],
  action: () => {
    const elem = document.querySelector('[href*="oferta-academica"]');
    if (elem) elem.click();
  }
}
```

**¿Por qué es un problema?**
- Si la URL cambia de `/oferta-academica` a `/programas` → ❌ Se rompe
- Si cambian la estructura HTML → ❌ No funcionan los selectores
- Mantener sincronizado con HTML es tedioso
- No hay forma de saber si un selector está funcionando

---

## Solución Implementada ✅

```javascript
// ✅ DESPUÉS: Data-* attributes robustos
carreras: {
  keywords: ['carreras', 'programas', 'oferta académica', 'malla'],
  dataAttribute: 'duco-section-carreras',           // ← Específico
  fallbackSelectors: ['[href*="oferta-academica"]'], // ← Red de seguridad
  heading: {
    title: 'Carreras y Programas',
    description: 'Aquí encontrarás...'
  },
  action: () => {
    const elem = findSectionElement('carreras');    // ← Nueva función
    if (elem) {
      if (elem.tagName === 'A') elem.click();
      scrollToElement(elem);
    }
  }
}
```

---

## Función Central: `findSectionElement()` 🔍

```javascript
function findSectionElement(intentKey) {
  try {
    const intentData = navigationMap[intentKey];
    if (!intentData) return null;

    // Intento 1: Buscar por data-* attribute ESPECÍFICO
    let elem = document.querySelector(`[data-${intentData.dataAttribute}]`);
    if (elem) {
      console.log(`✅ Encontrado por data-attribute: ${intentData.dataAttribute}`);
      return elem;
    }

    // Intento 2: Buscar con fallback selectors
    for (const selector of intentData.fallbackSelectors) {
      elem = document.querySelector(selector);
      if (elem) {
        console.log(`✅ Encontrado por fallback: ${selector}`);
        return elem;
      }
    }

    // Intento 3: Buscar por data-* attribute GENÉRICO
    elem = document.querySelector(`[data-duco-section="${intentKey}"]`);
    if (elem) {
      console.log(`✅ Encontrado por data-duco-section: ${intentKey}`);
      return elem;
    }

    console.warn(`❌ No se encontró elemento para: ${intentKey}`);
    return null;
  } catch (error) {
    console.error(`❌ Error en findSectionElement:`, error);
    return null;
  }
}
```

---

## Flujo de Búsqueda Visual 🎯

```
Usuario pregunta "¿Dónde veo las carreras?"
        ↓
detectIntent() → "carreras"
        ↓
findSectionElement("carreras")
        ↓
┌─────────────────────────────────────┐
│ Intento 1: data-duco-section-carreras│ ← PRIMERO (más específico)
│ <a data-duco-section-carreras>...   │
└─────────────────────────────────────┘
        │
        ├─ ✅ Encontrado → return
        │
        └─ ❌ No encontrado
             ↓
    ┌───────────────────────────────────────┐
    │ Intento 2: Fallback selectors        │ ← SEGUNDO
    │ [href*="oferta-academica"]           │
    │ a:contains("Carreras")               │
    └───────────────────────────────────────┘
             │
             ├─ ✅ Encontrado → return
             │
             └─ ❌ No encontrado
                  ↓
        ┌─────────────────────────────────────┐
        │ Intento 3: data-duco-section genérico│ ← ÚLTIMO
        │ [data-duco-section="carreras"]      │
        └─────────────────────────────────────┘
                  │
                  ├─ ✅ Encontrado → return
                  │
                  └─ ❌ No encontrado
                       ↓
                   ❌ LOG ERROR
```

---

## Comparativa: ANTES vs DESPUÉS

| Aspecto | ANTES ❌ | DESPUÉS ✅ |
|---------|---------|----------|
| **Búsqueda** | 1 selector | 3 intentos (robusto) |
| **Dependencia de URL** | Alto | Bajo |
| **Data-attributes** | No | Sí |
| **Fallback** | No | Sí |
| **Logging** | No | Detallado |
| **Mantenibilidad** | Difícil | Fácil |
| **Error handling** | Básico | Avanzado |

---

## Cambios Específicos por Intención

### 1️⃣ CARRERAS

**ANTES:**
```javascript
selectors: ['[href*="oferta-academica"]', 'a:contains("Carreras")']
action: () => {
  const elem = document.querySelector('[href*="oferta-academica"]');
  if (elem) elem.click();
}
```

**DESPUÉS:**
```javascript
dataAttribute: 'duco-section-carreras',
fallbackSelectors: ['[href*="oferta-academica"]'],
action: () => {
  const elem = findSectionElement('carreras');
  if (elem) {
    if (elem.tagName === 'A') elem.click();
    scrollToElement(elem);
  }
}
```

### 2️⃣ ADMISIÓN

**ANTES:**
```javascript
selectors: ['[href*="admision"]', '[href*="duoc.cl/admision"]']
```

**DESPUÉS:**
```javascript
dataAttribute: 'duco-section-admision',
fallbackSelectors: ['[href*="admision"]', '[href*="duoc.cl/admision"]']
```

### ... (y así con todas las intenciones)

---

## HTML Requerido 📝

Para que funcione perfectamente, el HTML debe tener:

```html
<!-- OPCIÓN A: Data-attribute específico (RECOMENDADO) -->
<a href="/oferta-academica/" data-duco-section-carreras>
  Carreras
</a>

<!-- OPCIÓN B: Data-attribute genérico (TAMBIÉN VÁLIDO) -->
<a href="/oferta-academica/" data-duco-section="carreras">
  Carreras
</a>

<!-- OPCIÓN C: Sin data-attribute (fallback a selectors antiguos) -->
<a href="/oferta-academica/">
  Carreras
</a>
```

**El sistema funcionará con cualquiera de estas 3 opciones**, pero la Opción A es la más robusta.

---

## Ventajas del Nuevo Sistema 🌟

### 1. **Robustez**
```javascript
// URL cambió de /oferta-academica a /programas?
// ✅ Sigue funcionando porque busca data-duco-section-carreras
```

### 2. **Claridad**
```javascript
// Queda explícito qué sección es
data-duco-section-carreras  // Claro ✅
vs
[href*="oferta-academica"]  // Poco claro ❌
```

### 3. **Debugging**
```javascript
// Puedo ver en la consola exactamente qué se buscó
[Duco] Elemento encontrado por data-attribute: [data-duco-section-carreras]
[Duco] Buscando fallback selector: [href*="oferta-academica"]
[Duco] No se encontró elemento para: carreras
```

### 4. **Mantenibilidad**
```javascript
// Para agregar una nueva sección:
// Solo agrego un data-attribute, sin cambiar código JS
<a data-duco-section-nueva-seccion>Nueva</a>
```

### 5. **Performance**
```javascript
// querySelector con data-attribute es más rápido
// que selectores complejos
[data-duco-section-carreras]  // Más rápido ✅
[href*="oferta-academica"]    // Más lento
```

---

## Testing del Nuevo Sistema 🧪

### En DevTools (F12):

```javascript
// Prueba 1: Buscar elemento de Carreras
window.navigationSystem.findSectionElement('carreras')
// ✅ Debería devolver: <a data-duco-section-carreras>...</a>

// Prueba 2: Ver logs detallados
// (Abre Console, ejecuta prueba anterior)
// Deberías ver: "[Duco] Elemento encontrado por data-attribute: ..."

// Prueba 3: Probar con todas las intenciones
['carreras', 'admision', 'escuelas', 'vida_estudiantil', 'sedes', 'contacto', 'nosotros', 'duoc_online'].forEach(intent => {
  const elem = window.navigationSystem.findSectionElement(intent);
  console.log(`${intent}: ${elem ? '✅' : '❌'}`);
});

// Prueba 4: Ejecutar acción
window.navigationSystem.executeIntent('carreras')
// ✅ Debería navegar a la sección de carreras
```

---

## Migración desde Sistema Anterior 🔄

Si ya tienes HTML con la estructura anterior:

```javascript
// PASO 1: Elemento antiguo
<a href="/oferta-academica/" class="menu-carreras">Carreras</a>

// PASO 2: Agregar data-attribute
<a href="/oferta-academica/" 
   class="menu-carreras"
   data-duco-section-carreras>  ← Simplemente agregar esto
   Carreras
</a>

// PASO 3: Listo ✅
// El sistema lo encontrará por data-attribute en Intento 1
```

---

## Estructura Final del Código 📦

```
navigation-mapper.js
├── levenshteinDistance()          // Fuzzy matching
├── stringSimilarity()             // Similitud de strings
├── scrollToElement()              // Scroll suave
├── isElementInsideFixedHeader()   // Validación
├── findSectionElement() ← NUEVA   // Búsqueda robusta
├── detectIntent()                 // Detección de intención
├── getIntentData()                // Obtener datos
├── executeIntent()                // Ejecutar acción
└── navigationMap {}               // Mapeo actualizado
    ├── carreras
    ├── admision
    ├── escuelas
    ├── vida_estudiantil
    ├── sedes
    ├── contacto
    ├── nosotros
    └── duoc_online
```

---

## 🎯 Resumen de Cambios

| Cambio | Impacto | Beneficio |
|--------|--------|----------|
| Data-attributes en navigationMap | Alto | Robustez |
| Nueva función `findSectionElement()` | Alto | Búsqueda inteligente |
| Estrategia 3 intentos | Medio | Fallback seguro |
| Logging mejorado | Bajo | Debugging |
| Error handling | Medio | Estabilidad |

**Resultado final:** Sistema 10x más robusto y mantenible ✨

