"""Inspect and clean only the exact temporary records owned by this video shoot."""
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"admin-app"))
import app

mode,filename=sys.argv[1:3]
manifest=json.loads(Path(filename).read_text(encoding="utf-8"))
nonce=str(uuid.UUID(manifest["nonce"]))
prefix=f"[Demostracion {nonce[:8]}]"
question=manifest["question"]
if not question.startswith(prefix):raise ValueError("Demo fixture ownership mismatch")
with app.connect() as conn,conn.cursor() as cur:
    if mode=="cleanup":
        for session in manifest.get("sessions",[]):
            session=str(uuid.UUID(session))
            for sql in [
                "DELETE FROM EXPERIENCIAS_ACCION WHERE ID_MENSAJE IN (SELECT ID_MENSAJE FROM MENSAJES WHERE ID_SESION IN (SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:s))",
                "DELETE FROM VALORACIONES_RESPUESTA WHERE ID_MENSAJE IN (SELECT ID_MENSAJE FROM MENSAJES WHERE ID_SESION IN (SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:s))",
                "DELETE FROM MENSAJES WHERE ID_SESION IN (SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:s)",
                "DELETE FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:s",
            ]:cur.execute(sql,s=session)
        cur.execute("DELETE FROM PROPUESTAS_CONOCIMIENTO WHERE PREGUNTA=:q",q=question)
        cur.execute("DELETE FROM PREGUNTAS_FRECUENTES WHERE PREGUNTA=:q",q=question)
        conn.commit()
    elif mode!="inspect":raise ValueError("Unknown operation")
    report={"mode":mode,"databaseVersion":conn.version,"proposal":[],"faq":[],"sessions":[]}
    cur.execute("SELECT ID_PROPUESTA,ESTADO FROM PROPUESTAS_CONOCIMIENTO WHERE PREGUNTA=:q",q=question)
    report["proposal"]=[list(row) for row in cur]
    cur.execute("SELECT ID_PREGUNTA FROM PREGUNTAS_FRECUENTES WHERE PREGUNTA=:q",q=question)
    report["faq"]=[row[0] for row in cur]
    for session in manifest.get("sessions",[]):
        cur.execute("SELECT COUNT(*) FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:s",s=str(uuid.UUID(session)))
        report["sessions"].append({"session":session,"rows":cur.fetchone()[0]})
    if mode=="cleanup":report["clean"]=not report["proposal"] and not report["faq"] and all(s["rows"]==0 for s in report["sessions"])
    print(json.dumps(report))
