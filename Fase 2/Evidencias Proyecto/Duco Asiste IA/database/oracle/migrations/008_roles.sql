-- 008 · Roles de la aplicación: ADMINISTRADOR, EVALUADOR y CONSULTA.
-- «REVISOR» pasa a llamarse «EVALUADOR» (los usuarios que lo tenían lo conservan) y se agrega «CONSULTA». Idempotente.
UPDATE ROLES SET NOMBRE = 'EVALUADOR' WHERE NOMBRE = 'REVISOR'
/

MERGE INTO ROLES r USING (SELECT 'ADMINISTRADOR' nombre FROM dual UNION ALL SELECT 'EVALUADOR' FROM dual UNION ALL SELECT 'CONSULTA' FROM dual) s
   ON (r.NOMBRE = s.nombre)
 WHEN NOT MATCHED THEN INSERT (NOMBRE) VALUES (s.nombre)
/

COMMENT ON TABLE ROLES IS 'Acceso y administración · Perfiles de acceso: ADMINISTRADOR (todo), EVALUADOR (ve datos y evalúa propuestas y valoraciones) y CONSULTA (solo ve dashboard, reportes y tablas).'
/
