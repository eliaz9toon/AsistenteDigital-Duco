-- 009a: permiso para crear procedimientos. Ejecutar UNA vez conectado al servicio FREEPDB1 como SYSTEM
-- (DUCO_APP no puede darse este permiso a sí mismo).
GRANT CREATE PROCEDURE TO DUCO_APP;

-- 010 (trigger): también hace falta este permiso.
GRANT CREATE TRIGGER TO DUCO_APP;
