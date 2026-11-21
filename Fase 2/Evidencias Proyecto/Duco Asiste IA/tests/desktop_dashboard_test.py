"""Pruebas del servidor interno del dashboard de escritorio (admin-app/desktop_dashboard.py), sin abrir la ventana.

Uso:  cd admin-app  &&  .venv\\Scripts\\python.exe ..\\tests\\desktop_dashboard_test.py
Levanta el mismo servidor que usa el dashboard en un puerto libre, crea un administrador de prueba (zz.test.*) y lo borra al terminar.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
import uuid
from http.cookiejar import CookieJar
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

ROOT = Path(__file__).resolve().parent.parent / "admin-app"
sys.path.insert(0, str(ROOT))
import app  # noqa: E402
import auth  # noqa: E402
import desktop_dashboard as dash  # noqa: E402

RESULTS: list[tuple[bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    RESULTS.append((bool(condition), name))
    print(("  ok   " if condition else "  FALLA ") + name + (f"  [{detail}]" if detail and not condition else ""))


class Client:
    def __init__(self, base: str):
        self.base = base
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))

    def call(self, method: str, path: str, body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data=data, method=method, headers={"Content-Type": "application/json"})
        try:
            with self.opener.open(request, timeout=20) as response:
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read() or b"{}")


def main() -> int:
    run = uuid.uuid4().hex[:6]
    admin_email, reviewer_email, password = f"zz.test.dash.{run}@duco.local", f"zz.test.dashrev.{run}@duco.local", "Prueba-Dash-2026"
    with app.connect() as conn, conn.cursor() as cur:
        for role, email in ((auth.ROLE_ADMIN, admin_email), (auth.ROLE_REVIEWER, reviewer_email)):
            cur.execute("SELECT ID_ROL FROM ROLES WHERE NOMBRE = :r", r=role)
            cur.execute("INSERT INTO USUARIOS_ADMIN (ID_ROL, NOMBRE, CORREO, CLAVE_HASH) VALUES (:r, :n, :e, :h)",
                        {"r": cur.execute("SELECT ID_ROL FROM ROLES WHERE NOMBRE = :r", r=role).fetchone()[0], "n": "ZZ Test " + role.title(), "e": email, "h": auth.hash_password(password)})
        conn.commit()
    server = ThreadingHTTPServer(("127.0.0.1", 0), dash.DashboardHandler)
    Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        print("Vista cliente (sin sesión)")
        anon = Client(base)
        status, body = anon.call("GET", "/dashboard/metrics?days=0")
        check("las métricas generales responden sin sesión", status == 200 and len(body["totals"]) == 4, str(body)[:120])
        check("trae sesiones y mensajes reales", status == 200 and body["totals"][0] > 0 and body["totals"][1] > 0)
        check("la vista cliente limita el detalle a 14 días", status == 200 and len(body["days"]) <= 14)
        check("el reporte detallado exige sesión → 401", anon.call("GET", "/dashboard/report?days=0")[0] == 401)
        check("un período inválido → 400", anon.call("GET", "/dashboard/metrics?days=5")[0] == 400)
        for days in (7, 30):
            check(f"período de {days} días responde", anon.call("GET", f"/dashboard/metrics?days={days}")[0] == 200)

        print("Solo lectura")
        check("las rutas de administración exigen sesión → 401", anon.call("GET", "/api/tables")[0] == 401 and anon.call("GET", "/api/admin/users")[0] == 401)
        check("no sirve el sitio ni archivos → 404", anon.call("GET", "/duco")[0] == 404 and anon.call("GET", "/js/duco-assistant.js")[0] == 404)
        check("no permite escribir (POST) → 404", anon.call("POST", "/api/duco/session", {"sessionId": str(uuid.uuid4()), "userName": "Ana"})[0] == 404)
        check("PUT/DELETE de tablas sin sesión → 401", anon.call("PUT", "/api/tables/MENSAJES")[0] == 401 and anon.call("DELETE", "/api/tables/MENSAJES")[0] == 401)
        check("PUT/DELETE fuera de las tablas → 405", anon.call("PUT", "/api/duco/proposals")[0] == 405 and anon.call("DELETE", "/api/duco/knowledge")[0] == 405)

        print("Vista administrador")
        admin = Client(base)
        status, body = admin.call("POST", "/api/auth/login", {"email": admin_email, "password": password})
        check("el administrador ingresa con las cuentas del panel", status == 200 and body["admin"]["role"] == auth.ROLE_ADMIN, str(body))
        status, report = admin.call("GET", "/dashboard/report?days=0")
        check("el administrador ve el reporte detallado", status == 200 and len(report["days"]) >= 1)
        status, metrics = admin.call("GET", "/dashboard/metrics?days=0")
        check("el total del reporte coincide con las métricas", report["totals"] == metrics["totals"])
        with app.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM SESIONES_CHAT"); sessions = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM MENSAJES"); messages = cur.fetchone()[0]
        check("las sesiones coinciden con la base", report["totals"][0] == sessions, f"{report['totals'][0]} vs {sessions}")
        check("los mensajes coinciden con la base", report["totals"][1] == messages, f"{report['totals'][1]} vs {messages}")

        print("Roles")
        reviewer = Client(base)
        reviewer.call("POST", "/api/auth/login", {"email": reviewer_email, "password": password})
        check("un evaluador también ve el reporte detallado (cualquier rol con sesión)", reviewer.call("GET", "/dashboard/report?days=0")[0] == 200)
        check("un evaluador ve las métricas generales", reviewer.call("GET", "/dashboard/metrics?days=0")[0] == 200)
        check("contraseña incorrecta → 401", Client(base).call("POST", "/api/auth/login", {"email": admin_email, "password": "mala-clave-1"})[0] == 401)
    finally:
        server.shutdown()
        with app.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT ID_ADMIN FROM USUARIOS_ADMIN WHERE CORREO LIKE 'zz.test.dash%'")
            for (admin_id,) in cur.fetchall():
                cur.execute("DELETE FROM SESIONES_ADMIN WHERE ID_ADMIN = :i", i=admin_id)
                cur.execute("UPDATE AUDITORIA_CAMBIOS SET ID_ADMIN = NULL WHERE ID_ADMIN = :i", i=admin_id)
                cur.execute("DELETE FROM USUARIOS_ADMIN WHERE ID_ADMIN = :i", i=admin_id)
            cur.execute("DELETE FROM EVENTOS_SISTEMA WHERE TIPO LIKE '%zz.test.dash%'")
            cur.execute("DELETE FROM AUDITORIA_CAMBIOS WHERE NOMBRE_ACTOR LIKE 'ZZ Test%'")
            conn.commit()
    failed = [name for ok, name in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} pasan")
    for name in failed:
        print("  FALLA:", name)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
