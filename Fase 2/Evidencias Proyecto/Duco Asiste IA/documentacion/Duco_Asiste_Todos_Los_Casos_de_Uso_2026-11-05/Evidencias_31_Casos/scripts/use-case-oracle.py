"""Inspect and remove only this evidence run's uniquely identified fixtures."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "admin-app"))
import app

mode, manifest_path = sys.argv[1:3]
manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
marker = manifest["marker"]
if not re.fullmatch(r"DUCO_EVIDENCE_[a-f0-9]{32}", marker):
    raise ValueError("Invalid fixture marker")
sessions = manifest.get("sessions", [])
with app.connect() as conn, conn.cursor() as cur:
    if mode == "cleanup":
        for session in sessions:
            for statement in [
                "DELETE FROM EXPERIENCIAS_ACCION WHERE ID_MENSAJE IN (SELECT ID_MENSAJE FROM MENSAJES WHERE ID_SESION IN (SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:s))",
                "DELETE FROM VALORACIONES_RESPUESTA WHERE ID_MENSAJE IN (SELECT ID_MENSAJE FROM MENSAJES WHERE ID_SESION IN (SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:s))",
                "DELETE FROM MENSAJES WHERE ID_SESION IN (SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:s)",
                "DELETE FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:s",
            ]:
                cur.execute(statement, s=session)
        for table, column in [("PROPUESTAS_CONOCIMIENTO", "PREGUNTA"), ("PREGUNTAS_FRECUENTES", "PREGUNTA"), ("CONFIGURACIONES", "CLAVE")]:
            cur.execute(f"DELETE FROM {table} WHERE SUBSTR({column},1,:n)=:m", n=len(marker), m=marker)
        conn.commit()
    elif mode != "inspect":
        raise ValueError("Invalid mode")
    result = {"databaseVersion": conn.version, "mode": mode, "marker": marker}
    for label, sql in [
        ("configurations", "SELECT ID_CONFIG, CLAVE, VALOR FROM CONFIGURACIONES WHERE SUBSTR(CLAVE,1,:n)=:m"),
        ("proposals", "SELECT ID_PROPUESTA, PREGUNTA, ESTADO FROM PROPUESTAS_CONOCIMIENTO WHERE SUBSTR(PREGUNTA,1,:n)=:m"),
        ("publishedFaqs", "SELECT ID_PREGUNTA, PREGUNTA FROM PREGUNTAS_FRECUENTES WHERE SUBSTR(PREGUNTA,1,:n)=:m"),
    ]:
        cur.execute(sql, n=len(marker), m=marker)
        result[label] = [list(row) for row in cur]
    result["sessionRows"] = []
    for session in sessions:
        cur.execute("SELECT COUNT(*) FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:s", s=session)
        count = cur.fetchone()[0]
        cur.execute("SELECT v.ID_VALORACION, v.PUNTUACION, v.ESTADO_REVISION FROM VALORACIONES_RESPUESTA v JOIN MENSAJES m ON m.ID_MENSAJE=v.ID_MENSAJE JOIN SESIONES_CHAT s ON s.ID_SESION=m.ID_SESION WHERE s.CLIENT_SESSION_ID=:s", s=session)
        result["sessionRows"].append({"session": session, "count": count, "ratings": [list(row) for row in cur]})
    if mode == "cleanup":
        result["clean"] = not any(result[k] for k in ["configurations", "proposals", "publishedFaqs"]) and all(s["count"] == 0 for s in result["sessionRows"])
    print(json.dumps(result, ensure_ascii=True))
