# Plan de aceptacion - Duco Asiste

## Entorno y ejecucion

Servidor local en http://127.0.0.1:8765, Ollama instalado con qwen3.5:9b,
Node con Playwright resoluble y Chromium disponible. Ejecutar desde la raiz:

```powershell
node tests/run-acceptance.cjs
```

El ejecutor procesa las suites en serie, conserva stdout/stderr por suite y
genera acceptance.json con fechas, tiempos y codigos de salida. Un fallo no
impide registrar las suites restantes. Cada suite usa un navegador aislado;
las pruebas de Session Storage no modifican el historial del navegador del
usuario. Las peticiones externas se bloquean para aislar la copia local.

## Criterios operativos

Los criterios siguientes hacen comprobable la descripcion de las tareas;
no sustituyen criterios de aceptacion externos que no hayan sido entregados.

| ID | Aceptacion y evidencia |
| --- | --- |
| E4-H1-T01 | Chat muestra bienvenida, mensajes y controles; sprint1.json |
| E4-H1-T03 | Mensajes de usuario y asistente diferenciados; sprint1.json |
| E4-H1-T04 | Misma conversacion al navegar; sprint1.json, manual-return-context.cjs.log |
| E1-H1-T01 | Campo, boton y envio con Enter funcionan; sprint1.json |
| E1-H1-T02 | Entrada de espacios no genera consulta; sprint1.json |
| E1-H1-T03 | Consulta valida obtiene respuesta real; sprint2.json y sprint4.json |
| E1-H2-T01 | Guardado temporal, recarga, navegacion y reinicio; sprint2.json |
| E1-H2-T03 | Seguimiento usa preferencia y motivo previos; sprint2.json |
| E3-H1-T03 | Menu real expone opciones accesibles; sprint3.json |
| E3-H1-T04 | Destino no encontrado produce fallo; sprint3.json |
| E3-H2-T01 | Objetivo recibe marcador visual; sprint3.json |
| E3-H2-T02 | Cambiar objetivo elimina el marcador anterior; sprint3.json |
| E3-H2-T03 | Texto ausente u oculto no anuncia exito; sprint3.json |
| E3-H2-T04 | Marcador descubierto y no tapado; sprint3.json |
| E3-H3-T01 | Control real responde y navega; sprint3-model.json, manual-return-context.cjs.log |
| E3-H3-T02 | Apertura, cambio y cierre automatico/explicito; sprint3.json |
| E3-H3-T03 | Controles ausentes, deshabilitados o separados se rechazan; sprint3.json |
| E3-H3-T04 | Error visible; opcion inexistente no se omite; sprint3.json |
| E2-H2-T01 | Referencia sin antecedente y consulta ininteligible no actuan; sprint4.json |
| E2-H2-T02 | Solicitud de aclaracion o reformulacion; sprint4.json |
| E2-H2-T03 | Aclaracion de menu retoma la solicitud y abre el control; sprint4.json |
| E2-H2-T04 | Dato no disponible se reconoce sin inventar una cifra; sprint4.json |
| E4-H2-T01 | Este plan vincula tareas, criterios y pruebas |
| E4-H2-T02 | Ejecucion consolidada con resultados; acceptance.json |
| E4-H2-T03 | Registro de fallos, cambios y repeticion; validation.md y logs |
| E4-H2-T04 | Indice final de evidencias; validation.md |

## Alcance y limites

Chromium automatizado: no equivale a una prueba manual en cada dispositivo.
La vista movil se comprueba a 375px para interfaz; la navegacion detallada
se prueba en escritorio. No se recorren exhaustivamente las 81 fichas.
Las suites funcionales del ejecutor de acciones usan planes predeterminados;
las suites de contexto, aclaracion y navegacion indicadas usan Ollama real.
Un resultado positivo no garantiza todas las formulaciones de lenguaje
natural. No se certifica actualidad de precios ni contenido institucional.
