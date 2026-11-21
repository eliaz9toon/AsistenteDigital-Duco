"""Dashboard de escritorio de Duco conectado a Oracle local."""

import csv
from datetime import date, timedelta
from http.cookiejar import CookieJar
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
from threading import Thread
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import HTTPCookieProcessor, ProxyHandler, Request, build_opener

import app


BG, CARD, INK, MUTED = "#f2f5f8", "#ffffff", "#132a3f", "#506478"
BLUE, TEAL, RED = "#245cd1", "#087c73", "#b84954"
PERIODS = {"Todo el historial": 0, "Últimos 7 días": 7, "Últimos 30 días": 30}


def oracle_metrics(start):
    with app.db_session() as conn, conn.cursor() as cur:
        rows = cur.execute("""
            WITH activity AS (
                SELECT TRUNC(FECHA_INICIO) AS dia, 1 AS sesiones, 0 AS mensajes,
                       0 AS positivas, 0 AS negativas FROM SESIONES_CHAT
                UNION ALL
                SELECT TRUNC(FECHA), 0, 1, 0, 0 FROM MENSAJES
                UNION ALL
                SELECT TRUNC(v.FECHA_CREACION), 0, 0,
                       CASE WHEN v.PUNTUACION = 1 THEN 1 ELSE 0 END,
                       CASE WHEN v.PUNTUACION = -1 THEN 1 ELSE 0 END
                  FROM VALORACIONES_RESPUESTA v
            )
            SELECT TO_CHAR(dia, 'YYYY-MM-DD'), SUM(sesiones), SUM(mensajes),
                   SUM(positivas), SUM(negativas)
              FROM activity
             WHERE :inicio IS NULL OR dia >= :inicio
             GROUP BY dia
             ORDER BY dia NULLS LAST
        """, inicio=start).fetchall()
    totals = [sum(row[i] for row in rows) for i in range(1, 5)]
    return {"totals": totals, "days": rows}


class DashboardHandler(app.Handler):
    def do_GET(self):
        url = urlsplit(self.path)
        if url.path not in {"/dashboard/metrics", "/dashboard/report"}:
            return self.send_json(404, {"error": "Ruta no disponible."})
        detailed = url.path == "/dashboard/report"
        if detailed and not self.require_admin({app.auth.ROLE_ADMIN}):
            return
        try:
            period = int(parse_qs(url.query).get("days", ["0"])[0])
            if period not in PERIODS.values():
                raise ValueError
        except ValueError:
            return self.send_json(400, {"error": "Período inválido."})
        start = date.today() - timedelta(days=period - 1) if period else None
        try:
            data = oracle_metrics(start)
        except Exception:
            return self.send_json(503, {"error": "No se pudo consultar Oracle local. Revisa el servicio y admin-app/.env."})
        if not detailed:
            data["days"] = [row for row in data["days"] if row[0]][-14:]
        return self.send_json(200, data)

    def do_POST(self):
        if urlsplit(self.path).path in {"/api/auth/login", "/api/auth/logout"}:
            return super().do_POST()
        return self.send_json(404, {"error": "Ruta no disponible."})

    def do_PUT(self):
        return self.send_json(405, {"error": "Operación no disponible."})

    do_DELETE = do_PUT


class Dashboard:
    def __init__(self, root, server):
        self.root = root
        self.url = f"http://127.0.0.1:{server.server_port}"
        self.cookies = CookieJar()
        self.http = build_opener(ProxyHandler({}), HTTPCookieProcessor(self.cookies))
        self.admin = None
        self.report = []
        self.data = None
        self.period = tk.StringVar(value="Todo el historial")
        self.status = tk.StringVar(value="Consultando Oracle local…")
        self.values = [tk.StringVar(value="—") for _ in range(3)]
        self.rating_detail = tk.StringVar(value="Valoraciones registradas")
        root.title("Duco Asiste | Reportería")
        root.geometry("1050x730")
        root.minsize(770, 590)
        root.configure(bg=BG)
        style = ttk.Style(root)
        style.theme_use("clam")
        style.configure("TFrame", background=BG)
        style.configure("TButton", padding=(13, 7), font=("Segoe UI", 10))
        style.configure("Treeview", rowheight=28, font=("Segoe UI", 10))
        style.configure("Treeview.Heading", font=("Segoe UI Semibold", 10))
        style.configure("TNotebook", background=BG, borderwidth=0)
        style.configure("TNotebook.Tab", padding=(18, 8), font=("Segoe UI", 10))
        self.build()
        root.after(30, self.refresh)

    def request(self, path, payload=None):
        request = Request(
            self.url + path,
            data=json.dumps(payload).encode() if payload is not None else None,
            headers={"Content-Type": "application/json"},
        )
        try:
            with self.http.open(request, timeout=10) as response:
                return json.load(response)
        except HTTPError as error:
            try:
                detail = json.load(error).get("error")
            except ValueError:
                detail = None
            raise RuntimeError(detail or f"Error HTTP {error.code}") from error
        except (URLError, TimeoutError) as error:
            raise RuntimeError("La consulta local tardó demasiado o dejó de responder.") from error

    def build(self):
        shell = ttk.Frame(self.root, padding=22)
        shell.pack(fill="both", expand=True)
        header = ttk.Frame(shell)
        header.pack(fill="x", pady=(0, 14))
        tk.Label(header, text="Duco Asiste", bg=BG, fg=INK, font=("Segoe UI Semibold", 25)).pack(side="left")
        self.mode = tk.Label(header, text="Vista cliente", bg=BG, fg=MUTED, font=("Segoe UI", 11))
        self.mode.pack(side="left", padx=16, pady=(6, 0))
        self.login_button = ttk.Button(header, text="Entrar como administrador", command=self.login)
        self.login_button.pack(side="right")
        self.tabs = ttk.Notebook(shell)
        self.tabs.pack(fill="both", expand=True)
        overview = ttk.Frame(self.tabs, padding=(0, 15, 0, 0))
        self.tabs.add(overview, text="Dashboard")
        toolbar = ttk.Frame(overview)
        toolbar.pack(fill="x", pady=(0, 13))
        tk.Label(toolbar, text="Período", bg=BG, fg=INK, font=("Segoe UI", 10)).pack(side="left", padx=(0, 8))
        selector = ttk.Combobox(toolbar, values=list(PERIODS), textvariable=self.period, state="readonly", width=20)
        selector.pack(side="left")
        selector.bind("<<ComboboxSelected>>", lambda _: self.refresh())
        ttk.Button(toolbar, text="Actualizar", command=self.refresh).pack(side="right")
        cards = ttk.Frame(overview)
        cards.pack(fill="x", pady=(0, 14))
        for index, (title, subtitle) in enumerate((
            ("Sesiones del chat", "Sesiones registradas"),
            ("Mensajes", "Mensajes almacenados en Oracle"),
            ("Valoración positiva", self.rating_detail),
        )):
            cards.columnconfigure(index, weight=1, uniform="kpi")
            tile = tk.Frame(cards, bg=CARD, padx=16, pady=12, highlightbackground="#dbe3ec", highlightthickness=1)
            tile.grid(row=0, column=index, sticky="nsew", padx=(0 if index == 0 else 6, 0 if index == 2 else 6))
            tk.Label(tile, text=title, bg=CARD, fg=INK, font=("Segoe UI Semibold", 11)).pack(anchor="w")
            tk.Label(tile, textvariable=self.values[index], bg=CARD, fg=BLUE, font=("Segoe UI Semibold", 27)).pack(anchor="w")
            label = {"text": subtitle} if isinstance(subtitle, str) else {"textvariable": subtitle}
            tk.Label(tile, **label, bg=CARD, fg=MUTED, font=("Segoe UI", 9)).pack(anchor="w")
        self.chart = tk.Canvas(overview, bg=CARD, highlightthickness=1, highlightbackground="#dbe3ec")
        self.chart.pack(fill="both", expand=True)
        self.chart.bind("<Configure>", lambda _: self.draw())
        self.report_tab = ttk.Frame(self.tabs, padding=(0, 15, 0, 0))
        actions = ttk.Frame(self.report_tab)
        actions.pack(fill="x", pady=(0, 10))
        tk.Label(actions, text="Actividad por día · mismo período del dashboard", bg=BG, fg=INK,
                 font=("Segoe UI Semibold", 11)).pack(side="left")
        ttk.Button(actions, text="Exportar CSV", command=self.export).pack(side="right")
        columns = ("Fecha", "Sesiones", "Mensajes", "Positivas", "Negativas")
        self.table = ttk.Treeview(self.report_tab, columns=columns, show="headings")
        for column in columns:
            self.table.heading(column, text=column)
            self.table.column(column, width=125, anchor="center")
        scroll = ttk.Scrollbar(self.report_tab, orient="vertical", command=self.table.yview)
        self.table.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        self.table.pack(fill="both", expand=True, side="left")
        tk.Label(shell, textvariable=self.status, bg=BG, fg=MUTED,
                 font=("Segoe UI", 10)).pack(anchor="w", pady=(12, 0))

    def refresh(self):
        days = PERIODS[self.period.get()]
        try:
            route = "/dashboard/report" if self.admin else "/dashboard/metrics"
            data = self.request(f"{route}?days={days}")
        except RuntimeError as error:
            self.report = []
            self.table.delete(*self.table.get_children())
            self.data = None
            for value in self.values:
                value.set("—")
            self.rating_detail.set("Valoraciones registradas")
            self.status.set(str(error))
            self.draw()
            return
        self.data = data
        sessions, messages, positive, negative = data["totals"]
        votes = positive + negative
        for variable, value in zip(self.values, (str(sessions), str(messages), f"{positive / votes:.1%}" if votes else "—")):
            variable.set(value.replace(".", ","))
        self.rating_detail.set(f"{positive} positivas de {votes} valoraciones")
        if self.admin:
            self.report = data["days"]
            self.table.delete(*self.table.get_children())
            for row in self.report:
                self.table.insert("", "end", values=(row[0] or "Sin fecha", *row[1:]))
        self.status.set("Oracle local · FREEPDB1 · " + self.period.get())
        self.draw()

    def draw(self):
        c = self.chart
        c.delete("all")
        w, h = c.winfo_width(), c.winfo_height()
        if w < 20 or h < 20:
            return
        c.create_text(20, 20, text="Actividad por fecha", anchor="nw", fill=INK, font=("Segoe UI Semibold", 13))
        c.create_text(20, 47, text="Hasta 14 fechas con registros", anchor="nw", fill=MUTED, font=("Segoe UI", 9))
        data = [row for row in self.data["days"] if row[0]][-14:] if self.data else []
        divider = round(w * 0.7)
        for i, (label, color) in enumerate((("Sesiones", TEAL), ("Mensajes", BLUE))):
            y = 73
            x = 20 + i * 105
            c.create_rectangle(x, y, x + 11, y + 11, fill=color, outline="")
            c.create_text(x + 17, y + 5, text=label, anchor="w", fill=MUTED, font=("Segoe UI", 9))
        left, right, top, bottom = 55, divider - 20, 104, max(112, h - 38)
        if data:
            ceiling = max(1, max(max(row[1], row[2]) for row in data))
            for tick in sorted({0, ceiling // 2, ceiling}):
                y = bottom - tick / ceiling * (bottom - top)
                c.create_line(left, y, right, y, fill="#dce5ee")
                c.create_text(left - 9, y, text=str(tick), anchor="e", fill=MUTED, font=("Segoe UI", 9))
            step = (right - left) / len(data)
            bar = min(24, step * 0.31)
            for index, (when, sessions, messages, *_) in enumerate(data):
                x = left + (index + 0.5) * step
                for value, color, start in ((sessions, TEAL, x - bar - 1), (messages, BLUE, x + 1)):
                    if value:
                        c.create_rectangle(start, bottom - value / ceiling * (bottom - top), start + bar,
                                           bottom, fill=color, outline="")
                if index % (2 if len(data) > 8 else 1) == 0:
                    c.create_text(x, bottom + 12, text=date.fromisoformat(when).strftime("%d/%m"),
                                  anchor="n", fill=MUTED, font=("Segoe UI", 8))
        else:
            c.create_text(divider / 2, (top + bottom) / 2, text="Sin registros con fecha para mostrar", fill=MUTED)
        c.create_line(divider, 20, divider, h - 20, fill="#dce5ee")
        x = divider + 19
        c.create_text(x, 20, text="Valoraciones", anchor="nw", fill=INK, font=("Segoe UI Semibold", 13))
        positive, negative = self.data["totals"][2:] if self.data else (0, 0)
        for i, (label, count, color) in enumerate((("Positivas", positive, TEAL), ("Negativas", negative, RED))):
            y = 68 + i * 60
            c.create_text(x, y, text=f"{label} · {count}", anchor="nw", fill=MUTED, font=("Segoe UI", 10))
            width = max(0, w - x - 22)
            c.create_rectangle(x, y + 24, x + width, y + 35, fill="#e6edf3", outline="")
            if count:
                c.create_rectangle(x, y + 24, x + width * count / (positive + negative), y + 35, fill=color, outline="")

    def login(self):
        if self.admin:
            try:
                self.request("/api/auth/logout", {})
            except RuntimeError:
                pass
            self.cookies.clear()
            self.admin = None
            self.report = []
            self.table.delete(*self.table.get_children())
            self.tabs.forget(self.report_tab)
            self.mode.configure(text="Vista cliente")
            self.login_button.configure(text="Entrar como administrador")
            self.refresh()
            return

        dialog = tk.Toplevel(self.root)
        dialog.title("Acceso de administrador")
        dialog.transient(self.root)
        dialog.resizable(False, False)
        body = ttk.Frame(dialog, padding=20)
        body.pack(fill="both", expand=True)
        ttk.Label(body, text="Correo del panel").pack(anchor="w")
        email = ttk.Entry(body, width=38)
        email.pack(fill="x", pady=(3, 12))
        ttk.Label(body, text="Contraseña del panel").pack(anchor="w")
        password = ttk.Entry(body, show="*", width=38)
        password.pack(fill="x", pady=(3, 12))

        def submit():
            try:
                admin = self.request("/api/auth/login", {"email": email.get(), "password": password.get()})["admin"]
                if admin["role"] != app.auth.ROLE_ADMIN:
                    self.request("/api/auth/logout", {})
                    self.cookies.clear()
                    raise RuntimeError("Esta vista requiere una cuenta administradora.")
            except RuntimeError as error:
                password.delete(0, "end")
                messagebox.showerror("Acceso", str(error), parent=dialog)
                return
            dialog.destroy()
            self.admin = admin
            self.mode.configure(text="Vista administrador")
            self.login_button.configure(text="Cerrar sesión")
            self.tabs.add(self.report_tab, text="Reportería")
            self.refresh()

        ttk.Button(body, text="Ingresar", command=submit).pack(anchor="e")
        dialog.bind("<Return>", lambda _: submit())
        dialog.grab_set()
        email.focus_set()

    def export(self):
        if not self.admin or not self.report:
            messagebox.showinfo("Reportería", "No hay filas para exportar en este período.")
            return
        filename = filedialog.asksaveasfilename(defaultextension=".csv", initialfile="duco-reporte.csv",
                                                filetypes=[("CSV", "*.csv")])
        if not filename:
            return
        try:
            with Path(filename).open("w", newline="", encoding="utf-8-sig") as stream:
                writer = csv.writer(stream, delimiter=";")
                writer.writerow(("Fecha", "Sesiones", "Mensajes", "Positivas", "Negativas"))
                writer.writerows((row[0] or "Sin fecha", *row[1:]) for row in self.report)
        except OSError as error:
            messagebox.showerror("Exportar CSV", str(error))
            return
        self.status.set("Reporte exportado.")


def main():
    if os.getenv("ORACLE_DSN") != "127.0.0.1:1521/FREEPDB1" or os.getenv("ORACLE_USER") != "DUCO_APP":
        raise SystemExit("Configura DUCO_APP y 127.0.0.1:1521/FREEPDB1 en admin-app/.env.")
    with ThreadingHTTPServer(("127.0.0.1", 0), DashboardHandler) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            root = tk.Tk()
            Dashboard(root, server)
            root.mainloop()
        finally:
            server.shutdown()
            thread.join()


if __name__ == "__main__":
    main()