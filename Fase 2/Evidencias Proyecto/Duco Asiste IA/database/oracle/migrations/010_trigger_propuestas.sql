-- 010: trigger sobre PROPUESTAS_CONOCIMIENTO. Requiere GRANT CREATE TRIGGER TO DUCO_APP (ver 009a), como SYSTEM.
-- Un trigger se dispara solo cuando alguien modifica la tabla (no se llama ni recibe parámetros).
-- Reglas que aplica, venga el cambio de la aplicación, de SQL Developer o de SP_REVISAR_PROPUESTA:
--   1) Una propuesta ya revisada (APROBADA o RECHAZADA) no puede cambiar de estado.
--   2) Al pasar de PENDIENTE a revisada, la fecha de revisión se completa sola.
CREATE OR REPLACE TRIGGER TRG_PROPUESTAS_REVISION
BEFORE UPDATE OF ESTADO ON PROPUESTAS_CONOCIMIENTO
FOR EACH ROW
WHEN (OLD.ESTADO <> NEW.ESTADO)
BEGIN
    IF :OLD.ESTADO <> 'PENDIENTE' THEN
        RAISE_APPLICATION_ERROR(-20003, 'La propuesta ya fue revisada (' || :OLD.ESTADO || '): no se puede cambiar su estado');
    END IF;
    IF :NEW.FECHA_REVISION IS NULL THEN
        :NEW.FECHA_REVISION := CURRENT_TIMESTAMP;
    END IF;
END TRG_PROPUESTAS_REVISION;
/
