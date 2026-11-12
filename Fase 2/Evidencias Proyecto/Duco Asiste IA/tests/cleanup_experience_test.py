from pathlib import Path
import json
import sys
sys.path.insert(0,str(Path(__file__).parents[1]/'admin-app'))
import app
path=Path(__file__).with_name('.experience-test-session.json')
if path.exists():
 session=json.loads(path.read_text(encoding='utf-8'))['session']
 with app.db_session() as conn, conn.cursor() as cur:
  cur.execute('SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:session_key',session_key=session)
  row=cur.fetchone()
  if row:
   session_id=row[0]
   for table in ['EXPERIENCIAS_ACCION','VALORACIONES_RESPUESTA']:
    cur.execute(f'DELETE FROM {table} WHERE ID_MENSAJE IN (SELECT ID_MENSAJE FROM MENSAJES WHERE ID_SESION=:session_id)',session_id=session_id)
   cur.execute('DELETE FROM MENSAJES WHERE ID_SESION=:session_id',session_id=session_id)
   cur.execute('DELETE FROM SESIONES_CHAT WHERE ID_SESION=:session_id',session_id=session_id)
   conn.commit()
 path.unlink()
 print('Datos de la sesión de prueba eliminados.')
