# Correccion de busqueda y apertura de carreras

Fecha local: 4 de noviembre de 2026.

## Problema observado

El visitante solicitaba buscar carreras y abrir Ingenieria en Informatica,
pero recibia informacion en vez de navegacion o una aclaracion repetida.
La reproduccion no repitio literalmente todos los mensajes del ejemplo:
propuso abrir Escuelas, ir al catalogo y resaltar la carrera, sin abrir su ficha.
El resultado confirma que el objetivo concreto podia perderse durante la
planificacion del modelo. Evidencia: career-navigation-before.json.

Tambien se reprodujo una contradiccion informativa: con una afirmacion
incorrecta anterior en el historial, el modelo indicaba solo Diurna para
Alameda aunque los datos adjuntos incluian Diurna y Vespertina.

## Cambios

- Las peticiones simples de navegacion con un nombre completo del catalogo
  se resuelven contra su ruta real, sin pedir a la IA que invente un recorrido.
- La busqueda del catalogo general no selecciona una carrera particular.
- Una referencia a esa informacion puede recuperar la carrera cuando su
  nombre aparece en el dialogo reciente; un valor antiguo aislado no basta.
- Una peticion concreta nueva reemplaza la correccion antigua que bloqueaba
  la conversacion. Las negaciones, preguntas informativas y guias compuestas
  no se sustituyen por esta ruta directa.
- Los campos estructurados de una carrera nombrada se presentan directamente
  desde el catalogo cuando se solicita duracion, escuela, tipo, sedes o jornadas.
  Se conserva su fuente y fecha de captura, sin afirmar actualidad en tiempo real.
- No se modificaron ni eliminaron valoraciones o propuestas existentes en Oracle.

## Pruebas

career-navigation-regression.cjs comprueba siete escenarios principales:

1. me buscas las carreras abre /carreras.html.
2. buscame ingenieria en informatica abre la ficha correspondiente.
3. Me llevarias hasta donde esta toda esa informacion recupera la ficha desde
   el contexto, incluso con una correccion antigua almacenada.
4. La peticion explicita de viajar hasta Ingenieria en Informatica llega a la ficha.
5. carrera -> ingenieria en informatica llega a la misma ficha.
6. Once entradas no pertinentes no autorizan esta navegacion; se rechazan
   rutas externas, no se actua sin referente y no se recarga una ficha ya abierta.
7. La consulta de jornadas de Alameda respeta Diurna y Vespertina del catalogo,
   aunque el historial diga incorrectamente solo Diurna.

Las cinco navegaciones se ejecutan desde el campo y el boton del chat en
Chromium, verificando la URL de destino, el historial y la sustitucion de la
correccion antigua. Estos recorridos directos son deterministas, no inferencias
del modelo. La evidencia final esta en career-navigation.json.

La suite se incorporo al ejecutor general, que ahora contiene once suites.
El resultado consolidado y sus logs estan en acceptance.json y los archivos
*.log de este directorio. Se conservan las pruebas con Ollama real para los
flujos que siguen requiriendo interpretacion o generacion.

## Alcance

Las abreviaturas ambiguas, los nombres incompletos y las instrucciones con
varias operaciones siguen necesitando interpretacion y pueden requerir
aclaracion. No se certifican todas las formulaciones posibles. El catalogo
consultado es una copia y no valida por si mismo la oferta institucional actual.

Se actualizaron las versiones del cliente en las paginas del proyecto para
que la recarga cargue el cambio sin exigir borrar la conversacion.
