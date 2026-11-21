-- 006 · Login del panel, nombre del usuario del chat, auditoría completa y fechas de creación.
-- Se ejecuta con admin-app/apply_migration.py (idempotente: se puede correr más de una vez).
-- Cada bloque termina con una línea que contiene solo «/».

-- 1) Quién usa el chat: nombre (o apodo) y última actividad de la sesión.
BEGIN
  FOR c IN (SELECT 'NOMBRE_USUARIO VARCHAR2(80 CHAR)' def, 'NOMBRE_USUARIO' col FROM dual
            UNION ALL SELECT 'ULTIMA_ACTIVIDAD TIMESTAMP', 'ULTIMA_ACTIVIDAD' FROM dual) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'ALTER TABLE SESIONES_CHAT ADD (' || c.def || ')';
    EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF;
    END;
  END LOOP;
END;
/

-- 2) Usuarios del panel de administración.
BEGIN
  FOR c IN (SELECT 'ACTIVO NUMBER(1) DEFAULT 1 NOT NULL' def FROM dual
            UNION ALL SELECT 'FECHA_CREACION TIMESTAMP DEFAULT SYSTIMESTAMP' FROM dual
            UNION ALL SELECT 'ULTIMO_ACCESO TIMESTAMP' FROM dual) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'ALTER TABLE USUARIOS_ADMIN ADD (' || c.def || ')';
    EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE USUARIOS_ADMIN ADD CONSTRAINT UQ_USUARIOS_ADMIN_CORREO UNIQUE (CORREO)';
  EXCEPTION WHEN OTHERS THEN IF SQLCODE NOT IN (-2261, -2264, -955) THEN RAISE; END IF;
  END;
END;
/

-- 3) Sesiones de administración: solo se guarda el hash del token, nunca el token.
BEGIN
  FOR c IN (SELECT 'TOKEN_HASH VARCHAR2(64)' def FROM dual
            UNION ALL SELECT 'FECHA_EXPIRA TIMESTAMP' FROM dual
            UNION ALL SELECT 'FECHA_FIN TIMESTAMP' FROM dual
            UNION ALL SELECT 'DIRECCION_IP VARCHAR2(45)' FROM dual) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'ALTER TABLE SESIONES_ADMIN ADD (' || c.def || ')';
    EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF;
    END;
  END LOOP;
END;
/

-- 4) Auditoría: qué tabla, qué fila, qué acción, valores antes y después, quién y desde dónde.
BEGIN
  FOR c IN (SELECT 'ACCION VARCHAR2(20)' def FROM dual
            UNION ALL SELECT 'ID_REGISTRO VARCHAR2(120)' FROM dual
            UNION ALL SELECT 'VALOR_ANTERIOR CLOB' FROM dual
            UNION ALL SELECT 'VALOR_NUEVO CLOB' FROM dual
            UNION ALL SELECT 'NOMBRE_ACTOR VARCHAR2(120 CHAR)' FROM dual
            UNION ALL SELECT 'ORIGEN VARCHAR2(20)' FROM dual) LOOP
    BEGIN
      EXECUTE IMMEDIATE 'ALTER TABLE AUDITORIA_CAMBIOS ADD (' || c.def || ')';
    EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF;
    END;
  END LOOP;
END;
/

-- Los registros antiguos tenían «TABLA:ACCION» en un solo texto: se separan.
UPDATE AUDITORIA_CAMBIOS
   SET ACCION = CASE WHEN INSTR(TABLA_AFECTADA, ':') > 0 THEN SUBSTR(TABLA_AFECTADA, INSTR(TABLA_AFECTADA, ':') + 1) ELSE 'ACTUALIZADA' END,
       TABLA_AFECTADA = CASE WHEN INSTR(TABLA_AFECTADA, ':') > 0 THEN SUBSTR(TABLA_AFECTADA, 1, INSTR(TABLA_AFECTADA, ':') - 1) ELSE TABLA_AFECTADA END,
       ORIGEN = 'historico'
 WHERE ACCION IS NULL
/

-- 5) Fecha y hora de creación en todas las tablas que no tenían ninguna.
--    Las filas anteriores quedan en NULL (no se inventa una fecha); las nuevas toman SYSTIMESTAMP.
BEGIN
  FOR t IN (SELECT table_name FROM user_tables
             WHERE table_name NOT IN (SELECT table_name FROM user_tab_columns
                                       WHERE column_name IN ('FECHA', 'FECHA_CREACION', 'FECHA_INICIO'))) LOOP
    EXECUTE IMMEDIATE 'ALTER TABLE "' || t.table_name || '" ADD (FECHA_CREACION TIMESTAMP)';
    EXECUTE IMMEDIATE 'ALTER TABLE "' || t.table_name || '" MODIFY (FECHA_CREACION DEFAULT SYSTIMESTAMP)';
  END LOOP;
END;
/

-- Fechas recuperables de datos históricos: una valoración nació con su mensaje.
UPDATE VALORACIONES_RESPUESTA v
   SET FECHA_CREACION = (SELECT m.FECHA FROM MENSAJES m WHERE m.ID_MENSAJE = v.ID_MENSAJE)
 WHERE FECHA_CREACION IS NULL
/

-- Una pregunta frecuente nació cuando se aprobó su propuesta.
UPDATE PREGUNTAS_FRECUENTES f
   SET FECHA_CREACION = (SELECT MAX(p.FECHA_REVISION) FROM PROPUESTAS_CONOCIMIENTO p
                          WHERE p.ESTADO = 'APROBADA' AND p.PREGUNTA = f.PREGUNTA)
 WHERE FECHA_CREACION IS NULL
/

-- 6) Roles del panel.
MERGE INTO ROLES r USING (SELECT 'ADMINISTRADOR' nombre FROM dual UNION ALL SELECT 'REVISOR' FROM dual) s
   ON (r.NOMBRE = s.nombre)
 WHEN NOT MATCHED THEN INSERT (NOMBRE) VALUES (s.nombre)
/
