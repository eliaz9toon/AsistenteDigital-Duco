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
