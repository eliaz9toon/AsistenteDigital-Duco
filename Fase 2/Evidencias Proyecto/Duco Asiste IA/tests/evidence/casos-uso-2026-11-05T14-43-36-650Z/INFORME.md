# Evidencias de casos de uso de Duco Asiste

31 casos documentados, 28 verificados en el escenario ejecutado y 3 con fallo. 77 capturas PNG originales. 7 escenarios complementarios.

Fecha: 05-11-2026, 11:43:36 a. m. (America/Santiago).

Abrir index.html para recorrer la galeria; cada imagen puede abrirse en su tamano original.

## Resultados

| ID | Caso | Estado del escenario | Capturas base |
|---|---|---|---|
| CU-01 | Abrir y cerrar el asistente | VERIFICADO | 3 |
| CU-02 | Consultar informacion institucional | VERIFICADO | 2 |
| CU-03 | Buscar y filtrar carreras | VERIFICADO | 2 |
| CU-04 | Consultar la ficha de una carrera | VERIFICADO | 2 |
| CU-05 | Solicitar una explicacion de una carrera | VERIFICADO | 5 |
| CU-06 | Navegar a otra pagina mediante Duco | VERIFICADO | 2 |
| CU-07 | Localizar una seccion mediante desplazamiento | FALLO | 2 |
| CU-08 | Resaltar un texto o elemento | VERIFICADO | 2 |
| CU-09 | Mostrar el respaldo de una explicacion | VERIFICADO | 2 |
| CU-10 | Abrir un menu del sitio | VERIFICADO | 2 |
| CU-11 | Cerrar menus abiertos por la guia | VERIFICADO | 2 |
| CU-12 | Seleccionar una pestana de la ficha | VERIFICADO | 2 |
| CU-13 | Abrir contenido multimedia de una carrera | VERIFICADO | 3 |
| CU-14 | Aclarar una consulta ambigua | VERIFICADO | 2 |
| CU-15 | Corregir una interpretacion o accion de Duco | FALLO | 2 |
| CU-16 | Continuar una conversacion durante la navegacion | VERIFICADO | 3 |
| CU-17 | Repetir una guia o un resaltado anterior | VERIFICADO | 3 |
| CU-18 | Iniciar una nueva conversacion | VERIFICADO | 2 |
| CU-19 | Valorar una respuesta o una guia | VERIFICADO | 2 |
| CU-20 | Proponer informacion para revision | VERIFICADO | 2 |
| CU-21 | Consultar propuestas de conocimiento pendientes | VERIFICADO | 1 |
| CU-22 | Aprobar una propuesta de conocimiento | VERIFICADO | 3 |
| CU-23 | Rechazar una propuesta de conocimiento | VERIFICADO | 2 |
| CU-24 | Revisar valoraciones negativas | VERIFICADO | 2 |
| CU-25 | Consultar tablas y registros administrables | VERIFICADO | 1 |
| CU-26 | Crear un registro administrativo | VERIFICADO | 2 |
| CU-27 | Modificar un registro administrativo | VERIFICADO | 3 |
| CU-28 | Eliminar un registro administrativo | VERIFICADO | 2 |
| CU-29 | Reintentar una consulta tras un fallo del servicio de IA | VERIFICADO | 2 |
| CU-30 | Solicitar una carrera alternativa | FALLO | 2 |
| CU-31 | Consultar la ubicacion actual y la peticion anterior | VERIFICADO | 2 |

## Incidencias

- CU-07: No se encontró el destino del desplazamiento
- CU-15: ¿Qué carrera quieres que explique y vaya resaltando? Indícame su nombre completo.
- CU-30: page.waitForURL: Timeout 120000ms exceeded.

## Como se obtuvieron

Se ejecutaron controles de la interfaz y acciones del motor sobre las paginas reales del proyecto. Los JSON distinguen consultas por UI, integracion directa y planes controlados. Se registraron 13 respuestas HTTP reales del modelo. Los casos de administracion usan la base Oracle real y comprobaciones por conexion independiente. Las claves de prueba usan un marcador unico; no se modificaron registros de negocio previos. Las trazas de auditoria generadas por la aplicacion se conservan.

Limpieza final de registros temporales: confirmada. Revisar limpieza.json.

## Limitaciones

- Chromium de escritorio; capturas moviles por emulacion, no telefono fisico.
- Ollama se usa solo como servicio de IA del prototipo, no como requisito del visitante final.
- Las pruebas del motor de acciones no certifican la interpretacion de lenguaje natural.
- CU-29 provoca un fallo controlado; no se apaga el servicio compartido.
- Abrir el reproductor no certifica reproduccion audiovisual externa.
- No se certifican produccion, autenticacion administrativa ni exactitud semantica completa del modelo.
- Un escenario complementario inicial de CU-07 no pudo iniciar por un encabezado de prueba inexistente; es un fallo de precondicion del guion, no una segunda incidencia de la aplicacion. Se conserva junto a la nueva prueba con un encabezado real.
- CU-30 no navego y genero una respuesta con preferencias no expresadas en esa sesion y una oferta de Enfermeria no verificada. No usar esa respuesta como informacion institucional.
- Las verificaciones son escenarios concretos, no cobertura exhaustiva de todas las variantes de cada caso.
- En CU-15 el enrutador devolvio una aclaracion sin llamar al modelo: no atribuir ese resultado a Ollama.
- Algunas capturas muestran el chat sobre parte del contenido; CU-09 incluye una toma adicional con el panel cerrado.
- Los datos administrativos son sinteticos y estan identificados por un marcador unico. No son conocimiento institucional.
- Las capturas no se han retocado. Los planes o precondiciones controlados se declaran por caso.
- Se conservaron los fallos iniciales y sus registros. Las pruebas complementarias no los borran ni los convierten en aprobados.

## Archivos

- index.html: galeria navegable por los 31 identificadores originales.
- CU-XX*.png: capturas originales; las de detalle administrativo pueden ser recortes de un elemento, sin retoques.
- CU-XX.json: entradas, resultados, errores y respuestas del modelo por caso.
- CU-XX-oracle-inspect.json: comprobaciones independientes de datos.
- resultados.json: ejecucion principal completa, con fallos preservados.
- complementarias.json: escenarios adicionales y alcance declarado.
- limpieza.json: confirmacion de retirada de datos temporales.
- integridad.json: tamano y SHA-256 de capturas, registros y scripts.
- scripts/: fuentes de la automatizacion para revision.

No se han realizado cambios funcionales a la aplicacion durante esta recogida de evidencias.
