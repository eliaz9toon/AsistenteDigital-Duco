# Explicacion guiada por etapas

Se atiende la peticion combinada de explicar una carrera e ir resaltando su
contenido. No se sustituye por marcar solamente el titulo de la carrera.

## Comportamiento

- Si hace falta, abre la ficha identificada con una ruta comprobada del catalogo.
- Conserva la indicacion de explicacion guiada al continuar tras navegar.
- Recoge parrafos de contenido de la ficha y pide al servicio de IA un plan
  de dos a cuatro explicaciones, cada una vinculada con un parrafo diferente.
- Valida todo el plan antes de mostrar una etapa: indices existentes, fuentes
  distintas y explicaciones no vacias con longitud acotada.
- En cada etapa revela, desplaza y resalta el respaldo antes de escribir la
  explicacion. Reemplaza el marcador anterior, conserva una pausa de lectura
  y calcula la duracion visual considerando tambien el tiempo de escritura.
- Mantiene bloqueados nuevos envios durante la secuencia para no mezclarlos.
- Guarda las explicaciones y sus fuentes para seguimientos. La valoracion
  final corresponde al contenido explicado, no solo al anuncio inicial.
- Una fuente que desaparece detiene la secuencia y produce un fallo explicito.
  No se intenta reparar ese fallo sustituyendo la guia por un titulo marcado.

## Validacion

Prueba reproducible: node tests/guided-explanation.cjs.
Evidencia: guided-explanation.json.

1. Peticion combinada, ficha ya abierta, negacion y objetivo ambiguo.
2. Peticion exacta del visitante desde el campo del chat, navegacion real a
   Ingenieria en Informatica y plan generado por Ollama real qwen3.5:9b.
   Se comprueba que el respaldo esta marcado antes de cada fragmento y que
   se conserva el orden, el bloqueo de envios y el contenido de la valoracion.
3. Referencias invalidas simuladas se rechazan sin mostrar etapas ni marcadores.
4. La eliminacion simulada de una fuente durante la guia impide mostrar la
   siguiente etapa como si estuviera respaldada.

La prueba funcional acelera las pausas a 120 ms y desactiva la escritura
animada para medir el orden sin esperas innecesarias. En uso normal, las
pausas calculadas duran entre tres y ocho segundos y el marcador considera
el tiempo de escritura. Esto no equivale a probar todas las velocidades de
lectura ni todos los dispositivos.

Tambien pasaron chat-bold.cjs, career-navigation-regression.cjs y
sprint3-browser.cjs. La suite nueva se incorporo al ejecutor de aceptacion;
no se volvio a ejecutar en este cambio la totalidad del conjunto general.

## Alcance

Se prueban carreras identificables del catalogo y el recorrido de escritorio
en Chromium. Una peticion ambigua solicita el nombre; una explicacion de otro
tema no se fuerza a esta ruta. La referencia usa la ficha disponible, no una
consulta institucional en tiempo real. La validacion de indices no certifica
por si sola la exactitud de cada parafrasis que pueda generar el modelo.
