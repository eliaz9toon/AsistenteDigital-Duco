# Correcciones de CU-07, CU-15 y CU-30

Fecha: 5 de noviembre de 2026, America/Santiago.

## Resultado

Las tres incidencias se corrigieron y sus escenarios de regresion pasaron en dos ejecuciones. Este paquete recoge la ultima ejecucion, sobre el codigo final, con 10 capturas nuevas y 3 capturas de la ejecucion anterior para comparar. Abrir index.html para consultar la galeria.

Ademas, las 14 suites de tests/run-acceptance.cjs terminaron sin fallos. El informe completo esta en regresion/acceptance.json y los resultados de cada suite en sus archivos de registro.

## Cambios y comprobaciones

| Caso | Causa | Correccion | Comprobacion |
|---|---|---|---|
| CU-07 | El buscador de destinos de scroll ignoraba los controles del navbar y el scroll directo no usaba la guia para elementos fijos. | Se reconocen controles de navegacion por su nombre completo y se utiliza el desplazamiento guiado existente. | Desde scroll 1600 se vuelve al inicio, Vida Estudiantil queda visible y sin obstrucciones, y se registran posiciones intermedias de desplazamiento suave. Tambien pasa el desplazamiento a una seccion del cuerpo; un destino inexistente sigue fallando honestamente. |
| CU-15 | La coincidencia por prefijo confundia explicativo con una orden de explicar. | Se separa la solicitud de respaldo de una nueva explicacion y se recuperan exclusivamente los parrafos del contexto de evidencia actual. | Tras generar una explicacion con Ollama real y resaltar el titulo como precondicion controlada, la correccion por UI resalta parrafos que pertenecen a las fuentes guardadas y no marca encabezados. Se captura tambien el respaldo con el panel cerrado. |
| CU-30 | La solicitud de otra carrera podia ser clasificada como conversacion y generar datos no fundamentados. | Las solicitudes explicitas de otra carrera sin restricciones se resuelven contra el catalogo local validado, evitando la carrera actual y las ya mostradas cuando quedan opciones. | Desde la ficha se navega al catalogo y se destaca una carrera real. Una segunda solicitud elige otra distinta. Se verifica que no se necesita generacion de texto del modelo para estas alternativas. |

Se actualizaron los identificadores de cache de los dos scripts en las 83 paginas que los cargan, para que una recarga obtenga la version corregida.

## Limites

- Pruebas automatizadas en Chromium; no se utilizo un telefono fisico.
- El escenario de desplazamiento prueba directamente el motor de acciones; no certifica cada formulacion posible en lenguaje natural.
- Para aislar la correccion de CU-15 se genera una explicacion real por el motor y se coloca un resaltado de titulo controlado antes de enviar la rectificacion por la interfaz.
- Las alternativas con requisitos de sede, modalidad, horario u otros filtros no se convierten silenciosamente en una eleccion cualquiera: se dejan fuera del nuevo atajo.
- Las tres incidencias quedan revalidadas. No se repitio en este paquete la toma de capturas de los otros 28 casos ni se certifica cobertura exhaustiva de sus variantes.
- Ollama es el servicio de IA del prototipo, no un requisito para el visitante de la solucion final.

## Integridad y datos

resultados.json contiene solicitudes, respuestas, resultados de acciones, muestreos de scroll y comprobaciones. Los archivos CU-XX-antes.json conservan los fallos originales sin modificarlos. integridad.json incluye hashes SHA-256 de los archivos entregados.

La limpieza de las sesiones y registros temporales usados en la prueba fue confirmada mediante Oracle. Los eventos de auditoria generados por la aplicacion se conservan; no se eliminaron registros de negocio previos.

La carpeta codigo contiene una copia de los dos scripts corregidos y del auxiliar de limpieza. No contiene credenciales ni archivos .env.
