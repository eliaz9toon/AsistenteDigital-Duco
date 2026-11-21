"""Pestañas de administración de la aplicación de escritorio de Duco: tablas, evaluación, auditoría, usuarios y contraseña.

Todas hablan con el mismo servidor interno del dashboard (que reutiliza el login y los roles del panel web), así que los permisos
los decide el servidor: aquí solo se muestran las pestañas y botones que corresponden al rol de quien inició sesión.

  ADMINISTRADOR: tablas (ver, crear, editar, borrar), evaluación, auditoría y usuarios.
  EVALUADOR:     tablas (solo ver), evaluación de propuestas y valoraciones, auditoría.
  CONSULTA:      tablas (solo ver).
"""
from __future__ import annotations

import tkinter as tk
from tkinter import messagebox, ttk

import app

INK, MUTED, BG, CARD = "#132a3f", "#506478", "#f2f5f8", "#ffffff"
ID_BG, FK_BG = "#eef5ff", "#f7f2ff"


def short(value, limit: int = 110) -> str:
    """Texto en una sola línea y recortado, para mostrarlo en una celda."""
    text = "—" if value is None or value == "" else " ".join(str(value).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def is_date(column: dict) -> bool:
    return column["type"] == "DATE" or column["type"].startswith("TIMESTAMP")


def fmt_date(value) -> str:
    return "—" if not value else str(value).replace("T", " ")[:19]


class Tab(ttk.Frame):
    """Base de las pestañas: guarda la función `api(path, payload, method)` del dashboard y muestra los errores."""

    def __init__(self, parent, api, role: str):
        super().__init__(parent, padding=(0, 12, 0, 0))
        self.api = api
        self.role = role

    def call(self, path, payload=None, method=None, quiet=False):
        try:
            return self.api(path, payload, method)
        except RuntimeError as error:
            if quiet:
                raise
            messagebox.showerror("Duco", str(error), parent=self)
            return None


# ---------------------------------------------------------------------------------------------------------------- Tablas
class RecordDialog(tk.Toplevel):
    """Formulario para crear o editar un registro. Los ID automáticos y la clave de un registro existente no se pueden cambiar."""

    def __init__(self, parent, meta: dict, row: dict | None, on_save):
        super().__init__(parent)
        self.meta, self.row, self.on_save = meta, row, on_save
        self.title(("Editar" if row else "Nuevo registro") + f" · {meta['name']}")
        self.transient(parent.winfo_toplevel())
        self.resizable(False, True)
        body = ttk.Frame(self, padding=16)
        body.pack(fill="both", expand=True)
        self.widgets: dict[str, tk.Widget] = {}
        order = sorted(meta["columns"], key=lambda c: (0 if c.get("isPk") else 1 if c.get("fk") else 3 if is_date(c) else 2))
        for line, column in enumerate(order):
            if column["identity"] and not row:
                continue  # Oracle lo asigna solo
            locked = column["identity"] or bool(row and column.get("isPk"))
            note = (" · clave primaria" if column.get("isPk") else "") + ("" if column["nullable"] else " · requerido")
            ttk.Label(body, text=f"{column['name']}\n{column['type']}{note}", justify="left", foreground=MUTED).grid(row=line, column=0, sticky="nw", padx=(0, 12), pady=4)
            if column["type"] in ("CLOB", "NCLOB"):
                widget = tk.Text(body, width=46, height=4, wrap="word")
                widget.insert("1.0", "" if not row or row.get(column["name"]) is None else str(row[column["name"]]))
                if locked:
                    widget.configure(state="disabled", background="#eef1f4")
            else:
                widget = ttk.Entry(body, width=48)
                widget.insert(0, "" if not row or row.get(column["name"]) is None else (fmt_date(row[column["name"]]) if is_date(column) else str(row[column["name"]])))
                if locked:
                    widget.state(["disabled"])
            widget.grid(row=line, column=1, sticky="ew", pady=4)
            self.widgets[column["name"]] = widget
        self.error = ttk.Label(body, text="", foreground="#a12b2b", wraplength=420)
        self.error.grid(row=len(order) + 1, column=0, columnspan=2, sticky="w", pady=(8, 0))
        buttons = ttk.Frame(body)
        buttons.grid(row=len(order) + 2, column=0, columnspan=2, sticky="e", pady=(10, 0))
        ttk.Button(buttons, text="Cancelar", command=self.destroy).pack(side="right", padx=(8, 0))
        ttk.Button(buttons, text="Guardar", command=self.save).pack(side="right")
        self.grab_set()

    def values(self) -> dict:
        out = {}
        for column in self.meta["columns"]:
            widget = self.widgets.get(column["name"])
            if widget is None or column["identity"] or (self.row and column.get("isPk")):
                continue
            text = widget.get("1.0", "end").strip() if isinstance(widget, tk.Text) else widget.get().strip()
            before = "" if not self.row or self.row.get(column["name"]) is None else (fmt_date(self.row[column["name"]]) if is_date(column) else str(self.row[column["name"]]))
            if self.row and text == before:
                continue  # sin cambios: no se envía
            out[column["name"]] = text
        return out

    def save(self):
        values = self.values()
        if not values and self.row:
            self.error.configure(text="No hay cambios para guardar.")
            return
        try:
            self.on_save(values, self.row)
        except RuntimeError as error:
            self.error.configure(text=str(error))
            return
        self.destroy()


class TablesTab(Tab):
    """Ver, buscar y (solo ADMINISTRADOR) crear, editar y borrar registros de las 32 tablas, con los ID explicados."""

    def __init__(self, parent, api, role):
        super().__init__(parent, api, role)
        self.schema: list[dict] = []
        self.data: dict | None = None
        self.table_names: list[str] = []
        self.search_job = None
        self.filter_var, self.search_var, self.column_var = tk.StringVar(), tk.StringVar(), tk.StringVar(value="en todas las columnas")
        self.table_var = tk.StringVar()
        self.status = tk.StringVar(value="")
        top = ttk.Frame(self)
        top.pack(fill="x")
        ttk.Label(top, text="Tabla").pack(side="left")
        ttk.Entry(top, textvariable=self.filter_var, width=16).pack(side="left", padx=(8, 4))
        self.filter_var.trace_add("write", lambda *_: self.render_tables())
        self.table_box = ttk.Combobox(top, textvariable=self.table_var, state="readonly", width=46)
        self.table_box.pack(side="left", padx=4)
        self.table_box.bind("<<ComboboxSelected>>", lambda _: self.choose_table())
        self.can_edit = role == app.auth.ROLE_ADMIN
        if self.can_edit:
            ttk.Button(top, text="Nuevo", command=self.new_record).pack(side="right")
            ttk.Button(top, text="Eliminar", command=self.delete_record).pack(side="right", padx=6)
            ttk.Button(top, text="Editar", command=self.edit_record).pack(side="right")
        bar = ttk.Frame(self)
        bar.pack(fill="x", pady=(8, 6))
        ttk.Label(bar, text="Buscar").pack(side="left")
        ttk.Entry(bar, textvariable=self.search_var, width=34).pack(side="left", padx=(8, 4))
        self.search_var.trace_add("write", lambda *_: self.schedule_search())
        self.column_box = ttk.Combobox(bar, textvariable=self.column_var, state="readonly", width=26, values=["en todas las columnas"])
        self.column_box.pack(side="left", padx=4)
        self.column_box.bind("<<ComboboxSelected>>", lambda _: self.run_search())
        ttk.Button(bar, text="Limpiar", command=self.clear_search).pack(side="left", padx=4)
        card = tk.Frame(self, bg=CARD, highlightthickness=1, highlightbackground="#dbe3ec")
        card.pack(fill="x", pady=(0, 8))
        head = tk.Frame(card, bg=CARD)
        head.pack(fill="x", padx=12, pady=(8, 2))
        self.info_name = tk.Label(head, bg=CARD, fg=INK, font=("Segoe UI Semibold", 11))
        self.info_name.pack(side="left")
        self.info_module = tk.Label(head, bg="#e8f0fb", fg="#245cd1", font=("Segoe UI", 8), padx=8, pady=1)
        self.info_module.pack(side="left", padx=10)
        self.details_open = False
        self.details_button = ttk.Button(head, text="Cómo leer esta tabla ▸", command=self.toggle_details)
        self.details_button.pack(side="right")
        self.info_desc = tk.Label(card, bg=CARD, fg=MUTED, font=("Segoe UI", 9), anchor="w", justify="left", wraplength=900)
        self.info_desc.pack(fill="x", padx=12, pady=(0, 8))
        self.details = tk.Label(card, bg="#f5f9ff", fg=INK, font=("Segoe UI", 9), anchor="w", justify="left", wraplength=900, padx=12, pady=8)
        card.bind("<Configure>", lambda e: (self.info_desc.configure(wraplength=max(300, e.width - 30)), self.details.configure(wraplength=max(300, e.width - 30))))
        holder = ttk.Frame(self)
        holder.pack(fill="both", expand=True)
        self.tree = ttk.Treeview(holder, show="headings", selectmode="browse")
        yscroll = ttk.Scrollbar(holder, orient="vertical", command=self.tree.yview)
        xscroll = ttk.Scrollbar(holder, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)
        yscroll.pack(side="right", fill="y")
        xscroll.pack(side="bottom", fill="x")
        self.tree.pack(fill="both", expand=True, side="left")
        self.tree.tag_configure("odd", background="#f8fafc")
        self.tree.bind("<Double-1>", lambda _: self.edit_record() if self.can_edit else None)
        ttk.Label(self, textvariable=self.status, foreground=MUTED).pack(anchor="w", pady=(6, 0))

    # -- datos
    def load(self):
        data = self.call("/api/admin/schema")
        if not data:
            return
        self.schema = data["tables"]
        self.modules = data["modules"]
        self.render_tables()
        preferred = next((name for name in ("MENSAJES", "SESIONES_CHAT") if any(t["name"] == name for t in self.schema)), None)
        if preferred:
            self.select(preferred)

    def render_tables(self):
        needle = self.filter_var.get().strip().lower()
        items = [t for t in self.schema if not needle or needle in f"{t['name']} {t['description']} {t['module']}".lower()]
        self.table_names = [t["name"] for t in items]
        self.table_box.configure(values=[f"{t['name']} · {t['rows']} fila{'s' if t['rows'] != 1 else ''}" if t["rows"] else f"{t['name']} · vacía" for t in items])

    def choose_table(self):
        index = self.table_box.current()
        if 0 <= index < len(self.table_names):
            self.select(self.table_names[index], reset_column=True)

    def select(self, name: str, reset_column: bool = False):
        self.current = name
        if reset_column:
            self.column_var.set("en todas las columnas")
        for index, t in enumerate(self.schema):
            if t["name"] == name:
                rows = t["rows"]
                self.table_var.set(f"{name} · {rows} fila{'s' if rows != 1 else ''}" if rows else f"{name} · vacía")
        self.fetch()

    def fetch(self):
        from urllib.parse import quote
        term = self.search_var.get().strip()
        column = self.column_var.get()
        query = ""
        if term:
            query = "?q=" + quote(term) + ("" if column.startswith("en todas") else "&col=" + quote(column.removeprefix("en ")))
        data = self.call(f"/api/tables/{self.current}/rows{query}")
        if not data:
            return
        self.data = data
        self.draw()

    def toggle_details(self):
        self.details_open = not self.details_open
        if self.details_open:
            self.details.pack(fill="x")
        else:
            self.details.pack_forget()
        self.details_button.configure(text="Cómo leer esta tabla ▾" if self.details_open else "Cómo leer esta tabla ▸")

    # -- búsqueda
    def schedule_search(self):
        if self.search_job:
            self.after_cancel(self.search_job)
        self.search_job = self.after(350, self.run_search)

    def run_search(self):
        self.search_job = None
        if getattr(self, "current", None):
            self.fetch()

    def clear_search(self):
        self.search_var.set("")
        self.column_var.set("en todas las columnas")
        self.run_search()

    # -- dibujo
    def draw(self):
        data = self.data
        meta, docs = data["meta"], data["docs"]
        by_name = {c["name"]: c for c in meta["columns"]}
        pk = [c for c in meta["columns"] if c.get("isPk")]
        auto = len(pk) == 1 and pk[0]["identity"]
        id_note = (f"🔑  El ID ({pk[0]['name']}) lo genera Oracle solo: empieza en 1, sube de a uno y no se reutiliza si se borra una fila, por eso puede haber saltos."
                   if auto else (f"🔑  Su clave es {' + '.join(c['name'] for c in pk)}." if pk else ""))
        depends = ", ".join(sorted({r["table"] for r in docs["references"]})) or "ninguna (es un punto de partida)"
        used = ", ".join(sorted({t for t, _ in docs["referencedBy"]})) or "ninguna"
        self.info_name.configure(text=meta["name"])
        self.info_module.configure(text=docs["module"])
        self.info_desc.configure(text=docs["description"] or "Sin descripción.")
        self.details.configure(text="\n".join(line for line in (
            id_note,
            "🔗  Las columnas con este símbolo guardan el ID de una fila de otra tabla; al lado del número se muestra a qué corresponde.",
            f"⬆  Depende de: {depends}",
            f"⬇  La usan: {used}") if line))
        columns = data["displayOrder"]
        self.column_box.configure(values=["en todas las columnas"] + [f"en {c}" for c in columns])
        self.tree.delete(*self.tree.get_children())
        self.tree.configure(columns=columns)
        for name in columns:
            column = by_name[name]
            marker = "🔑 " if column.get("isPk") else "🔗 " if column.get("fk") else "🕒 " if is_date(column) else ""
            self.tree.heading(name, text=marker + name)
            self.tree.column(name, width=190 if column["type"] in ("CLOB", "NCLOB", "VARCHAR2") else 130, minwidth=90, stretch=False)
        self.rows = data["rows"]
        for index, row in enumerate(self.rows):
            cells = []
            for name in columns:
                column, value = by_name[name], row.get(name)
                if value is None or value == "":
                    cells.append("—")
                elif is_date(column):
                    cells.append(fmt_date(value))
                elif column.get("fk"):
                    label = data["labels"].get(name, {}).get(str(value))
                    cells.append(f"{value} · {short(label, 40)}" if label else str(value))
                else:
                    cells.append(short(value))
            self.tree.insert("", "end", iid=str(index), values=cells, tags=("odd",) if index % 2 else ())
        found = f" · búsqueda «{data['query']}»: {data['total']} de {data['tableTotal']} coinciden" if data.get("query") else ""
        read_only = " · solo lectura" if meta["name"] in ("AUDITORIA_CAMBIOS", "SESIONES_ADMIN", "USUARIOS_ADMIN") else ""
        self.status.set(f"Mostrando {len(self.rows)} de {data['total']} registro(s) · orden: {data['orderedBy']}{read_only}")
        if found:
            self.status.set(self.status.get() + found)

    # -- edición (solo administrador; el servidor lo vuelve a comprobar)
    def selected_row(self):
        selection = self.tree.selection()
        return self.rows[int(selection[0])] if selection else None

    def key_of(self, row: dict) -> dict:
        return {c["name"]: row[c["name"]] for c in self.data["meta"]["columns"] if c.get("isPk")}

    def new_record(self):
        if self.data:
            RecordDialog(self, self.data["meta"], None, self.save_record)

    def edit_record(self):
        row = self.selected_row()
        if not row:
            messagebox.showinfo("Editar", "Selecciona primero un registro.", parent=self)
            return
        RecordDialog(self, self.data["meta"], row, self.save_record)

    def save_record(self, values: dict, row: dict | None):
        """Guarda en el servidor (que valida el rol y registra la auditoría). Lanza RuntimeError con el motivo si falla."""
        name = self.data["meta"]["name"]
        if row:
            self.api(f"/api/tables/{name}", {"key": self.key_of(row), "values": values}, "PUT")
        else:
            self.api(f"/api/tables/{name}", {"values": {k: v for k, v in values.items() if v != ""}}, "POST")
        self.fetch()

    def delete_record(self):
        row = self.selected_row()
        if not row:
            messagebox.showinfo("Eliminar", "Selecciona primero un registro.", parent=self)
            return
        if not messagebox.askyesno("Eliminar", "¿Eliminar este registro? Si otras tablas lo usan, Oracle impedirá borrarlo. Queda anotado en la auditoría.", parent=self):
            return
        self.remove_record(row)

    def remove_record(self, row: dict):
        try:
            self.api(f"/api/tables/{self.data['meta']['name']}", {"key": self.key_of(row)}, "DELETE")
        except RuntimeError as error:
            messagebox.showerror("Eliminar", str(error), parent=self)
            return False
        self.fetch()
        return True


# ------------------------------------------------------------------------------------------------------------ Evaluación
class EvaluationTab(Tab):
    """Propuestas de conocimiento por aprobar o rechazar y respuestas con valoración negativa por revisar."""

    def __init__(self, parent, api, role):
        super().__init__(parent, api, role)
        self.proposals: list[dict] = []
        self.feedback: list[dict] = []
        pane = ttk.PanedWindow(self, orient="vertical")
        pane.pack(fill="both", expand=True)
        self.p_tree, self.p_detail = self.section(pane, "Propuestas de conocimiento pendientes", ("Pregunta", "👍", "👎", "Creada"), (520, 60, 60, 150), self.show_proposal,
                                                 (("Aprobar", lambda: self.decide("APROBADA")), ("Rechazar", lambda: self.decide("RECHAZADA"))))
        self.f_tree, self.f_detail = self.section(pane, "Respuestas con valoración negativa por revisar", ("Pregunta", "Fecha"), (680, 150), self.show_feedback,
                                                 (("Marcar como revisada", self.mark_reviewed),))
        self.status = tk.StringVar(value="")
        ttk.Label(self, textvariable=self.status, foreground=MUTED).pack(anchor="w", pady=(6, 0))

    def section(self, pane, title, columns, widths, on_select, buttons):
        frame = ttk.Frame(pane, padding=(0, 0, 0, 8))
        pane.add(frame, weight=1)
        head = ttk.Frame(frame)
        head.pack(fill="x")
        ttk.Label(head, text=title, font=("Segoe UI Semibold", 11)).pack(side="left")
        for label, command in reversed(buttons):
            ttk.Button(head, text=label, command=command).pack(side="right", padx=(6, 0))
        tree = ttk.Treeview(frame, columns=columns, show="headings", height=5, selectmode="browse")
        for column, width in zip(columns, widths):
            tree.heading(column, text=column)
            tree.column(column, width=width, anchor="w" if column == columns[0] else "center")
        tree.pack(fill="both", expand=True, pady=(4, 4))
        tree.bind("<<TreeviewSelect>>", lambda _: on_select())
        detail = tk.Text(frame, height=5, wrap="word", state="disabled", bg=CARD, relief="flat", highlightthickness=1, highlightbackground="#dbe3ec")
        detail.pack(fill="x")
        return tree, detail

    def load(self):
        proposals = self.call("/api/duco/proposals")
        feedback = self.call("/api/duco/negative-feedback")
        if proposals is None or feedback is None:
            return
        self.proposals, self.feedback = proposals["proposals"], feedback["feedback"]
        self.p_tree.delete(*self.p_tree.get_children())
        for index, item in enumerate(self.proposals):
            self.p_tree.insert("", "end", iid=str(index), values=(short(item["question"], 90), item["positiveVotes"], item["negativeVotes"], fmt_date(item["createdAt"])))
        self.f_tree.delete(*self.f_tree.get_children())
        for index, item in enumerate(self.feedback):
            self.f_tree.insert("", "end", iid=str(index), values=(short(item["question"], 120), fmt_date(item["createdAt"])))
        self.set_text(self.p_detail, "" if self.proposals else "No hay propuestas pendientes.")
        self.set_text(self.f_detail, "" if self.feedback else "No hay respuestas negativas pendientes.")
        self.status.set(f"{len(self.proposals)} propuesta(s) y {len(self.feedback)} valoración(es) negativa(s) por evaluar")

    @staticmethod
    def set_text(widget, text):
        widget.configure(state="normal")
        widget.delete("1.0", "end")
        widget.insert("1.0", text)
        widget.configure(state="disabled")

    def pick(self, tree, items):
        selection = tree.selection()
        return items[int(selection[0])] if selection else None

    def show_proposal(self):
        item = self.pick(self.p_tree, self.proposals)
        if item:
            self.set_text(self.p_detail, f"Pregunta:\n{item['question']}\n\nRespuesta propuesta:\n{item['answer']}")

    def show_feedback(self):
        item = self.pick(self.f_tree, self.feedback)
        if item:
            self.set_text(self.f_detail, f"Pregunta:\n{item['question']}\n\nRespuesta que recibió 👎:\n{item['answer']}")

    def decide(self, decision: str):
        item = self.pick(self.p_tree, self.proposals)
        if not item:
            messagebox.showinfo("Evaluación", "Selecciona primero una propuesta.", parent=self)
            return
        if decision == "APROBADA" and not messagebox.askyesno("Aprobar", "Al aprobarla pasa a las preguntas frecuentes y Duco podrá usarla. ¿Aprobar?", parent=self):
            return
        self.evaluate(item["id"], decision)

    def evaluate(self, proposal_id: int, decision: str):
        if self.call(f"/api/duco/proposals/{proposal_id}/review", {"decision": decision}, "POST") is not None:
            self.load()
            self.status.set("Propuesta aprobada: ya está en las preguntas frecuentes." if decision == "APROBADA" else "Propuesta rechazada.")

    def mark_reviewed(self):
        item = self.pick(self.f_tree, self.feedback)
        if not item:
            messagebox.showinfo("Evaluación", "Selecciona primero una valoración.", parent=self)
            return
        self.review_feedback(item["id"])

    def review_feedback(self, feedback_id: int):
        if self.call(f"/api/duco/feedback/{feedback_id}/review", {}, "POST") is not None:
            self.load()
            self.status.set("Valoración marcada como revisada.")


# ------------------------------------------------------------------------------------------------------------- Auditoría
class AuditTab(Tab):
    def __init__(self, parent, api, role):
        super().__init__(parent, api, role)
        self.entries: list[dict] = []
        head = ttk.Frame(self)
        head.pack(fill="x", pady=(0, 8))
        ttk.Label(head, text="Cada cambio queda con su tabla, el ID del registro, la acción, quién lo hizo y desde dónde. Es de solo lectura.", foreground=MUTED).pack(side="left")
        ttk.Button(head, text="Actualizar", command=self.load).pack(side="right")
        columns = ("Fecha", "Tabla", "Acción", "ID registro", "Quién", "Origen")
        self.tree = ttk.Treeview(self, columns=columns, show="headings", selectmode="browse")
        for column, width in zip(columns, (150, 220, 100, 100, 180, 90)):
            self.tree.heading(column, text=column)
            self.tree.column(column, width=width, anchor="w")
        self.tree.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", lambda _: self.show())
        self.detail = tk.Text(self, height=7, wrap="word", state="disabled", bg=CARD, relief="flat", highlightthickness=1, highlightbackground="#dbe3ec")
        self.detail.pack(fill="x", pady=(8, 0))

    def load(self):
        data = self.call("/api/admin/reports/audit")
        if data is None:
            return
        self.entries = data["audit"]
        self.tree.delete(*self.tree.get_children())
        for index, entry in enumerate(self.entries):
            self.tree.insert("", "end", iid=str(index), values=(fmt_date(entry["date"]), entry["table"], entry["action"], entry["recordId"] or "—", entry["actor"] or "—", entry["origin"] or "—"))

    def show(self):
        selection = self.tree.selection()
        if not selection:
            return
        entry = self.entries[int(selection[0])]
        EvaluationTab.set_text(self.detail, f"{entry['table']} · {entry['action']} · registro {entry['recordId'] or 'sin ID (histórico)'}\n\nAntes:\n{entry['before'] or '—'}\n\nDespués:\n{entry['after'] or '—'}")


# -------------------------------------------------------------------------------------------------------------- Usuarios
class UserDialog(tk.Toplevel):
    def __init__(self, parent, on_save):
        super().__init__(parent)
        self.on_save = on_save
        self.title("Nuevo usuario")
        self.transient(parent.winfo_toplevel())
        self.resizable(False, False)
        body = ttk.Frame(self, padding=18)
        body.pack(fill="both", expand=True)
        self.entries = {}
        for key, label, secret in (("name", "Nombre", False), ("email", "Correo", False), ("password", "Contraseña (mínimo 8, con letras y números)", True)):
            ttk.Label(body, text=label).pack(anchor="w")
            entry = ttk.Entry(body, width=44, show="*" if secret else "")
            entry.pack(fill="x", pady=(2, 10))
            self.entries[key] = entry
        ttk.Label(body, text="Rol").pack(anchor="w")
        self.role = ttk.Combobox(body, state="readonly", width=42, values=[f"{r} — {d}" for r, d in ROLE_HELP.items()])
        self.role.current(2)
        self.role.pack(fill="x", pady=(2, 10))
        self.error = ttk.Label(body, text="", foreground="#a12b2b", wraplength=380)
        self.error.pack(anchor="w")
        row = ttk.Frame(body)
        row.pack(fill="x", pady=(8, 0))
        ttk.Button(row, text="Cancelar", command=self.destroy).pack(side="right", padx=(8, 0))
        ttk.Button(row, text="Crear", command=self.save).pack(side="right")
        self.grab_set()

    def save(self):
        role = self.role.get().split(" — ")[0]
        try:
            self.on_save({"name": self.entries["name"].get(), "email": self.entries["email"].get(), "password": self.entries["password"].get(), "role": role})
        except RuntimeError as error:
            self.error.configure(text=str(error))
            return
        self.destroy()


ROLE_HELP = {
    app.auth.ROLE_ADMIN: "todo: edita, borra y gestiona usuarios",
    app.auth.ROLE_EVALUATOR: "ve datos y evalúa propuestas y valoraciones",
    app.auth.ROLE_VIEWER: "solo ve dashboard, reportes y tablas",
}


class UsersTab(Tab):
    def __init__(self, parent, api, role, me_id: int):
        super().__init__(parent, api, role)
        self.me_id = me_id
        self.users: list[dict] = []
        head = ttk.Frame(self)
        head.pack(fill="x", pady=(0, 8))
        ttk.Label(head, text="Quién puede entrar a la aplicación y con qué rol.", foreground=MUTED).pack(side="left")
        ttk.Button(head, text="Nuevo usuario", command=lambda: UserDialog(self, self.create)).pack(side="right")
        ttk.Button(head, text="Activar / desactivar", command=self.toggle).pack(side="right", padx=6)
        columns = ("Nombre", "Correo", "Rol", "Estado", "Último acceso")
        self.tree = ttk.Treeview(self, columns=columns, show="headings", selectmode="browse")
        for column, width in zip(columns, (200, 260, 140, 100, 170)):
            self.tree.heading(column, text=column)
            self.tree.column(column, width=width, anchor="w")
        self.tree.pack(fill="both", expand=True)
        legend = "\n".join(f"{r}: {d}" for r, d in ROLE_HELP.items())
        ttk.Label(self, text=legend, foreground=MUTED, justify="left").pack(anchor="w", pady=(8, 0))

    def load(self):
        data = self.call("/api/admin/users")
        if data is None:
            return
        self.users = data["users"]
        self.tree.delete(*self.tree.get_children())
        for index, user in enumerate(self.users):
            self.tree.insert("", "end", iid=str(index), values=(user["name"], user["email"], user["role"], "Activo" if user["active"] else "Desactivado", fmt_date(user["lastAccess"])))

    def create(self, payload: dict):
        self.api("/api/admin/users", payload, "POST")
        self.load()

    def toggle(self):
        selection = self.tree.selection()
        if not selection:
            messagebox.showinfo("Usuarios", "Selecciona primero un usuario.", parent=self)
            return
        user = self.users[int(selection[0])]
        self.set_active(user["id"], not user["active"])

    def set_active(self, user_id: int, active: bool):
        if self.call(f"/api/admin/users/{user_id}/active", {"active": active}, "POST") is not None:
            self.load()


# ----------------------------------------------------------------------------------------------------------- Contraseña
class PasswordDialog(tk.Toplevel):
    def __init__(self, parent, on_save):
        super().__init__(parent)
        self.on_save = on_save
        self.title("Mi contraseña")
        self.transient(parent)
        self.resizable(False, False)
        body = ttk.Frame(self, padding=18)
        body.pack(fill="both", expand=True)
        self.current = ttk.Entry(body, show="*", width=40)
        self.new = ttk.Entry(body, show="*", width=40)
        for label, entry in (("Contraseña actual", self.current), ("Contraseña nueva (mínimo 8, con letras y números)", self.new)):
            ttk.Label(body, text=label).pack(anchor="w")
            entry.pack(fill="x", pady=(2, 10))
        self.error = ttk.Label(body, text="", foreground="#a12b2b", wraplength=340)
        self.error.pack(anchor="w")
        ttk.Button(body, text="Guardar", command=self.save).pack(anchor="e", pady=(8, 0))
        self.bind("<Return>", lambda _: self.save())
        self.grab_set()
        self.current.focus_set()

    def save(self):
        try:
            self.on_save(self.current.get(), self.new.get())
        except RuntimeError as error:
            self.error.configure(text=str(error))
            self.current.delete(0, "end")
            return
        messagebox.showinfo("Mi contraseña", "Contraseña actualizada.", parent=self)
        self.destroy()
