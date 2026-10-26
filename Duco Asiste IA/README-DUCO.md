# Duco Assistant - Asistente Virtual Interactivo

## 📋 Descripción

**Duco** es un asistente virtual conversacional integrado en el sitio frontend de Duoc UC. Ayuda a los usuarios a navegar por el sitio mediante palabras clave, proporcionando respuestas contextuales y guías visuales hacia las secciones relevantes.

## 🎯 Características

- ✅ **Chat Conversacional**: Interfaz amigable con historial de mensajes
- 🧭 **Detección de Intenciones**: Reconoce palabras clave en español
- 🎨 **Navegación Guiada**: Destaca elementos y navega automáticamente
- 📱 **Responsive**: Funciona en desktop y mobile
- ⚡ **Sin Dependencias Externas**: Código vanilla JavaScript
- 🚀 **Preparado para IA**: Estructura lista para integrar API de IA

## 📁 Estructura del Proyecto

```
Proyecto capstone/
├── duoc.html                    # HTML principal (modificado)
├── duoc_files/                  # Recursos descargados
│
├── js/                          # Módulos JavaScript
│   ├── navigation-mapper.js     # Mapeo de intenciones a secciones
│   ├── ui-highlighter.js        # Sistema de destacado visual
│   ├── chat-handler.js          # Gestión de conversación
│   └── duco-assistant.js        # Asistente principal
│
├── css/
│   └── duco-styles.css          # Estilos del asistente
│
└── assets/                      # Recursos (imágenes, etc.)
```

## 🔧 Módulos Disponibles

### 1. **navigation-mapper.js**
Mapea palabras clave a secciones del sitio.

```javascript
// Detectar intención
const intent = window.navigationSystem.detectIntent("Quiero ver las carreras");
// Resultado: "carreras"

// Ejecutar acción asociada
window.navigationSystem.executeIntent("carreras");
```

**Intenciones Disponibles:**
- `carreras` - Carreras y programas
- `admision` - Proceso de admisión
- `escuelas` - Nuestras escuelas
- `vida_estudiantil` - Vida estudiantil y apoyo
- `sedes` - Sedes y campus
- `contacto` - Contacte con nosotros
- `nosotros` - Sobre Duoc UC
- `duoc_online` - Carreras en línea

### 2. **ui-highlighter.js**
Sistema de efectos visuales para destacar elementos.

```javascript
// Destacar un elemento
window.ducoHighlighter.highlight('.someElement', 3000);

// Crear flecha apuntadora
window.ducoHighlighter.createArrowPointer('.target-element');

// Efecto de parpadeo
window.ducoHighlighter.blink('.attention-element', 3);

// Destacar secuencia
window.ducoHighlighter.highlightSequence(['.elem1', '.elem2', '.elem3'], 2000);
```

### 3. **chat-handler.js**
Gestión de conversación y mensajes.

```javascript
// Agregar mensaje del usuario
window.chatHandler.addUserMessage("¿Qué carreras tienen?");

// Agregar respuesta del asistente
window.chatHandler.addAssistantMessage("Tenemos 69 carreras disponibles...");

// Obtener respuesta automática
const response = window.chatHandler.getAutoResponse("hola");

// Simular escritura
await window.chatHandler.simulateTyping("Texto...");
```

### 4. **duco-assistant.js**
Orquesta todo: chat + navegación + UI.

```javascript
// Acceso global
window.duco.openPanel();  // Abre el chat
window.duco.closePanel(); // Cierra el chat
```

### 5. **gemini-client.js**
Cliente local para Gemini que devuelve respuestas JSON con texto y acciones.

```javascript
// Configurar la key en el entorno local, no en el repositorio
window.DUCO_GEMINI_API_KEY = 'tu_key_local';

// O desde localStorage
localStorage.setItem('duco-gemini-api-key', 'tu_key_local');
```

> Importante: la clave API no debe quedar hardcodeada en el HTML ni en los JS públicos.
> Para una versión de producción, lo correcto es mover la llamada a Gemini a un backend/proxy.

## 🚀 Cómo Usar

### 1. **Verificar que está funcionando**
1. Abre el navegador: `http://127.0.0.1:5500/duoc.html`
2. Busca el avatar azul **"Duco"** en la esquina inferior derecha
3. Haz click para abrir el chat

### 2. **Probar intenciones**
Escribe en el chat:
- "Quiero ver las carreras"
- "¿Cómo me matriculo?"
- "¿Dónde están las sedes?"
- "Muéstrame las escuelas"
- "Contacto"

Duco debería:
1. Entender tu intención
2. Responder contextualizadamente
3. Navegar a la sección correspondiente
4. Destacar visualmente el elemento

### 3. **En consola del navegador**
```javascript
// Ver intenciones disponibles
console.log(window.navigationSystem.navigationMap);

// Ver historial de chat
console.log(window.chatHandler.getAllMessages());

// Resumen del chat
console.log(window.chatHandler.getSummary());

// Debuggear detección de intención
window.navigationSystem.detectIntent("tu texto aquí");
```

## 🔄 Integración Futura con IA

El sistema está diseñado para ser reemplazado por un modelo de IA. Actualmente:

1. **Detección de Intención**: Usa búsqueda de palabras clave
2. **Generación de Respuesta**: Usa respuestas hardcodeadas

**Para integrar IA:**
1. Reemplazar `detectIntent()` con llamada a API de IA
2. Reemplazar `getContextualResponse()` con respuesta del modelo
3. Mantener intacto: mapeo, UI, chat handler

### Estructura Recomendada para IA:
```javascript
// En duco-assistant.js, modificar processUserInput():

async processUserInput(text) {
  // Llamar a API de IA
  const response = await fetch('/api/duco/query', {
    method: 'POST',
    body: JSON.stringify({ query: text })
  });
  
  const data = await response.json();
  const intent = data.intent;
  const message = data.response;
  
  // El resto del código sigue igual...
}
```

### Integración actual con Gemini

La versión actual usa `js/gemini-client.js` para pedir respuestas estructuradas a Gemini.
Duco puede recibir:
- `reply`: texto para mostrar en el chat
- `actions`: dropdown, scroll, goto, highlight o clear

El asistente lee la key desde `window.DUCO_GEMINI_API_KEY`, `window.ducoConfig.geminiApiKey` o `localStorage`.
Si no encuentra una key, funciona solo con navegación local.

## 🎨 Personalización

### Cambiar Colores
En `css/duco-styles.css`, línea 4-9:
```css
--duco-primary: #035bb3;      /* Azul principal */
--duco-secondary: #FFB800;    /* Amarillo secundario */
```

### Agregar Más Intenciones
En `js/navigation-mapper.js`, agregar a `navigationMap`:
```javascript
nueva_seccion: {
  keywords: ['palabra1', 'palabra2'],
  selectors: ['[href*="ruta"]'],
  heading: {
    title: 'Título',
    description: 'Descripción'
  },
  action: () => {
    // Lo que hacer al detectar esta intención
  }
}
```

### Cambiar Avatar
En `js/duco-assistant.js`, reemplazar el SVG dentro de `.duco-avatar`

## 📊 Estado Actual

✅ **Completado:**
- Interfaz visual del asistente
- Sistema modular de navegación
- Efectos visuales de destacado
- Gestión de chat y mensajes
- Detección de palabras clave
- Respuestas contextuales
- Responsive design
- Validación HTML/CSS

⏳ **Pendiente (Próxima Fase):**
- Integración con API de IA real
- Persistencia de conversaciones en BD
- Análisis de interacciones
- Multilengua
- Avatar animado mejorado
- Opciones de satisfacción del usuario

## 🐛 Troubleshooting

### "Duco no aparece"
- Recarga la página: `Ctrl + F5`
- Verifica que los scripts estén cargando (F12 → Console)

### "El chat no responde"
- Abre la consola (F12)
- Verifica que no haya errores JavaScript
- Comprueba que los módulos estén disponibles:
  ```javascript
  console.log(window.navigationSystem);
  console.log(window.chatHandler);
  console.log(window.ducoHighlighter);
  ```

### "Los botones no funcionan"
- Asegúrate de que el servidor sigue ejecutándose
- Comprueba que `localhost:5500` está disponible

## 📝 Notas Técnicas

- **Compatibilidad**: Todos los navegadores modernos (Chrome 90+, Firefox 88+, Safari 14+)
- **Tamaño**: ~15KB en total (JS + CSS)
- **Dependencias**: Ninguna (vanilla JavaScript + CSS3)
- **Licencia**: Para uso interno de Duoc UC

## 📞 Contacto y Soporte

Para preguntas sobre la arquitectura o integración de IA, contacta al equipo de desarrollo.

---

**Versión**: 1.0 Beta  
**Última Actualización**: 25 de Abril de 2026  
**Estado**: Funcional y listo para pruebas
