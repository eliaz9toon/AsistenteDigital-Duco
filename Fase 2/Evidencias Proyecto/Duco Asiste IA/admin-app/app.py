"""Aplicación local de administración CRUD para el esquema Oracle de Duco Asiste."""

from __future__ import annotations

import json
import mimetypes
import os
import re
import shutil
import subprocess
import threading
import time
import unicodedata
import uuid
from contextlib import contextmanager
from datetime import datetime
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from urllib.request import ProxyHandler, build_opener

import auth
import external_apis
import web_lookup

try:
    import oracledb
except ImportError as exc:
    raise SystemExit("Falta python-oracledb. Instala dependencias con: pip install -r requirements.txt") from exc


ROOT = Path(__file__).resolve().parent


def is_contextual_exchange(question: str, answer: str, interaction_type: str = "") -> bool:
    """Las valoraciones de acciones visuales no son respuestas FAQ reutilizables."""
    if interaction_type == "navigation":
        return True
    def normalize(value):
        return "".join(c for c in unicodedata.normalize("NFKD", str(value).lower())
                       if not unicodedata.combining(c))
    question, answer = normalize(question), normalize(answer)
    confirmation = re.search(
        r"\b(?:resaltando|remarcando|abriendo|cerrando|te marque|he resaltado|"
        r"repito el resaltado|resaltare|voy a resaltar|voy a abrir el menu)\b", answer)
    visual_request = re.search(
        r"\b(?:resalta\w*|remarca\w*|marcame|subraya\w*|senala\w*)\b", question)
    menu_request = re.search(
        r"\b(?:abre\w*|abrir|cierra\w*|cerrar)\b.*\b(?:menu|dropdown|desplegable)\b", question)
    factual_question = re.search(r"\b(?:como|que significa|para que sirve)\b", question)
    dependent_followup = re.fullmatch(
        r"\W*(?:lo que (?:tu )?quieras|cualquiera|de ?nuevo|nuevamente|"
        r"intentalo(?: nuevamente)?|otra vez|lo mismo|repite)\W*", question)
    return bool(confirmation or dependent_followup or ((visual_request or menu_request) and not factual_question))


def load_dotenv() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


load_dotenv()
oracledb.defaults.fetch_lobs = False


class OllamaService:
    """Start a local Ollama server; only stop the process owned by Duco."""

    def __init__(self):
        self.base_url = "http://127.0.0.1:11434"
        self.process = None
        self.lock = threading.Lock()
        self.http = build_opener(ProxyHandler({}))

    def is_online(self):
        try:
            with self.http.open(self.base_url + "/api/tags", timeout=1) as response:
                return response.status == 200 and isinstance(json.load(response).get("models"), list)
        except (OSError, ValueError):
            return False

    def executable(self):
        executable = shutil.which("ollama")
        if executable:
            return executable
        local_app_data = os.getenv("LOCALAPPDATA")
        if local_app_data:
            candidate = Path(local_app_data) / "Programs" / "Ollama" / "ollama.exe"
            if candidate.is_file():
                return str(candidate)
        return None

    def ensure_running(self):
        with self.lock:
            if self.is_online():
                return {"online": True, "started": False}
            if self.process is None or self.process.poll() is not None:
                executable = self.executable()
                if not executable:
                    return {"online": False, "error": "No se encontro Ollama instalado en este equipo."}
                env = dict(os.environ, OLLAMA_HOST=urlparse(self.base_url).netloc)
                try:
                    with (ROOT / "ollama.log").open("ab") as log:
                        self.process = subprocess.Popen(
                            [executable, "serve"], env=env, stdin=subprocess.DEVNULL,
                            stdout=log, stderr=log,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                        )
                except OSError as exc:
                    return {"online": False, "error": f"No se pudo iniciar Ollama: {exc}"}

            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                if self.is_online():
                    return {"online": True, "started": True}
                if self.process.poll() is not None:
                    break
                time.sleep(0.2)
            return {"online": False, "error": "Ollama no respondio al iniciar. Revisa admin-app/ollama.log."}

    def close(self):
        with self.lock:
            if self.process is not None and self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait()
            self.process = None


ollama_service = OllamaService()


def connect():
    user = os.getenv("ORACLE_USER")
    password = os.getenv("ORACLE_PASSWORD")
    dsn = os.getenv("ORACLE_DSN")
    if not user or not password or not dsn:
        raise RuntimeError("Configura ORACLE_USER, ORACLE_PASSWORD y ORACLE_DSN en admin-app/.env")
    return oracledb.connect(user=user, password=password, dsn=dsn)


@contextmanager
def db_session():
    connection = connect()
    try:
        yield connection
    finally:
        connection.close()


def safe_ident(name: str) -> str:
    if not re.fullmatch(r"[A-Z][A-Z0-9_$#]{0,127}", name):
        raise ValueError("Identificador Oracle inválido")
    return f'"{name}"'


def table_names(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
        return [row[0] for row in cur]


def table_meta(conn, table: str) -> dict:
    table = table.upper()
    if table not in table_names(conn):
        raise ValueError("La tabla no existe en el esquema conectado")
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name, data_type, nullable, identity_column
            FROM user_tab_columns WHERE table_name = :table_name ORDER BY column_id
        """, table_name=table)
        columns = [
            {"name": row[0], "type": row[1], "nullable": row[2] == "Y", "identity": row[3] == "YES"}
            for row in cur
        ]
        cur.execute("""
            SELECT column_name FROM user_cons_columns
            WHERE table_name = :table_name AND constraint_name IN (
                SELECT constraint_name FROM user_constraints
                WHERE table_name = :table_name AND constraint_type = 'P'
            ) ORDER BY position
        """, table_name=table)
        primary_key = [row[0] for row in cur]
    if not primary_key:
        raise ValueError("No se puede editar una tabla sin clave primaria")
    return {"name": table, "columns": columns, "primaryKey": primary_key}


MODULE_ORDER = ["Acceso y administración", "Chat e inteligencia artificial", "Contenido y navegación", "Conocimiento administrable", "Calidad y operación"]
LABEL_CANDIDATES = ["NOMBRE_USUARIO", "NOMBRE", "TITULO", "PREGUNTA", "TEXTO", "CLAVE", "TIPO", "CORREO", "CLIENT_SESSION_ID", "CONTENIDO", "ESTADO"]


def schema_info(conn) -> dict:
    """Metadatos del esquema para el visor: comentarios (módulo y descripción), claves foráneas y primarias."""
    with conn.cursor() as cur:
        cur.execute("SELECT table_name, comments FROM user_tab_comments WHERE table_type = 'TABLE'")
        table_comments = {name: text or "" for name, text in cur}
        cur.execute("SELECT table_name, column_name, comments FROM user_col_comments")
        column_comments = {(t, c): text or "" for t, c, text in cur}
        cur.execute("""
            SELECT c.table_name, cc.column_name, p.table_name, pc.column_name
            FROM user_constraints c
            JOIN user_cons_columns cc ON cc.constraint_name = c.constraint_name
            JOIN user_constraints p ON p.constraint_name = c.r_constraint_name
            JOIN user_cons_columns pc ON pc.constraint_name = p.constraint_name AND pc.position = cc.position
            WHERE c.constraint_type = 'R'
        """)
        foreign_keys = [{"table": t, "column": c, "parentTable": pt, "parentColumn": pcn} for t, c, pt, pcn in cur]
    return {"tableComments": table_comments, "columnComments": column_comments, "foreignKeys": foreign_keys}


def split_comment(text: str) -> tuple[str, str]:
    module, _, description = (text or "").partition(" · ")
    return (module, description) if description else ("Otras", text or "")


def table_depths(info: dict, names: list[str]) -> dict[str, int]:
    """Profundidad según las claves foráneas: 0 = no depende de nadie; sirve para listar primero las tablas «padre»."""
    parents: dict[str, set[str]] = {name: set() for name in names}
    for fk in info["foreignKeys"]:
        if fk["table"] != fk["parentTable"]:
            parents.setdefault(fk["table"], set()).add(fk["parentTable"])
    depth: dict[str, int] = {}
    def resolve(name: str, trail: tuple = ()) -> int:
        if name in depth:
            return depth[name]
        if name in trail:
            return 0
        depth[name] = 1 + max((resolve(parent, trail + (name,)) for parent in parents.get(name, ())), default=-1)
        return depth[name]
    for name in names:
        resolve(name)
    return depth


def describe_table(conn, meta: dict, info: dict) -> dict:
    """Enriquece las columnas con comentario, rol (clave primaria o foránea) y relaciones de la tabla."""
    name = meta["name"]
    fks = {fk["column"]: fk for fk in info["foreignKeys"] if fk["table"] == name}
    for column in meta["columns"]:
        column["comment"] = info["columnComments"].get((name, column["name"]), "")
        column["isPk"] = column["name"] in meta["primaryKey"]
        column["fk"] = {"table": fks[column["name"]]["parentTable"], "column": fks[column["name"]]["parentColumn"]} if column["name"] in fks else None
    module, description = split_comment(info["tableComments"].get(name, ""))
    return {
        "module": module, "description": description,
        "references": [{"column": fk["column"], "table": fk["parentTable"], "refColumn": fk["parentColumn"]} for fk in fks.values()],
        "referencedBy": sorted({(fk["table"], fk["column"]) for fk in info["foreignKeys"] if fk["parentTable"] == name}),
    }


def display_order(meta: dict) -> list[str]:
    """Orden de lectura: primero los identificadores (clave primaria y foráneas), luego los datos y al final las fechas."""
    def rank(column: dict) -> int:
        if column.get("isPk"):
            return 0
        if column.get("fk"):
            return 1
        return 3 if column["type"] == "DATE" or column["type"].startswith("TIMESTAMP") else 2
    return [col["name"] for col in sorted(meta["columns"], key=rank)]  # sorted es estable: conserva el orden original dentro de cada grupo


def first_nonempty(parts: list[str]) -> str:
    """COALESCE de Oracle exige 2 o más argumentos (ORA-00938): con una sola columna se usa directamente."""
    return parts[0] if len(parts) == 1 else "COALESCE(" + ", ".join(parts) + ")"


def foreign_labels(conn, meta: dict, rows: list[dict]) -> dict:
    """Para cada columna foránea, el texto de la fila a la que apunta («181» → «María»), para entender de qué es cada ID."""
    labels: dict[str, dict[str, str]] = {}
    for column in meta["columns"]:
        fk = column.get("fk")
        values = list({row[column["name"]] for row in rows if row.get(column["name"]) is not None})[:200]
        if not fk or not values:
            continue
        with conn.cursor() as cur:
            cur.execute("SELECT column_name FROM user_tab_columns WHERE table_name = :t", t=fk["table"])
            present = {row[0] for row in cur}
            chosen = [name for name in LABEL_CANDIDATES if name in present][:2]
            if not chosen:
                continue
            # Un UUID de 36 caracteres no ayuda a leer: se abrevia a sus primeros 8 («sesión 76f517e7»).
            part = lambda name: f"'sesión ' || SUBSTR({safe_ident(name)}, 1, 8)" if name == "CLIENT_SESSION_ID" else f"TO_CHAR(SUBSTR({safe_ident(name)}, 1, 60))"
            expression = first_nonempty([part(name) for name in chosen])
            binds = {f"v{i}": value for i, value in enumerate(values)}
            placeholders = ", ".join(f":v{i}" for i in range(len(values)))
            cur.execute(f"SELECT {safe_ident(fk['column'])}, {expression} FROM {safe_ident(fk['table'])} WHERE {safe_ident(fk['column'])} IN ({placeholders})", binds)
            labels[column["name"]] = {str(key): str(text) for key, text in cur if text}
    return labels


def search_clause(conn, meta: dict, term: str, only_column: str | None = None) -> tuple[str, dict]:
    """Condición WHERE para buscar un texto en una tabla: en todas las columnas (o en una) y, en las claves foráneas, en el texto de la fila a la que apuntan
    (así «María» encuentra los mensajes de la conversación de María). Sin distinguir mayúsculas; los símbolos % y _ se buscan tal cual."""
    term = str(term or "").strip()[:100]
    if not term:
        return "", {}
    escaped = term.lower().replace("!", "!!").replace("%", "!%").replace("_", "!_")
    binds = {"term": f"%{escaped}%"}
    by_name = {col["name"]: col for col in meta["columns"]}
    if only_column and only_column not in by_name:
        raise ValueError("La columna no existe en la tabla")
    parts = []
    if only_column in HIDDEN_COLUMNS:
        raise ValueError("Esa columna no se puede buscar")
    for column in ([by_name[only_column]] if only_column else meta["columns"]):
        if column["name"] in HIDDEN_COLUMNS:
            continue
        ident = safe_ident(column["name"])
        kind = column["type"]
        if kind in ("CLOB", "NCLOB"):
            expression = f"DBMS_LOB.SUBSTR({ident}, 2000, 1)"
        elif kind == "DATE" or kind.startswith("TIMESTAMP"):
            expression = f"TO_CHAR({ident}, 'YYYY-MM-DD HH24:MI:SS')"
        elif kind in ("BLOB", "RAW", "LONG"):
            continue
        else:
            expression = f"TO_CHAR({ident})"
        parts.append(f"LOWER({expression}) LIKE :term ESCAPE '!'")
    # Claves foráneas: también se busca en el texto legible de la fila relacionada.
    info = schema_info(conn)
    for fk in [f for f in info["foreignKeys"] if f["table"] == meta["name"] and (not only_column or f["column"] == only_column)]:
        with conn.cursor() as cur:
            cur.execute("SELECT column_name FROM user_tab_columns WHERE table_name = :t", t=fk["parentTable"])
            present = {row[0] for row in cur}
        chosen = [name for name in LABEL_CANDIDATES if name in present][:2]
        if not chosen:
            continue
        label = first_nonempty([f"TO_CHAR(SUBSTR({safe_ident(name)}, 1, 200))" for name in chosen])
        parts.append(f"{safe_ident(fk['column'])} IN (SELECT {safe_ident(fk['parentColumn'])} FROM {safe_ident(fk['parentTable'])} WHERE LOWER({label}) LIKE :term ESCAPE '!')")
    return (" WHERE " + " OR ".join(parts), binds) if parts else (" WHERE 1 = 0", {})


def normalize(value, data_type: str):
    if value is None or value == "":
        return None
    if data_type == "NUMBER":
        return Decimal(str(value))
    if data_type == "DATE":
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if data_type.startswith("TIMESTAMP"):
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return value


def clean_user_name(value) -> str | None:
    """Nombre (o apodo) de quien usa el chat: se pide solo eso, sin RUT, correo ni teléfono."""
    name = re.sub(r"\s+", " ", str(value or "")).strip()
    if not name:
        return None
    if not re.fullmatch(r"[^\W_][\w .'\-]{1,39}", name):
        raise ValueError("El nombre debe tener entre 2 y 40 caracteres: letras, números, espacios, punto, guion o apóstrofo.")
    if re.search(r"\d{5,}|@", name):
        raise ValueError("Escribe solo tu nombre o un apodo, sin números largos ni correos.")
    return name


def compact(value, limit: int = 300):
    """Recorta textos largos antes de guardarlos en la auditoría."""
    if isinstance(value, dict):
        return {key: compact(item, limit) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [compact(item, limit) for item in value[:20]]
    text = value if isinstance(value, (int, float, bool)) or value is None else str(value)
    return text[:limit] + "…" if isinstance(text, str) and len(text) > limit else text


def record_audit(cur, table: str, action: str, record_id, before=None, after=None, actor: dict | None = None) -> None:
    """Una fila de auditoría por cambio: qué tabla, qué registro, qué acción, valores antes y después, quién y desde dónde."""
    actor = actor or {}
    dump = lambda data: json.dumps(compact(data), ensure_ascii=False, default=str)[:4000] if data is not None else None
    cur.execute("""
        INSERT INTO AUDITORIA_CAMBIOS (ID_ADMIN, TABLA_AFECTADA, FECHA, ACCION, ID_REGISTRO, VALOR_ANTERIOR, VALOR_NUEVO, NOMBRE_ACTOR, ORIGEN)
        VALUES (:admin_id, :tabla, CURRENT_TIMESTAMP, :accion, :registro, :antes, :despues, :actor, :origen)
    """, {"admin_id": actor.get("id"), "tabla": table, "accion": action, "registro": None if record_id is None else str(record_id)[:120],
          "antes": dump(before), "despues": dump(after), "actor": (actor.get("name") or None) and str(actor["name"])[:120],
          "origen": actor.get("origin") or "sistema"})


def log_event(cur, kind: str) -> None:
    cur.execute("INSERT INTO EVENTOS_SISTEMA (TIPO, FECHA) VALUES (:tipo, CURRENT_TIMESTAMP)", tipo=str(kind)[:80])


def first_out(cur_var):
    value = cur_var.getvalue()
    return value[0] if isinstance(value, list) else value


READ_ONLY_TABLES = {"AUDITORIA_CAMBIOS", "SESIONES_ADMIN", "USUARIOS_ADMIN"}
HIDDEN_COLUMNS = {"CLAVE_HASH", "TOKEN_HASH"}  # contraseñas y tokens (aunque sean hashes) nunca se muestran ni se buscan


class Handler(BaseHTTPRequestHandler):
    server_version = "DucoAdmin/1.0"

    def log_message(self, format, *args):
        print("[Duco Admin]", format % args)

    # ---- Sesión del panel de administración -------------------------------------------------------------------
    def current_admin(self) -> dict | None:
        token = auth.parse_cookie(self.headers.get("Cookie"))
        if not token:
            return None
        try:
            with db_session() as conn, conn.cursor() as cur:
                cur.execute("""
                    SELECT s.ID_SESION_ADMIN, u.ID_ADMIN, u.NOMBRE, u.CORREO, r.NOMBRE
                    FROM SESIONES_ADMIN s
                    JOIN USUARIOS_ADMIN u ON u.ID_ADMIN = s.ID_ADMIN
                    LEFT JOIN ROLES r ON r.ID_ROL = u.ID_ROL
                    WHERE s.TOKEN_HASH = :token_hash AND s.FECHA_FIN IS NULL
                      AND s.FECHA_EXPIRA > CURRENT_TIMESTAMP AND u.ACTIVO = 1
                """, token_hash=auth.token_hash(token))
                row = cur.fetchone()
        except Exception:
            return None
        if not row:
            return None
        return {"sessionId": row[0], "id": row[1], "name": row[2], "email": row[3], "role": row[4] or auth.ROLE_VIEWER, "origin": "panel"}

    def require_admin(self, roles: set[str] | None = None) -> dict | None:
        """Devuelve el usuario con sesión válida; si no, responde 401 (sin sesión) o 403 (rol insuficiente) y devuelve None."""
        admin = self.current_admin()
        if not admin:
            self.send_json(401, {"error": "Inicia sesión para continuar."})
            return None
        if roles and admin["role"] not in roles:
            self.send_json(403, {"error": "Tu rol no permite esta acción."})
            return None
        return admin

    def send_json(self, status: int, payload, headers: dict | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for header, header_value in (headers or {}).items():
            self.send_header(header, header_value)
        origin = self.allowed_cors_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def allowed_cors_origin(self) -> str | None:
        path = urlparse(self.path).path
        origin = self.headers.get("Origin")
        allowed = {item.strip() for item in os.getenv(
            "DUCO_ALLOWED_ORIGINS",
            "http://127.0.0.1:5500,http://localhost:5500"
        ).split(",") if item.strip()}
        if path.startswith("/api/duco/") and origin in allowed:
            return origin
        return None

    def do_OPTIONS(self):
        origin = self.allowed_cors_origin()
        if not origin:
            return self.send_json(403, {"error": "Origen no permitido"})
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "300")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def body_json(self) -> dict:
        length = min(int(self.headers.get("Content-Length", "0")), 1_000_000)
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path == "/api/duco/health":
            return self.send_json(200, {"service": "duco-admin"})
        if path == "/api/duco/web":
            # Consulta limitada a duoc.cl (sitemaps oficiales); no usa la base de datos y falla en silencio.
            query = (parse_qs(parsed.query).get("q") or [""])[0][:300]
            try:
                return self.send_json(200, web_lookup.lookup(query))
            except Exception as error:
                return self.send_json(200, {"results": [], "reason": str(error)[:120]})
        if path in {"/api/duco/geocode", "/api/duco/route", "/api/duco/holidays"}:
            # APIs externas con servidores fijos (Nominatim, OSRM y Nager.Date): no usan la base de datos y fallan en silencio.
            args = parse_qs(parsed.query)
            first = lambda name: (args.get(name) or [""])[0]
            try:
                if path == "/api/duco/geocode":
                    return self.send_json(200, external_apis.geocode(first("q")))
                if path == "/api/duco/route":
                    return self.send_json(200, external_apis.route(float(first("fromLat")), float(first("fromLng")), float(first("toLat")), float(first("toLng"))))
                return self.send_json(200, external_apis.holidays(int(first("year") or datetime.now().year)))
            except (ValueError, TypeError):
                return self.send_json(400, {"found": False, "reason": "parametros invalidos"})
            except Exception as error:
                return self.send_json(200, {"found": False, "reason": "servicio no disponible"})
        if path in {"/", "/duco", "/duoc.html"}:
            return self.serve_project_file("duoc.html")
        if path in {"/carreras.html", "/admision.html", "/financiamiento.html", "/sedes.html", "/vida-estudiantil.html", "/nosotros.html"}:
            return self.serve_project_file(path.lstrip("/"))
        if self.is_project_asset(path):
            return self.serve_project_file(path.lstrip("/"))
        if path == "/api/auth/me":
            admin = self.current_admin()
            if not admin:
                return self.send_json(401, {"error": "Sin sesión."})
            return self.send_json(200, {"admin": {key: admin[key] for key in ("id", "name", "email", "role")}})
        # Todo lo que muestra o administra datos del panel exige sesión; las consultas del chat (experiencias, conocimiento) son públicas.
        panel_admin = None
        if path == "/api/tables" or path.startswith("/api/tables/") or path.startswith("/api/admin/") or path in {"/api/duco/proposals", "/api/duco/negative-feedback"}:
            if path == "/api/admin/users":
                roles = {auth.ROLE_ADMIN}
            elif path in {"/api/duco/proposals", "/api/duco/negative-feedback", "/api/admin/reports/audit"}:
                roles = auth.CAN_EVALUATE  # evaluar propuestas y valoraciones y ver la auditoría
            else:
                roles = None  # ver tablas y reportes: cualquier rol con sesión
            panel_admin = self.require_admin(roles)
            if panel_admin is None:
                return
        try:
            with db_session() as conn:
                if path == "/api/admin/users":
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT u.ID_ADMIN, u.NOMBRE, u.CORREO, r.NOMBRE, u.ACTIVO, u.FECHA_CREACION, u.ULTIMO_ACCESO
                            FROM USUARIOS_ADMIN u LEFT JOIN ROLES r ON r.ID_ROL = u.ID_ROL ORDER BY u.ID_ADMIN
                        """)
                        users = [{"id": row[0], "name": row[1], "email": row[2], "role": row[3], "active": bool(row[4]), "createdAt": row[5], "lastAccess": row[6]} for row in cur]
                    return self.send_json(200, {"users": users})
                if path.startswith("/api/admin/reports/"):
                    return self.send_json(200, self.admin_report(conn, path.rsplit("/", 1)[1]))
                if path == "/api/admin/schema":
                    info = schema_info(conn)
                    names = table_names(conn)
                    depth = table_depths(info, names)
                    items = []
                    for name in names:
                        module, description = split_comment(info["tableComments"].get(name, ""))
                        with conn.cursor() as cur:
                            cur.execute(f"SELECT COUNT(*) FROM {safe_ident(name)}")
                            count = cur.fetchone()[0]
                        items.append({"name": name, "module": module, "description": description, "rows": count, "depth": depth.get(name, 0)})
                    rank = {module: index for index, module in enumerate(MODULE_ORDER)}
                    items.sort(key=lambda item: (rank.get(item["module"], 99), item["depth"], item["name"]))
                    return self.send_json(200, {"tables": items, "modules": MODULE_ORDER})
                if path == "/api/tables":
                    return self.send_json(200, {"tables": table_names(conn)})
                if path == "/api/duco/experiences":
                    args = parse_qs(parsed.query)
                    return self.send_json(200, {"items": self.search_experiences(conn,
                        args.get("query", [""])[0], args.get("page", [""])[0])})
                if path == "/api/duco/knowledge":
                    query = parse_qs(parsed.query).get("query", [""])[0]
                    return self.send_json(200, {"items": self.search_knowledge(conn, query)})
                if path == "/api/duco/proposals":
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT p.ID_PROPUESTA, p.PREGUNTA, p.RESPUESTA, p.FECHA_CREACION,
                                   NVL(v.POSITIVE_VOTES, 0), NVL(v.NEGATIVE_VOTES, 0)
                            FROM PROPUESTAS_CONOCIMIENTO p
                            LEFT JOIN (
                                SELECT r.ID_PROPUESTA,
                                       COUNT(DISTINCT CASE WHEN r.PUNTUACION = 1 THEN m.ID_SESION END) POSITIVE_VOTES,
                                       COUNT(DISTINCT CASE WHEN r.PUNTUACION = -1 THEN m.ID_SESION END) NEGATIVE_VOTES
                                FROM VALORACIONES_RESPUESTA r
                                JOIN MENSAJES m ON m.ID_MENSAJE = r.ID_MENSAJE
                                WHERE r.ID_PROPUESTA IS NOT NULL
                                GROUP BY r.ID_PROPUESTA
                            ) v ON v.ID_PROPUESTA = p.ID_PROPUESTA
                            WHERE p.ESTADO = 'PENDIENTE'
                            ORDER BY p.FECHA_CREACION FETCH FIRST 500 ROWS ONLY
                        """)
                        rows = [{"id": row[0], "question": row[1], "answer": row[2], "createdAt": row[3], "positiveVotes": row[4], "negativeVotes": row[5]} for row in cur]
                    return self.send_json(200, {"proposals": rows})
                if path == "/api/duco/negative-feedback":
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT v.ID_VALORACION, q.CONTENIDO, a.CONTENIDO, a.FECHA
                            FROM VALORACIONES_RESPUESTA v
                            JOIN MENSAJES a ON a.ID_MENSAJE = v.ID_MENSAJE
                            JOIN MENSAJES q ON q.CLIENT_MESSAGE_ID =
                                SUBSTR(a.CLIENT_MESSAGE_ID, 1, LENGTH(a.CLIENT_MESSAGE_ID) - 10) || ':user'
                            WHERE v.PUNTUACION = -1 AND v.ESTADO_REVISION = 'PENDIENTE'
                            ORDER BY a.FECHA DESC FETCH FIRST 100 ROWS ONLY
                        """)
                        rows = [{"id": row[0], "question": row[1], "answer": row[2], "createdAt": row[3]} for row in cur]
                    return self.send_json(200, {"feedback": rows})
                match = re.fullmatch(r"/api/tables/([A-Za-z0-9_$#]+)/rows", path)
                if match:
                    meta = table_meta(conn, match.group(1))
                    qtable = safe_ident(meta["name"])
                    order, order_label = self.row_order(meta)
                    info = schema_info(conn)
                    docs = describe_table(conn, meta, info)
                    query_args = parse_qs(parsed.query)
                    term = (query_args.get("q") or [""])[0]
                    only_column = ((query_args.get("col") or [""])[0] or "").upper() or None
                    where, binds = search_clause(conn, meta, term, only_column)
                    with conn.cursor() as cur:
                        cur.execute(f"SELECT COUNT(*) FROM {qtable}")
                        table_total = cur.fetchone()[0]
                        cur.execute(f"SELECT COUNT(*) FROM {qtable}{where}", binds)
                        total = cur.fetchone()[0]
                        cur.execute(f"SELECT * FROM {qtable}{where} ORDER BY {order} FETCH FIRST 200 ROWS ONLY", binds)
                        names = [col[0] for col in cur.description]
                        rows = [dict(zip(names, row)) for row in cur]
                    for row in rows:
                        for hidden in HIDDEN_COLUMNS & set(row):
                            if row[hidden] is not None:
                                row[hidden] = "•••• (oculto)"
                    return self.send_json(200, {"meta": meta, "rows": rows, "limit": 200, "orderedBy": order_label, "total": total, "tableTotal": table_total,
                                                "query": term.strip()[:100], "column": only_column,
                                                "docs": docs, "displayOrder": display_order(meta), "labels": foreign_labels(conn, meta, rows)})
            self.send_json(404, {"error": "Ruta no encontrada"})
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})

    def do_POST(self):
        path = unquote(urlparse(self.path).path)
        if path == "/api/auth/login":
            try:
                payload = self.body_json()
                email = str(payload.get("email", "")).strip().lower()[:180]
                password = str(payload.get("password", ""))[:200]
                key = f"{self.client_address[0]}|{email}"
                wait = auth.throttle.wait_seconds(key)
                if wait:
                    return self.send_json(429, {"error": f"Demasiados intentos fallidos. Espera {wait} segundos."})
                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("""
                        SELECT u.ID_ADMIN, u.NOMBRE, u.CLAVE_HASH, u.ACTIVO, r.NOMBRE
                        FROM USUARIOS_ADMIN u LEFT JOIN ROLES r ON r.ID_ROL = u.ID_ROL
                        WHERE LOWER(u.CORREO) = :email
                    """, email=email)
                    row = cur.fetchone()
                    valid = auth.verify_or_dummy(password, row[2] if row else None) and bool(row) and bool(row[3])
                    if not valid:
                        auth.throttle.failed(key)
                        log_event(cur, f"ADMIN_LOGIN_FALLIDO:{email}")
                        conn.commit()
                        return self.send_json(401, {"error": "Correo o contraseña incorrectos."})
                    token = auth.new_token()
                    cur.execute("""
                        INSERT INTO SESIONES_ADMIN (ID_ADMIN, FECHA_INICIO, TOKEN_HASH, FECHA_EXPIRA, DIRECCION_IP)
                        VALUES (:admin_id, CURRENT_TIMESTAMP, :token_hash, CURRENT_TIMESTAMP + NUMTODSINTERVAL(:hours, 'HOUR'), :ip)
                    """, {"admin_id": row[0], "token_hash": auth.token_hash(token), "hours": auth.SESSION_HOURS, "ip": self.client_address[0][:45]})
                    cur.execute("UPDATE USUARIOS_ADMIN SET ULTIMO_ACCESO = CURRENT_TIMESTAMP WHERE ID_ADMIN = :admin_id", admin_id=row[0])
                    log_event(cur, f"ADMIN_LOGIN:{email}")
                    conn.commit()
                auth.throttle.succeeded(key)
                cookie = f"{auth.COOKIE_NAME}={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={auth.SESSION_HOURS * 3600}"
                return self.send_json(200, {"admin": {"id": row[0], "name": row[1], "email": email, "role": row[4]}}, {"Set-Cookie": cookie})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        if path == "/api/auth/logout":
            token = auth.parse_cookie(self.headers.get("Cookie"))
            if token:
                try:
                    with db_session() as conn, conn.cursor() as cur:
                        cur.execute("UPDATE SESIONES_ADMIN SET FECHA_FIN = CURRENT_TIMESTAMP WHERE TOKEN_HASH = :h AND FECHA_FIN IS NULL", h=auth.token_hash(token))
                        conn.commit()
                except Exception:
                    pass
            return self.send_json(200, {"ok": True}, {"Set-Cookie": f"{auth.COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"})

        if path == "/api/auth/password":
            admin = self.require_admin()
            if admin is None:
                return
            try:
                payload = self.body_json()
                current, new = str(payload.get("current", "")), str(payload.get("new", ""))
                problem = auth.password_problem(new)
                if problem:
                    raise ValueError(problem)
                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("SELECT CLAVE_HASH FROM USUARIOS_ADMIN WHERE ID_ADMIN = :id", id=admin["id"])
                    if not auth.verify_password(current, cur.fetchone()[0]):
                        raise ValueError("La contraseña actual no es correcta.")
                    cur.execute("UPDATE USUARIOS_ADMIN SET CLAVE_HASH = :hash WHERE ID_ADMIN = :id", hash=auth.hash_password(new), id=admin["id"])
                    record_audit(cur, "USUARIOS_ADMIN", "UPDATE", admin["id"], {"campo": "CLAVE_HASH"}, {"campo": "CLAVE_HASH", "cambio": "contraseña actualizada"}, admin)
                    conn.commit()
                return self.send_json(200, {"ok": True})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        if path == "/api/admin/users":
            admin = self.require_admin({auth.ROLE_ADMIN})
            if admin is None:
                return
            try:
                payload = self.body_json()
                name = re.sub(r"\s+", " ", str(payload.get("name", ""))).strip()
                email = str(payload.get("email", "")).strip().lower()
                role = str(payload.get("role", auth.ROLE_VIEWER)).upper()
                password = str(payload.get("password", ""))
                if not 2 <= len(name) <= 120:
                    raise ValueError("El nombre debe tener entre 2 y 120 caracteres.")
                if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(email) > 180:
                    raise ValueError("El correo no es válido.")
                if role not in auth.ALL_ROLES:
                    raise ValueError("El rol debe ser ADMINISTRADOR, EVALUADOR o CONSULTA.")
                problem = auth.password_problem(password)
                if problem:
                    raise ValueError(problem)
                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("SELECT 1 FROM USUARIOS_ADMIN WHERE LOWER(CORREO) = :email", email=email)
                    if cur.fetchone():
                        raise ValueError("Ya existe un usuario con ese correo.")
                    cur.execute("SELECT ID_ROL FROM ROLES WHERE NOMBRE = :role", role=role)
                    role_id = cur.fetchone()[0]
                    new_id = cur.var(int)
                    cur.execute("""
                        INSERT INTO USUARIOS_ADMIN (ID_ROL, NOMBRE, CORREO, CLAVE_HASH) VALUES (:role_id, :name, :email, :hash)
                        RETURNING ID_ADMIN INTO :new_id
                    """, {"role_id": role_id, "name": name, "email": email, "hash": auth.hash_password(password), "new_id": new_id})
                    created = first_out(new_id)
                    record_audit(cur, "USUARIOS_ADMIN", "INSERT", created, None, {"nombre": name, "correo": email, "rol": role}, admin)
                    conn.commit()
                return self.send_json(201, {"ok": True, "id": created})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        user_active = re.fullmatch(r"/api/admin/users/(\d+)/active", path)
        if user_active:
            admin = self.require_admin({auth.ROLE_ADMIN})
            if admin is None:
                return
            try:
                target, active = int(user_active.group(1)), 1 if self.body_json().get("active") else 0
                if target == admin["id"] and not active:
                    raise ValueError("No puedes desactivar tu propio usuario.")
                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("SELECT ACTIVO FROM USUARIOS_ADMIN WHERE ID_ADMIN = :id FOR UPDATE", id=target)
                    row = cur.fetchone()
                    if not row:
                        raise ValueError("El usuario no existe.")
                    cur.execute("UPDATE USUARIOS_ADMIN SET ACTIVO = :a WHERE ID_ADMIN = :id", a=active, id=target)
                    if not active:
                        cur.execute("UPDATE SESIONES_ADMIN SET FECHA_FIN = CURRENT_TIMESTAMP WHERE ID_ADMIN = :id AND FECHA_FIN IS NULL", id=target)
                    record_audit(cur, "USUARIOS_ADMIN", "UPDATE", target, {"activo": row[0]}, {"activo": active}, admin)
                    conn.commit()
                return self.send_json(200, {"ok": True})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        if path == "/api/duco/session":
            # Registro de quien se conecta al chat: nombre (o apodo) y sesión; se actualiza la actividad en cada llamada.
            try:
                payload = self.body_json()
                session_key = str(uuid.UUID(str(payload.get("sessionId", ""))))
                user_name = clean_user_name(payload.get("userName"))
                if not user_name:
                    raise ValueError("Falta el nombre.")
                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("SELECT ID_SESION, NOMBRE_USUARIO FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID = :k", k=session_key)
                    row = cur.fetchone()
                    actor = {"name": user_name, "origin": "chat"}
                    if row:
                        cur.execute("UPDATE SESIONES_CHAT SET NOMBRE_USUARIO = :n, ULTIMA_ACTIVIDAD = CURRENT_TIMESTAMP WHERE ID_SESION = :id", n=user_name, id=row[0])
                        if row[1] != user_name:
                            record_audit(cur, "SESIONES_CHAT", "UPDATE", row[0], {"nombre_usuario": row[1]}, {"nombre_usuario": user_name}, actor)
                        session_id = row[0]
                    else:
                        out = cur.var(int)
                        cur.execute("""
                            INSERT INTO SESIONES_CHAT (FECHA_INICIO, CLIENT_SESSION_ID, NOMBRE_USUARIO, ULTIMA_ACTIVIDAD)
                            VALUES (CURRENT_TIMESTAMP, :k, :n, CURRENT_TIMESTAMP) RETURNING ID_SESION INTO :id
                        """, {"k": session_key, "n": user_name, "id": out})
                        session_id = first_out(out)
                        record_audit(cur, "SESIONES_CHAT", "INSERT", session_id, None, {"nombre_usuario": user_name}, actor)
                        log_event(cur, "SESION_CHAT_INICIADA")
                    conn.commit()
                return self.send_json(201, {"ok": True, "sessionId": session_id, "userName": user_name})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        if path == "/api/duco/ollama/ensure":
            origin = self.headers.get("Origin")
            own_origins = {f"http://{host}:{self.server.server_port}" for host in ("localhost", "127.0.0.1")}
            if origin and origin not in own_origins and not self.allowed_cors_origin():
                return self.send_json(403, {"error": "Origen no permitido"})
            result = ollama_service.ensure_running()
            return self.send_json(200 if result["online"] else 503, result)
        if path == "/api/duco/feedback":
            try:
                payload = self.body_json()
                try:
                    session_key = str(uuid.UUID(str(payload.get("sessionId", ""))))
                    interaction_key = str(uuid.UUID(str(payload.get("interactionId", ""))))
                except (ValueError, AttributeError):
                    raise ValueError("La sesión o interacción no es válida")
                question = str(payload.get("question", "")).strip()
                answer = str(payload.get("answer", "")).strip()
                rating = payload.get("rating")
                experience = self.clean_experience(payload.get("experience"))
                reusable = not is_contextual_exchange(question, answer, str(payload.get("interactionType", "")))
                if not question or len(question) > 2000 or not answer or len(answer) > 5000:
                    raise ValueError("La pregunta o respuesta no tiene una longitud válida")
                if type(rating) is not int or rating not in {-1, 1}:
                    raise ValueError("La valoración debe ser positiva o negativa")

                try:
                    user_name = clean_user_name(payload.get("userName"))
                except ValueError:
                    user_name = None

                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("SELECT ID_SESION, NOMBRE_USUARIO FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID = :session_key", session_key=session_key)
                    row = cur.fetchone()
                    if row:
                        session_id = row[0]
                        user_name = user_name or row[1]
                        if user_name and row[1] != user_name:
                            cur.execute("UPDATE SESIONES_CHAT SET NOMBRE_USUARIO = :n WHERE ID_SESION = :id", n=user_name, id=session_id)
                        cur.execute("UPDATE SESIONES_CHAT SET ULTIMA_ACTIVIDAD = CURRENT_TIMESTAMP WHERE ID_SESION = :id", id=session_id)
                    else:
                        session_out = cur.var(int)
                        cur.execute("""
                            INSERT INTO SESIONES_CHAT (FECHA_INICIO, CLIENT_SESSION_ID, NOMBRE_USUARIO, ULTIMA_ACTIVIDAD)
                            VALUES (CURRENT_TIMESTAMP, :session_key, :user_name, CURRENT_TIMESTAMP)
                            RETURNING ID_SESION INTO :session_id
                        """, {"session_key": session_key, "user_name": user_name, "session_id": session_out})
                        session_value = session_out.getvalue()
                        session_id = session_value[0] if isinstance(session_value, list) else session_value
                        record_audit(cur, "SESIONES_CHAT", "INSERT", session_id, None, {"nombre_usuario": user_name}, {"name": user_name, "origin": "chat"})
                    chat_actor = {"name": user_name, "origin": "chat"}

                    assistant_client_id = interaction_key + ":assistant"
                    cur.execute("SELECT ID_MENSAJE, ID_SESION FROM MENSAJES WHERE CLIENT_MESSAGE_ID = :client_id", client_id=assistant_client_id)
                    existing_message = cur.fetchone()
                    if existing_message:
                        if existing_message[1] != session_id:
                            raise ValueError("La interacción no pertenece a esta sesión")
                        assistant_message_id = existing_message[0]
                    else:
                        cur.execute("""
                            INSERT INTO MENSAJES (ID_SESION, ROL_EMISOR, CONTENIDO, FECHA, CLIENT_MESSAGE_ID)
                            VALUES (:session_id, 'user', :question, CURRENT_TIMESTAMP, :user_client_id)
                        """, {"session_id": session_id, "question": question, "user_client_id": interaction_key + ":user"})
                        message_out = cur.var(int)
                        cur.execute("""
                            INSERT INTO MENSAJES (ID_SESION, ROL_EMISOR, CONTENIDO, FECHA, CLIENT_MESSAGE_ID)
                            VALUES (:session_id, 'assistant', :answer, CURRENT_TIMESTAMP, :assistant_client_id)
                            RETURNING ID_MENSAJE INTO :message_id
                        """, {"session_id": session_id, "answer": answer, "assistant_client_id": assistant_client_id, "message_id": message_out})
                        message_value = message_out.getvalue()
                        assistant_message_id = message_value[0] if isinstance(message_value, list) else message_value

                    cur.execute("""
                        SELECT PUNTUACION FROM VALORACIONES_RESPUESTA WHERE ID_MENSAJE = :message_id
                    """, message_id=assistant_message_id)
                    previous_rating_row = cur.fetchone()

                    approved_faq = self.find_similar_approved_faq(cur, question) if reusable else None
                    pending_proposal = self.find_similar_pending_proposal(cur, question) if reusable and not approved_faq else None
                    faq_id = approved_faq[0] if approved_faq else None
                    proposal_id = pending_proposal[0] if pending_proposal else None
                    proposal_created = False
                    proposal_status = "not_applicable"

                    synonym_audit = lambda table, action, record_id, before, after: record_audit(cur, table, action, record_id, before, after, chat_actor)
                    if not reusable:
                        proposal_status = "contextual_only"
                    elif rating > 0:
                        if approved_faq:
                            self.add_faq_synonym(cur, approved_faq[0], approved_faq[1], question, synonym_audit)
                            proposal_status = "approved_match"
                        elif pending_proposal:
                            proposal_status = "similar_exists"
                        elif len(question) > 500:
                            proposal_status = "question_too_long"
                        else:
                            proposal_out = cur.var(int)
                            cur.execute("""
                                INSERT INTO PROPUESTAS_CONOCIMIENTO (PREGUNTA, RESPUESTA)
                                VALUES (:question, :answer)
                                RETURNING ID_PROPUESTA INTO :proposal_id
                            """, {"question": question, "answer": answer, "proposal_id": proposal_out})
                            proposal_value = proposal_out.getvalue()
                            proposal_id = proposal_value[0] if isinstance(proposal_value, list) else proposal_value
                            proposal_created = True
                            proposal_status = "created"
                            record_audit(cur, "PROPUESTAS_CONOCIMIENTO", "INSERT", proposal_id, None, {"estado": "PENDIENTE", "pregunta": question}, chat_actor)
                    elif approved_faq:
                        proposal_status = "approved_match"
                    elif pending_proposal:
                        proposal_status = "similar_exists"

                    cur.execute("""
                        MERGE INTO VALORACIONES_RESPUESTA target
                        USING (SELECT :message_id ID_MENSAJE FROM DUAL) source
                        ON (target.ID_MENSAJE = source.ID_MENSAJE)
                        WHEN MATCHED THEN UPDATE SET target.PUNTUACION = :rating,
                            target.ESTADO_REVISION = CASE WHEN :rating > 0 THEN 'REVISADA' ELSE 'PENDIENTE' END,
                            target.ID_PREGUNTA_FAQ = :faq_id, target.ID_PROPUESTA = :proposal_id
                        WHEN NOT MATCHED THEN INSERT
                            (ID_MENSAJE, PUNTUACION, ESTADO_REVISION, ID_PREGUNTA_FAQ, ID_PROPUESTA)
                            VALUES (source.ID_MENSAJE, :rating,
                                CASE WHEN :rating > 0 THEN 'REVISADA' ELSE 'PENDIENTE' END,
                                :faq_id, :proposal_id)
                    """, {"message_id": assistant_message_id, "rating": rating, "faq_id": faq_id, "proposal_id": proposal_id})

                    if experience:
                        cur.setinputsizes(data_json=oracledb.DB_TYPE_CLOB)
                        cur.execute("""
                            MERGE INTO EXPERIENCIAS_ACCION target
                            USING (SELECT :message_id ID_MENSAJE FROM DUAL) source
                            ON (target.ID_MENSAJE = source.ID_MENSAJE)
                            WHEN MATCHED THEN UPDATE SET target.PAGINA=:page_path,
                                target.PETICION=:request_text, target.DATOS=:data_json, target.FECHA=CURRENT_TIMESTAMP
                            WHEN NOT MATCHED THEN INSERT (ID_MENSAJE,PAGINA,PETICION,DATOS)
                                VALUES(source.ID_MENSAJE,:page_path,:request_text,:data_json)
                        """, message_id=assistant_message_id,page_path=experience["page"],request_text=question,
                            data_json=json.dumps(experience,ensure_ascii=False))

                    # Auditoría de la valoración: alta o cambio de voto, con el registro afectado y los valores antes y después.
                    cur.execute("SELECT ID_VALORACION FROM VALORACIONES_RESPUESTA WHERE ID_MENSAJE = :message_id", message_id=assistant_message_id)
                    rating_id = cur.fetchone()[0]
                    if not previous_rating_row:
                        record_audit(cur, "VALORACIONES_RESPUESTA", "INSERT", rating_id, None, {"puntuacion": rating, "id_mensaje": assistant_message_id}, chat_actor)
                    elif previous_rating_row[0] != rating:
                        record_audit(cur, "VALORACIONES_RESPUESTA", "UPDATE", rating_id, {"puntuacion": previous_rating_row[0]}, {"puntuacion": rating}, chat_actor)
                    conn.commit()
                return self.send_json(201, {"ok": True, "proposalCreated": proposal_created, "proposalStatus": proposal_status})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        feedback_review = re.fullmatch(r"/api/duco/feedback/(\d+)/review", path)
        if feedback_review:
            admin = self.require_admin(auth.CAN_EVALUATE)
            if admin is None:
                return
            try:
                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("""
                        UPDATE VALORACIONES_RESPUESTA SET ESTADO_REVISION = 'REVISADA'
                        WHERE ID_VALORACION = :feedback_id AND PUNTUACION = -1 AND ESTADO_REVISION = 'PENDIENTE'
                    """, feedback_id=int(feedback_review.group(1)))
                    if cur.rowcount != 1:
                        raise ValueError("La valoración no existe o ya fue revisada")
                    record_audit(cur, "VALORACIONES_RESPUESTA", "UPDATE", int(feedback_review.group(1)),
                                 {"estado_revision": "PENDIENTE"}, {"estado_revision": "REVISADA"}, admin)
                    conn.commit()
                return self.send_json(200, {"ok": True})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        if path == "/api/duco/proposals":
            try:
                payload = self.body_json()
                question = str(payload.get("question", "")).strip()
                answer = str(payload.get("answer", "")).strip()
                if not question or len(question) > 500:
                    raise ValueError("La pregunta debe tener entre 1 y 500 caracteres")
                if not answer or len(answer) > 5000:
                    raise ValueError("La respuesta debe tener entre 1 y 5000 caracteres")
                try:
                    proposer = clean_user_name(payload.get("userName"))
                except ValueError:
                    proposer = None
                with db_session() as conn, conn.cursor() as cur:
                    new_proposal = cur.var(int)
                    cur.execute("""
                        INSERT INTO PROPUESTAS_CONOCIMIENTO (PREGUNTA, RESPUESTA)
                        VALUES (:question, :answer) RETURNING ID_PROPUESTA INTO :proposal_id
                    """, {"question": question, "answer": answer, "proposal_id": new_proposal})
                    record_audit(cur, "PROPUESTAS_CONOCIMIENTO", "INSERT", first_out(new_proposal), None,
                                 {"estado": "PENDIENTE", "pregunta": question}, {"name": proposer, "origin": "chat"})
                    conn.commit()
                return self.send_json(202, {"ok": True, "status": "PENDIENTE"})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        review = re.fullmatch(r"/api/duco/proposals/(\d+)/review", path)
        if review:
            admin = self.require_admin(auth.CAN_EVALUATE)
            if admin is None:
                return
            try:
                payload = self.body_json()
                decision = str(payload.get("decision", "")).upper()
                if decision not in {"APROBADA", "RECHAZADA"}:
                    raise ValueError("Decisión de revisión inválida")
                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("""
                        SELECT PREGUNTA, RESPUESTA FROM PROPUESTAS_CONOCIMIENTO
                        WHERE ID_PROPUESTA = :proposal_id AND ESTADO = 'PENDIENTE'
                        FOR UPDATE
                    """, proposal_id=int(review.group(1)))
                    proposal = cur.fetchone()
                    if not proposal:
                        raise ValueError("La propuesta no existe o ya fue revisada")
                    if decision == "APROBADA":
                        faq_out = cur.var(int)
                        cur.execute("""
                            INSERT INTO PREGUNTAS_FRECUENTES (PREGUNTA, RESPUESTA)
                            VALUES (:question, :answer)
                            RETURNING ID_PREGUNTA INTO :faq_id
                        """, {"question": proposal[0], "answer": proposal[1], "faq_id": faq_out})
                        faq_value = faq_out.getvalue()
                        faq_id = faq_value[0] if isinstance(faq_value, list) else faq_value
                        record_audit(cur, "PREGUNTAS_FRECUENTES", "INSERT", faq_id, None, {"pregunta": proposal[0], "origen": f"propuesta {int(review.group(1))}"}, admin)
                        review_audit = lambda table, action, record_id, before, after: record_audit(cur, table, action, record_id, before, after, admin)

                        cur.execute("""
                            SELECT q.CONTENIDO
                            FROM VALORACIONES_RESPUESTA r
                            JOIN MENSAJES a ON a.ID_MENSAJE = r.ID_MENSAJE
                            JOIN MENSAJES q ON q.ID_SESION = a.ID_SESION
                              AND q.CLIENT_MESSAGE_ID = SUBSTR(a.CLIENT_MESSAGE_ID, 1, LENGTH(a.CLIENT_MESSAGE_ID) - 10) || ':user'
                            WHERE r.ID_PROPUESTA = :proposal_id
                        """, proposal_id=int(review.group(1)))
                        variants = []
                        seen_variants = set()
                        for row in cur:
                            variant = str(row[0] or "").strip()
                            normalized_variant = unicodedata.normalize("NFKD", variant.lower())
                            normalized_variant = "".join(char for char in normalized_variant if not unicodedata.combining(char))
                            if normalized_variant and normalized_variant not in seen_variants:
                                seen_variants.add(normalized_variant)
                                variants.append(variant)
                        for variant in variants:
                            if variant and variant != proposal[0] and len(variant) <= 200:
                                self.add_faq_synonym(cur, faq_id, proposal[0], variant, review_audit)

                        cur.execute("""
                            UPDATE VALORACIONES_RESPUESTA
                            SET ID_PREGUNTA_FAQ = :faq_id, ID_PROPUESTA = NULL
                            WHERE ID_PROPUESTA = :proposal_id
                        """, {"faq_id": faq_id, "proposal_id": int(review.group(1))})
                    cur.execute("""
                        UPDATE PROPUESTAS_CONOCIMIENTO
                        SET ESTADO = :status, FECHA_REVISION = CURRENT_TIMESTAMP
                        WHERE ID_PROPUESTA = :proposal_id
                    """, {"status": decision, "proposal_id": int(review.group(1))})
                    record_audit(cur, "PROPUESTAS_CONOCIMIENTO", "UPDATE", int(review.group(1)),
                                 {"estado": "PENDIENTE"}, {"estado": decision}, admin)
                    conn.commit()
                return self.send_json(200, {"ok": True, "status": decision})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        match = re.fullmatch(r"/api/tables/([A-Za-z0-9_$#]+)", path)
        if not match:
            return self.send_json(404, {"error": "Ruta no encontrada"})
        admin = self.require_admin({auth.ROLE_ADMIN})
        if admin is None:
            return
        try:
            payload = self.body_json()
            with db_session() as conn:
                meta = table_meta(conn, match.group(1))
                self.ensure_writable(meta)
                values = self.clean_values(meta, payload.get("values", {}), allow_pk=True)
                if not values:
                    raise ValueError("Ingresa al menos un valor")
                columns = list(values)
                binds = {f"v{i}": normalize(values[name], self.col_type(meta, name)) for i, name in enumerate(columns)}
                names_sql = ", ".join(safe_ident(name) for name in columns)
                binds_sql = ", ".join(f":v{i}" for i in range(len(columns)))
                with conn.cursor() as cur:
                    returning, new_key = "", None
                    if len(meta["primaryKey"]) == 1:
                        key_name = meta["primaryKey"][0]
                        new_key = cur.var(oracledb.DB_TYPE_NUMBER if self.col_type(meta, key_name) == "NUMBER" else oracledb.DB_TYPE_VARCHAR)
                        binds["new_key"] = new_key
                        returning = f" RETURNING {safe_ident(key_name)} INTO :new_key"
                    cur.execute(f"INSERT INTO {safe_ident(meta['name'])} ({names_sql}) VALUES ({binds_sql}){returning}", binds)
                    created_key = first_out(new_key) if new_key is not None else None
                    if isinstance(created_key, float) and created_key.is_integer():
                        created_key = int(created_key)
                    record_audit(cur, meta["name"], "INSERT", created_key, None, values, admin)
                conn.commit()
            self.send_json(201, {"ok": True})
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})

    def do_PUT(self):
        path = unquote(urlparse(self.path).path)
        match = re.fullmatch(r"/api/tables/([A-Za-z0-9_$#]+)", path)
        if not match:
            return self.send_json(404, {"error": "Ruta no encontrada"})
        admin = self.require_admin({auth.ROLE_ADMIN})
        if admin is None:
            return
        try:
            payload = self.body_json()
            with db_session() as conn:
                meta = table_meta(conn, match.group(1))
                self.ensure_writable(meta)
                key = payload.get("key", {})
                if not all(column in key for column in meta["primaryKey"]):
                    raise ValueError("Falta la clave primaria del registro")
                values = self.clean_values(meta, payload.get("values", {}), allow_pk=False)
                if not values:
                    raise ValueError("No hay cambios para guardar")
                binds = {f"v{i}": normalize(values[name], self.col_type(meta, name)) for i, name in enumerate(values)}
                sets = ", ".join(f"{safe_ident(name)} = :v{i}" for i, name in enumerate(values))
                where_parts, key_binds = [], {}
                for i, name in enumerate(meta["primaryKey"]):
                    binds[f"k{i}"] = key_binds[f"k{i}"] = normalize(key[name], self.col_type(meta, name))
                    where_parts.append(f"{safe_ident(name)} = :k{i}")
                with conn.cursor() as cur:
                    before = self.snapshot_row(cur, meta, where_parts, key_binds)
                    cur.execute(f"UPDATE {safe_ident(meta['name'])} SET {sets} WHERE {' AND '.join(where_parts)}", binds)
                    if cur.rowcount != 1:
                        raise ValueError("No se encontró el registro")
                    record_audit(cur, meta["name"], "UPDATE", "|".join(str(key[name]) for name in meta["primaryKey"]),
                                 {name: (before or {}).get(name) for name in values}, values, admin)
                conn.commit()
            self.send_json(200, {"ok": True})
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})

    def do_DELETE(self):
        path = unquote(urlparse(self.path).path)
        match = re.fullmatch(r"/api/tables/([A-Za-z0-9_$#]+)", path)
        if not match:
            return self.send_json(404, {"error": "Ruta no encontrada"})
        admin = self.require_admin({auth.ROLE_ADMIN})
        if admin is None:
            return
        try:
            payload = self.body_json()
            with db_session() as conn:
                meta = table_meta(conn, match.group(1))
                self.ensure_writable(meta)
                key = payload.get("key", {})
                if not all(column in key for column in meta["primaryKey"]):
                    raise ValueError("Falta la clave primaria del registro")
                binds, parts = {}, []
                for i, name in enumerate(meta["primaryKey"]):
                    binds[f"k{i}"] = normalize(key[name], self.col_type(meta, name))
                    parts.append(f"{safe_ident(name)} = :k{i}")
                with conn.cursor() as cur:
                    before = self.snapshot_row(cur, meta, parts, binds)
                    cur.execute(f"DELETE FROM {safe_ident(meta['name'])} WHERE {' AND '.join(parts)}", binds)
                    if cur.rowcount != 1:
                        raise ValueError("No se encontró el registro")
                    record_audit(cur, meta["name"], "DELETE", "|".join(str(key[name]) for name in meta["primaryKey"]), before, None, admin)
                conn.commit()
            self.send_json(200, {"ok": True})
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})

    @staticmethod
    def ensure_writable(meta: dict) -> None:
        """La auditoría, las sesiones y los usuarios no se editan a mano: la auditoría es solo de lectura y las claves se guardan con hash."""
        if meta["name"] in READ_ONLY_TABLES:
            raise ValueError(f"{meta['name']} es de solo lectura en el visor. " + (
                "Los usuarios se gestionan desde «Usuarios»." if meta["name"] == "USUARIOS_ADMIN" else "Es un registro que no debe alterarse."))

    @staticmethod
    def snapshot_row(cur, meta: dict, where_parts: list[str], binds: dict) -> dict | None:
        """Estado actual de una fila (para guardar en la auditoría lo que había antes de cambiarla o borrarla)."""
        key_binds = {name: value for name, value in binds.items() if name.startswith("k")}
        cur.execute(f"SELECT * FROM {safe_ident(meta['name'])} WHERE {' AND '.join(where_parts)}", key_binds)
        row = cur.fetchone()
        return dict(zip([col[0] for col in cur.description], row)) if row else None

    @staticmethod
    def row_order(meta: dict) -> tuple[str, str]:
        """Orden del visor: lo más reciente primero (por fecha de creación si la tabla la tiene y, si no, por clave primaria)."""
        names = [col["name"] for col in meta["columns"]]
        parts, labels = [], []
        for candidate in ("FECHA_CREACION", "FECHA", "FECHA_INICIO"):
            if candidate in names:
                parts.append(f"{safe_ident(candidate)} DESC NULLS LAST")
                labels.append(candidate)
                break
        for key in meta["primaryKey"]:
            parts.append(f"{safe_ident(key)} DESC")
            labels.append(key)
        return ", ".join(parts), " y ".join(labels) + " (más reciente primero)"

    def admin_report(self, conn, kind: str) -> dict:
        """Reportes de apoyo para revisar la base: resumen por tabla, últimos registros y auditoría reciente."""
        if kind == "summary":
            items = []
            for name in table_names(conn):
                meta = table_meta(conn, name)
                date_col = next((c for c in ("FECHA_CREACION", "FECHA", "FECHA_INICIO") if c in [col["name"] for col in meta["columns"]]), None)
                numeric_pk = meta["primaryKey"][0] if len(meta["primaryKey"]) == 1 and self.col_type(meta, meta["primaryKey"][0]) == "NUMBER" else None
                with conn.cursor() as cur:
                    cur.execute(f"SELECT COUNT(*), {('MAX(' + safe_ident(date_col) + ')') if date_col else 'NULL'}, "
                                f"{('MAX(' + safe_ident(numeric_pk) + ')') if numeric_pk else 'NULL'} FROM {safe_ident(name)}")
                    count, last_date, last_id = cur.fetchone()
                items.append({"table": name, "rows": count, "dateColumn": date_col, "lastCreated": last_date, "lastId": last_id})
            return {"tables": items}
        if kind == "latest":
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT * FROM (
                        SELECT s.ID_SESION, s.NOMBRE_USUARIO, s.FECHA_INICIO, s.ULTIMA_ACTIVIDAD,
                               (SELECT COUNT(*) FROM MENSAJES m WHERE m.ID_SESION = s.ID_SESION)
                        FROM SESIONES_CHAT s ORDER BY s.FECHA_INICIO DESC) WHERE ROWNUM <= 20
                """)
                sessions = [{"id": r[0], "userName": r[1], "startedAt": r[2], "lastActivity": r[3], "messages": r[4]} for r in cur]
                cur.execute("""
                    SELECT * FROM (
                        SELECT m.ID_MENSAJE, m.ID_SESION, s.NOMBRE_USUARIO, m.ROL_EMISOR, SUBSTR(m.CONTENIDO, 1, 160), m.FECHA
                        FROM MENSAJES m LEFT JOIN SESIONES_CHAT s ON s.ID_SESION = m.ID_SESION ORDER BY m.FECHA DESC, m.ID_MENSAJE DESC) WHERE ROWNUM <= 20
                """)
                messages = [{"id": r[0], "sessionId": r[1], "userName": r[2], "role": r[3], "text": r[4], "date": r[5]} for r in cur]
                cur.execute("""
                    SELECT * FROM (SELECT ID_VALORACION, ID_MENSAJE, PUNTUACION, ESTADO_REVISION, FECHA_CREACION
                                   FROM VALORACIONES_RESPUESTA ORDER BY FECHA_CREACION DESC NULLS LAST, ID_VALORACION DESC) WHERE ROWNUM <= 20
                """)
                ratings = [{"id": r[0], "messageId": r[1], "score": r[2], "status": r[3], "createdAt": r[4]} for r in cur]
            return {"sessions": sessions, "messages": messages, "ratings": ratings}
        if kind == "audit":
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT * FROM (
                        SELECT a.ID_CAMBIO, a.FECHA, a.TABLA_AFECTADA, a.ACCION, a.ID_REGISTRO,
                               NVL(u.NOMBRE, a.NOMBRE_ACTOR), a.ORIGEN, SUBSTR(a.VALOR_ANTERIOR, 1, 400), SUBSTR(a.VALOR_NUEVO, 1, 400)
                        FROM AUDITORIA_CAMBIOS a LEFT JOIN USUARIOS_ADMIN u ON u.ID_ADMIN = a.ID_ADMIN
                        ORDER BY a.FECHA DESC, a.ID_CAMBIO DESC) WHERE ROWNUM <= 100
                """)
                entries = [{"id": r[0], "date": r[1], "table": r[2], "action": r[3], "recordId": r[4], "actor": r[5], "origin": r[6], "before": r[7], "after": r[8]} for r in cur]
            return {"audit": entries}
        raise ValueError("Reporte desconocido")

    @staticmethod
    def col_type(meta: dict, name: str) -> str:
        return next(col["type"] for col in meta["columns"] if col["name"] == name)

    @staticmethod
    def clean_values(meta: dict, values: dict, allow_pk: bool) -> dict:
        if not isinstance(values, dict):
            raise ValueError("Los datos del formulario no son válidos")
        known = {col["name"] for col in meta["columns"]}
        identity = {col["name"] for col in meta["columns"] if col["identity"]}
        pk = set(meta["primaryKey"])
        unknown = set(values) - known
        if unknown:
            raise ValueError("Se recibieron columnas desconocidas")
        if set(values) & identity or (not allow_pk and set(values) & pk):
            raise ValueError("No se puede modificar una clave generada o clave primaria")
        return values

    @staticmethod
    def is_project_asset(path: str) -> bool:
        parts = Path(path.lstrip("/")).parts
        return bool(parts) and parts[0] in {"js", "css", "dibujos", "duoc_files", "assets", "carreras-detalle"} and all(
            part not in {".", ".."} and not part.startswith(".") for part in parts
        )

    def serve_project_file(self, relative_path: str):
        project_root = ROOT.parent.resolve()
        target = (project_root / relative_path).resolve()
        if project_root not in target.parents and target != project_root:
            return self.send_json(403, {"error": "Ruta no permitida"})
        if not target.is_file():
            return self.send_json(404, {"error": "Archivo no encontrado"})
        content = target.read_bytes()
        content_type, _ = mimetypes.guess_type(target.name)
        if target.suffix == ".descarga" and target.parent.name == "duoc_files":
            content_type = "text/javascript"
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type or 'application/octet-stream'}; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(content)

    @staticmethod
    def clean_experience(data):
        if not isinstance(data, dict):
            return None
        page = str(data.get("page", ""))[:500]
        if not page.startswith("/") or page.startswith("//"):
            raise ValueError("Página de experiencia inválida")
        if data.get("origin") == "legacy":
            # El registro conserva solo la conversación; no inventar pasos ni página.
            response = str(data.get("recordedResponse", ""))[:5000]
            if not response:
                return None
            return {"origin":"legacy", "page":"/__unknown__", "steps":[],
                "recordedResponse":response, "executionKnown":False}
        allowed = {"navigate", "dropdown", "closeDropdown", "highlightTerms", "showEvidence", "selectPageControl", "clickControl", "explainCareer", "clearHighlights", "scroll"}
        steps = []
        for step in (data.get("steps") or [])[:20]:
            if not isinstance(step, dict) or step.get("type") not in allowed:
                continue
            steps.append({"type":step["type"], "terms":[str(t)[:200] for t in (step.get("terms") or [])[:6]],
                "success":step.get("success") is True, "detail":str(step.get("detail", ""))[:220],
                "page":str(step.get("page", page))[:500]})
        if not steps:
            return None
        correction = data.get("correction") if isinstance(data.get("correction"),dict) else {}
        return {"page":page,"steps":steps,"correction":{"message":str(correction.get("message", ""))[:2000],"goal":str(correction.get("goal", ""))[:2000],"constraints":[str(item)[:300] for item in (correction.get("constraints") or [])[:5]]},"evidenceTexts":[str(t)[:800] for t in (data.get("evidenceTexts") or [])[:8]]}

    @classmethod
    def search_experiences(cls, conn, query, page):
        # La página debe ser el origen o uno de los pasos ejecutados de la experiencia.
        candidates = {}
        with conn.cursor() as cur:
            cur.execute("""
                SELECT e.PETICION,e.DATOS,v.PUNTUACION,m.ID_SESION
                FROM EXPERIENCIAS_ACCION e
                JOIN VALORACIONES_RESPUESTA v ON v.ID_MENSAJE=e.ID_MENSAJE
                JOIN MENSAJES m ON m.ID_MENSAJE=e.ID_MENSAJE
                WHERE (JSON_VALUE(e.DATOS, '$.origin')='legacy' OR e.PAGINA=:page_path OR JSON_EXISTS(e.DATOS, '$.steps[*]?(@.page == $page)' PASSING :page_path AS "page"))
                ORDER BY e.FECHA DESC FETCH FIRST 200 ROWS ONLY
            """,page_path=str(page)[:500])
            for request, raw, rating, session_id in cur:
                score = cls.question_similarity(str(query)[:2000], request)
                if score < 0.35:
                    continue
                data = cls.clean_experience(json.loads(str(raw)))
                if not data:
                    continue
                key = json.dumps(data,sort_keys=True,ensure_ascii=False)
                item = candidates.setdefault(key,{"request":request,"experience":data,"score":score,"positive":set(),"negative":set()})
                item["score"] = max(item["score"],score)
                item["positive" if rating > 0 else "negative"].add(session_id)
        ranked = sorted(candidates.values(),key=lambda item:(item["score"],item["experience"].get("origin")!="legacy",len(item["positive"])+len(item["negative"])),reverse=True)[:5]
        return [{"request":item["request"],"experience":item["experience"],
            "positive":len(item["positive"]),"negative":len(item["negative"]),
            "verifiedSuccess":item["experience"].get("origin")!="legacy" and bool(item["experience"]["steps"]) and bool(item["positive"]) and not item["negative"] and all(step["success"] for step in item["experience"]["steps"])} for item in ranked]

    @staticmethod
    def search_knowledge(conn, query: str) -> list[dict]:
        query = str(query or "").strip()[:500]
        normalized = unicodedata.normalize("NFKD", query.lower())
        normalized = "".join(char for char in normalized if not unicodedata.combining(char))
        tokens = [word for word in re.findall(r"[a-z0-9]{3,}", normalized)
                  if word not in {"que", "como", "para", "por", "con", "una", "uno", "las", "los", "del", "donde", "esta", "este", "hay", "quiero", "puede", "puedes"}]
        if not tokens:
            return []

        candidates: list[dict] = []
        with conn.cursor() as cur:
            cur.execute("""
                SELECT f.ID_PREGUNTA, f.PREGUNTA, f.RESPUESTA, c.NOMBRE
                FROM PREGUNTAS_FRECUENTES f
                LEFT JOIN CATEGORIAS_FAQ c ON c.ID_CATEGORIA = f.ID_CATEGORIA
                FETCH FIRST 500 ROWS ONLY
            """)
            faq_rows = list(cur)
            synonyms: dict[int, list[str]] = {}
            cur.execute("SELECT ID_PREGUNTA, TEXTO FROM SINONIMOS_CONSULTA")
            for faq_id, synonym in cur:
                synonyms.setdefault(int(faq_id), []).append(str(synonym or ""))
            for faq_id, question, answer, category in faq_rows:
                candidates.append({"type": "faq", "question": question or "", "answer": str(answer or ""), "category": category or "", "synonyms": synonyms.get(int(faq_id), []), "_faq_id": int(faq_id)})
            cur.execute("""
                SELECT PREGUNTA, RESPUESTA FROM PROPUESTAS_CONOCIMIENTO
                WHERE ESTADO = 'APROBADA' FETCH FIRST 500 ROWS ONLY
            """)
            for question, answer in cur:
                candidates.append({"type": "faq", "question": question or "", "answer": str(answer or ""), "category": "Conocimiento revisado"})
            cur.execute("""
                SELECT p.TITULO, p.RUTA, s.TITULO, e.URL_DESTINO
                FROM PAGINAS_WEB p
                LEFT JOIN SECCIONES_WEB s ON s.ID_PAGINA = p.ID_PAGINA
                LEFT JOIN ENLACES_SECCION e ON e.ID_SECCION = s.ID_SECCION
                FETCH FIRST 500 ROWS ONLY
            """)
            for page, route, section, destination in cur:
                links = [value for value in (destination, route) if value and (
                    str(value).startswith("/") and not str(value).startswith("//") or
                    str(value).startswith("https://") or str(value).startswith("http://")
                )]
                candidates.append({"type": "page", "title": page or "", "section": section or "", "links": list(dict.fromkeys(links))})

        def normalized_text(value: str) -> str:
            value = unicodedata.normalize("NFKD", str(value).lower())
            return "".join(char for char in value if not unicodedata.combining(char))

        ranked = []
        phrase = normalized_text(query)
        for item in candidates:
            # Filtrar también registros antiguos que ya fueron aprobados.
            if item.get("type") == "faq" and is_contextual_exchange(item.get("question", ""), item.get("answer", "")):
                continue
            fields = [item.get("question", "") * 3, item.get("answer", ""), item.get("category", ""), " ".join(item.get("synonyms", [])) * 2, item.get("title", ""), item.get("section", ""), " ".join(item.get("links", []))]
            text = normalized_text(" ".join(fields))
            score = sum(text.count(token) for token in set(tokens))
            if item.get("question") and phrase and phrase in normalized_text(item["question"]):
                score += 3
            if score:
                ranked.append((score, item))
        ranked.sort(key=lambda result: result[0], reverse=True)
        results = [item for _, item in ranked[:8]]
        faq_ids = list(dict.fromkeys(item["_faq_id"] for item in results if item.get("_faq_id")))
        if faq_ids:
            binds = {f"faq_id_{index}": faq_id for index, faq_id in enumerate(faq_ids)}
            placeholders = ", ".join(f":faq_id_{index}" for index in range(len(faq_ids)))
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT r.ID_PREGUNTA_FAQ,
                           COUNT(DISTINCT CASE WHEN r.PUNTUACION = 1 THEN m.ID_SESION END) POSITIVE_VOTES,
                           COUNT(DISTINCT CASE WHEN r.PUNTUACION = -1 THEN m.ID_SESION END) NEGATIVE_VOTES
                    FROM VALORACIONES_RESPUESTA r
                    JOIN MENSAJES m ON m.ID_MENSAJE = r.ID_MENSAJE
                    WHERE r.ID_PREGUNTA_FAQ IN ({placeholders})
                    GROUP BY r.ID_PREGUNTA_FAQ
                """, binds)
                vote_counts = {int(row[0]): {"positive": int(row[1]), "negative": int(row[2])} for row in cur}
            for item in results:
                faq_id = item.pop("_faq_id", None)
                if faq_id is not None:
                    item["communityFeedback"] = vote_counts.get(faq_id, {"positive": 0, "negative": 0})
        return results

    @staticmethod
    def question_terms(value: str) -> set[str]:
        ignored = {"que", "como", "para", "por", "con", "una", "uno", "las", "los", "del", "donde", "esta", "este", "hay", "cual", "cuales", "quien", "cuando"}
        normalized = unicodedata.normalize("NFKD", str(value or "").lower())
        normalized = "".join(char for char in normalized if not unicodedata.combining(char))
        return {word for word in re.findall(r"[a-z0-9]{3,}", normalized) if word not in ignored}

    @classmethod
    def question_similarity(cls, left: str, right: str) -> float:
        incoming = cls.question_terms(left)
        existing = cls.question_terms(right)
        if not incoming or not existing:
            return 0.0
        return len(incoming & existing) / min(len(incoming), len(existing))

    @classmethod
    def find_similar_approved_faq(cls, cursor, question: str):
        incoming = cls.question_terms(question)
        if not incoming:
            return None

        cursor.execute("SELECT ID_PREGUNTA, PREGUNTA FROM PREGUNTAS_FRECUENTES FETCH FIRST 1000 ROWS ONLY")
        faqs = list(cursor)
        cursor.execute("SELECT ID_PREGUNTA, TEXTO FROM SINONIMOS_CONSULTA")
        synonyms = {}
        for faq_id, text in cursor:
            synonyms.setdefault(int(faq_id), []).append(str(text or ""))

        best = None
        best_score = 0.8
        for faq_id, canonical_question in faqs:
            for candidate in [canonical_question or "", *synonyms.get(int(faq_id), [])]:
                score = cls.question_similarity(question, candidate)
                if score >= best_score:
                    best = (int(faq_id), str(canonical_question or ""))
                    best_score = score
        return best

    @classmethod
    def find_similar_pending_proposal(cls, cursor, question: str):
        if not cls.question_terms(question):
            return None
        cursor.execute("""
            SELECT ID_PROPUESTA, PREGUNTA FROM PROPUESTAS_CONOCIMIENTO
            WHERE ESTADO = 'PENDIENTE' FETCH FIRST 1000 ROWS ONLY
        """)
        best = None
        best_score = 0.8
        for proposal_id, known_question in cursor:
            score = cls.question_similarity(question, known_question or "")
            if score >= best_score:
                best = (int(proposal_id), str(known_question or ""))
                best_score = score
        return best

    @classmethod
    def add_faq_synonym(cls, cursor, faq_id: int, canonical_question: str, variant: str, auditor=None) -> bool:
        if len(variant) > 200:
            return False

        def normalized(value: str) -> str:
            text = unicodedata.normalize("NFKD", str(value or "").lower())
            return "".join(char for char in text if not unicodedata.combining(char)).strip()

        variant_key = normalized(variant)
        if not variant_key or variant_key == normalized(canonical_question):
            return False
        cursor.execute("SELECT TEXTO FROM SINONIMOS_CONSULTA WHERE ID_PREGUNTA = :faq_id", faq_id=faq_id)
        if any(normalized(row[0]) == variant_key for row in cursor):
            return False
        synonym_id = cursor.var(int)
        cursor.execute("INSERT INTO SINONIMOS_CONSULTA (ID_PREGUNTA, TEXTO) VALUES (:faq_id, :text) RETURNING ID_SINONIMO INTO :synonym_id",
                       {"faq_id": faq_id, "text": variant, "synonym_id": synonym_id})
        if auditor:
            auditor("SINONIMOS_CONSULTA", "INSERT", first_out(synonym_id), None, {"id_pregunta": faq_id, "texto": variant})
        return True

    @classmethod
    def similar_question_exists(cls, cursor, question: str) -> bool:
        if cls.find_similar_approved_faq(cursor, question) or cls.find_similar_pending_proposal(cursor, question):
            return True
        cursor.execute("SELECT PREGUNTA FROM PROPUESTAS_CONOCIMIENTO WHERE ESTADO = 'APROBADA' FETCH FIRST 1000 ROWS ONLY")
        return any(cls.question_similarity(question, row[0] or "") >= 0.8 for row in cursor)


def main():
    port = int(os.getenv("ADMIN_PORT", "8765"))
    host = os.getenv("ADMIN_HOST", "127.0.0.1")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Duco Admin disponible en http://{host}:{port}")
    print("Usa Ctrl+C para cerrar.")
    web_lookup.warm_async()  # carga en segundo plano el indice de duoc.cl para la consulta web limitada
    try:
        status = ollama_service.ensure_running()
        print("Ollama disponible." if status["online"] else status["error"])
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCerrando Duco Admin…")
    finally:
        server.server_close()
        ollama_service.close()


if __name__ == "__main__":
    main()
