"""Pruebas de la aplicación de escritorio: pestañas por rol, tablas, edición, evaluación, auditoría y usuarios.
Crea la ventana sin mostrarla (withdraw) y maneja los mismos métodos que usan los botones; no hace clic en cuadros de diálogo.

Uso:  cd admin-app  &&  .venv\\Scripts\\python.exe ..\\tests\\desktop_panel_test.py
Crea usuarios y datos de prueba (zz.test.*) y los borra al terminar.
"""
from __future__ import annotations

import sys
import tkinter as tk
import uuid
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

ROOT = Path(__file__).resolve().parent.parent / "admin-app"
sys.path.insert(0, str(ROOT))
import app  # noqa: E402
import auth  # noqa: E402
import desktop_dashboard as dash  # noqa: E402
import desktop_panel as panel  # noqa: E402

RESULTS: list[tuple[bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    RESULTS.append((bool(condition), name))
    print(("  ok   " if condition else "  FALLA ") + name + (f"  [{detail}]" if detail and not condition else ""))


def tab_titles(dashboard) -> list[str]:
    return [dashboard.tabs.tab(tab, "text") for tab in dashboard.tabs.tabs()]


def make_user(role: str, email: str, password: str) -> int:
    with app.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT ID_ROL FROM ROLES WHERE NOMBRE = :r", r=role)
        role_id = cur.fetchone()[0]
        out = cur.var(int)
        cur.execute("INSERT INTO USUARIOS_ADMIN (ID_ROL, NOMBRE, CORREO, CLAVE_HASH) VALUES (:r, :n, :e, :h) RETURNING ID_ADMIN INTO :i",
                    {"r": role_id, "n": "ZZ Test " + role.title(), "e": email, "h": auth.hash_password(password), "i": out})
        conn.commit()
        return app.first_out(out)


def new_window(server):
    root = tk.Tk()
    root.withdraw()
    window = dash.Dashboard(root, server)
    root.update()
    return root, window


def main() -> int:
    run = uuid.uuid4().hex[:6]
    password = "Prueba-Escritorio-2026"
    users = {role: f"zz.test.{role.lower()}.{run}@duco.local" for role in auth.ALL_ROLES}
    ids = {role: make_user(role, email, password) for role, email in users.items()}
    server = ThreadingHTTPServer(("127.0.0.1", 0), dash.DashboardHandler)
    Thread(target=server.serve_forever, daemon=True).start()
    proposal_id = None
    session_key = str(uuid.uuid4())
    try:
        print("Pestañas según el rol")
        expected = {
            auth.ROLE_ADMIN: ["Dashboard", "Reportería", "Tablas", "Evaluación", "Auditoría", "Usuarios"],
            auth.ROLE_EVALUATOR: ["Dashboard", "Reportería", "Tablas", "Evaluación", "Auditoría"],
            auth.ROLE_VIEWER: ["Dashboard", "Reportería", "Tablas"],
        }
        for role in auth.ALL_ROLES:
            root, window = new_window(server)
            check(f"{role}: sin sesión solo ve el dashboard", tab_titles(window) == ["Dashboard"])
            window.authenticate(users[role], password)
            root.update()
            check(f"{role}: sus pestañas son {expected[role][2:]}", tab_titles(window) == expected[role], str(tab_titles(window)))
            check(f"{role}: el encabezado muestra su nombre y rol", role in window.mode.cget("text"))
            tables = window.role_tabs[0]
            check(f"{role}: {'puede' if role == auth.ROLE_ADMIN else 'NO puede'} editar tablas", tables.can_edit == (role == auth.ROLE_ADMIN))
            window.logout()
            root.update()
            check(f"{role}: al cerrar sesión vuelve a ver solo el dashboard", tab_titles(window) == ["Dashboard"] and window.admin is None)
            root.destroy()

        print("Tablas: ver, buscar, ordenar")
        root, window = new_window(server)
        window.authenticate(users[auth.ROLE_ADMIN], password)
        root.update()
        tables = window.role_tabs[0]
        check("la lista trae las 32 tablas con módulo", len(tables.schema) == 32 and all(t["module"] != "Otras" for t in tables.schema))
        check("abre en MENSAJES con sus registros", tables.current == "MENSAJES" and len(tables.rows) > 0)
        ids_shown = [r["ID_MENSAJE"] for r in tables.rows]
        check("lo más reciente aparece primero", ids_shown == sorted(ids_shown, reverse=True))
        check("el identificador va primero y las fechas al final", tables.data["displayOrder"][0] == "ID_MENSAJE" and tables.data["displayOrder"][-1] == "FECHA")
        check("la ficha es corta: nombre, módulo y una línea de descripción", tables.info_name.cget("text") == "MENSAJES" and tables.info_module.cget("text") == "Chat e inteligencia artificial" and "\n" not in tables.info_desc.cget("text"))
        check("el detalle está oculto hasta que se pide", not tables.details_open and not bool(tables.details.winfo_manager()))
        tables.toggle_details()
        root.update()
        check("«Cómo leer esta tabla» explica de dónde sale el ID y las relaciones", bool(tables.details.winfo_manager()) and "Oracle" in tables.details.cget("text") and "Depende de: SESIONES_CHAT" in tables.details.cget("text"))
        tables.toggle_details()
        root.update()
        check("se puede volver a ocultar", not bool(tables.details.winfo_manager()))
        check("la clave foránea muestra su etiqueta", any("·" in tables.tree.item(i, "values")[1] for i in tables.tree.get_children()))
        tables.search_var.set("assistant")
        tables.column_var.set("en ROL_EMISOR")
        tables.run_search()
        root.update()
        check("buscar filtra por columna", 0 < len(tables.rows) and all(r["ROL_EMISOR"] == "assistant" for r in tables.rows))
        tables.clear_search()
        root.update()
        check("limpiar la búsqueda vuelve a la lista completa", tables.data["query"] == "" and len(tables.rows) > 0)
        tables.filter_var.set("auditor")
        root.update()
        check("el filtro de tablas acorta la lista", tables.table_names == ["AUDITORIA_CAMBIOS"])
        tables.filter_var.set("")

        print("Tablas: crear, editar y borrar (administrador)")
        tables.select("CONFIGURACIONES", reset_column=True)
        tables.save_record({"CLAVE": "zz.test.escritorio", "VALOR": "uno"}, None)
        found = [r for r in tables.rows if r["CLAVE"] == "zz.test.escritorio"]
        check("crea un registro y aparece en la tabla", len(found) == 1 and found[0]["FECHA_CREACION"] is not None)
        tables.tree.selection_set(str(tables.rows.index(found[0])))
        tables.save_record({"VALOR": "dos"}, found[0])
        updated = [r for r in tables.rows if r["CLAVE"] == "zz.test.escritorio"][0]
        check("edita el registro", updated["VALOR"] == "dos")
        check("borra el registro", tables.remove_record(updated) and not [r for r in tables.rows if r["CLAVE"] == "zz.test.escritorio"])
        with app.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT ACCION FROM AUDITORIA_CAMBIOS WHERE TABLA_AFECTADA = 'CONFIGURACIONES' AND ID_REGISTRO = :r ORDER BY ID_CAMBIO", r=str(updated["ID_CONFIG"]))
            actions = [row[0] for row in cur]
            cur.execute("DELETE FROM AUDITORIA_CAMBIOS WHERE TABLA_AFECTADA = 'CONFIGURACIONES' AND ID_REGISTRO = :r", r=str(updated["ID_CONFIG"]))
            conn.commit()
        check("cada cambio quedó en la auditoría", actions == ["INSERT", "UPDATE", "DELETE"], str(actions))
        tables.select("AUDITORIA_CAMBIOS", reset_column=True)
        try:
            tables.save_record({"ACCION": "x"}, tables.rows[0])
            blocked = False
        except RuntimeError as error:
            blocked = "solo lectura" in str(error)
        check("la auditoría no se puede editar desde la aplicación", blocked)

        print("Evaluación (propuestas y valoraciones)")
        with app.connect() as conn, conn.cursor() as cur:
            out = cur.var(int)
            cur.execute("INSERT INTO PROPUESTAS_CONOCIMIENTO (PREGUNTA, RESPUESTA) VALUES ('zz.test ¿pregunta de escritorio?', 'Respuesta de prueba') RETURNING ID_PROPUESTA INTO :i", i=out)
            proposal_id = app.first_out(out)
            cur.execute("INSERT INTO SESIONES_CHAT (FECHA_INICIO, CLIENT_SESSION_ID, NOMBRE_USUARIO) VALUES (CURRENT_TIMESTAMP, :k, 'ZZ Test Persona')", k=session_key)
            cur.execute("SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID = :k", k=session_key)
            session_id = cur.fetchone()[0]
            cur.execute("INSERT INTO MENSAJES (ID_SESION, ROL_EMISOR, CONTENIDO, FECHA, CLIENT_MESSAGE_ID) VALUES (:s, 'user', 'zz.test pregunta', CURRENT_TIMESTAMP, :c)", s=session_id, c=session_key + ":user")
            cur.execute("INSERT INTO MENSAJES (ID_SESION, ROL_EMISOR, CONTENIDO, FECHA, CLIENT_MESSAGE_ID) VALUES (:s, 'assistant', 'zz.test respuesta mala', CURRENT_TIMESTAMP, :c)", s=session_id, c=session_key + ":assistant")
            cur.execute("SELECT ID_MENSAJE FROM MENSAJES WHERE CLIENT_MESSAGE_ID = :c", c=session_key + ":assistant")
            message_id = cur.fetchone()[0]
            cur.execute("INSERT INTO VALORACIONES_RESPUESTA (ID_MENSAJE, PUNTUACION, ESTADO_REVISION) VALUES (:m, -1, 'PENDIENTE')", m=message_id)
            cur.execute("SELECT ID_VALORACION FROM VALORACIONES_RESPUESTA WHERE ID_MENSAJE = :m", m=message_id)
            rating_id = cur.fetchone()[0]
            conn.commit()
        evaluation = next(t for t in window.role_tabs if isinstance(t, panel.EvaluationTab))
        evaluation.load()
        check("la propuesta pendiente aparece para evaluar", any(p["id"] == proposal_id for p in evaluation.proposals))
        check("la valoración negativa aparece para revisar", any(f["id"] == rating_id for f in evaluation.feedback))
        evaluation.evaluate(proposal_id, "RECHAZADA")
        check("rechazar una propuesta la saca de la lista", not any(p["id"] == proposal_id for p in evaluation.proposals))
        evaluation.review_feedback(rating_id)
        check("marcar revisada una valoración la saca de la lista", not any(f["id"] == rating_id for f in evaluation.feedback))
        with app.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT ESTADO FROM PROPUESTAS_CONOCIMIENTO WHERE ID_PROPUESTA = :i", i=proposal_id)
            estado = cur.fetchone()[0]
            cur.execute("SELECT ESTADO_REVISION FROM VALORACIONES_RESPUESTA WHERE ID_VALORACION = :i", i=rating_id)
            revisada = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM AUDITORIA_CAMBIOS WHERE TABLA_AFECTADA = 'PROPUESTAS_CONOCIMIENTO' AND ID_REGISTRO = :i AND NOMBRE_ACTOR LIKE 'ZZ Test%'", i=str(proposal_id))
            audited = cur.fetchone()[0]
        check("en la base quedaron RECHAZADA y REVISADA", estado == "RECHAZADA" and revisada == "REVISADA", f"{estado} {revisada}")
        check("la evaluación quedó en la auditoría con el nombre de quien la hizo", audited >= 1)

        print("Auditoría y usuarios")
        audit = next(t for t in window.role_tabs if isinstance(t, panel.AuditTab))
        audit.load()
        check("la auditoría lista los cambios con acción y origen", len(audit.entries) > 0 and all(e["action"] for e in audit.entries))
        users_tab = next(t for t in window.role_tabs if isinstance(t, panel.UsersTab))
        users_tab.load()
        check("la lista de usuarios muestra los roles", {u["role"] for u in users_tab.users} >= {auth.ROLE_ADMIN})
        users_tab.create({"name": "ZZ Test Nueva Persona", "email": f"zz.test.nueva.{run}@duco.local", "role": auth.ROLE_VIEWER, "password": "Clave-Segura-2026"})
        created = [u for u in users_tab.users if u["email"].startswith("zz.test.nueva")]
        check("el administrador crea un usuario CONSULTA", len(created) == 1 and created[0]["role"] == auth.ROLE_VIEWER)
        users_tab.set_active(created[0]["id"], False)
        check("lo desactiva", [u for u in users_tab.users if u["email"].startswith("zz.test.nueva")][0]["active"] is False)
        try:
            users_tab.create({"name": "X Y", "email": "malo", "role": "CONSULTA", "password": "x"})
            rejected = False
        except RuntimeError:
            rejected = True
        check("rechaza un usuario con datos inválidos", rejected)
        try:
            window.request("/api/auth/password", {"current": "incorrecta", "new": "Otra-Clave-2026"})
            wrong = False
        except RuntimeError as error:
            wrong = "actual" in str(error)
        check("cambiar la contraseña con la actual equivocada falla", wrong)
        check("cambiar la contraseña con la actual correcta funciona", window.request("/api/auth/password", {"current": password, "new": "Otra-Clave-2026"}).get("ok") is True)
        window.logout()
        root.destroy()

        print("Un evaluador no puede editar ni ver usuarios, aunque llame al servidor")
        root, window = new_window(server)
        window.authenticate(users[auth.ROLE_EVALUATOR], password)
        for method, path, body in (("DELETE", "/api/tables/MENSAJES", {"key": {"ID_MENSAJE": 999999}}), ("GET", "/api/admin/users", None),
                                   ("POST", "/api/tables/CONFIGURACIONES", {"values": {"CLAVE": "zz.test.x"}})):
            try:
                window.request(path, body, method)
                denied = False
            except RuntimeError as error:
                denied = "rol no permite" in str(error)
            check(f"evaluador: {method} {path} → rechazado", denied)
        window.logout()
        root.destroy()
        root, window = new_window(server)
        window.authenticate(users[auth.ROLE_VIEWER], password)
        for path in ("/api/duco/proposals", "/api/admin/reports/audit"):
            try:
                window.request(path)
                denied = False
            except RuntimeError as error:
                denied = "rol no permite" in str(error)
            check(f"consulta: GET {path} → rechazado", denied)
        window.logout()
        root.destroy()
    finally:
        server.shutdown()
        with app.connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID = :k", k=session_key)
            for (sid,) in cur.fetchall():
                cur.execute("DELETE FROM VALORACIONES_RESPUESTA WHERE ID_MENSAJE IN (SELECT ID_MENSAJE FROM MENSAJES WHERE ID_SESION = :s)", s=sid)
                cur.execute("DELETE FROM MENSAJES WHERE ID_SESION = :s", s=sid)
                cur.execute("DELETE FROM SESIONES_CHAT WHERE ID_SESION = :s", s=sid)
            cur.execute("DELETE FROM PROPUESTAS_CONOCIMIENTO WHERE PREGUNTA LIKE 'zz.test%'")
            cur.execute("SELECT ID_ADMIN FROM USUARIOS_ADMIN WHERE CORREO LIKE 'zz.test.%'")
            for (admin_id,) in cur.fetchall():
                cur.execute("DELETE FROM SESIONES_ADMIN WHERE ID_ADMIN = :i", i=admin_id)
                cur.execute("UPDATE AUDITORIA_CAMBIOS SET ID_ADMIN = NULL WHERE ID_ADMIN = :i", i=admin_id)
                cur.execute("DELETE FROM USUARIOS_ADMIN WHERE ID_ADMIN = :i", i=admin_id)
            cur.execute("DELETE FROM EVENTOS_SISTEMA WHERE TIPO LIKE '%zz.test%'")
            cur.execute("DELETE FROM AUDITORIA_CAMBIOS WHERE NOMBRE_ACTOR LIKE 'ZZ Test%' OR VALOR_NUEVO LIKE '%zz.test%' OR VALOR_ANTERIOR LIKE '%zz.test%'")
            conn.commit()
    failed = [name for ok, name in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} pasan")
    for name in failed:
        print("  FALLA:", name)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
