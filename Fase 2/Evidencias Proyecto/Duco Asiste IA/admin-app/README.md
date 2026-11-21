# Duco Admin local

Aplicación CRUD local para revisar y modificar las tablas del esquema Oracle conectado. Se sirve en `127.0.0.1` y usa la conexión configurada en el backend; las credenciales no se guardan en el navegador.

## Requisitos

- Python 3.10 o posterior.
- Oracle Database XE/Free iniciado y el esquema Duco instalado desde `../database/oracle/schema.sql`.
- Acceso de red local a la dirección de servicio Oracle configurada.

## Inicio en Windows PowerShell

Con las dependencias y `.env` configurados, puedes abrir `../Iniciar_Duco.cmd`
con doble clic para iniciar el servidor y abrir el asistente. `python app.py`
tambien inicia Ollama automaticamente si no responde en el puerto 11434.
Ollama debe estar instalado y el modelo del frontend descargado previamente.
No se descargan modelos ni se duplica un servidor que ya este activo.

El chat pide al backend local que vuelva a iniciar Ollama si pierde la conexion,
tanto desde `/duco` como desde Live Server (con el backend encendido).
`Ctrl+C` cierra el servidor y el proceso de Ollama iniciado por Duco; si Ollama
ya estaba ejecutandose por separado, se conserva. Cerrar el navegador no cierra
el backend. Los fallos de inicio se registran en `ollama.log`.

Desde la carpeta `admin-app`:

```powershell
Copy-Item .env.example .env
notepad .env
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

En `.env`, configura `ORACLE_USER`, `ORACLE_PASSWORD` y `ORACLE_DSN`. XE suele usar `localhost:1521/XEPDB1`; Oracle Database Free suele usar `localhost:1521/FREEPDB1`. Abre `http://127.0.0.1:8765` en el navegador. Cierra la aplicación con `Ctrl+C` en la terminal.

La administración muestra hasta 200 filas por tabla y permite insertar, editar y eliminar. **Revisar Duco** permite aprobar/rechazar respuestas positivas propuestas y marcar valoraciones negativas como revisadas; las propuestas muestran votos positivos y negativos de sesiones únicas. Las valoraciones de preguntas similares se acumulan en la propuesta correspondiente. Si una pregunta coincide con una respuesta aprobada, Duco guarda la nueva frase como sinónimo y reutiliza el conocimiento aprobado sin crear una propuesta duplicada. Al aprobar una propuesta, sus variantes valoradas se transfieren al conocimiento aprobado. Las conversaciones no se guardan automáticamente: solo se persiste la pregunta y respuesta cuando alguien pulsa 👍 o 👎. Oracle valida las claves foráneas y restricciones; si un registro está relacionado, la interfaz muestra el error y no oculta el fallo. La aplicación se liga únicamente a localhost: no la expongas a una red compartida sin añadir autenticación y controles de seguridad.

Cuando el servidor está en ejecución, puedes abrir `http://127.0.0.1:8765/duco` o el mismo `duoc.html` desde VS Code Live Server en `http://127.0.0.1:5500/duoc.html`. Ambos orígenes locales usan la API Oracle; el backend permite CORS únicamente desde `http://127.0.0.1:5500` y `http://localhost:5500` por defecto. Para otro puerto, agrega su origen exacto a `DUCO_ALLOWED_ORIGINS` en `.env` y reinicia el servidor. Abrir `duoc.html` directamente como archivo no conecta esa API. En instalaciones que ya tenían el esquema, ejecuta una sola vez y en orden las migraciones `001_propuestas_conocimiento.sql`, `002_valoraciones_chat.sql`, `003_revision_valoraciones.sql` `004_feedback_conocimiento_aprobado.sql` y `005_experiencias_accion.sql` como `DUCO_APP`.

Si no conecta, comprueba que Oracle esté iniciado, que el DSN incluya el service name de la PDB y que el usuario `DUCO_APP` tenga el esquema instalado. La conexión usa el modo Thin de `python-oracledb`, que no requiere instalar Oracle Instant Client.

## Memoria de acciones valoradas

La migración `005_experiencias_accion.sql` añade `EXPERIENCIAS_ACCION`, vinculada a los mensajes y valoraciones existentes. Las valoraciones nuevas guardan la página de origen, pasos realmente ejecutados y resultados; las explicaciones incluyen los párrafos fuente. Los pulgares aparecen al terminar la secuencia, también después de navegar entre páginas. Los registros anteriores pueden importarse con `python migrate_legacy_experiences.py --apply`: se conservan como referencias históricas con `origin=legacy`, sin pasos inventados ni página conocida. Ejecutar sin `--apply` muestra cuántos faltan; repetirlo no duplica registros. Las referencias históricas nunca se presentan como ejecución confirmada, incluso con votos positivos.

`GET /api/duco/experiences?query=...&page=...` recupera hasta cinco experiencias similares cuyo origen o alguno de sus pasos corresponde a la página actual y cuenta sesiones distintas. Un procedimiento se presenta como confirmado solo con votos positivos, sin negativos y con todos sus pasos confirmados. El cliente entrega estos ejemplos a la planificación, explicación y revisión de acciones para orientar el procedimiento; no ejecuta automáticamente acciones guardadas ni modifica el modelo de Ollama. Las experiencias con votos negativos se proporcionan como errores que revisar. Las referencias históricas se recuperan por similitud de la petición aunque no tengan página conocida. El resultado depende todavía de la interpretación del modelo y de los elementos disponibles en la página.

## Correcciones durante la conversación

El intérprete decide primero si el usuario rechaza la respuesta anterior, luego explicita el objetivo, sus restricciones y la operación necesaria. Una corrección tiene prioridad sobre repetir, explicar o elegir otro elemento. Los destinos de navegación se contrastan con el objetivo antes de ejecutar. Una corrección evita los mecanismos de repetición de planes anteriores. Las correcciones que necesitan un plan generado pasan una comprobación semántica antes de ejecutarse; si no hay un objetivo claro o el plan no cumple la corrección, Duco pide aclaración sin ejecutar acciones. El catálogo general de Carreras es un destino distinto de cualquier ficha individual.

Cuando una corrección explícita rechaza la última interacción que tuvo pasos registrados, el cliente envía una valoración negativa de esa interacción y guarda el mensaje de corrección y el objetivo interpretado dentro de su experiencia. Se utiliza el mismo identificador de interacción para no duplicar el voto. El objetivo corregido permanece en Session Storage para los seguimientos y las recargas. La corrección se mantiene en el contexto aunque la API no esté disponible; en ese caso no se afirma que Oracle la haya guardado. Este mecanismo adapta el contexto y la memoria, no modifica el código ni los pesos del modelo.

La interpretación inicial del objetivo usa el diálogo actual, sin mezclar valoraciones antiguas con la postura del usuario. Las experiencias se consultan después, durante la preparación, explicación o revisión de las acciones. Pedir otro elemento no equivale a rechazar el anterior.

## Consulta web limitada a duoc.cl

Cuando una pregunta informativa no se resuelve con los datos locales (catálogo, sedes, fechas y preguntas frecuentes), Duco puede consultar el sitio oficial. `GET /api/duco/web?q=...` (archivo `web_lookup.py`, solo biblioteca estándar) funciona así:

1. Lee los sitemaps oficiales de `www.duoc.cl` (páginas, carreras, escuelas, sedes y preguntas frecuentes) y guarda el índice 12 horas en memoria; se precarga al iniciar el servidor.
2. Puntúa las URL por las palabras de la consulta y descarga hasta dos páginas, con un máximo de 6 s por página y 600 KB.
3. Devuelve extractos con título y URL. Si es una pregunta frecuente oficial, el asistente muestra el texto tal cual; en otros casos el modelo responde solo con esas fuentes y, si no las respeta, se muestra el extracto. Siempre se cita la fuente.

Límites de seguridad: el usuario nunca entrega una URL, solo se leen dominios `duoc.cl` por HTTPS (también en redirecciones) y, si el sitio no responde, el asistente sigue sin esta ayuda. Para activarla en una instalación existente hay que reiniciar el servidor (`Iniciar_Duco.cmd`).

## APIs externas: Nominatim, OSRM y Nager.Date

El backend (`external_apis.py`, solo biblioteca estándar) consulta tres APIs públicas sin clave. Solo habla con esos tres servidores por HTTPS (también en redirecciones) y falla en silencio si alguno no responde. Las direcciones no se guardan ni se escriben en el log; solo hay una caché en memoria con vencimiento.

| Ruta propia | API externa | Para qué |
|---|---|---|
| `GET /api/duco/geocode?q=...` | Nominatim (OpenStreetMap), solo Chile y máximo 1 consulta por segundo | Convierte una dirección en coordenadas |
| `GET /api/duco/route?fromLat=&fromLng=&toLat=&toLng=` | OSRM | Distancia, tiempo en auto y trazado por calle hasta la sede |
| `GET /api/duco/holidays?year=2027` | Nager.Date | Feriados públicos de Chile |

**Permiso Sí/No.** Lo que envía datos personales (una dirección o la ubicación del navegador) pregunta antes con dos botones, «Sí, doy permiso» y «No, gracias». La decisión se recuerda solo durante la sesión y se borra al reiniciar la conversación o al escribir «cambiar permisos». Con «No», Duco no envía nada y ofrece responder solo con la comuna. Los feriados no llevan datos del usuario y no piden permiso. La ubicación del navegador usa además el aviso propio del navegador.

Ejemplos: «¿cuánto demoro a la sede de Maipú desde Av. Matta 123, Santiago?», «sede más cercana a mi ubicación», «feriados de marzo 2027», «¿el inicio de clases cae en feriado?».

## Login, roles y auditoría (20/11/2026)

El panel (`http://127.0.0.1:8765/`) exige **iniciar sesión**. Hasta ahora cualquiera podía ver y borrar filas.

- **Primer usuario:** `python create_admin.py --name "Tu Nombre" --email tu@correo.cl --generate` (muestra una contraseña generada una sola vez; cámbiala con «Mi contraseña»). Sin `--generate` la pide sin mostrarla. Con `--reset` restablece la de un usuario existente.
- **Roles:** `ADMINISTRADOR` edita, crea y borra registros y gestiona usuarios; `REVISOR` solo consulta y revisa propuestas y valoraciones.
- **Seguridad:** contraseñas con PBKDF2-SHA256 y sal; sesión de 8 horas en una cookie `HttpOnly` y `SameSite=Strict` (en la base solo el SHA-256 del token); bloqueo de 5 minutos tras 5 intentos fallidos; no se revela si falló el correo o la contraseña; `AUDITORIA_CAMBIOS`, `SESIONES_ADMIN` y `USUARIOS_ADMIN` son de solo lectura en el visor.
- **Rutas del chat públicas:** salud, conocimiento, experiencias, valoraciones, propuestas y `POST /api/duco/session`. Todo lo demás pide sesión.
- **Visor claro:** las tablas se agrupan por módulo (primero las que no dependen de otras) y muestran cuántas filas tienen o si están vacías. Cada tabla trae su descripción, de qué tabla depende y cuáles la usan (con botones para saltar). Las columnas se ordenan en «identificadores, datos, fechas»; 🔑 marca el ID automático que genera Oracle (empieza en 1 y no se reutiliza al borrar, por eso hay saltos) y 🔗 marca las columnas que apuntan a otra tabla, con el nombre de lo que apuntan al lado del número («208 · sesión 76f517e7»). Los registros van del más reciente al más antiguo. La descripción sale de los comentarios de Oracle (migración 007), así que también se ve en SQL Developer.
- **Búsqueda:** el campo «Buscar» filtra los registros de la tabla seleccionada (en todas las columnas o en una), sin distinguir mayúsculas y resaltando lo encontrado; en las columnas que apuntan a otra tabla también busca en su nombre (buscar «María» en `MENSAJES` trae los mensajes de su conversación). «Filtrar tablas» acorta la lista por nombre, módulo o descripción. La búsqueda es del lado del servidor, con parámetros (no hay inyección SQL) y muestra hasta 200 resultados.
- **Reportes** (botón del panel): resumen de las 32 tablas (filas y último registro), últimos usuarios, mensajes y valoraciones, y la auditoría reciente.
- **Auditoría:** cada cambio guarda tabla, ID del registro, acción, valores antes y después, quién (usuario del panel o nombre del chat) y origen.
- **Nombre en el chat:** Duco pide el nombre (o apodo) al abrirse y registra la sesión en `SESIONES_CHAT`. «Cambiar mi nombre» lo vuelve a pedir. Para automatizaciones: `window.ducoConfig.requireUserName = false`.
- **Pruebas:** con el backend encendido, `python ..	estsdmin_auth_test.py http://127.0.0.1:8766` (56 comprobaciones; crea y borra sus propios datos de prueba).
- **Migración:** `python apply_migration.py ../database/oracle/migrations/006_login_auditoria_fechas.sql` (ver `database/README.md`).

