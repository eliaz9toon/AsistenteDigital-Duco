from pathlib import Path
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent
CASES = []

def case(title, actor, goal, pre, trigger, steps, alternatives, post, related):
    CASES.append(dict(id=f'CU-{len(CASES)+1:02}', title=title, actor=actor, goal=goal,
                      pre=pre, trigger=trigger, steps=steps, alternatives=alternatives,
                      post=post, related=related))

case('Abrir y cerrar el asistente', 'Visitante',
     'Acceder al chat integrado sin abandonar la página y ocultarlo cuando no se necesite.',
     'El sitio está abierto y el componente de Duco Asiste terminó de cargar.',
     'El visitante activa el botón de Duco mediante clic, toque o teclado.',
     ['El visitante localiza y activa el botón del asistente.',
      'El sistema muestra el panel, identifica a Duco y presenta la bienvenida o la conversación existente.',
      'El sistema habilita el campo de consulta y dirige el foco al campo cuando el panel está visible.',
      'El visitante consulta los mensajes o prepara una pregunta.',
      'El visitante utiliza Cerrar o la tecla Escape; el sistema oculta el panel y devuelve el foco al botón de apertura.'],
     ['Si el visitante vuelve a abrir el panel, el sistema conserva los mensajes de la sesión; cerrar no equivale a borrar.',
      'En una pantalla estrecha, el panel adapta su tamaño y los controles mantienen un área de interacción adecuada.'],
     'El panel queda abierto y utilizable, o cerrado sin perder el diálogo.',
     'Da acceso a CU-02 y CU-18. La adaptación visual es una condición de interfaz, no un actor diferente.')

case('Consultar información institucional', 'Visitante',
     'Obtener una respuesta sobre Duoc UC utilizando la información que el sistema tenga disponible.',
     'El chat está abierto. Para generar una respuesta mediante IA, el servicio correspondiente debe estar disponible.',
     'El visitante escribe y envía una pregunta institucional.',
     ['El visitante introduce una consulta y pulsa Enviar o Enter.',
      'El sistema elimina espacios exteriores y valida que la consulta no esté vacía ni exceda la longitud permitida.',
      'El sistema incorpora el contexto pertinente de la conversación, la página actual y las fuentes disponibles.',
      'El servicio de IA interpreta la pregunta y genera una respuesta sin ejecutar operaciones visuales que no se hayan solicitado.',
      'El sistema presenta la respuesta diferenciada del mensaje del visitante y conserva el intercambio en el historial temporal.'],
     ['Si el mensaje está vacío o es demasiado largo, el sistema muestra una indicación y no lo envía al servicio de IA.',
      'Si falta información o la solicitud no se comprende, el sistema reconoce el límite o solicita aclaración mediante CU-14.',
      'Si el servicio no responde o devuelve un resultado inválido, el sistema informa el problema y permite reintentar mediante CU-29.'],
     'Se presenta una respuesta o una explicación del impedimento; no se inventa que una acción fue completada.',
     'Se relaciona con CU-05, CU-14, CU-16, CU-19 y CU-29.')

case('Buscar y filtrar carreras', 'Visitante',
     'Encontrar opciones académicas en el catálogo mediante texto y filtros disponibles.',
     'El catálogo de carreras está accesible y sus datos y controles de búsqueda han cargado.',
     'El visitante accede al catálogo e introduce un término o modifica un filtro.',
     ['El visitante abre el catálogo directamente o mediante una solicitud de navegación al asistente.',
      'El sistema muestra las carreras y los filtros disponibles en esa versión del catálogo.',
      'El visitante escribe un término y puede seleccionar modalidad, tipo, escuela, sede o jornada cuando esos filtros estén disponibles.',
      'El sistema procesa los criterios y actualiza los resultados sin modificar la información de las carreras.',
      'El visitante revisa los resultados, limpia los filtros o selecciona una carrera para consultar su ficha.'],
     ['Si no existen coincidencias, el sistema comunica la ausencia de resultados y permite cambiar los criterios.',
      'Si los datos no pueden cargarse, la búsqueda no debe presentarse como completada.',
      'En una pantalla estrecha, el visitante puede desplegar los filtros mediante el control previsto para esa vista.'],
     'Queda visible el conjunto de resultados correspondiente a los criterios introducidos.',
     'Puede preceder a CU-04. Es una función del sitio integrado y no requiere IA para cada búsqueda manual.')

case('Consultar la ficha de una carrera', 'Visitante',
     'Acceder a la información específica de una carrera sin confundirla con el catálogo general.',
     'Existe una ficha accesible y la carrera puede identificarse por su nombre o por el contexto.',
     'El visitante selecciona una carrera o pide a Duco que la abra.',
     ['El visitante identifica la carrera en un resultado del catálogo o en su solicitud al asistente.',
      'El sistema comprueba que el destino corresponde a una ficha disponible.',
      'Si la petición se realizó al asistente, este utiliza el nombre y el contexto para resolver el destino.',
      'El sistema abre la ficha y presenta el contenido disponible, manteniendo la conversación de la sesión.',
      'El visitante revisa la información y puede solicitar una explicación o acceder a sus secciones.'],
     ['Si el nombre corresponde a varias alternativas, el sistema solicita precisar la carrera antes de elegir arbitrariamente.',
      'Si se pidió únicamente el catálogo general, el sistema no debe añadir la apertura de una ficha particular.',
      'Si la ficha no está disponible, se informa el problema y se permite consultar otra opción.'],
     'La ficha identificada queda visible, o el visitante recibe una explicación del impedimento.',
     'Se relaciona con CU-03, CU-05, CU-06, CU-12 y CU-30.')

case('Solicitar una explicación de una carrera', 'Visitante',
     'Comprender la información de una carrera mediante una explicación apoyada en fuentes disponibles.',
     'La carrera está identificada y existe información legible en su ficha o en el catálogo.',
     'El visitante solicita que Duco explique una carrera o un aspecto de ella.',
     ['El visitante indica la carrera o formula la petición mientras consulta su ficha.',
      'El sistema reúne los datos y párrafos disponibles para esa carrera y distingue lo que no consta.',
      'El servicio de IA redacta la explicación utilizando esas fuentes y el objetivo de la consulta.',
      'El sistema presenta la explicación y, cuando se identifican párrafos de respaldo ejecutables, los señala en la página.',
      'El visitante puede hacer una pregunta relacionada o pedir que se vuelva a mostrar el respaldo de la explicación.'],
     ['Si no hay una carrera inequívoca, el sistema pide identificarla.',
      'Si faltan datos como aranceles o requisitos, el sistema informa esa ausencia en vez de completarlos por suposición.',
      'Si puede explicar pero no localizar el párrafo de respaldo, distingue la respuesta informativa del fallo de la guía visual.'],
     'El visitante obtiene una explicación contextual y conoce los límites de la información utilizada.',
     'Puede utilizar CU-09 para mostrar respaldo y CU-16 para preguntas relacionadas.')

case('Navegar a otra página mediante Duco', 'Visitante',
     'Acceder a un destino del sitio mediante una petición en lenguaje natural.',
     'El chat está disponible y el sistema puede identificar y comprobar un destino de navegación.',
     'El visitante solicita abrir una página, volver al inicio o regresar a una página anterior.',
     ['El visitante envía la petición de navegación.',
      'El sistema interpreta el destino final, dando prioridad al objetivo explícito sobre referencias antiguas.',
      'El sistema verifica que existe un enlace o ruta local ejecutable y prepara los pasos necesarios.',
      'Duco abre los controles pertinentes y ejecuta la navegación en el orden solicitado.',
      'En la página de destino, el sistema recupera la conversación y continúa los pasos pendientes cuando correspondan.'],
     ['Si la petición es ambigua, se solicita aclaración antes de navegar.',
      'Si el enlace no existe o la ruta no puede resolverse, el sistema informa el fallo y no afirma que llegó al destino.',
      'Si el visitante nombra un destino concreto, ese destino prevalece sobre una interpretación genérica de volver.'],
     'El visitante llega al destino identificado o recibe un mensaje que explica por qué no fue posible.',
     'Puede coordinar CU-07, CU-10 y CU-16. No toda navegación requiere abrir un menú.')

case('Localizar una sección mediante desplazamiento', 'Visitante',
     'Encontrar una sección de la página actual sin buscarla manualmente mediante scroll.',
     'El objetivo existe en la página y su contenedor puede mostrarse.',
     'El visitante pide que Duco lo lleve a una sección o elemento de la página.',
     ['El visitante identifica el objetivo por su nombre o por una referencia que el diálogo permita resolver.',
      'El sistema busca el elemento correspondiente y comprueba su disponibilidad.',
      'El sistema prepara los contenedores que deban abrirse o activarse para mostrarlo.',
      'El sistema desplaza la vista de forma guiada, considerando cabeceras fijas y elementos que puedan ocultar el contenido.',
      'Duco deja el objetivo en la vista para que el visitante continúe su interacción.'],
     ['Si el objetivo pertenece a un banner fijo cubierto por el contenido, el sistema vuelve al inicio para descubrirlo.',
      'Si no existe un destino coincidente, el sistema devuelve un fallo en vez de anunciar un desplazamiento satisfactorio.',
      'Si la solicitud corresponde a otra página, se resuelve mediante CU-06 en lugar de un scroll sin destino.'],
     'La sección localizada queda visible, o el sistema explica que no encontró un destino válido.',
     'Puede acompañar a CU-08, CU-09 y CU-10; es una operación de apoyo a la navegación guiada.')

case('Resaltar un texto o elemento', 'Visitante',
     'Distinguir visualmente un contenido específico de la página.',
     'El objetivo puede identificarse en el contenido disponible y puede hacerse visible.',
     'El visitante solicita resaltar, remarcar o señalar un objetivo.',
     ['El visitante indica el texto o elemento, usando comillas cuando necesita una coincidencia precisa.',
      'El sistema interpreta el alcance y busca un objetivo real en la página actual.',
      'El sistema prepara la vista, por ejemplo activando la diapositiva del carrusel o abriendo el contenedor adecuado.',
      'El sistema limpia el resaltado anterior que deba reemplazarse, guía al objetivo y aplica el marcador o contorno correspondiente.',
      'El sistema mantiene el efecto durante un tiempo de lectura y registra el resultado de la ejecución para seguimientos.'],
     ['Si no hay contenido coincidente, el sistema informa que no pudo resaltarlo; no sustituye el objetivo por el navbar.',
      'Si se necesita precisar el alcance, el sistema pide aclaración.',
      'Si el contenido solo está oculto y no puede revelarse, no se informa un éxito visual.'],
     'El objetivo queda marcado y visible durante la guía, o se informa un resultado fallido.',
     'Se relaciona con CU-07, CU-09 y CU-17. El éxito requiere ejecución, no solo una frase generada por IA.')

case('Mostrar el respaldo de una explicación', 'Visitante',
     'Relacionar una explicación de Duco con los párrafos de la ficha que la sustentan.',
     'Existe una explicación previa con párrafos fuente identificados y la página de respaldo está accesible.',
     'El visitante pide ver el texto que respalda una explicación o activa una acción disponible para mostrarlo.',
     ['El visitante solicita señalar la información que sustenta la explicación.',
      'El sistema recupera los párrafos fuente asociados a esa explicación.',
      'El sistema contrasta esos textos con el contenido actual de la página y revela sus contenedores si es necesario.',
      'El sistema guía al primer bloque disponible y destaca los párrafos coincidentes.',
      'Duco comunica el resultado y conserva el objetivo para una posible repetición.'],
     ['Si no existen párrafos fuente identificados, el sistema reconoce que no puede mostrar ese respaldo.',
      'Si la página cambió y el texto no coincide, informa la ausencia en la vista actual.',
      'Si el visitante solicita una explicación adicional, se atiende mediante CU-05 sin confundirla con una petición de resaltado.'],
     'Los párrafos de respaldo quedan destacados, o se informa por qué no pudieron localizarse.',
     'Extiende la consulta explicativa de CU-05 y puede repetirse mediante CU-17.')

case('Abrir un menú del sitio', 'Visitante',
     'Acceder a opciones de navegación contenidas en un menú desplegable.',
     'El sitio contiene un control de menú disponible y habilitado.',
     'El visitante solicita abrir un menú por su nombre o por una opción que pertenece a él.',
     ['El visitante envía la petición de apertura.',
      'El sistema identifica el control y su menú propietario, evitando confundir una opción interior con otro destino de la página.',
      'El sistema comprueba que el control sigue conectado al documento y no está deshabilitado.',
      'El sistema cierra estados transitorios incompatibles, prepara la vista y abre el menú identificado.',
      'Duco deja visibles las opciones; si corresponde, puede señalar una de ellas y cerrar el menú al finalizar la guía.'],
     ['Si el control no existe o está deshabilitado, el sistema informa que no puede abrirlo.',
      'Si una opción solicitada no existe dentro del menú, ese paso devuelve un fallo explícito.',
      'Si el visitante pidió abrir y después cerrar, el sistema ejecuta ambas operaciones en ese orden.'],
     'El menú queda abierto para lectura o interacción, o se registra un fallo de apertura.',
     'Puede preceder a CU-06, CU-08 o CU-11. Es una operación de apoyo de la navegación.')

case('Cerrar menús abiertos por la guía', 'Visitante',
     'Despejar la página al terminar de revisar un menú o una secuencia guiada.',
     'Existe un menú abierto o un estado transitorio gestionado por la guía.',
     'El visitante pide cerrar el menú o finaliza una guía que debe limpiarse automáticamente.',
     ['El visitante solicita el cierre o el sistema alcanza el final de la guía.',
      'El sistema identifica los menús y estados transitorios pertinentes.',
      'Cuando el cierre es automático, el sistema respeta un tiempo de lectura coherente con el resaltado.',
      'El sistema retira el estado abierto y actualiza los atributos correspondientes de los controles.',
      'El sistema cancela temporizadores obsoletos y devuelve la página a un estado de navegación normal.'],
     ['Si no hay menús abiertos, la operación no debe provocar un error ni abrir otro control.',
      'Si empieza una nueva guía, la limpieza anterior no debe cerrar prematuramente el nuevo menú.',
      'El cierre de dropdowns no debe modificar el estado declarado de componentes ajenos, como un acordeón no relacionado.'],
     'Los menús pertinentes quedan cerrados sin alterar componentes ajenos a la operación.',
     'Puede seguir a CU-10. El cierre automático es comportamiento de apoyo, no una nueva intervención del visitante.')

case('Seleccionar una pestaña de la ficha', 'Visitante',
     'Acceder a un apartado de una ficha mediante su pestaña correspondiente.',
     'La ficha actual contiene la pestaña solicitada y su panel asociado.',
     'El visitante pide seleccionar un apartado como Perfil de egreso.',
     ['El visitante identifica la pestaña que desea consultar.',
      'El sistema busca un control coincidente entre las pestañas disponibles.',
      'El sistema verifica que el contenido asociado existe y guía hacia el control.',
      'Duco activa la pestaña y comprueba su selección o la activación del panel.',
      'El visitante revisa el apartado que quedó visible.'],
     ['Si solo se pidió localizar el rótulo, el sistema puede señalarlo sin seleccionarlo.',
      'Si el control o su panel no están disponibles, se informa el fallo en lugar de simular una selección.',
      'Si el apartado pertenece a otra ficha, primero debe resolverse el destino de navegación.'],
     'La pestaña identificada queda seleccionada y su contenido visible, o se informa el impedimento.',
     'Se relaciona con CU-04, CU-06 y CU-08.')

case('Abrir contenido multimedia de una carrera', 'Visitante',
     'Consultar un recurso multimedia disponible, como el video de una carrera.',
     'Existe un botón disponible que abre el recurso o diálogo correspondiente.',
     'El visitante pide abrir el video o activa su botón en la ficha.',
     ['El visitante identifica el contenido que desea abrir.',
      'Si la solicitud se realiza por chat, el sistema localiza el control real y su diálogo asociado.',
      'El sistema comprueba que el botón y el contenedor existen y pueden utilizarse.',
      'El sistema activa el control y verifica que el contenido se abrió.',
      'El visitante consulta el recurso y puede cerrarlo mediante los controles del sitio.'],
     ['Si no se identifica el recurso, el sistema solicita su nombre o informa que no encuentra el control.',
      'Si el diálogo abre pero el proveedor externo no carga el video, el sistema no debe confundir esa apertura con una reproducción correcta.',
      'Si el visitante cambia de objetivo, una referencia antigua al video no debe impedir atender la nueva petición.'],
     'El contenedor del recurso queda abierto o se comunica el fallo; la reproducción depende de su disponibilidad.',
     'Se relaciona con CU-04 y CU-15. Puede requerir conexión con un proveedor externo.')

case('Aclarar una consulta ambigua', 'Visitante',
     'Precisar una petición que no permite determinar de forma segura qué debe responder o ejecutar Duco.',
     'Existe una consulta ambigua, incompleta, no reconocida o con un referente sin antecedente suficiente.',
     'El visitante envía una expresión como Ábreme eso sin que el objetivo pueda resolverse.',
     ['El visitante envía la consulta inicial.',
      'El sistema intenta interpretarla con la conversación y el estado actual de la página.',
      'Al no identificar un objetivo suficiente, el sistema solicita la aclaración mínima y no ejecuta acciones visuales.',
      'El visitante aporta el nombre, el propósito o el elemento faltante.',
      'El sistema interpreta la aclaración junto con la petición anterior y continúa el caso de uso correspondiente.'],
     ['Si el nuevo mensaje sigue siendo ambiguo, el sistema pide reformular sin elegir un destino arbitrario.',
      'Si el visitante cambia explícitamente de objetivo, el nuevo objetivo reemplaza al anterior.',
      'La necesidad de aclaración bloquea las acciones también al repetir, corregir o pedir una alternativa.'],
     'La intención queda suficientemente definida para continuar, o el sistema mantiene una solicitud de aclaración.',
     'Puede extender CU-02, CU-06, CU-08 y CU-10; no implica registrar conocimiento aprobado.')

case('Corregir una interpretación o acción de Duco', 'Visitante',
     'Sustituir un objetivo equivocado o una ejecución que no correspondía a la petición del visitante.',
     'Existe una respuesta o acción anterior que el visitante desea corregir.',
     'El visitante expresa que no era lo solicitado y aporta una corrección o restricción.',
     ['El visitante identifica el malentendido y explica qué desea en su lugar.',
      'El sistema distingue una corrección de la simple elección de otra opción.',
      'El sistema establece el objetivo corregido y las restricciones, sin copiar el plan rechazado.',
      'Si hay un objetivo suficiente, Duco prepara y comprueba un nuevo plan; si falta información, pide aclaración.',
      'El sistema presenta el resultado y conserva la corrección como contexto para los seguimientos pertinentes.'],
     ['Si la corrección es ambigua, no se ejecuta el objetivo anterior por defecto.',
      'Si existía una interacción de acciones registrada, el sistema puede asociarle una valoración negativa conforme al mecanismo de corrección del prototipo.',
      'Si falla el registro de la corrección en el servicio de datos, el sistema no afirma que quedó persistida; el diálogo puede conservarse en la sesión.'],
     'La conversación apunta al objetivo corregido o solicita el dato que falta para resolverlo.',
     'Se relaciona con CU-14, CU-16 y CU-19. Corregir no equivale a reentrenar el modelo.')

case('Continuar una conversación durante la navegación', 'Visitante',
     'Formular seguimientos sin repetir los datos ya conversados, aunque cambie la página consultada.',
     'El historial temporal de la sesión está disponible en el navegador.',
     'El visitante pregunta algo relacionado con turnos anteriores o navega durante la conversación.',
     ['El visitante realiza una consulta o declara información relevante para su orientación.',
      'El sistema conserva el diálogo y los datos de contexto necesarios en el almacenamiento temporal de la sesión.',
      'El visitante navega, vuelve manualmente o recarga una página del sitio.',
      'El sistema recupera los mensajes y obtiene la ubicación actual del navegador.',
      'Ante una consulta relacionada, Duco utiliza los turnos previos pertinentes sin asumir que un menú o resaltado antiguo sigue activo.'],
     ['Si el visitante reinició la conversación o el historial ya no existe, el sistema no inventa datos personales anteriores.',
      'Si la referencia apunta a otra página, el sistema distingue el objetivo histórico de la ubicación actual.',
      'El contexto enviado al servicio de IA es limitado; una referencia fuera de esa ventana puede requerir aclaración.'],
     'El seguimiento utiliza el contexto disponible y los mensajes se mantienen durante la sesión compatible.',
     'Se relaciona con CU-02, CU-06, CU-18 y CU-31. No supone historial permanente entre equipos.')

case('Repetir una guía o un resaltado anterior', 'Visitante',
     'Volver a ver una acción visual cuyo objetivo se identificó en la conversación.',
     'Existe un objetivo o plan anterior recuperable y debe comprobarse que aún sea ejecutable.',
     'El visitante solicita repetir la guía o dice Remárcame el mismo.',
     ['El visitante pide repetir la acción o mostrar el mismo objetivo.',
      'El sistema resuelve la referencia utilizando los planes y resultados disponibles de la sesión.',
      'El sistema comprueba la página actual y la presencia real del objetivo, sin depender únicamente de un resumen de texto.',
      'Si el plan sigue siendo válido, Duco lo ejecuta de nuevo y concede una nueva duración al efecto visual.',
      'El sistema comunica y registra el resultado de esa nueva ejecución.'],
     ['Si el plan anterior falló o no contiene un objetivo suficiente, el sistema pide aclaración o revisa la petición.',
      'Si cambió la página y el objetivo no está disponible, el sistema no presume que el éxito anterior garantiza el actual.',
      'Si el visitante corrige la guía, se aplica CU-15 en lugar de repetir el plan rechazado.'],
     'La guía se vuelve a ejecutar o se explica por qué no es válida en la situación actual.',
     'Se apoya en CU-07, CU-08, CU-09 y CU-16.')

case('Iniciar una nueva conversación', 'Visitante',
     'Comenzar un diálogo sin utilizar el historial ni el borrador de la conversación anterior.',
     'El chat está disponible y no está procesando una consulta que bloquee el reinicio.',
     'El visitante selecciona Nueva conversación.',
     ['El visitante activa el control de reinicio.',
      'El sistema elimina el historial y el contexto temporal de la conversación anterior y genera una nueva identidad de sesión conversacional.',
      'El sistema cancela estados visuales transitorios y elimina las acciones pendientes asociadas al diálogo anterior.',
      'El sistema limpia el campo de entrada y muestra una nueva bienvenida.',
      'Las consultas siguientes se procesan sin incorporar los turnos borrados.'],
     ['Si hay una consulta en proceso, el control permanece deshabilitado para no mezclar el reinicio con la respuesta pendiente.',
      'Si el visitante recarga después del reinicio, no deben reaparecer los mensajes anteriores.',
      'El reinicio del chat no elimina por sí mismo registros de valoraciones o propuestas ya guardados en el servidor.'],
     'La sesión conversacional queda reiniciada y el campo de consulta vacío.',
     'Interrumpe la continuidad de CU-16; no equivale a eliminar datos administrativos de Oracle.')

case('Valorar una respuesta o una guía', 'Visitante',
     'Informar si una respuesta fue útil y aportar una señal para revisión y contexto posterior.',
     'Existe una interacción valorable y el servicio de registro de valoraciones está disponible.',
     'El visitante selecciona una valoración positiva o negativa.',
     ['El visitante revisa la respuesta o el resultado de la guía y elige una valoración.',
      'El sistema identifica la sesión y la interacción para evitar registros incoherentes o votos duplicados de la misma interacción.',
      'El sistema envía la pregunta, la respuesta y la información de ejecución que corresponda a esa interacción.',
      'El servicio de datos registra la valoración y la vincula con conocimiento o propuestas cuando corresponde.',
      'El sistema informa si la valoración se guardó o si una propuesta quedó enviada a revisión.'],
     ['Si falla el registro, el sistema informa el problema y permite reintentar sin afirmar que se guardó.',
      'Una valoración positiva de una guía contextual no la convierte automáticamente en una respuesta institucional reutilizable.',
      'La valoración puede actualizar una interacción existente; no debe multiplicarse el voto por repetir la misma operación.'],
     'La valoración queda registrada o el visitante recibe una explicación del fallo.',
     'Puede alimentar CU-21 y CU-24. Las valoraciones aportan contexto y revisión, no reentrenamiento automático.')

case('Proponer información para revisión', 'Visitante',
     'Enviar una pregunta y su respuesta como propuesta de conocimiento, sin publicarla automáticamente.',
     'La información está identificada y el servicio de propuestas está disponible.',
     'El visitante solicita explícitamente guardar una pregunta y respuesta como propuesta.',
     ['El visitante pide que se proponga guardar la información indicada.',
      'El sistema comprueba que la petición es explícita y que existe una pregunta y una respuesta válidas.',
      'El sistema valida las longitudes y prepara los datos de la propuesta.',
      'El servicio de datos almacena la propuesta con estado pendiente de revisión.',
      'Duco comunica que fue enviada a revisión, sin afirmar que ya forma parte del conocimiento aprobado.'],
     ['Si falta la pregunta o la respuesta, el sistema solicita completar los datos o rechaza la propuesta inválida.',
      'Si el modelo propone guardar información sin solicitud explícita del visitante, el sistema no ejecuta esa acción.',
      'Si el servicio de datos falla, se informa que la propuesta no pudo guardarse.'],
     'Existe una propuesta pendiente o se comunica por qué no pudo registrarse.',
     'Se relaciona con CU-21, CU-22 y CU-23. Una valoración positiva también puede originar una propuesta mediante CU-19.')

case('Consultar propuestas de conocimiento pendientes', 'Administrador',
     'Revisar las preguntas y respuestas que requieren una decisión administrativa.',
     'El administrador tiene acceso habilitado al panel y el servicio de datos está disponible.',
     'El administrador abre la sección Revisar Duco.',
     ['El administrador accede a la función de revisión.',
      'El sistema consulta las propuestas pendientes y muestra la pregunta, la respuesta y la información de recepción disponible.',
      'El sistema muestra las valoraciones asociadas cuando existen, distinguiendo las sesiones únicas contabilizadas.',
      'El administrador examina el contenido y determina si corresponde aprobarlo o rechazarlo.',
      'El administrador puede ejecutar la decisión pertinente y actualizar la lista.'],
     ['Si no hay propuestas pendientes, el sistema muestra una lista vacía informativa.',
      'Si falla la consulta al servicio de datos, el sistema informa el error en lugar de presentar una lista desactualizada como vigente.',
      'El número de votos no sustituye la revisión de exactitud y pertinencia del contenido.'],
     'El administrador conoce las propuestas recuperadas o el problema que impidió consultarlas.',
     'Da acceso a CU-22 y CU-23; puede compartir la sección de revisión con CU-24.')

case('Aprobar una propuesta de conocimiento', 'Administrador',
     'Incorporar al conocimiento disponible una pregunta y respuesta revisadas.',
     'Existe una propuesta pendiente y el administrador puede acceder a su revisión.',
     'El administrador selecciona Aprobar en la propuesta.',
     ['El administrador revisa el contenido y solicita su aprobación.',
      'El sistema verifica que la propuesta todavía está pendiente y bloquea su revisión concurrente en la transacción.',
      'El sistema crea el conocimiento aprobado y vincula las valoraciones o variantes aplicables.',
      'El sistema actualiza el estado y la fecha de revisión de la propuesta y registra el evento de auditoría.',
      'El sistema confirma la operación y actualiza el listado de pendientes.'],
     ['Si la propuesta ya fue revisada o no existe, el sistema rechaza la operación.',
      'Si falla una operación de la transacción, el sistema no debe confirmar una aprobación parcial.',
      'La aprobación habilita su recuperación posterior, pero no garantiza que el modelo deba incluirla en todas las consultas.'],
     'La propuesta queda aprobada y su contenido disponible para recuperación como conocimiento.',
     'Parte de CU-21 y habilita el uso de información aprobada dentro de CU-02.')

case('Rechazar una propuesta de conocimiento', 'Administrador',
     'Impedir que una propuesta no pertinente o incorrecta se publique como conocimiento aprobado.',
     'Existe una propuesta pendiente de revisión.',
     'El administrador selecciona Rechazar.',
     ['El administrador revisa la propuesta y decide no aprobarla.',
      'El sistema comprueba que la propuesta sigue pendiente.',
      'El sistema registra el estado rechazado y la fecha de revisión sin crear una FAQ aprobada a partir de ella.',
      'El sistema registra el evento administrativo y confirma la transacción.',
      'El sistema retira la propuesta de la lista de pendientes y comunica el resultado.'],
     ['Si la propuesta ya fue revisada, el sistema informa que no puede aplicarse otra decisión mediante ese flujo.',
      'Si falla el servicio de datos, el sistema comunica el error y no afirma que la decisión fue guardada.',
      'El rechazo no implica borrar automáticamente las valoraciones históricas asociadas.'],
     'La propuesta queda rechazada sin publicarse como conocimiento aprobado.',
     'Parte de CU-21 y constituye una decisión alternativa a CU-22.')

case('Revisar valoraciones negativas', 'Administrador',
     'Identificar respuestas no útiles y dejar constancia de que fueron revisadas.',
     'El administrador tiene acceso al panel de revisión y existen valoraciones recuperables.',
     'El administrador consulta el apartado de respuestas valoradas negativamente.',
     ['El administrador abre la sección de revisión de Duco.',
      'El sistema recupera las valoraciones negativas pendientes y presenta la pregunta y la respuesta relacionadas.',
      'El administrador examina el intercambio para reconocer el problema comunicado.',
      'El administrador puede seleccionar Marcar revisada en una valoración.',
      'El sistema actualiza el estado de revisión, registra el evento y refresca el listado.'],
     ['Si no existen valoraciones pendientes, el sistema lo informa.',
      'Si el registro no existe o ya no puede revisarse, el sistema comunica el error.',
      'Marcar una valoración como revisada no corrige automáticamente el modelo, la respuesta histórica ni el código del sistema.'],
     'La valoración queda marcada como revisada o se explica por qué no pudo actualizarse.',
     'Se relaciona con CU-19 y CU-21. No representa un mecanismo automático de reentrenamiento.')

case('Consultar tablas y registros administrables', 'Administrador',
     'Examinar la información que el panel permite gestionar en el servicio de datos.',
     'El administrador tiene acceso al panel y existe conexión con la base de datos.',
     'El administrador selecciona una tabla o solicita actualizar su listado.',
     ['El administrador abre la administración de registros.',
      'El sistema consulta las tablas del esquema configurado y presenta las opciones disponibles.',
      'El administrador selecciona una tabla.',
      'El sistema recupera sus metadatos, clave primaria y registros dentro del límite de visualización.',
      'El sistema presenta los valores y las acciones permitidas, distinguiendo una tabla vacía de un fallo de consulta.'],
     ['Si la conexión falla, se muestra un error y no se ofrece una confirmación ficticia de consulta.',
      'Si la tabla no existe o no tiene una clave primaria utilizable, el sistema informa que no puede gestionarla mediante ese mecanismo.',
      'Si existen más registros que el límite de presentación, el listado no debe interpretarse como una exportación completa.'],
     'Se muestran los registros recuperados y los metadatos necesarios para su gestión.',
     'Da acceso a CU-26, CU-27 y CU-28. La interfaz del prototipo muestra hasta 200 filas por tabla.')

case('Crear un registro administrativo', 'Administrador',
     'Agregar un registro válido a una tabla administrable.',
     'Se seleccionó una tabla disponible y el administrador conoce los datos que desea registrar.',
     'El administrador selecciona Nuevo registro.',
     ['El administrador solicita crear un registro en la tabla seleccionada.',
      'El sistema construye el formulario a partir de los metadatos, sin pedir las claves generadas automáticamente.',
      'El administrador introduce los datos y selecciona Guardar.',
      'El sistema valida las columnas, convierte los tipos pertinentes y solicita la inserción mediante parámetros.',
      'La base de datos aplica sus restricciones; si la operación tiene éxito, el sistema confirma el guardado y actualiza la lista.'],
     ['Si faltan campos requeridos o un valor no es válido, se solicita corregir la entrada.',
      'Si una restricción de integridad impide la inserción, el sistema presenta el error y no confirma el alta.',
      'Si se intenta enviar una columna desconocida o modificar una identidad generada, el servicio rechaza la operación.'],
     'El registro queda persistido o la operación se rechaza sin confirmar un guardado inexistente.',
     'Se inicia desde CU-25. No debe confundirse con la aprobación especializada de CU-22.')

case('Modificar un registro administrativo', 'Administrador',
     'Actualizar los campos permitidos de un registro existente.',
     'El registro aparece en una tabla administrable y puede identificarse mediante su clave primaria.',
     'El administrador selecciona Editar.',
     ['El administrador elige el registro que desea modificar.',
      'El sistema muestra un formulario con los valores actuales y mantiene las claves no editables protegidas.',
      'El administrador cambia los campos permitidos y solicita guardar.',
      'El sistema valida las columnas y tipos, localiza el registro por su clave y solicita la actualización.',
      'Si se actualiza el registro esperado, el sistema confirma la transacción y vuelve a consultar la tabla.'],
     ['Si el registro ya no existe, el sistema informa que no pudo encontrarlo.',
      'Si los datos incumplen una restricción o incluyen campos no permitidos, la actualización se rechaza.',
      'Si el administrador cancela el formulario, no se envía una modificación.'],
     'Los campos permitidos quedan actualizados, o el registro permanece sin los cambios rechazados.',
     'Se inicia desde CU-25 y comparte las reglas de integridad con CU-26.')

case('Eliminar un registro administrativo', 'Administrador',
     'Retirar un registro concreto sin infringir las relaciones de integridad de la base de datos.',
     'El administrador identificó un registro de una tabla administrable.',
     'El administrador selecciona Eliminar.',
     ['El administrador solicita eliminar el registro seleccionado.',
      'El sistema pide confirmar la eliminación y advierte que puede existir información relacionada.',
      'Si el administrador confirma, el sistema envía la clave primaria del registro al servicio de datos.',
      'La base de datos comprueba las restricciones y elimina el registro cuando la operación es válida.',
      'El sistema confirma la transacción y actualiza la tabla consultada.'],
     ['Si el administrador cancela la confirmación, no se elimina ningún registro.',
      'Si existen registros relacionados que impiden el borrado, el sistema muestra el error y conserva el registro.',
      'Si el registro ya fue eliminado, el sistema informa que no se encontró; no presenta un segundo borrado como exitoso.'],
     'El registro queda eliminado o la eliminación se rechaza de forma explícita.',
     'Se inicia desde CU-25. No implica borrado en cascada automático ni eliminación masiva.')

case('Reintentar una consulta tras un fallo del servicio de IA', 'Visitante',
     'Volver a consultar cuando una solicitud no pudo completarse por disponibilidad, tiempo de espera o respuesta inválida.',
     'Existe un intento fallido y la interfaz continúa disponible para el visitante.',
     'El sistema informa un problema del servicio de IA y el visitante decide intentar nuevamente.',
     ['Una consulta no obtiene una respuesta válida dentro de las condiciones de servicio.',
      'El sistema retira el indicador de procesamiento, presenta un mensaje comprensible y desbloquea los controles.',
      'El visitante vuelve a enviar la consulta o reformula su mensaje.',
      'El sistema realiza un nuevo intento utilizando el contexto pertinente, sin confundir el error anterior con una nueva instrucción.',
      'El sistema muestra la respuesta recibida o informa nuevamente el fallo, manteniendo el control de envíos simultáneos.'],
     ['Si el fallo persiste, el visitante conserva la posibilidad de cerrar el chat o consultar el sitio manualmente.',
      'El sistema distingue indisponibilidad, demora excesiva y resultado inválido cuando dispone de esa información.',
      'El visitante no debe instalar ni arrancar Ollama como parte del flujo de la solución desplegada.'],
     'El nuevo intento produce una respuesta o un aviso de fallo, sin dejar la interfaz bloqueada.',
     'Es un flujo de recuperación de CU-02. La recuperación técnica del proveedor depende de la arquitectura de despliegue.')

case('Solicitar una carrera alternativa', 'Visitante',
     'Explorar otra carrera disponible sin repetir por defecto la última carrera mostrada.',
     'Existe un catálogo disponible y suficiente contexto para entender qué alternativa se solicita.',
     'El visitante pide otra carrera, otra opción o una alternativa distinta.',
     ['El visitante solicita una alternativa respecto de la carrera tratada anteriormente.',
      'El sistema distingue la petición de otra opción de una corrección que rechaza la respuesta previa.',
      'El sistema consulta las carreras disponibles y considera la última carrera y las opciones ya visitadas cuando esa información existe.',
      'El sistema identifica una alternativa ejecutable y prepara la navegación o el resaltado correspondiente.',
      'Duco muestra la alternativa y permite que el visitante pida su ficha o una explicación.'],
     ['Si no está claro a qué tipo de alternativa se refiere el visitante, se solicita aclaración.',
      'Si no se puede consultar el catálogo o no hay una alternativa disponible, el sistema lo informa.',
      'Mostrar otra carrera no equivale a una recomendación vocacional validada ni garantiza compatibilidad con todas las preferencias personales.'],
     'Se presenta una carrera distinta cuando es posible, o se comunica la limitación.',
     'Se relaciona con CU-03, CU-04, CU-14 y CU-15; depende de interpretación contextual.')

case('Consultar la ubicación actual y la petición anterior', 'Visitante',
     'Saber qué página está consultando y recuperar el objetivo previo de la conversación.',
     'El asistente puede leer la ruta actual; para recordar una petición debe existir historial temporal disponible.',
     'El visitante pregunta dónde está o qué había pedido antes.',
     ['El visitante formula una pregunta sobre la página actual, la consulta anterior o ambas.',
      'El sistema identifica que se solicita información sobre el estado de la conversación, no una navegación nueva.',
      'El sistema obtiene la ubicación real del navegador, incluso si el visitante regresó manualmente.',
      'Si corresponde, el sistema recupera la última petición anterior del visitante.',
      'Duco responde con esos datos sin repetir automáticamente la acción que había ejecutado.'],
     ['Si no existe una petición anterior, el sistema declara que no dispone de ella.',
      'Si la página no tiene un nombre funcional conocido, puede informar su ruta disponible sin inventar una sección.',
      'Si el mensaje también pide una acción nueva, el sistema interpreta esa acción además de la pregunta informativa.'],
     'El visitante recibe una descripción del estado actual y del antecedente disponible sin navegación no solicitada.',
     'Se apoya en CU-16 y se distingue de CU-06 y CU-17.')

assert len(CASES) == 31

doc = Document()
section = doc.sections[0]
section.page_width, section.page_height = Cm(21), Cm(29.7)
section.top_margin = section.bottom_margin = Cm(1.8)
section.left_margin = section.right_margin = Cm(2)
section.header_distance = section.footer_distance = Cm(0.8)
for name in ['Normal', 'Title', 'Subtitle', 'Heading 1', 'Heading 2', 'Heading 3']:
    style = doc.styles[name]
    style.font.name = 'Calibri'
    style.font.color.rgb = RGBColor(0, 0, 0)
normal = doc.styles['Normal']
normal.font.size = Pt(11)
normal.paragraph_format.space_after = Pt(5)
normal.paragraph_format.line_spacing = 1.05
normal.paragraph_format.widow_control = True
doc.styles['Title'].font.size = Pt(27)
doc.styles['Heading 1'].font.size = Pt(17)
doc.styles['Heading 2'].font.size = Pt(11)
doc.styles['Heading 2'].paragraph_format.space_before = Pt(8)
doc.styles['Heading 2'].paragraph_format.space_after = Pt(3)
for name in ['Heading 1', 'Heading 2', 'Heading 3']:
    doc.styles[name].paragraph_format.keep_with_next = True

header = section.header.paragraphs[0]
header.text = 'Duco Asiste    Especificación funcional'
header.style = doc.styles['Normal']
for run in header.runs: run.font.size = Pt(9)
footer = section.footer.paragraphs[0]
footer.alignment = 2
footer.add_run('Página ')
field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'PAGE'); footer._p.append(field)
for run in footer.runs: run.font.size = Pt(9)

def para(text, label=None):
    p = doc.add_paragraph()
    if label: p.add_run(label + ' ').bold = True
    p.add_run(text)
    return p

doc.add_paragraph('Casos de uso de Duco Asiste', 'Title')
doc.add_paragraph('Especificación funcional', 'Subtitle')
para('Versión 1.0    4 de noviembre de 2026')
para('Este documento desarrolla 31 casos de uso del asistente integrado y su administración. Cada ficha describe un objetivo, sus participantes, las condiciones necesarias, la secuencia normal, las alternativas y el resultado que debe quedar al terminar. Sirve como base para el informe del proyecto, la discusión de requisitos y la preparación de pruebas de aceptación.')
doc.add_heading('Solución prevista y prototipo', 1)
para('Duco Asiste se concibe como una solución accesible mediante un sitio desplegado. El visitante utiliza su navegador y no necesita instalar un modelo de IA, iniciar servicios en su equipo ni configurar una conexión con Oracle. El servicio de IA se trata como una integración del sistema, no como una obligación del visitante.')
para('En el prototipo, Ollama permite demostrar esa integración mediante un modelo de prueba. La ejecución local y Duco Admin local son condiciones del entorno actual de demostración, no requisitos definitivos del producto desplegado. Estos casos no afirman que el despliegue, la autenticación o la infraestructura de producción ya estén resueltos.')
doc.add_heading('Actores y límites del sistema', 1)
para('Persona que consulta el sitio, conversa y solicita orientación. Puede ser postulante, estudiante u otro visitante.', 'Visitante')
para('Persona responsable de revisar propuestas y mantener información mediante el panel de administración. Es un rol funcional; no implica que exista ya un mecanismo de autenticación implementado.', 'Administrador')
para('Sistema externo que interpreta consultas y genera respuestas o propuestas de acciones. Ollama es su implementación de prueba actual.', 'Servicio de IA')
para('El sitio integrado, el asistente, el backend y la persistencia en Oracle se consideran dentro del alcance funcional descrito. Oracle es un componente de almacenamiento, no una persona que inicia casos de uso.')
doc.add_heading('Criterio de lectura', 1)
para('Los flujos expresan el comportamiento funcional previsto a partir del prototipo. No equivalen a una certificación de todas sus variantes. Los casos de abrir menús, desplazar la vista o mostrar respaldo se detallan como funciones de apoyo porque pueden solicitarse directamente o formar parte de una guía mayor.')

doc.add_page_break()
doc.add_heading('Catálogo de casos de uso', 1)
para('Las fichas siguientes desarrollan todos los casos del catálogo. La numeración identifica funciones y no representa su prioridad ni una secuencia obligatoria.')
table = doc.add_table(rows=1, cols=3)
table.style = 'Light Shading Accent 1'
table.autofit = False
for column, width in zip(table.columns, [1.8, 12, 3.2]):
    column.width = Cm(width)
table.rows[0].cells[0].text = 'Código'
table.rows[0].cells[1].text = 'Caso de uso'
table.rows[0].cells[2].text = 'Actor principal'
for c in CASES:
    row = table.add_row().cells
    row[0].text, row[1].text, row[2].text = c['id'], c['title'], c['actor']
for row in table.rows:
    for cell, width in zip(row.cells, [1.8, 12, 3.2]):
        cell.width = Cm(width)
    for cell in row.cells:
        for p in cell.paragraphs:
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.space_before = Pt(3)
            for run in p.runs: run.font.size = Pt(10)
for cell in table.rows[0].cells:
    tcPr = cell._tc.get_or_add_tcPr()
    shading = OxmlElement('w:shd'); shading.set(qn('w:fill'), 'E8E8E8'); tcPr.append(shading)
    for p in cell.paragraphs:
        for run in p.runs: run.bold = True; run.font.color.rgb = RGBColor(0, 0, 0)
trPr = table.rows[0]._tr.get_or_add_trPr(); repeat = OxmlElement('w:tblHeader'); trPr.append(repeat)

for c in CASES:
    doc.add_page_break()
    doc.add_heading(c['id'] + ' ' + c['title'], 1)
    para(c['actor'], 'Actor principal')
    para(c['goal'], 'Objetivo')
    doc.add_heading('Precondiciones', 2); para(c['pre'])
    doc.add_heading('Disparador', 2); para(c['trigger'])
    doc.add_heading('Flujo principal', 2)
    for i, step in enumerate(c['steps'], 1):
        p = para(f'{i}. {step}')
        p.paragraph_format.left_indent = Cm(0.3)
        p.paragraph_format.first_line_indent = Cm(-0.3)
    doc.add_heading('Flujos alternativos y excepciones', 2)
    for i, alternative in enumerate(c['alternatives'], 1): para(alternative, f'A{i}')
    doc.add_heading('Postcondición', 2); para(c['post'])
    doc.add_heading('Relaciones y observaciones', 2); para(c['related'])

doc.add_page_break()
doc.add_heading('Reglas transversales', 1)
rules = [
    ('Validación de consultas', 'El prototipo rechaza consultas vacías y aplica un máximo de 2000 caracteres después de retirar espacios exteriores. El máximo de entrada no debe truncar la respuesta mostrada.'),
    ('Control de concurrencia', 'Mientras una consulta está en proceso se bloquean el envío y el reinicio que puedan mezclar respuestas. Un borrador escrito entretanto no debe perderse.'),
    ('Confirmación de acciones', 'El mensaje del modelo es una propuesta. El sistema debe distinguirla del resultado observado al abrir, seleccionar, navegar o resaltar.'),
    ('Ambigüedad', 'Si falta un objetivo suficiente, se solicita aclaración y se bloquean las acciones, incluidas las peticiones interpretadas como repetición o alternativa.'),
    ('Historial temporal', 'La continuidad depende del almacenamiento de sesión del navegador y de una ventana de contexto limitada. No se promete memoria ilimitada, sincronización entre dispositivos ni conservación permanente.'),
    ('Registro en el servidor', 'No se almacena automáticamente toda la conversación como historial permanente. Se registran datos de las interacciones correspondientes al valorar, proponer conocimiento o aplicar los mecanismos de corrección previstos.'),
    ('Revisión humana', 'Una propuesta pendiente o un voto positivo no equivalen a conocimiento aprobado. Las valoraciones y experiencias no modifican automáticamente los pesos del modelo.'),
    ('Integridad de datos', 'Las operaciones administrativas deben respetar claves, tipos y relaciones de Oracle. Un borrado impedido por una clave foránea debe informarse, no ocultarse.'),
    ('Disponibilidad de fuentes', 'La respuesta debe distinguir datos disponibles de información ausente o potencialmente desactualizada. Abrir un recurso externo no garantiza su carga o reproducción.'),
    ('Acceso a la administración', 'La autenticación, autorización y protección del panel en un despliegue real deben definirse y comprobarse. La ausencia de esas capacidades en el prototipo no autoriza a exponerlo sin protección.'),
]
for label, text in rules: para(text, label)

doc.add_page_break()
doc.add_heading('Relaciones funcionales y alcance', 1)
para('Las relaciones siguientes orientan la lectura y una futura representación UML. No toda asociación es una inclusión obligatoria: una navegación directa puede no requerir un menú y una respuesta informativa puede no necesitar resaltado.')
for label, text in [
    ('Orientación y consulta', 'CU-02 puede conducir a CU-04 o CU-05. CU-03 permite buscar una carrera sin intervención de IA. CU-30 ofrece una alternativa y CU-31 informa el estado actual.'),
    ('Navegación guiada', 'CU-06 puede coordinar CU-07, CU-08, CU-10 y CU-12 según el destino. CU-11 limpia estados transitorios y CU-13 abre recursos disponibles.'),
    ('Conversación', 'CU-14 resuelve ambigüedades; CU-15 corrige interpretaciones. CU-16 conserva continuidad; CU-17 repite una guía válida. CU-18 reinicia el diálogo y CU-29 permite reintentar tras un fallo.'),
    ('Conocimiento y mejora', 'CU-19 registra valoraciones; CU-20 envía propuestas. CU-21 permite consultarlas, CU-22 aprobarlas y CU-23 rechazarlas. CU-24 permite revisar valoraciones negativas.'),
    ('Administración', 'CU-25 presenta tablas y registros. Desde esa consulta se accede a CU-26, CU-27 y CU-28 para su mantenimiento.'),
]: para(text, label)
doc.add_heading('Capacidades que no se dan por implementadas', 2)
para('No se incluyen como funciones existentes el acceso con cuentas institucionales, el control de permisos por perfiles, la inscripción o matrícula efectiva, el pago de aranceles, la sincronización de conversaciones entre equipos, el reentrenamiento automático del modelo ni la consulta garantizada de información institucional en tiempo real. Cualquier incorporación debe generar requisitos y casos de uso específicos.')
doc.add_heading('Correspondencia con el desarrollo', 2)
para('Interfaz y chat: CU-01, CU-02, CU-16, CU-18 y CU-29. Historial y contexto: CU-15, CU-16, CU-17 y CU-31. Navegación inteligente: CU-03 a CU-13 y CU-30. Ambigüedad: CU-14 y CU-15. Valoraciones y administración: CU-19 a CU-28. Esta agrupación facilita la trazabilidad, pero no sustituye criterios de aceptación ni pruebas individuales.')
doc.add_heading('Referencias del proyecto', 2)
para('La especificación se apoya en js/duco-assistant.js, js/ollama-client.js, js/chat-handler.js, js/ui-highlighter.js, js/carreras-buscador-local.js, admin-app/app.py, admin-app/index.html y el esquema Oracle. Los informes de pruebas de tests/evidence documentan escenarios comprobados, sin demostrar todas las variantes descritas en estas fichas.')

doc.core_properties.title = 'Casos de uso de Duco Asiste'
doc.core_properties.subject = 'Especificación funcional del asistente y su administración'
doc.core_properties.author = 'Proyecto Duco Asiste'
doc.core_properties.keywords = 'Duco Asiste, casos de uso, especificación funcional'
for xml_root in [doc.styles.element, doc._element]:
    for border in xml_root.xpath('.//w:pBdr'):
        border.getparent().remove(border)
target = ROOT / 'Casos_de_uso_Duco_Asiste.docx'
doc.save(target)
print(target)
print(f'{len(CASES)} casos de uso completos')
