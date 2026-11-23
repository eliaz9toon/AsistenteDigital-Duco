-- 009: procedimientos almacenados de Duco Asiste.
-- Requisito previo (una sola vez, como SYSTEM):  GRANT CREATE PROCEDURE TO DUCO_APP;  (ver 009a_permiso_procedimientos.sql)
-- Ejecutar conectado como DUCO_APP con "Run Script" (F5) en SQL Developer, o con: python apply_migration.py <este archivo>
-- Los bloques se separan con una línea que solo contiene "/".

-- 1) SP_REVISAR_PROPUESTA: aprueba o rechaza una propuesta de conocimiento en UNA sola operación.
--    Valida la decisión, bloquea la fila, cambia el estado, guarda la fecha de revisión, si se aprueba crea la
--    pregunta frecuente y deja todo registrado en AUDITORIA_CAMBIOS. No hace COMMIT: lo decide quien la llama,
--    así, si algo falla, no queda nada a medias.
CREATE OR REPLACE PROCEDURE SP_REVISAR_PROPUESTA (
    p_id_propuesta IN NUMBER,
    p_decision     IN VARCHAR2,                 -- 'APROBADA' o 'RECHAZADA'
    p_id_admin     IN NUMBER   DEFAULT NULL,    -- USUARIOS_ADMIN.ID_ADMIN de quien revisa
    p_actor        IN VARCHAR2 DEFAULT NULL,    -- nombre de quien revisa (para la auditoría)
    p_id_faq       OUT NUMBER                   -- ID de la pregunta frecuente creada (NULL si se rechaza)
) AS
    v_decision  VARCHAR2(20) := UPPER(TRIM(p_decision));
    v_pregunta  PROPUESTAS_CONOCIMIENTO.PREGUNTA%TYPE;
    v_respuesta PROPUESTAS_CONOCIMIENTO.RESPUESTA%TYPE;
BEGIN
    p_id_faq := NULL;
    IF v_decision NOT IN ('APROBADA', 'RECHAZADA') THEN
        RAISE_APPLICATION_ERROR(-20001, 'Decisión inválida: use APROBADA o RECHAZADA');
    END IF;

    BEGIN
        SELECT PREGUNTA, RESPUESTA INTO v_pregunta, v_respuesta
        FROM PROPUESTAS_CONOCIMIENTO
        WHERE ID_PROPUESTA = p_id_propuesta AND ESTADO = 'PENDIENTE'
        FOR UPDATE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20002, 'La propuesta no existe o ya fue revisada');
    END;

    UPDATE PROPUESTAS_CONOCIMIENTO
       SET ESTADO = v_decision, FECHA_REVISION = CURRENT_TIMESTAMP
     WHERE ID_PROPUESTA = p_id_propuesta;

    INSERT INTO AUDITORIA_CAMBIOS (ID_ADMIN, TABLA_AFECTADA, FECHA, ACCION, ID_REGISTRO, VALOR_ANTERIOR, VALOR_NUEVO, NOMBRE_ACTOR, ORIGEN)
    VALUES (p_id_admin, 'PROPUESTAS_CONOCIMIENTO', CURRENT_TIMESTAMP, 'UPDATE', TO_CHAR(p_id_propuesta),
            '{"estado":"PENDIENTE"}', '{"estado":"' || v_decision || '"}', SUBSTR(p_actor, 1, 120), 'procedimiento');

    IF v_decision = 'APROBADA' THEN
        INSERT INTO PREGUNTAS_FRECUENTES (PREGUNTA, RESPUESTA)
        VALUES (v_pregunta, v_respuesta)
        RETURNING ID_PREGUNTA INTO p_id_faq;

        INSERT INTO AUDITORIA_CAMBIOS (ID_ADMIN, TABLA_AFECTADA, FECHA, ACCION, ID_REGISTRO, VALOR_ANTERIOR, VALOR_NUEVO, NOMBRE_ACTOR, ORIGEN)
        VALUES (p_id_admin, 'PREGUNTAS_FRECUENTES', CURRENT_TIMESTAMP, 'INSERT', TO_CHAR(p_id_faq),
                NULL, '{"origen":"propuesta ' || p_id_propuesta || '"}', SUBSTR(p_actor, 1, 120), 'procedimiento');
    END IF;
END SP_REVISAR_PROPUESTA;
/

-- 2) SP_RESUMEN_USO: cuenta cuánto se usó el asistente en los últimos N días (para reportes).
CREATE OR REPLACE PROCEDURE SP_RESUMEN_USO (
    p_dias      IN  NUMBER DEFAULT 7,
    p_sesiones  OUT NUMBER,
    p_mensajes  OUT NUMBER,
    p_negativas OUT NUMBER
) AS
    v_desde TIMESTAMP := CURRENT_TIMESTAMP - NUMTODSINTERVAL(GREATEST(NVL(p_dias, 7), 1), 'DAY');
BEGIN
    SELECT COUNT(*) INTO p_sesiones FROM SESIONES_CHAT WHERE FECHA_INICIO >= v_desde;
    SELECT COUNT(*) INTO p_mensajes FROM MENSAJES WHERE FECHA >= v_desde;
    SELECT COUNT(*) INTO p_negativas
      FROM VALORACIONES_RESPUESTA r JOIN MENSAJES m ON m.ID_MENSAJE = r.ID_MENSAJE
     WHERE m.FECHA >= v_desde AND r.PUNTUACION < 0;
END SP_RESUMEN_USO;
/

COMMENT ON TABLE PROPUESTAS_CONOCIMIENTO IS 'Propuestas de respuestas nuevas; se aprueban o rechazan con el procedimiento SP_REVISAR_PROPUESTA.';
/
