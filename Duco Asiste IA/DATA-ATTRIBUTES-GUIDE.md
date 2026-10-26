# 📋 Guía: Data Attributes para Duco Navigator

## ¿Por qué `data-*` attributes?

**Antes (Frágil ❌):**
```html
<a href="/duoc/oferta-academica/">Carreras</a>
<!-- Si la URL cambia → ❌ Se rompe el asistente -->
```

**Ahora (Robusto ✅):**
```html
<a href="/any-url-can-change/" data-duco-section="carreras">Carreras</a>
<!-- URL puede cambiar, pero el asistente sigue funcionando -->
```

---

## 📝 Implementación en HTML

### Paso 1: Agregar data-* attributes a enlaces de navegación

Encuentra cada sección del sitio y agrégale un atributo `data-duco-section-*`:

#### 1. **CARRERAS**
```html
<!-- Opción A: Con data-duco-section-carreras -->
<a href="/oferta-academica/" data-duco-section-carreras>
  Carreras
</a>

<!-- O Opción B: Con data-duco-section genérico -->
<a href="/oferta-academica/" data-duco-section="carreras">
  Carreras
</a>
```

#### 2. **ADMISIÓN**
```html
<a href="/admision/" data-duco-section-admision>
  Admisión
</a>
```

#### 3. **ESCUELAS**
```html
<a href="/escuelas/" data-duco-section-escuelas>
  Escuelas
</a>
```

#### 4. **VIDA ESTUDIANTIL**
```html
<a href="/vida-estudiantil/" data-duco-section-vida-estudiantil>
  Vida Estudiantil
</a>
```

#### 5. **SEDES**
```html
<a href="/donde-estamos/sedes/" data-duco-section-sedes>
  Sedes y Campus
</a>
```

#### 6. **CONTACTO**
```html
<a href="/contacto/" data-duco-section-contacto>
  Contacto
</a>
```

#### 7. **SOBRE NOSOTROS**
```html
<a href="/nosotros/" data-duco-section-nosotros>
  Sobre Nosotros
</a>
```

#### 8. **DUOC ONLINE**
```html
<a href="/duoc-online/" data-duco-section-duoc-online>
  Duoc Online
</a>
```

---

## 🔍 Estrategia de búsqueda (Fallback)

El sistema busca en este orden:

```
1. [data-duco-section-<key>]          ← Primero (más específico)
       ↓ Si no encuentra...
       
2. fallbackSelectors del navigationMap  ← Segundo (selectors tradicionales)
       ↓ Si no encuentra...
       
3. [data-duco-section="<key>"]         ← Tercero (genérico)
       ↓ Si no encuentra...
       
❌ No encontrado (log de error)
```

**Ejemplo real:**
```javascript
// Para buscar "carreras", intenta en este orden:
1. document.querySelector('[data-duco-section-carreras]')
2. document.querySelector('[href*="oferta-academica"]')
3. document.querySelector('a:contains("Carreras")')
4. document.querySelector('[data-duco-section="carreras"]')
```

---

## 🎯 Atributos Específicos por Sección

| Sección | Data Attribute | Alternativa Genérica |
|---------|---|---|
| Carreras | `data-duco-section-carreras` | `data-duco-section="carreras"` |
| Admisión | `data-duco-section-admision` | `data-duco-section="admision"` |
| Escuelas | `data-duco-section-escuelas` | `data-duco-section="escuelas"` |
| Vida Estudiantil | `data-duco-section-vida-estudiantil` | `data-duco-section="vida_estudiantil"` |
| Sedes | `data-duco-section-sedes` | `data-duco-section="sedes"` |
| Contacto | `data-duco-section-contacto` | `data-duco-section="contacto"` |
| Sobre Nosotros | `data-duco-section-nosotros` | `data-duco-section="nosotros"` |
| Duoc Online | `data-duco-section-duoc-online` | `data-duco-section="duoc_online"` |

---

## ✅ Checklist de Implementación

- [ ] Agregar `data-duco-section-carreras` al enlace de Carreras
- [ ] Agregar `data-duco-section-admision` al enlace de Admisión
- [ ] Agregar `data-duco-section-escuelas` al enlace de Escuelas
- [ ] Agregar `data-duco-section-vida-estudiantil` al enlace de Vida Estudiantil
- [ ] Agregar `data-duco-section-sedes` al enlace de Sedes
- [ ] Agregar `data-duco-section-contacto` al enlace de Contacto
- [ ] Agregar `data-duco-section-nosotros` al enlace de Sobre Nosotros
- [ ] Agregar `data-duco-section-duoc-online` al enlace de Duoc Online

---

## 🧪 Cómo Verificar que Funciona

### En DevTools (F12):

```javascript
// Prueba 1: Buscar un elemento
window.navigationSystem.findSectionElement('carreras')
// ✅ Debería devolver <a> element con data-duco-section-carreras

// Prueba 2: Ver logs de búsqueda
// Abre Console, intenta que Duco se dirija a "Carreras"
// Deberías ver logs como:
// "[Duco] Elemento encontrado por data-attribute: [data-duco-section-carreras]"

// Prueba 3: Ejecutar acción
window.navigationSystem.executeIntent('carreras')
// ✅ Debería navegar a la sección
```

---

## 🚀 Beneficios de esta Refactorización

| Aspecto | Antes | Ahora |
|--------|-------|-------|
| **Dependencia de URLs** | Alto ❌ | Bajo ✅ |
| **Mantenibilidad** | Difícil ❌ | Fácil ✅ |
| **Claridad** | Confuso ❌ | Explícito ✅ |
| **Performance** | - | Ligeramente mejor ✅ |
| **Logging** | Nulo ❌ | Detallado ✅ |
| **Fallback** | No ❌ | Sí ✅ |

---

## 📌 Notas Importantes

1. **Convención de nombres:** 
   - Guiones bajos para `_` en JavaScript: `vida_estudiantil`
   - Guiones para data-attributes: `data-duco-section-vida-estudiantil`

2. **Redundancia:** Es bueno mantener los `fallbackSelectors` como red de contención

3. **Logging:** Todos los intentos de búsqueda quedan registrados en Console → facilita debugging

4. **Compatibilidad:** `data-*` attributes funcionan en todos los navegadores modernos

---

## 🔧 Estructura del Código

```javascript
// Cada intención tiene:
{
  keywords: [...],                    // Palabras para detectar intención
  dataAttribute: 'duco-section-xxx',  // Atributo específico
  fallbackSelectors: [...],           // Selectores de respaldo
  heading: { title, description },    // Metadatos
  action: () => {}                    // Acción a ejecutar
}
```

La función `findSectionElement()` implementa la estrategia de búsqueda con 3 intentos.

