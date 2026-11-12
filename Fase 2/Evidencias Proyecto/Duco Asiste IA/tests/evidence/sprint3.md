# Sprint 3 - Navegacion inteligente

Validacion: 2026-11-04 (hora de Chile). Chromium automatizado, escritorio
1280x800, servidor local 127.0.0.1:8765. Resultado: 12 casos funcionales
aprobados y un flujo adicional con Ollama real qwen3.5:9b aprobado.

## Cobertura

| Tarea | Escenario validado |
| --- | --- |
| E3-H1-T03 | Apertura de Oferta Academica y acceso visual a Carreras |
| E3-H1-T04 | Menu y destino de scroll inexistentes devuelven fallo |
| E3-H2-T01 | Marcador real en Congreso i2T 2026 |
| E3-H2-T02 | Nuevo objetivo reemplaza el resaltado anterior |
| E3-H2-T03 | Texto inexistente u oculto no produce falso exito |
| E3-H2-T04 | Carrusel descubierto al volver arriba y opcion de menu no tapada por el chat; comprobacion con elementFromPoint |
| E3-H3-T01 | Apertura del control real y secuencia real abrir/cerrar desde Ollama |
| E3-H3-T02 | Cambio de menu, cierre explicito y cierre automatico posterior a la respuesta |
| E3-H3-T03 | Rechazo de controles separados del DOM, deshabilitados y dialogos inexistentes |
| E3-H3-T04 | Fallo de ejecucion mostrado en el chat; opcion inexistente no descartada silenciosamente |

## Correcciones verificadas

- Scroll sin destino ya no anuncia exito.
- Texto inexistente ya no deriva al boton del navbar ni a una intencion antigua.
- Opciones inexistentes de dropdown ya no desaparecen del plan sin un error.
- Un menu abierto por la respuesta se cierra automaticamente, dejando al menos
  4,5 segundos de lectura; las duraciones mayores del resaltado se respetan.
- La limpieza cancela temporizadores antiguos y no cambia aria-expanded de
  controles ajenos a los dropdowns.

## Reproduccion y evidencias

Desde la raiz, con Playwright disponible para Node y el servidor iniciado:

```powershell
node tests/sprint3-browser.cjs
node tests/sprint3-model.cjs
node tests/repeat-same-carousel.cjs
node tests/highlight-target-regression.js
```

- sprint3-before-fix.json: fallos iniciales.
- sprint3.json: doce casos funcionales de la ultima ejecucion.
- sprint3-model.json: orden del usuario, modelo y resultados reales de abrir
  y cerrar Admision mediante el chat, sin simular la respuesta.
- Tambien pasaron smoke-test.js y las comprobaciones de sintaxis de ambos JS.

## Limites

La suite funcional entrega acciones predeterminadas al ejecutor; el caso de
Ollama prueba interpretacion y ejecucion conjuntamente. No implica que se hayan
validado todas las reformulaciones del lenguaje natural, las 81 fichas, todos
los navegadores ni dispositivos moviles fisicos. Los sitios externos se
bloquean durante las pruebas para aislar el sitio local.
