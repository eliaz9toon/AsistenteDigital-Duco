# Base de datos Oracle de Duco Asiste

El ZIP original se conserva en `database/source/`. El documento y el diagrama describen un modelo propuesto de 30 tablas; `oracle/schema.sql` agrega una tabla operativa para propuestas de conocimiento del asistente. El DDL adapta el modelo para Oracle 12c o posterior y agrega columnas identity a las claves primarias simples, para que Oracle genere sus valores automáticamente. Las tablas de relación conservan sus claves primarias compuestas. No se incluyen datos ficticios.

## Descargas oficiales

- [Oracle AI Database Free 26ai para Windows](https://www.oracle.com/database/free/): es el servidor local de base de datos.
- [Oracle SQL Developer](https://www.oracle.com/database/sqldeveloper/): es el cliente con Data Modeler para ejecutar los scripts y generar/editar el diagrama. Para Windows, el paquete ZIP que incluye JDK evita instalar Java por separado.

Descarga e instala ambos componentes desde Oracle. SQL Developer por sí solo no crea ni ejecuta un servidor de base de datos.

## Crear el esquema local

1. Instala Oracle Database XE o Oracle Database Free y recuerda el nombre del servicio PDB. SQL Developer es el cliente; no sustituye al servidor Oracle.
2. En SQL Developer crea una conexión administrativa a la PDB (por ejemplo `localhost:1521/XEPDB1` para XE o `localhost:1521/FREEPDB1` para Free).
3. Abre y ejecuta `oracle/create_user.sql` como `SYSTEM`. El script solicita la contraseña de `DUCO_APP` de forma oculta y concede los permisos para crear tablas con columnas identity.
4. Crea una conexión nueva como `DUCO_APP` y ejecuta `oracle/schema.sql`. El script crea las tablas del modelo y las propuestas de conocimiento; no borra objetos existentes, por lo que debe ejecutarse en un esquema vacío.
5. Verifica las tablas del esquema en el panel Tables. Para una instalación existente que ya tenía el modelo anterior, ejecuta en orden las migraciones `001_propuestas_conocimiento.sql`, `002_valoraciones_chat.sql`, `003_revision_valoraciones.sql` y `004_feedback_conocimiento_aprobado.sql` como `DUCO_APP`.

Oracle Database Free 26ai está instalado y activo en este equipo. El esquema `DUCO_APP` está en `localhost:1521/FREEPDB1`.

## Integración del asistente y conocimiento

La administración local sirve el sitio Duco en `http://127.0.0.1:8765/duco`, con una API local para consultar preguntas frecuentes, respuestas aprobadas y rutas/enlaces cargados en Oracle. Cuando la persona pide explícitamente guardar información, Duco crea una propuesta pendiente. En la administración, **Propuestas para revisar** permite aprobarla (se incorpora a preguntas frecuentes) o rechazarla. El chat solo recibe conocimiento aprobado; no cambia registros directamente.

## SQL Developer Data Modeler

El DDL usa tipos y sintaxis Oracle, e importa como modelo relacional. Para generar el diagrama desde el script, abre Data Modeler y elige **File → Import → DDL File**, agrega `oracle/schema.sql` y termina el asistente. Para extraer un modelo desde el esquema ya creado, usa **File → Import → Data Dictionary**, selecciona la conexión `DUCO_APP` y luego las 30 tablas. Guarda el diseño resultante como `.dmd` desde Data Modeler. Oracle describe ambas opciones como flujos de modelado bottom-up: importar DDL o extraer el diccionario de una base. Consulta [la guía oficial de Data Modeler](https://docs.oracle.com/en/database/oracle/sql-developer-data-modeler/24.3/dmdug/data-modeler-concepts-usage.html).

## Consola administrativa

Consulta `../admin-app/README.md` para iniciar la aplicación local de altas, consultas, edición y eliminación de registros.
