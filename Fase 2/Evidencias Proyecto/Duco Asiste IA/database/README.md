# Base de datos Oracle de Duco Asiste

El modelo implementado tiene **32 tablas**: las 30 del diseño original más `PROPUESTAS_CONOCIMIENTO` y `EXPERIENCIAS_ACCION`, agregadas durante el desarrollo. `oracle/schema.sql` las crea todas e incluye las migraciones 001 a 005. En `database/source/` están el documento del modelo de datos, el script de 32 tablas y los diagramas ER (general y por módulo); el ZIP original con el diseño de 30 tablas se conserva en `Duco_Asiste_Oracle_Kit.zip`. El DDL adapta el modelo para Oracle 12c o posterior y agrega columnas identity a las claves primarias simples, para que Oracle genere sus valores automáticamente. Las tablas de relación conservan sus claves primarias compuestas. No se incluyen datos ficticios.

## Descargas oficiales

- [Oracle AI Database Free 26ai para Windows](https://www.oracle.com/database/free/): es el servidor local de base de datos.
- [Oracle SQL Developer](https://www.oracle.com/database/sqldeveloper/): es el cliente con Data Modeler para ejecutar los scripts y generar/editar el diagrama. Para Windows, el paquete ZIP que incluye JDK evita instalar Java por separado.

Descarga e instala ambos componentes desde Oracle. SQL Developer por sí solo no crea ni ejecuta un servidor de base de datos.

## Crear el esquema local

1. Instala Oracle Database XE o Oracle Database Free y recuerda el nombre del servicio PDB. SQL Developer es el cliente; no sustituye al servidor Oracle.
2. En SQL Developer crea una conexión administrativa a la PDB (por ejemplo `localhost:1521/XEPDB1` para XE o `localhost:1521/FREEPDB1` para Free).
3. Abre y ejecuta `oracle/create_user.sql` como `SYSTEM`. El script solicita la contraseña de `DUCO_APP` de forma oculta y concede los permisos para crear tablas con columnas identity.
4. Crea una conexión nueva como `DUCO_APP` y ejecuta `oracle/schema.sql`. El script crea las 32 tablas del modelo; no borra objetos existentes, por lo que debe ejecutarse en un esquema vacío.
5. Verifica las tablas del esquema en el panel Tables. Para una instalación existente que ya tenía el modelo anterior, ejecuta en orden las migraciones `001_propuestas_conocimiento.sql`, `002_valoraciones_chat.sql`, `003_revision_valoraciones.sql`, `004_feedback_conocimiento_aprobado.sql`, `005_experiencias_accion.sql` y, con `admin-app/apply_migration.py`, `006_login_auditoria_fechas.sql` como `DUCO_APP`. Una instalación completa debe mostrar 32 tablas en el panel Tables.

Si al iniciar Duco aparece `ORA-12514` o `DPY-6001` (el servicio FREEPDB1 no está registrado), la base de datos está apagada: ejecuta `Iniciar_Base_de_Datos.cmd` (pide permisos de administrador) o simplemente `Iniciar_Duco.cmd`, que la inicia solo cuando hace falta.

Oracle Database Free 26ai está instalado y activo en este equipo. El esquema `DUCO_APP` está en `localhost:1521/FREEPDB1`.

## Integración del asistente y conocimiento

La administración local sirve el sitio Duco en `http://127.0.0.1:8765/duco`, con una API local para consultar preguntas frecuentes, respuestas aprobadas y rutas/enlaces cargados en Oracle. Cuando la persona pide explícitamente guardar información, Duco crea una propuesta pendiente. En la administración, **Propuestas para revisar** permite aprobarla (se incorpora a preguntas frecuentes) o rechazarla. El chat solo recibe conocimiento aprobado; no cambia registros directamente.

## SQL Developer Data Modeler

El DDL usa tipos y sintaxis Oracle, e importa como modelo relacional. Para generar el diagrama desde el script, abre Data Modeler y elige **File → Import → DDL File**, agrega `oracle/schema.sql` y termina el asistente. Para extraer un modelo desde el esquema ya creado, usa **File → Import → Data Dictionary**, selecciona la conexión `DUCO_APP` y luego las 32 tablas. Guarda el diseño resultante como `.dmd` desde Data Modeler. Oracle describe ambas opciones como flujos de modelado bottom-up: importar DDL o extraer el diccionario de una base. Consulta [la guía oficial de Data Modeler](https://docs.oracle.com/en/database/oracle/sql-developer-data-modeler/24.3/dmdug/data-modeler-concepts-usage.html).

## Migración 006: login, auditoría y fechas (20/11/2026)

`oracle/migrations/006_login_auditoria_fechas.sql` se aplica con `python apply_migration.py ../database/oracle/migrations/006_login_auditoria_fechas.sql` (desde `admin-app/`). Es idempotente. **Haz un respaldo antes**: los datos se pueden volcar a `database/backups/` (carpeta que no se sube a GitHub). En una instalación nueva, ejecuta `schema.sql` y después esta migración.

| Tabla | Cambio | Para qué |
|---|---|---|
| `SESIONES_CHAT` | `NOMBRE_USUARIO`, `ULTIMA_ACTIVIDAD` | Registrar quién se conecta al chat (nombre o apodo). |
| `USUARIOS_ADMIN` | `ACTIVO`, `FECHA_CREACION`, `ULTIMO_ACCESO`, correo único | Usuarios del panel con login. La contraseña se guarda solo como hash PBKDF2. |
| `SESIONES_ADMIN` | `TOKEN_HASH`, `FECHA_EXPIRA`, `FECHA_FIN`, `DIRECCION_IP` | Sesiones del panel; del token solo se guarda su SHA-256. |
| `AUDITORIA_CAMBIOS` | `ACCION`, `ID_REGISTRO`, `VALOR_ANTERIOR`, `VALOR_NUEVO`, `NOMBRE_ACTOR`, `ORIGEN` | Cada cambio queda con tabla, fila, acción, valores antes y después, quién y desde dónde (`panel`, `chat`, `sistema` o `historico`). Es de solo lectura en el visor. |
| Las 32 tablas | `FECHA_CREACION` (con valor por defecto) en las que no tenían ninguna fecha | Fecha y hora de creación de cada dato nuevo. Las filas anteriores quedan en `NULL`, salvo valoraciones y preguntas frecuentes, cuya fecha se recuperó de sus mensajes y propuestas. |
| `ROLES` | `ADMINISTRADOR`, `EVALUADOR` (antes `REVISOR`) y `CONSULTA` (migración 008) | Permisos de la aplicación de escritorio. |

`oracle/migrations/007_comentarios.sql` (generado desde los metadatos reales) agrega `COMMENT ON` a las 32 tablas y a sus columnas: módulo y descripción de cada tabla, qué es cada ID automático y a qué tabla apunta cada clave foránea. Es la documentación que usa el visor del panel y que se ve en SQL Developer.

**Límite conocido:** la auditoría la escribe la aplicación (`app.py`), no disparadores de Oracle; un cambio hecho directamente con SQL Developer no queda registrado. Los disparadores requieren que `DUCO_APP` tenga `CREATE TRIGGER` y `CREATE PROCEDURE`, privilegios que hoy no tiene.

## Base local propia para estudiar (copia de los datos)

Cada integrante puede tener su propia base para practicar `SELECT`, `INSERT` o `DELETE` sin riesgo para los datos de otro. Funciona con Oracle Free 26ai o con Oracle XE 18c/21c (desde 12c; el nombre del servicio es `FREEPDB1` o `XEPDB1`).

1. **Crear la base vacía:** `oracle/create_user.sql` como `SYSTEM`; luego `oracle/schema.sql` como `DUCO_APP` (ya incluye lo de las migraciones `001` a `005`: en una base nueva **no** se ejecutan); después `006`, `007` y `008` con `python apply_migration.py <archivo>` (desde `admin-app/`). Para los procedimientos almacenados: `009a_permiso_procedimientos.sql` como `SYSTEM` (una vez) y luego `009_procedimientos_almacenados.sql` como `DUCO_APP`.
2. **Pedir el archivo de datos** a quien tenga la base cargada, que lo genera con `python export_data.py` (queda en `database/export/`, sin usuarios, contraseñas ni auditoría, y con los nombres del chat anonimizados; `--keep-names` los conserva).
3. **Cargarlo en TU base local:** `python import_data.py ../database/export/duco_datos_AAAAMMDD-HHMM.json` (con `admin-app/.env` apuntando a TU base). El script se niega a cargar en una base que no sea local, se niega si las tablas ya tienen datos, hace todo en una transacción y deja los contadores de ID al día. `--dry-run` prueba sin dejar nada.
4. **Crear tu usuario del panel:** `python create_admin.py --name "Tu Nombre" --email tu@correo.cl --generate`.

El archivo exportado contiene conversaciones reales: compártelo solo con el equipo y **no lo subas a GitHub** (`database/export/` y `database/backups/` están en `.gitignore`).

## Consola administrativa

Consulta `../admin-app/README.md` para iniciar la aplicación local de altas, consultas, edición y eliminación de registros.

## Procedimientos almacenados (migración 009)

| Procedimiento | Qué hace |
|---|---|
| `SP_REVISAR_PROPUESTA(id, decisión, id_admin, actor, OUT id_faq)` | Aprueba o rechaza una propuesta de conocimiento en una sola operación: valida la decisión (`ORA-20001`), bloquea la fila y comprueba que siga `PENDIENTE` (`ORA-20002`), cambia estado y fecha de revisión, crea la pregunta frecuente si se aprueba y registra todo en `AUDITORIA_CAMBIOS`. No hace `COMMIT`: lo decide quien la llama. |
| `SP_RESUMEN_USO(días, OUT sesiones, OUT mensajes, OUT negativas)` | Cuenta sesiones, mensajes y valoraciones negativas de los últimos N días (7 por defecto). |

Necesitan `GRANT CREATE PROCEDURE TO DUCO_APP` (`009a`, como `SYSTEM`). Demostración para SQL Developer: `oracle/demo_procedimientos.sql` (deshace todo al final).
