-- 007 · Comentarios de tablas y columnas (documentación dentro de Oracle: se ven en SQL Developer y en el panel).
-- Generado a partir de los metadatos reales; se puede volver a ejecutar sin riesgo.

COMMENT ON TABLE ACCIONES_NAVEGACION IS 'Contenido y navegación · Tipos de acción que Duco puede hacer en el sitio (abrir un menú, resaltar un texto, ir a una página).'
/
COMMENT ON TABLE AUDITORIA_CAMBIOS IS 'Acceso y administración · Bitácora de cambios: qué tabla y registro cambió, qué acción se hizo, los valores antes y después, quién y desde dónde (panel, chat o sistema).'
/
COMMENT ON TABLE CATEGORIAS_FAQ IS 'Conocimiento administrable · Categorías en que se agrupan las preguntas frecuentes.'
/
COMMENT ON TABLE CONFIGURACIONES IS 'Acceso y administración · Parámetros de configuración del sistema en formato clave y valor.'
/
COMMENT ON TABLE DETECCIONES_INTENCION IS 'Chat e inteligencia artificial · Intención detectada en cada mensaje de la persona.'
/
COMMENT ON TABLE EJECUCIONES_NAVEGACION IS 'Contenido y navegación · Cada acción de navegación que Duco realizó y su resultado.'
/
COMMENT ON TABLE ENLACES_SECCION IS 'Contenido y navegación · Enlaces que contiene cada sección.'
/
COMMENT ON TABLE ETIQUETAS IS 'Contenido y navegación · Etiquetas temáticas para clasificar secciones.'
/
COMMENT ON TABLE EVENTOS_SISTEMA IS 'Calidad y operación · Eventos del sistema: ingresos al panel, sesiones de chat nuevas y similares.'
/
COMMENT ON TABLE EXPERIENCIAS_ACCION IS 'Calidad y operación · Memoria de acciones valoradas: qué hizo Duco en una interacción y si funcionó.'
/
COMMENT ON TABLE FAQ_FUENTES IS 'Conocimiento administrable · Fuentes que respaldan cada pregunta frecuente.'
/
COMMENT ON TABLE FUENTES_INFORMACION IS 'Contenido y navegación · Fuentes oficiales de donde sale la información (páginas y documentos).'
/
COMMENT ON TABLE FUENTES_RESPUESTA IS 'Contenido y navegación · Qué fuentes respaldaron cada respuesta de Duco.'
/
COMMENT ON TABLE GENERACIONES_IA IS 'Chat e inteligencia artificial · Registro de cada respuesta generada por el modelo, para medir y depurar.'
/
COMMENT ON TABLE INTENCIONES IS 'Chat e inteligencia artificial · Catálogo de intenciones que Duco reconoce (navegar, consultar, etc.).'
/
COMMENT ON TABLE MENSAJES IS 'Chat e inteligencia artificial · Cada mensaje de una conversación, escrito por la persona o por Duco, con su fecha.'
/
COMMENT ON TABLE METRICAS_RENDIMIENTO IS 'Calidad y operación · Tiempos de respuesta medidos por sesión.'
/
COMMENT ON TABLE MODELOS_IA IS 'Chat e inteligencia artificial · Modelos de IA que usa Duco (por ejemplo qwen3.5:4b) y su proveedor.'
/
COMMENT ON TABLE PAGINAS_WEB IS 'Contenido y navegación · Páginas del sitio de Duoc UC que Duco conoce.'
/
COMMENT ON TABLE PREGUNTAS_FRECUENTES IS 'Conocimiento administrable · Preguntas y respuestas aprobadas que Duco puede reutilizar.'
/
COMMENT ON TABLE PROPUESTAS_CONOCIMIENTO IS 'Conocimiento administrable · Respuestas que Duco propone y esperan revisión: solo pasan a preguntas frecuentes si un administrador las aprueba.'
/
COMMENT ON TABLE REGISTROS_ERROR IS 'Calidad y operación · Errores ocurridos, con su tipo, la sesión y el detalle.'
/
COMMENT ON TABLE ROLES IS 'Acceso y administración · Perfiles de acceso al panel de administración (ADMINISTRADOR y REVISOR).'
/
COMMENT ON TABLE SECCIONES_WEB IS 'Contenido y navegación · Secciones dentro de cada página del sitio.'
/
COMMENT ON TABLE SECCION_ETIQUETA IS 'Contenido y navegación · Tabla intermedia: qué etiquetas tiene cada sección (relación de muchos a muchos).'
/
COMMENT ON TABLE SESIONES_ADMIN IS 'Acceso y administración · Sesiones iniciadas en el panel (una por ingreso): quién, desde qué dirección y hasta cuándo valen. Solo se guarda el hash del token.'
/
COMMENT ON TABLE SESIONES_CHAT IS 'Chat e inteligencia artificial · Una fila por conversación del chat: identificador del navegador, nombre de la persona y última actividad.'
/
COMMENT ON TABLE SINONIMOS_CONSULTA IS 'Conocimiento administrable · Otras formas de hacer la misma pregunta que una pregunta frecuente.'
/
COMMENT ON TABLE TIPOS_ERROR IS 'Calidad y operación · Catálogo de tipos de error del sistema.'
/
COMMENT ON TABLE USUARIOS_ADMIN IS 'Acceso y administración · Personas que pueden ingresar al panel: nombre, correo y contraseña (solo como hash, nunca en texto).'
/
COMMENT ON TABLE VALORACIONES_RESPUESTA IS 'Chat e inteligencia artificial · Votos de 👍 o 👎 que las personas dan a las respuestas de Duco y su estado de revisión.'
/
COMMENT ON TABLE VERSIONES_PROMPT IS 'Chat e inteligencia artificial · Versiones de las instrucciones (prompts) que se le dan al modelo de IA.'
/
COMMENT ON COLUMN ACCIONES_NAVEGACION.ID_ACCION IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN ACCIONES_NAVEGACION.ID_SECCION IS 'Clave foránea: indica a qué fila de SECCIONES_WEB pertenece este registro (coincide con SECCIONES_WEB.ID_SECCION).'
/
COMMENT ON COLUMN ACCIONES_NAVEGACION.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN AUDITORIA_CAMBIOS.ID_CAMBIO IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN AUDITORIA_CAMBIOS.ID_ADMIN IS 'Usuario del panel que hizo el cambio (vacío si lo hizo el chat o el sistema).'
/
COMMENT ON COLUMN AUDITORIA_CAMBIOS.TABLA_AFECTADA IS 'Tabla donde ocurrió el cambio.'
/
COMMENT ON COLUMN AUDITORIA_CAMBIOS.FECHA IS 'Fecha y hora del registro.'
/
COMMENT ON COLUMN AUDITORIA_CAMBIOS.ACCION IS 'INSERT (se creó), UPDATE (se modificó) o DELETE (se borró). Las filas históricas dicen APROBADA o ACTUALIZADA.'
/
COMMENT ON COLUMN AUDITORIA_CAMBIOS.ID_REGISTRO IS 'ID de la fila que cambió, dentro de TABLA_AFECTADA (vacío en los registros históricos).'
/
COMMENT ON COLUMN AUDITORIA_CAMBIOS.VALOR_ANTERIOR IS 'Cómo estaba la fila antes del cambio (JSON).'
/
COMMENT ON COLUMN AUDITORIA_CAMBIOS.VALOR_NUEVO IS 'Cómo quedó la fila después del cambio (JSON).'
/
COMMENT ON COLUMN AUDITORIA_CAMBIOS.NOMBRE_ACTOR IS 'Nombre de quien hizo el cambio: el usuario del panel o el nombre dado en el chat.'
/
COMMENT ON COLUMN AUDITORIA_CAMBIOS.ORIGEN IS 'Desde dónde se hizo: panel, chat, sistema o historico (anterior al registro detallado).'
/
COMMENT ON COLUMN CATEGORIAS_FAQ.ID_CATEGORIA IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN CATEGORIAS_FAQ.NOMBRE IS 'Nombre.'
/
COMMENT ON COLUMN CATEGORIAS_FAQ.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN CONFIGURACIONES.ID_CONFIG IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN CONFIGURACIONES.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN DETECCIONES_INTENCION.ID_DETECCION IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN DETECCIONES_INTENCION.ID_MENSAJE IS 'Clave foránea: indica a qué fila de MENSAJES pertenece este registro (coincide con MENSAJES.ID_MENSAJE).'
/
COMMENT ON COLUMN DETECCIONES_INTENCION.ID_INTENCION IS 'Clave foránea: indica a qué fila de INTENCIONES pertenece este registro (coincide con INTENCIONES.ID_INTENCION).'
/
COMMENT ON COLUMN DETECCIONES_INTENCION.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN EJECUCIONES_NAVEGACION.ID_EJECUCION IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN EJECUCIONES_NAVEGACION.ID_ACCION IS 'Clave foránea: indica a qué fila de ACCIONES_NAVEGACION pertenece este registro (coincide con ACCIONES_NAVEGACION.ID_ACCION).'
/
COMMENT ON COLUMN EJECUCIONES_NAVEGACION.ID_MENSAJE IS 'Clave foránea: indica a qué fila de MENSAJES pertenece este registro (coincide con MENSAJES.ID_MENSAJE).'
/
COMMENT ON COLUMN EJECUCIONES_NAVEGACION.FECHA IS 'Fecha y hora del registro.'
/
COMMENT ON COLUMN ENLACES_SECCION.ID_ENLACE IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN ENLACES_SECCION.ID_SECCION IS 'Clave foránea: indica a qué fila de SECCIONES_WEB pertenece este registro (coincide con SECCIONES_WEB.ID_SECCION).'
/
COMMENT ON COLUMN ENLACES_SECCION.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN ETIQUETAS.ID_ETIQUETA IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN ETIQUETAS.NOMBRE IS 'Nombre.'
/
COMMENT ON COLUMN ETIQUETAS.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN EVENTOS_SISTEMA.ID_EVENTO IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN EVENTOS_SISTEMA.TIPO IS 'Qué ocurrió (por ejemplo ADMIN_LOGIN o SESION_CHAT_INICIADA).'
/
COMMENT ON COLUMN EVENTOS_SISTEMA.FECHA IS 'Fecha y hora del registro.'
/
COMMENT ON COLUMN EXPERIENCIAS_ACCION.ID_MENSAJE IS 'Clave primaria y a la vez foránea: es el mismo ID de MENSAJES.ID_MENSAJE.'
/
COMMENT ON COLUMN EXPERIENCIAS_ACCION.PAGINA IS 'Página del sitio donde ocurrió la interacción.'
/
COMMENT ON COLUMN EXPERIENCIAS_ACCION.PETICION IS 'Lo que pidió la persona.'
/
COMMENT ON COLUMN EXPERIENCIAS_ACCION.DATOS IS 'Detalle de los pasos que hizo Duco y su resultado (JSON).'
/
COMMENT ON COLUMN EXPERIENCIAS_ACCION.FECHA IS 'Fecha y hora del registro.'
/
COMMENT ON COLUMN FAQ_FUENTES.ID_PREGUNTA IS 'Clave primaria y a la vez foránea: es el mismo ID de PREGUNTAS_FRECUENTES.ID_PREGUNTA.'
/
COMMENT ON COLUMN FAQ_FUENTES.ID_FUENTE IS 'Clave primaria y a la vez foránea: es el mismo ID de FUENTES_INFORMACION.ID_FUENTE.'
/
COMMENT ON COLUMN FAQ_FUENTES.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN FUENTES_INFORMACION.ID_FUENTE IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN FUENTES_INFORMACION.ID_PAGINA IS 'Clave foránea: indica a qué fila de PAGINAS_WEB pertenece este registro (coincide con PAGINAS_WEB.ID_PAGINA).'
/
COMMENT ON COLUMN FUENTES_INFORMACION.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN FUENTES_RESPUESTA.ID_MENSAJE IS 'Clave primaria y a la vez foránea: es el mismo ID de MENSAJES.ID_MENSAJE.'
/
COMMENT ON COLUMN FUENTES_RESPUESTA.ID_FUENTE IS 'Clave primaria y a la vez foránea: es el mismo ID de FUENTES_INFORMACION.ID_FUENTE.'
/
COMMENT ON COLUMN FUENTES_RESPUESTA.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN GENERACIONES_IA.ID_GENERACION IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN GENERACIONES_IA.ID_MENSAJE IS 'Clave foránea: indica a qué fila de MENSAJES pertenece este registro (coincide con MENSAJES.ID_MENSAJE).'
/
COMMENT ON COLUMN GENERACIONES_IA.ID_PROMPT IS 'Clave foránea: indica a qué fila de VERSIONES_PROMPT pertenece este registro (coincide con VERSIONES_PROMPT.ID_PROMPT).'
/
COMMENT ON COLUMN GENERACIONES_IA.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN INTENCIONES.ID_INTENCION IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN INTENCIONES.NOMBRE IS 'Nombre.'
/
COMMENT ON COLUMN INTENCIONES.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN MENSAJES.ID_MENSAJE IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN MENSAJES.ID_SESION IS 'Clave foránea: indica a qué fila de SESIONES_CHAT pertenece este registro (coincide con SESIONES_CHAT.ID_SESION).'
/
COMMENT ON COLUMN MENSAJES.ROL_EMISOR IS 'Quién escribió el mensaje: user (la persona) o assistant (Duco).'
/
COMMENT ON COLUMN MENSAJES.CONTENIDO IS 'Texto del mensaje.'
/
COMMENT ON COLUMN MENSAJES.FECHA IS 'Fecha y hora en que se guardó el mensaje.'
/
COMMENT ON COLUMN MENSAJES.CLIENT_MESSAGE_ID IS 'Identificador de la interacción generado por el navegador: un UUID seguido de :user o :assistant.'
/
COMMENT ON COLUMN METRICAS_RENDIMIENTO.ID_METRICA IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN METRICAS_RENDIMIENTO.ID_SESION IS 'Clave foránea: indica a qué fila de SESIONES_CHAT pertenece este registro (coincide con SESIONES_CHAT.ID_SESION).'
/
COMMENT ON COLUMN METRICAS_RENDIMIENTO.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN MODELOS_IA.ID_MODELO IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN MODELOS_IA.NOMBRE IS 'Nombre.'
/
COMMENT ON COLUMN MODELOS_IA.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN PAGINAS_WEB.ID_PAGINA IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN PAGINAS_WEB.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN PREGUNTAS_FRECUENTES.ID_PREGUNTA IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN PREGUNTAS_FRECUENTES.ID_CATEGORIA IS 'Clave foránea: indica a qué fila de CATEGORIAS_FAQ pertenece este registro (coincide con CATEGORIAS_FAQ.ID_CATEGORIA).'
/
COMMENT ON COLUMN PREGUNTAS_FRECUENTES.PREGUNTA IS 'Pregunta tal como se aprobó.'
/
COMMENT ON COLUMN PREGUNTAS_FRECUENTES.RESPUESTA IS 'Respuesta aprobada que Duco puede reutilizar.'
/
COMMENT ON COLUMN PREGUNTAS_FRECUENTES.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN PROPUESTAS_CONOCIMIENTO.ID_PROPUESTA IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN PROPUESTAS_CONOCIMIENTO.ESTADO IS 'PENDIENTE, APROBADA o RECHAZADA.'
/
COMMENT ON COLUMN PROPUESTAS_CONOCIMIENTO.FECHA_CREACION IS 'Fecha y hora en que Duco creó la propuesta.'
/
COMMENT ON COLUMN PROPUESTAS_CONOCIMIENTO.FECHA_REVISION IS 'Fecha y hora en que un revisor la aprobó o rechazó.'
/
COMMENT ON COLUMN REGISTROS_ERROR.ID_ERROR IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN REGISTROS_ERROR.ID_TIPO_ERROR IS 'Clave foránea: indica a qué fila de TIPOS_ERROR pertenece este registro (coincide con TIPOS_ERROR.ID_TIPO_ERROR).'
/
COMMENT ON COLUMN REGISTROS_ERROR.ID_SESION IS 'Clave foránea: indica a qué fila de SESIONES_CHAT pertenece este registro (coincide con SESIONES_CHAT.ID_SESION).'
/
COMMENT ON COLUMN REGISTROS_ERROR.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN ROLES.ID_ROL IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN ROLES.NOMBRE IS 'Nombre.'
/
COMMENT ON COLUMN ROLES.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN SECCIONES_WEB.ID_SECCION IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN SECCIONES_WEB.ID_PAGINA IS 'Clave foránea: indica a qué fila de PAGINAS_WEB pertenece este registro (coincide con PAGINAS_WEB.ID_PAGINA).'
/
COMMENT ON COLUMN SECCIONES_WEB.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN SECCION_ETIQUETA.ID_SECCION IS 'Clave primaria y a la vez foránea: es el mismo ID de SECCIONES_WEB.ID_SECCION.'
/
COMMENT ON COLUMN SECCION_ETIQUETA.ID_ETIQUETA IS 'Clave primaria y a la vez foránea: es el mismo ID de ETIQUETAS.ID_ETIQUETA.'
/
COMMENT ON COLUMN SECCION_ETIQUETA.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN SESIONES_ADMIN.ID_SESION_ADMIN IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN SESIONES_ADMIN.ID_ADMIN IS 'Clave foránea: indica a qué fila de USUARIOS_ADMIN pertenece este registro (coincide con USUARIOS_ADMIN.ID_ADMIN).'
/
COMMENT ON COLUMN SESIONES_ADMIN.FECHA_INICIO IS 'Fecha y hora del registro.'
/
COMMENT ON COLUMN SESIONES_ADMIN.TOKEN_HASH IS 'SHA-256 del token de la sesión (el token real solo vive en la cookie del navegador).'
/
COMMENT ON COLUMN SESIONES_ADMIN.FECHA_EXPIRA IS 'Hasta cuándo vale la sesión.'
/
COMMENT ON COLUMN SESIONES_ADMIN.FECHA_FIN IS 'Cuándo se cerró la sesión (vacío si sigue abierta).'
/
COMMENT ON COLUMN SESIONES_ADMIN.DIRECCION_IP IS 'Dirección desde la que se ingresó.'
/
COMMENT ON COLUMN SESIONES_CHAT.ID_SESION IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN SESIONES_CHAT.FECHA_INICIO IS 'Fecha y hora en que empezó la conversación.'
/
COMMENT ON COLUMN SESIONES_CHAT.ID_MODELO IS 'Clave foránea: indica a qué fila de MODELOS_IA pertenece este registro (coincide con MODELOS_IA.ID_MODELO).'
/
COMMENT ON COLUMN SESIONES_CHAT.CLIENT_SESSION_ID IS 'Identificador aleatorio (UUID) que crea el navegador para cada conversación; no es el ID de la base.'
/
COMMENT ON COLUMN SESIONES_CHAT.NOMBRE_USUARIO IS 'Nombre o apodo que la persona escribió al abrir el chat.'
/
COMMENT ON COLUMN SESIONES_CHAT.ULTIMA_ACTIVIDAD IS 'Última vez que esa conversación se registró en el servidor.'
/
COMMENT ON COLUMN SINONIMOS_CONSULTA.ID_SINONIMO IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN SINONIMOS_CONSULTA.ID_PREGUNTA IS 'Clave foránea: indica a qué fila de PREGUNTAS_FRECUENTES pertenece este registro (coincide con PREGUNTAS_FRECUENTES.ID_PREGUNTA).'
/
COMMENT ON COLUMN SINONIMOS_CONSULTA.TEXTO IS 'Otra forma de escribir la misma pregunta.'
/
COMMENT ON COLUMN SINONIMOS_CONSULTA.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN TIPOS_ERROR.ID_TIPO_ERROR IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN TIPOS_ERROR.NOMBRE IS 'Nombre.'
/
COMMENT ON COLUMN TIPOS_ERROR.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN USUARIOS_ADMIN.ID_ADMIN IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN USUARIOS_ADMIN.ID_ROL IS 'Clave foránea: indica a qué fila de ROLES pertenece este registro (coincide con ROLES.ID_ROL).'
/
COMMENT ON COLUMN USUARIOS_ADMIN.NOMBRE IS 'Nombre.'
/
COMMENT ON COLUMN USUARIOS_ADMIN.CLAVE_HASH IS 'Contraseña transformada con PBKDF2; la contraseña real no se guarda.'
/
COMMENT ON COLUMN USUARIOS_ADMIN.ACTIVO IS '1 = puede ingresar; 0 = desactivado.'
/
COMMENT ON COLUMN USUARIOS_ADMIN.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN USUARIOS_ADMIN.ULTIMO_ACCESO IS 'Último ingreso al panel.'
/
COMMENT ON COLUMN VALORACIONES_RESPUESTA.ID_VALORACION IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN VALORACIONES_RESPUESTA.ID_MENSAJE IS 'Clave foránea: indica a qué fila de MENSAJES pertenece este registro (coincide con MENSAJES.ID_MENSAJE).'
/
COMMENT ON COLUMN VALORACIONES_RESPUESTA.PUNTUACION IS '1 = 👍 (útil) y -1 = 👎 (no útil).'
/
COMMENT ON COLUMN VALORACIONES_RESPUESTA.ESTADO_REVISION IS 'PENDIENTE (un revisor aún no la mira) o REVISADA.'
/
COMMENT ON COLUMN VALORACIONES_RESPUESTA.ID_PREGUNTA_FAQ IS 'Clave foránea: indica a qué fila de PREGUNTAS_FRECUENTES pertenece este registro (coincide con PREGUNTAS_FRECUENTES.ID_PREGUNTA).'
/
COMMENT ON COLUMN VALORACIONES_RESPUESTA.ID_PROPUESTA IS 'Clave foránea: indica a qué fila de PROPUESTAS_CONOCIMIENTO pertenece este registro (coincide con PROPUESTAS_CONOCIMIENTO.ID_PROPUESTA).'
/
COMMENT ON COLUMN VALORACIONES_RESPUESTA.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
COMMENT ON COLUMN VERSIONES_PROMPT.ID_PROMPT IS 'Identificador único de la fila. Lo genera Oracle solo (columna identity): empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos.'
/
COMMENT ON COLUMN VERSIONES_PROMPT.FECHA_CREACION IS 'Fecha y hora en que se creó el registro. Las filas anteriores a la migración 006 pueden estar vacías.'
/
