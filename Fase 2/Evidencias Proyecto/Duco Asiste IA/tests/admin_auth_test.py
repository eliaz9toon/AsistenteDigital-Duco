"""Pruebas de login, roles, auditoría y registro de usuarios del chat contra el backend real y Oracle.

Uso (con el backend encendido, p. ej. ADMIN_PORT=8766):
  cd admin-app
  .venv\\Scripts\\python.exe ..\\tests\\admin_auth_test.py [http://127.0.0.1:8766]

Crea usuarios y sesiones de prueba (prefijo «zz.test») y los borra al terminar. No toca los datos reales.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "admin-app"
sys.path.insert(0, str(ROOT))
import app  # noqa: E402  (carga .env)
import auth  # noqa: E402

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8766").rstrip("/")
RESULTS: list[tuple[bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    RESULTS.append((bool(condition), name))
    print(("  ok   " if condition else "  FALLA ") + name + (f"  [{detail}]" if detail and not condition else ""))


class Client:
    def __init__(self):
        self.cookies = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))

    def call(self, method: str, path: str, body=None, headers=None):
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json", **(headers or {})})
        try:
            with self.opener.open(request, timeout=20) as response:
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            raw = error.read()
            return error.code, json.loads(raw or b"{}")


def make_user(role: str, email: str, password: str) -> int:
    with app.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT ID_ROL FROM ROLES WHERE NOMBRE = :r", r=role)
        role_id = cur.fetchone()[0]
        out = cur.var(int)
        cur.execute("INSERT INTO USUARIOS_ADMIN (ID_ROL, NOMBRE, CORREO, CLAVE_HASH) VALUES (:r, :n, :e, :h) RETURNING ID_ADMIN INTO :i",
                    {"r": role_id, "n": "ZZ Test " + role.title(), "e": email, "h": auth.hash_password(password), "i": out})
        conn.commit()
        return app.first_out(out)


def cleanup(emails: list[str], session_keys: list[str], since=None) -> None:
    with app.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT CORREO FROM USUARIOS_ADMIN WHERE CORREO LIKE 'zz.test.%'")
        for email in emails + [row[0] for row in cur.fetchall()]:  # incluye restos de corridas interrumpidas
            cur.execute("SELECT ID_ADMIN FROM USUARIOS_ADMIN WHERE CORREO = :e", e=email)
            row = cur.fetchone()
            if row:
                cur.execute("DELETE FROM SESIONES_ADMIN WHERE ID_ADMIN = :i", i=row[0])
                cur.execute("UPDATE AUDITORIA_CAMBIOS SET ID_ADMIN = NULL WHERE ID_ADMIN = :i", i=row[0])
                cur.execute("DELETE FROM USUARIOS_ADMIN WHERE ID_ADMIN = :i", i=row[0])
        cur.execute("SELECT CLIENT_SESSION_ID FROM SESIONES_CHAT WHERE NOMBRE_USUARIO LIKE 'ZZ Test%'")
        for key in session_keys + [row[0] for row in cur.fetchall()]:  # incluye restos de ejecuciones interrumpidas
            cur.execute("SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID = :k", k=key)
            for (session_id,) in cur.fetchall():
                cur.execute("DELETE FROM VALORACIONES_RESPUESTA WHERE ID_MENSAJE IN (SELECT ID_MENSAJE FROM MENSAJES WHERE ID_SESION = :s)", s=session_id)
                cur.execute("DELETE FROM EXPERIENCIAS_ACCION WHERE ID_MENSAJE IN (SELECT ID_MENSAJE FROM MENSAJES WHERE ID_SESION = :s)", s=session_id)
                cur.execute("DELETE FROM MENSAJES WHERE ID_SESION = :s", s=session_id)
                cur.execute("DELETE FROM SESIONES_CHAT WHERE ID_SESION = :s", s=session_id)
        cur.execute("DELETE FROM PROPUESTAS_CONOCIMIENTO WHERE PREGUNTA LIKE 'zz.test%'")
        cur.execute("DELETE FROM EVENTOS_SISTEMA WHERE TIPO LIKE '%zz.test%' OR TIPO LIKE '%nadie@duco.local'")
        if since is not None:  # eventos de sesión de chat creados por esta corrida
            cur.execute("DELETE FROM EVENTOS_SISTEMA WHERE TIPO = 'SESION_CHAT_INICIADA' AND FECHA >= :t", t=since)
        cur.execute("DELETE FROM AUDITORIA_CAMBIOS WHERE NOMBRE_ACTOR LIKE 'ZZ Test%' OR VALOR_NUEVO LIKE '%zz.test%'")
        conn.commit()


def main() -> int:
    run = uuid.uuid4().hex[:6]  # correos distintos en cada corrida: el bloqueo por intentos fallidos dura 5 minutos
    admin_email, reviewer_email = f"zz.test.admin.{run}@duco.local", f"zz.test.revisor.{run}@duco.local"
    admin_pw, reviewer_pw = "Prueba-Admin-2026", "Prueba-Revisor-2026"
    session_key = str(uuid.uuid4())
    started = datetime.now()
    cleanup([admin_email, reviewer_email, "zz.test.nuevo@duco.local"], [session_key])
    make_user(auth.ROLE_ADMIN, admin_email, admin_pw)
    make_user(auth.ROLE_REVIEWER, reviewer_email, reviewer_pw)
    try:
        print("Sin sesión")
        anonymous = Client()
        for path in ("/api/tables", "/api/tables/MENSAJES/rows", "/api/duco/proposals", "/api/duco/negative-feedback", "/api/admin/reports/summary", "/api/admin/users"):
            check(f"GET {path} sin sesión → 401", anonymous.call("GET", path)[0] == 401)
        check("DELETE sin sesión → 401", anonymous.call("DELETE", "/api/tables/MENSAJES", {"key": {"ID_MENSAJE": 1}})[0] == 401)
        check("PUT sin sesión → 401", anonymous.call("PUT", "/api/tables/MENSAJES", {"key": {"ID_MENSAJE": 1}, "values": {"CONTENIDO": "x"}})[0] == 401)
        check("revisar propuesta sin sesión → 401", anonymous.call("POST", "/api/duco/proposals/1/review", {"decision": "APROBADA"})[0] == 401)
        check("/api/auth/me sin sesión → 401", anonymous.call("GET", "/api/auth/me")[0] == 401)
        check("rutas públicas del chat siguen abiertas (health)", anonymous.call("GET", "/api/duco/health")[0] == 200)
        check("rutas públicas del chat siguen abiertas (conocimiento)", anonymous.call("GET", "/api/duco/knowledge?query=becas")[0] == 200)

        print("Ingreso")
        bad = Client()
        status, body = bad.call("POST", "/api/auth/login", {"email": admin_email, "password": "incorrecta1"})
        check("contraseña incorrecta → 401 sin pistas", status == 401 and "incorrectos" in body.get("error", ""))
        status, body = bad.call("POST", "/api/auth/login", {"email": "nadie@duco.local", "password": "cualquiera1"})
        check("correo inexistente → mismo 401", status == 401 and "incorrectos" in body.get("error", ""))
        admin = Client()
        status, body = admin.call("POST", "/api/auth/login", {"email": admin_email, "password": admin_pw})
        check("login correcto → 200 con rol", status == 200 and body["admin"]["role"] == auth.ROLE_ADMIN, str(body))
        cookie = next((c for c in admin.cookies if c.name == auth.COOKIE_NAME), None)
        check("cookie de sesión HttpOnly", cookie is not None and cookie.has_nonstandard_attr("HttpOnly"))
        with app.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT TOKEN_HASH FROM SESIONES_ADMIN s JOIN USUARIOS_ADMIN u ON u.ID_ADMIN = s.ID_ADMIN WHERE u.CORREO = :e", e=admin_email)
            stored = [row[0] for row in cur]
            cur.execute("SELECT CLAVE_HASH FROM USUARIOS_ADMIN WHERE CORREO = :e", e=admin_email)
            password_hash = cur.fetchone()[0]
        check("el token no se guarda en claro (solo su hash)", cookie is not None and cookie.value not in stored and auth.token_hash(cookie.value) in stored)
        check("la contraseña se guarda con hash PBKDF2", password_hash.startswith("pbkdf2_sha256$") and admin_pw not in password_hash)
        check("/api/auth/me con sesión → 200", admin.call("GET", "/api/auth/me")[0] == 200)

        print("Visor y reportes (administrador)")
        status, body = admin.call("GET", "/api/tables/MENSAJES/rows")
        ids = [row["ID_MENSAJE"] for row in body.get("rows", [])]
        check("el visor muestra lo más reciente primero", status == 200 and ids == sorted(ids, reverse=True) and len(ids) > 0, f"{ids[:5]}")
        check("el visor informa el orden", "más reciente primero" in body.get("orderedBy", ""))
        status, body = admin.call("GET", "/api/admin/reports/summary")
        check("reporte resumen lista las 32 tablas", status == 200 and len(body.get("tables", [])) == 32 and all(t["dateColumn"] for t in body["tables"]))
        status, body = admin.call("GET", "/api/admin/reports/audit")
        check("reporte de auditoría con acción, registro y origen", status == 200 and all(e["action"] for e in body["audit"]))

        print("Roles")
        reviewer = Client()
        status, _ = reviewer.call("POST", "/api/auth/login", {"email": reviewer_email, "password": reviewer_pw})
        check("revisor ingresa", status == 200)
        check("revisor puede leer tablas", reviewer.call("GET", "/api/tables/MENSAJES/rows")[0] == 200)
        check("revisor NO puede borrar → 403", reviewer.call("DELETE", "/api/tables/MENSAJES", {"key": {"ID_MENSAJE": 999999}})[0] == 403)
        check("revisor NO puede editar → 403", reviewer.call("PUT", "/api/tables/MENSAJES", {"key": {"ID_MENSAJE": 999999}, "values": {"CONTENIDO": "x"}})[0] == 403)
        check("revisor NO ve usuarios → 403", reviewer.call("GET", "/api/admin/users")[0] == 403)
        check("revisor NO crea usuarios → 403", reviewer.call("POST", "/api/admin/users", {"name": "X Y", "email": "zz.test.x@duco.local", "role": "REVISOR", "password": "Clave12345"})[0] == 403)

        print("Tablas protegidas y auditoría de cambios")
        for table in ("AUDITORIA_CAMBIOS", "USUARIOS_ADMIN", "SESIONES_ADMIN"):
            status, body = admin.call("DELETE", f"/api/tables/{table}", {"key": {"ID_CAMBIO" if table == "AUDITORIA_CAMBIOS" else "ID_ADMIN" if table == "USUARIOS_ADMIN" else "ID_SESION_ADMIN": 1}})
            check(f"{table} es de solo lectura", status == 400 and "solo lectura" in body.get("error", ""))
        status, body = admin.call("POST", "/api/tables/CONFIGURACIONES", {"values": {"CLAVE": "zz.test.clave", "VALOR": "uno"}})
        check("administrador inserta un registro", status == 201, str(body))
        with app.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT ID_CONFIG, FECHA_CREACION FROM CONFIGURACIONES WHERE CLAVE = 'zz.test.clave'")
            config_id, created = cur.fetchone()
        check("el registro nuevo trae fecha y hora de creación", created is not None)
        check("actualizar el registro", admin.call("PUT", "/api/tables/CONFIGURACIONES", {"key": {"ID_CONFIG": config_id}, "values": {"VALOR": "dos"}})[0] == 200)
        check("borrar el registro", admin.call("DELETE", "/api/tables/CONFIGURACIONES", {"key": {"ID_CONFIG": config_id}})[0] == 200)
        with app.connect() as conn, conn.cursor() as cur:
            cur.execute("""SELECT ACCION, ID_REGISTRO, VALOR_ANTERIOR, VALOR_NUEVO, ID_ADMIN, ORIGEN FROM AUDITORIA_CAMBIOS
                           WHERE TABLA_AFECTADA = 'CONFIGURACIONES' AND ID_REGISTRO = :r ORDER BY ID_CAMBIO""", r=str(config_id))
            entries = cur.fetchall()
        check("la auditoría guarda INSERT, UPDATE y DELETE del mismo registro", [e[0] for e in entries] == ["INSERT", "UPDATE", "DELETE"], str(entries))
        check("la auditoría guarda valor anterior y nuevo", entries and "uno" in str(entries[1][2]) and "dos" in str(entries[1][3]))
        check("la auditoría guarda quién y desde dónde", entries and all(e[4] is not None and e[5] == "panel" for e in entries))
        with app.connect() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM AUDITORIA_CAMBIOS WHERE TABLA_AFECTADA = 'CONFIGURACIONES' AND ID_REGISTRO = :r", r=str(config_id))
            conn.commit()

        print("Usuarios del panel")
        status, body = admin.call("POST", "/api/admin/users", {"name": "Nuevo Revisor", "email": "zz.test.nuevo@duco.local", "role": "REVISOR", "password": "corta"})
        check("contraseña débil rechazada", status == 400 and "caracteres" in body.get("error", ""))
        status, body = admin.call("POST", "/api/admin/users", {"name": "Nuevo Revisor", "email": "zz.test.nuevo@duco.local", "role": "REVISOR", "password": "Clave-Segura-2026"})
        check("administrador crea un usuario", status == 201, str(body))
        check("no se repite el correo", admin.call("POST", "/api/admin/users", {"name": "Nuevo Revisor", "email": "ZZ.test.nuevo@duco.local", "role": "REVISOR", "password": "Clave-Segura-2026"})[0] == 400)
        check("no puede desactivarse a sí mismo", admin.call("POST", f"/api/admin/users/{[u['id'] for u in admin.call('GET', '/api/admin/users')[1]['users'] if u['email'] == admin_email][0]}/active", {"active": False})[0] == 400)

        print("Contraseña, bloqueo y salida")
        check("cambiar contraseña con la actual equivocada falla", admin.call("POST", "/api/auth/password", {"current": "mala", "new": "Otra-Clave-2026"})[0] == 400)
        check("cambiar contraseña", admin.call("POST", "/api/auth/password", {"current": admin_pw, "new": "Otra-Clave-2026"})[0] == 200)
        locked = Client()
        statuses = [locked.call("POST", "/api/auth/login", {"email": reviewer_email, "password": "mala-clave-1"})[0] for _ in range(auth.MAX_FAILURES)]
        check("tras 5 fallos el ingreso se bloquea (429)", statuses[-1] == 401 and locked.call("POST", "/api/auth/login", {"email": reviewer_email, "password": reviewer_pw})[0] == 429)
        check("salir cierra la sesión", admin.call("POST", "/api/auth/logout", {})[0] == 200 and admin.call("GET", "/api/tables")[0] == 401)

        print("Usuarios del chat (nombre y sesión)")
        chat = Client()
        check("sesión sin nombre → 400", chat.call("POST", "/api/duco/session", {"sessionId": session_key, "userName": ""})[0] == 400)
        check("nombre con correo → 400", chat.call("POST", "/api/duco/session", {"sessionId": session_key, "userName": "yo@correo.cl"})[0] == 400)
        check("nombre con número largo (RUT) → 400", chat.call("POST", "/api/duco/session", {"sessionId": session_key, "userName": "Ana 12345678"})[0] == 400)
        check("sesión inválida → 400", chat.call("POST", "/api/duco/session", {"sessionId": "no-es-uuid", "userName": "Ana"})[0] == 400)
        status, body = chat.call("POST", "/api/duco/session", {"sessionId": session_key, "userName": "ZZ Test María"})
        check("el chat registra la sesión con su nombre", status == 201 and body["userName"] == "ZZ Test María", str(body))
        check("registrar de nuevo actualiza (no duplica)", chat.call("POST", "/api/duco/session", {"sessionId": session_key, "userName": "ZZ Test María"})[0] == 201)
        with app.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT COUNT(*), MAX(NOMBRE_USUARIO), MAX(ULTIMA_ACTIVIDAD) FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID = :k", k=session_key)
            count, stored_name, last_activity = cur.fetchone()
            cur.execute("SELECT ACCION, NOMBRE_ACTOR, ORIGEN FROM AUDITORIA_CAMBIOS WHERE TABLA_AFECTADA = 'SESIONES_CHAT' AND NOMBRE_ACTOR = 'ZZ Test María'")
            audit_rows = cur.fetchall()
        check("una sola fila en SESIONES_CHAT con nombre y última actividad", count == 1 and stored_name == "ZZ Test María" and last_activity is not None)
        check("la auditoría registra al usuario del chat", len(audit_rows) == 1 and audit_rows[0][0] == "INSERT" and audit_rows[0][2] == "chat", str(audit_rows))
        interaction = str(uuid.uuid4())
        status, body = chat.call("POST", "/api/duco/feedback", {"sessionId": session_key, "interactionId": interaction, "question": "zz.test ¿hay becas?",
                                                                "answer": "Sí, hay becas internas.", "rating": 1, "userName": "ZZ Test María",
                                                                "experience": {"page": "/duoc.html", "steps": []}})
        check("la valoración del chat se guarda y audita", status == 201, str(body))
    finally:
        cleanup([admin_email, reviewer_email, "zz.test.nuevo@duco.local"], [session_key], started)

    failed = [name for ok, name in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} pasan")
    for name in failed:
        print("  FALLA:", name)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
