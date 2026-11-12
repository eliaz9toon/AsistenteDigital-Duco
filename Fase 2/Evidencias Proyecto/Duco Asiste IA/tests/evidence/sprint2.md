# Sprint 2 - Ollama e historial

Validacion funcional: 2026-11-04. Chromium automatizado, servidor local
127.0.0.1:8765 y Ollama real con qwen3.5:9b. Sesiones de prueba aisladas.

## Resultado

- E1-H2-T01: validado. Session Storage conserva mensajes, dialogo e identidad
  de sesion al recargar y navegar en la misma pestana. Una sesion independiente
  no hereda el historial. Nueva conversacion elimina el dialogo anterior,
  cambia el identificador y persiste ese reinicio despues de recargar.
- E1-H2-T03: validado en el escenario probado. El usuario declara que trabaja
  de dia y prefiere vespertino. Despues de recargar y navegar, pregunta que
  horario le acomoda y por que. Ollama recupera ambos datos y los relaciona.
  Tras reiniciar, solicita la preferencia en vez de atribuirle la anterior.

## Correcciones

La primera ejecucion guardaba el historial correctamente, pero confundia una
pregunta relacionada con cerrar un menu. Una correccion solo de instrucciones
no basto: en otra ejecucion pidio datos que ya estaban en el dialogo.
Se separo la clasificacion conversacional del planificador de acciones y la
respuesta conversacional usa directamente los turnos previos.

## Evidencias y reproduccion

- `sprint2-before-fix.json`: fallo inicial y solicitudes reales al modelo.
- `sprint2.json`: ultima ejecucion, respuestas, comprobaciones y solicitudes.
- Prueba: `node tests/sprint2-browser.cjs`, desde la raiz del proyecto.
- Requiere Playwright resoluble por Node, el servidor local y Ollama disponible.
  DUCO_TEST_URL permite cambiar la direccion del servidor local.

## Alcance

El contexto enviado al modelo conserva hasta ocho mensajes previos; no es
memoria ilimitada. El historial temporal depende de Session Storage del
navegador, no de una cuenta de usuario ni de almacenamiento permanente.
Estas pruebas no garantizan todas las reformulaciones posibles ni la
correccion de recomendaciones institucionales generadas por el modelo.
