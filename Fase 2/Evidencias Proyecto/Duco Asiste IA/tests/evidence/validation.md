# Validacion final - Duco Asiste

La comprobacion posterior de Oracle real y navegadores adicionales esta en
oracle-compatibility.md: CRUD y propuestas aprobados; Chromium, Edge y WebKit
aprobados; Firefox no ejecutado por su entorno y telefonos fisicos pendientes.

La revision general posterior y sus limitaciones estan en general-results.md.
Incluye la nueva ejecucion de diez suites, pruebas del sitio con conexion y
el fallo de funcionamiento desconectado; no debe resumirse como todo aprobado.

## Revision posterior del Sprint 1

La revision ampliada posterior esta documentada en sprint1-revalidation.md y
sprint1-revalidation.json. Encontraron y corrigieron cuatro fallos que la
prueba basica no detectaba. Esas evidencias sustituyen a la prueba basica como
referencia actual de Sprint 1. El ejecutor incluye ahora una suite adicional;
las nueve suites siguientes corresponden a la ejecucion historica aqui descrita.

Fecha local: 4 de noviembre de 2026 (America/Santiago).
Los JSON registran fechas UTC, que en esta ejecucion corresponden al 5 de
noviembre. Servidor local 127.0.0.1:8765; Ollama real qwen3.5:9b.

## Resultado de la ejecucion

- Nueve suites de regresion aprobadas, con codigo de salida 0 en todas.
- Quince pruebas unitarias de backend aprobadas.
- Sprint 4: cuatro escenarios reales de conversacion aprobados y una prueba
  adicional del bloqueo de acciones en seis modos del clasificador simulado.
- El resultado automatico consolidado figura en acceptance.json.

La cobertura operativa de las 26 tareas se detalla en acceptance-plan.md.
Se pueden registrar como validadas bajo ese alcance; esto no equivale a
certificacion de produccion, cobertura universal del lenguaje o pruebas en
todos los dispositivos.

## Sprint 4

| ID | Resultado |
| --- | --- |
| E2-H2-T01 | Sin referente o con texto ininteligible no ejecuta acciones |
| E2-H2-T02 | Solicita aclarar el objetivo o reformular el mensaje |
| E2-H2-T03 | Tras aclarar Admision, abre el menu real |
| E2-H2-T04 | Reconoce que no conoce el arancel futuro y no inventa una cifra |
| E4-H2-T01 | Plan con criterios operativos y correspondencia de las 26 tareas |
| E4-H2-T02 | Ejecucion serial completa del plan automatizado |
| E4-H2-T03 | Incidencias, cambios, logs y nuevas pruebas registrados |
| E4-H2-T04 | Este indice consolida las evidencias de la ejecucion |

## Incidencias y nuevas pruebas

| Hallazgo | Correccion | Evidencia posterior |
| --- | --- | --- |
| Sprint 2: pregunta de seguimiento interpretada como cierre de menu; tambien pedia datos ya declarados | Separar conversacion de planificacion de acciones y usar dialogo previo | sprint2-before-fix.json, sprint2.json |
| Sprint 3: scroll sin destino devolvia exito | Fallo explicito cuando no existe el objetivo | sprint3-before-fix.json, sprint3.json |
| Sprint 3: texto inexistente resaltaba el navbar | Eliminar sustitucion por navbar/intencion anterior | sprint3-before-fix.json, sprint3.json |
| Sprint 3: opcion inexistente se descartaba del plan | Mantenerla y devolver fallo explicito | sprint3.json |
| Sprint 3: cierre y controles no disponibles | Cierre temporizado, cancelacion de temporizadores y comprobacion de controles | sprint3.json, sprint3-model.json |
| Sprint 4: bloqueo por needsClarification limitado a algunos modos | Aplicar bloqueo antes de todas las rutas posteriores al clasificador | sprint4.json: caso real alternative y seis modos simulados |

En Sprint 4 no se observo una accion incorrecta antes del ajuste: el riesgo
se detecto revisando el codigo. El resultado real anterior ya pedia una
aclaracion; ahora esa seguridad no depende de la respuesta final del modelo.

## Indice de evidencias

- acceptance-plan.md: plan y matriz de cobertura.
- acceptance.json: nueve suites, tiempos, codigos de salida y resultado global.
- sprint1.json: interfaz, mensajes, vacios, navegacion y vista movil.
- sprint2.json y sprint2.md: almacenamiento temporal y contexto real.
- sprint3.json, sprint3-model.json y sprint3.md: ejecucion visual y modelo real.
- sprint4.json: consultas, respuestas, acciones, modelo y comprobaciones.
- Archivos *.log: stdout/stderr de cada suite ejecutada.
- backend-tests.log: ejecucion de las quince pruebas Python.
- Archivos *-before-fix.json: fallos iniciales conservados.

## Reproduccion

Desde la raiz, con servidor y Ollama disponibles y Playwright resoluble:

```powershell
node tests/run-acceptance.cjs
.\admin-app\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
```

El ejecutor vuelve a generar los resultados y logs; conserva por separado las
evidencias before-fix. Cada nueva ejecucion contra Ollama puede variar.

## Limites y pendientes fuera del alcance probado

- Pruebas manuales en telefonos fisicos y navegadores distintos de Chromium.
- Recorrido exhaustivo de las 81 fichas y del contenido externo del sitio.
- Pruebas de carga, accesibilidad completa y seguridad de produccion.
- Exactitud de todas las recomendaciones institucionales y consultas posibles.
- El contexto enviado al modelo tiene una ventana finita de mensajes previos.

Las pruebas no validan una cifra real de arancel: comprueban que el asistente
reconozca un dato no disponible, sin consultar fuentes externas.
