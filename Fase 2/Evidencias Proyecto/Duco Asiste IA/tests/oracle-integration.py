"""Opt-in integration test: writes only uniquely tagged temporary Oracle rows."""
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "admin-app"))
import app
import oracledb

if "--run-real" not in sys.argv:
    raise SystemExit("Use --run-real to authorize isolated test records in the configured database.")

marker = "DUCO_TEST_" + uuid.uuid4().hex
question = marker + " pregunta de validacion"
report = {"date": datetime.now().isoformat(), "driver": oracledb.__version__, "marker": marker, "checks": []}
output = Path(__file__).parent / "evidence" / "oracle-integration.json"

def api(method, route, payload=None, expected=200):
    data = json.dumps(payload).encode() if payload is not None else None
    request = Request("http://127.0.0.1:8765" + route, data=data, method=method,
                      headers={"Content-Type": "application/json", "Origin": "http://127.0.0.1:8765"})
    try:
        with urlopen(request, timeout=30) as response:
            status, result = response.status, json.load(response)
    except HTTPError as error:
        status, result = error.code, json.load(error)
    assert status == expected, (method, route, status, result.get("error"))
    return result

def query(sql, **binds):
    with app.connect() as connection, connection.cursor() as cursor:
        cursor.execute(sql, binds)
        return cursor.fetchall()

try:
    with app.connect() as connection:
        report["databaseVersion"] = connection.version
    assert "CONFIGURACIONES" in api("GET", "/api/tables")["tables"]
    report["checks"].append("Live Oracle connection and admin table metadata")
    api("POST", "/api/tables/CONFIGURACIONES", {"values": {"CLAVE": marker, "VALOR": "inicial"}}, 201)
    config_id, value = query("SELECT ID_CONFIG, VALOR FROM CONFIGURACIONES WHERE CLAVE=:m", m=marker)[0]
    assert value == "inicial"
    assert any(r["ID_CONFIG"] == config_id for r in api("GET", "/api/tables/CONFIGURACIONES/rows")["rows"])
    report["checks"].append("API insert committed; read from independent Oracle connection and HTTP list")
    api("PUT", "/api/tables/CONFIGURACIONES", {"key": {"ID_CONFIG": config_id}, "values": {"VALOR": "actualizado"}})
    assert query("SELECT VALOR FROM CONFIGURACIONES WHERE ID_CONFIG=:i", i=config_id)[0][0] == "actualizado"
    api("PUT", "/api/tables/CONFIGURACIONES", {"key": {"ID_CONFIG": config_id}, "values": {"INVALID_COLUMN": "bad"}}, 400)
    assert query("SELECT VALOR FROM CONFIGURACIONES WHERE ID_CONFIG=:i", i=config_id)[0][0] == "actualizado"
    report["checks"].append("Update committed and invalid column rejected without changing the row")
    api("DELETE", "/api/tables/CONFIGURACIONES", {"key": {"ID_CONFIG": config_id}})
    assert not query("SELECT ID_CONFIG FROM CONFIGURACIONES WHERE CLAVE=:m", m=marker)
    api("DELETE", "/api/tables/CONFIGURACIONES", {"key": {"ID_CONFIG": config_id}}, 400)
    report["checks"].append("Delete committed; a second deletion reports missing record")

    api("POST", "/api/tables/SESIONES_CHAT", {"values": {"CLIENT_SESSION_ID": marker, "FECHA_INICIO": datetime.now().isoformat()}}, 201)
    session_id = query("SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:m", m=marker)[0][0]
    content = "Texto de prueba con acentos: matrícula. " * 90
    api("POST", "/api/tables/MENSAJES", {"values": {"ID_SESION": session_id, "ROL_EMISOR": "user", "CONTENIDO": content, "CLIENT_MESSAGE_ID": marker}}, 201)
    message_id, stored = query("SELECT ID_MENSAJE, CONTENIDO FROM MENSAJES WHERE CLIENT_MESSAGE_ID=:m", m=marker)[0]
    assert stored == content
    failure = api("DELETE", "/api/tables/SESIONES_CHAT", {"key": {"ID_SESION": session_id}}, 400)
    assert "ORA-02292" in failure["error"]
    assert query("SELECT ID_SESION FROM SESIONES_CHAT WHERE ID_SESION=:i", i=session_id)
    api("DELETE", "/api/tables/MENSAJES", {"key": {"ID_MENSAJE": message_id}})
    api("DELETE", "/api/tables/SESIONES_CHAT", {"key": {"ID_SESION": session_id}})
    report["checks"].append("Timestamp, numeric FK and long Unicode CLOB persisted; Oracle prevents deleting a referenced parent")

    api("POST", "/api/duco/proposals", {"question": question, "answer": "Respuesta exclusiva de prueba"}, 202)
    proposal = query("SELECT ID_PROPUESTA FROM PROPUESTAS_CONOCIMIENTO WHERE PREGUNTA=:q", q=question)[0][0]
    api("POST", f"/api/duco/proposals/{proposal}/review", {"decision": "APROBADA"})
    assert query("SELECT ID_PREGUNTA FROM PREGUNTAS_FRECUENTES WHERE PREGUNTA=:q", q=question)
    knowledge = api("GET", "/api/duco/knowledge?query=" + marker)
    assert any(item.get("question") == question for item in knowledge["items"])
    api("POST", f"/api/duco/proposals/{proposal}/review", {"decision": "APROBADA"}, 400)
    report["checks"].append("Proposal approval creates real FAQ retrievable by Duco; repeated review rejected")
    api("POST", "/api/duco/proposals", {"question": question + " rechazo", "answer": "Respuesta exclusiva de prueba"}, 202)
    rejected = query("SELECT ID_PROPUESTA FROM PROPUESTAS_CONOCIMIENTO WHERE PREGUNTA=:q", q=question + " rechazo")[0][0]
    api("POST", f"/api/duco/proposals/{rejected}/review", {"decision": "RECHAZADA"})
    assert not query("SELECT ID_PREGUNTA FROM PREGUNTAS_FRECUENTES WHERE PREGUNTA=:q", q=question + " rechazo")
    for route in ["/api/duco/proposals", "/api/duco/negative-feedback", "/api/duco/experiences?query=" + marker + "&page=/duco"]:
        api("GET", route)
    report["checks"].append("Rejection does not publish a FAQ; proposal, negative-feedback and experience queries run against Oracle")
    report["passed"] = True
except Exception as error:
    report["passed"] = False
    report["error"] = str(error)
finally:
    try:
        with app.connect() as connection, connection.cursor() as cursor:
            for sql, binds in [
                ("DELETE FROM MENSAJES WHERE CLIENT_MESSAGE_ID=:m", {"m": marker}),
                ("DELETE FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:m", {"m": marker}),
                ("DELETE FROM CONFIGURACIONES WHERE CLAVE=:m", {"m": marker}),
                ("DELETE FROM PROPUESTAS_CONOCIMIENTO WHERE PREGUNTA IN (:a,:b)", {"a": question, "b": question + " rechazo"}),
                ("DELETE FROM PREGUNTAS_FRECUENTES WHERE PREGUNTA=:q", {"q": question}),
            ]:
                cursor.execute(sql, binds)
            connection.commit()
        report["cleanup"] = all(not query(sql, m=marker) for sql in [
            "SELECT ID_CONFIG FROM CONFIGURACIONES WHERE CLAVE=:m",
            "SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID=:m",
            "SELECT ID_MENSAJE FROM MENSAJES WHERE CLIENT_MESSAGE_ID=:m"])
        report["cleanup"] = report["cleanup"] and not query("SELECT ID_PROPUESTA FROM PROPUESTAS_CONOCIMIENTO WHERE PREGUNTA IN (:a,:b)", a=question, b=question + " rechazo") and not query("SELECT ID_PREGUNTA FROM PREGUNTAS_FRECUENTES WHERE PREGUNTA=:q", q=question)
        report["auditNote"] = "Application-generated audit events are intentionally retained. No existing business rows are modified."
    except Exception as error:
        report["cleanup"] = False
        report["cleanupError"] = str(error)
    report["passed"] = bool(report.get("passed") and report.get("cleanup"))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
raise SystemExit(0 if report["passed"] else 1)
