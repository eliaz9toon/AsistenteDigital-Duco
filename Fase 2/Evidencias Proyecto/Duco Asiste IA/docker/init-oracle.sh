# Executed by the Oracle image during first initialization.
case "$APP_USER_PASSWORD" in
  ''|*[!a-zA-Z0-9_]*)
    echo "Use letters, digits and underscores in DUCO_DOCKER_APP_PASSWORD." >&2
    exit 1 ;;
esac

sqlplus -s -L / as sysdba <<'SQL' || exit 1
WHENEVER SQLERROR EXIT FAILURE
ALTER SESSION SET CONTAINER = FREEPDB1;
GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE TO DUCO_APP;
ALTER USER DUCO_APP QUOTA UNLIMITED ON USERS;
@/duco-sql/migrations/009a_permiso_procedimientos.sql
EXIT SUCCESS
SQL

sqlplus -s -L /nolog <<SQL || exit 1
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT FAILURE
SET DEFINE OFF
CONNECT DUCO_APP/"$APP_USER_PASSWORD"@//localhost:1521/FREEPDB1
@/duco-sql/schema.sql
@/duco-sql/migrations/006_login_auditoria_fechas.sql
@/duco-sql/migrations/007_comentarios.sql
@/duco-sql/migrations/008_roles.sql
@/duco-sql/migrations/009_procedimientos_almacenados.sql
@/duco-sql/migrations/010_trigger_propuestas.sql
DECLARE
  valid_objects NUMBER;
BEGIN
  SELECT COUNT(*) INTO valid_objects FROM USER_OBJECTS
    WHERE OBJECT_NAME IN ('SP_REVISAR_PROPUESTA', 'SP_RESUMEN_USO', 'TRG_PROPUESTAS_REVISION')
      AND STATUS = 'VALID';
  IF valid_objects <> 3 THEN
    RAISE_APPLICATION_ERROR(-20005, 'Invalid Duco procedures or trigger');
  END IF;
END;
/
EXIT SUCCESS COMMIT
SQL
