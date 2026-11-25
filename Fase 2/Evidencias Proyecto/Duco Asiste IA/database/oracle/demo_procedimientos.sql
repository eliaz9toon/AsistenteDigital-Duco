-- Demostración de los procedimientos almacenados. Ejecutar como DUCO_APP con "Run Script" (F5) en SQL Developer.
-- Todo se deshace al final (ROLLBACK), así que no deja datos.
SET SERVEROUTPUT ON

DECLARE
    v_id_propuesta NUMBER;
    v_id_faq       NUMBER;
    v_sesiones     NUMBER;
    v_mensajes     NUMBER;
    v_negativas    NUMBER;
BEGIN
    -- 1) Una propuesta nueva queda PENDIENTE
    INSERT INTO PROPUESTAS_CONOCIMIENTO (PREGUNTA, RESPUESTA)
    VALUES ('¿Demo del procedimiento?', 'Respuesta de demostración')
    RETURNING ID_PROPUESTA INTO v_id_propuesta;
    DBMS_OUTPUT.PUT_LINE('Propuesta creada: ' || v_id_propuesta);

    -- 2) El procedimiento la aprueba, crea la pregunta frecuente y deja la auditoría
    SP_REVISAR_PROPUESTA(v_id_propuesta, 'APROBADA', NULL, 'Demo SQL Developer', v_id_faq);
    DBMS_OUTPUT.PUT_LINE('Aprobada. Pregunta frecuente creada: ' || v_id_faq);

    -- 3) Revisarla otra vez da error controlado
    BEGIN
        SP_REVISAR_PROPUESTA(v_id_propuesta, 'APROBADA', NULL, 'Demo SQL Developer', v_id_faq);
    EXCEPTION WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Segundo intento rechazado: ' || SQLERRM);
    END;

    -- 3b) El trigger TRG_PROPUESTAS_REVISION impide cambiar una propuesta ya revisada, aunque se haga a mano
    BEGIN
        UPDATE PROPUESTAS_CONOCIMIENTO SET ESTADO = 'PENDIENTE' WHERE ID_PROPUESTA = v_id_propuesta;
    EXCEPTION WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Trigger: ' || SQLERRM);
    END;

    -- 4) Resumen de uso de los últimos 7 días
    SP_RESUMEN_USO(7, v_sesiones, v_mensajes, v_negativas);
    DBMS_OUTPUT.PUT_LINE('Últimos 7 días -> sesiones: ' || v_sesiones || ', mensajes: ' || v_mensajes || ', valoraciones negativas: ' || v_negativas);
END;
/

-- Lo que quedó en la auditoría por el procedimiento (antes de deshacer)
SELECT TABLA_AFECTADA, ACCION, ID_REGISTRO, NOMBRE_ACTOR, ORIGEN FROM AUDITORIA_CAMBIOS WHERE ORIGEN = 'procedimiento' ORDER BY ID_CAMBIO DESC FETCH FIRST 2 ROWS ONLY;

ROLLBACK;
