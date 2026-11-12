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


class Handler(BaseHTTPRequestHandler):
    server_version = "DucoAdmin/1.0"

    def log_message(self, format, *args):
        print("[Duco Admin]", format % args)

    def send_json(self, status: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
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
        if path == "/" or path == "/index.html":
            return self.serve_index()
        if path in {"/duco", "/duoc.html"}:
            return self.serve_project_file("duoc.html")
        if path == "/carreras.html":
            return self.serve_project_file("carreras.html")
        if self.is_project_asset(path):
            return self.serve_project_file(path.lstrip("/"))
        try:
            with db_session() as conn:
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
                    with conn.cursor() as cur:
                        cur.execute(f"SELECT * FROM {qtable} FETCH FIRST 200 ROWS ONLY")
                        names = [col[0] for col in cur.description]
                        rows = [dict(zip(names, row)) for row in cur]
                    return self.send_json(200, {"meta": meta, "rows": rows, "limit": 200})
            self.send_json(404, {"error": "Ruta no encontrada"})
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})

    def do_POST(self):
        path = unquote(urlparse(self.path).path)
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

                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("SELECT ID_SESION FROM SESIONES_CHAT WHERE CLIENT_SESSION_ID = :session_key", session_key=session_key)
                    row = cur.fetchone()
                    if row:
                        session_id = row[0]
                    else:
                        session_out = cur.var(int)
                        cur.execute("""
                            INSERT INTO SESIONES_CHAT (FECHA_INICIO, CLIENT_SESSION_ID)
                            VALUES (CURRENT_TIMESTAMP, :session_key)
                            RETURNING ID_SESION INTO :session_id
                        """, {"session_key": session_key, "session_id": session_out})
                        session_value = session_out.getvalue()
                        session_id = session_value[0] if isinstance(session_value, list) else session_value

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

                    if not reusable:
                        proposal_status = "contextual_only"
                    elif rating > 0:
                        if approved_faq:
                            self.add_faq_synonym(cur, approved_faq[0], approved_faq[1], question)
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

                    # Si cambia el voto, registrar el ajuste como evento de auditoría.
                    if previous_rating_row and previous_rating_row[0] != rating:
                        cur.execute("""
                            INSERT INTO AUDITORIA_CAMBIOS (TABLA_AFECTADA, FECHA)
                            VALUES ('VALORACIONES_RESPUESTA:ACTUALIZADA', CURRENT_TIMESTAMP)
                        """)
                    conn.commit()
                return self.send_json(201, {"ok": True, "proposalCreated": proposal_created, "proposalStatus": proposal_status})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        feedback_review = re.fullmatch(r"/api/duco/feedback/(\d+)/review", path)
        if feedback_review:
            try:
                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("""
                        UPDATE VALORACIONES_RESPUESTA SET ESTADO_REVISION = 'REVISADA'
                        WHERE ID_VALORACION = :feedback_id AND PUNTUACION = -1 AND ESTADO_REVISION = 'PENDIENTE'
                    """, feedback_id=int(feedback_review.group(1)))
                    if cur.rowcount != 1:
                        raise ValueError("La valoración no existe o ya fue revisada")
                    cur.execute("""
                        INSERT INTO AUDITORIA_CAMBIOS (TABLA_AFECTADA, FECHA)
                        VALUES ('VALORACIONES_RESPUESTA', CURRENT_TIMESTAMP)
                    """)
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
                with db_session() as conn, conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO PROPUESTAS_CONOCIMIENTO (PREGUNTA, RESPUESTA)
                        VALUES (:question, :answer)
                    """, {"question": question, "answer": answer})
                    conn.commit()
                return self.send_json(202, {"ok": True, "status": "PENDIENTE"})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        review = re.fullmatch(r"/api/duco/proposals/(\d+)/review", path)
        if review:
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
                                self.add_faq_synonym(cur, faq_id, proposal[0], variant)

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
                    cur.execute("""
                        INSERT INTO AUDITORIA_CAMBIOS (TABLA_AFECTADA, FECHA)
                        VALUES (:event, CURRENT_TIMESTAMP)
                    """, event=f"PROPUESTAS_CONOCIMIENTO:{decision}")
                    conn.commit()
                return self.send_json(200, {"ok": True, "status": decision})
            except Exception as exc:
                return self.send_json(400, {"error": str(exc)})

        match = re.fullmatch(r"/api/tables/([A-Za-z0-9_$#]+)", path)
        if not match:
            return self.send_json(404, {"error": "Ruta no encontrada"})
        try:
            payload = self.body_json()
            with db_session() as conn:
                meta = table_meta(conn, match.group(1))
                values = self.clean_values(meta, payload.get("values", {}), allow_pk=True)
                if not values:
                    raise ValueError("Ingresa al menos un valor")
                columns = list(values)
                binds = {f"v{i}": normalize(values[name], self.col_type(meta, name)) for i, name in enumerate(columns)}
                names_sql = ", ".join(safe_ident(name) for name in columns)
                binds_sql = ", ".join(f":v{i}" for i in range(len(columns)))
                with conn.cursor() as cur:
                    cur.execute(f"INSERT INTO {safe_ident(meta['name'])} ({names_sql}) VALUES ({binds_sql})", binds)
                conn.commit()
            self.send_json(201, {"ok": True})
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})

    def do_PUT(self):
        path = unquote(urlparse(self.path).path)
        match = re.fullmatch(r"/api/tables/([A-Za-z0-9_$#]+)", path)
        if not match:
            return self.send_json(404, {"error": "Ruta no encontrada"})
        try:
            payload = self.body_json()
            with db_session() as conn:
                meta = table_meta(conn, match.group(1))
                key = payload.get("key", {})
                if not all(column in key for column in meta["primaryKey"]):
                    raise ValueError("Falta la clave primaria del registro")
                values = self.clean_values(meta, payload.get("values", {}), allow_pk=False)
                if not values:
                    raise ValueError("No hay cambios para guardar")
                binds = {f"v{i}": normalize(values[name], self.col_type(meta, name)) for i, name in enumerate(values)}
                sets = ", ".join(f"{safe_ident(name)} = :v{i}" for i, name in enumerate(values))
                where_parts = []
                for i, name in enumerate(meta["primaryKey"]):
                    binds[f"k{i}"] = normalize(key[name], self.col_type(meta, name))
                    where_parts.append(f"{safe_ident(name)} = :k{i}")
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE {safe_ident(meta['name'])} SET {sets} WHERE {' AND '.join(where_parts)}", binds)
                    if cur.rowcount != 1:
                        raise ValueError("No se encontró el registro")
                conn.commit()
            self.send_json(200, {"ok": True})
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})

    def do_DELETE(self):
        path = unquote(urlparse(self.path).path)
        match = re.fullmatch(r"/api/tables/([A-Za-z0-9_$#]+)", path)
        if not match:
            return self.send_json(404, {"error": "Ruta no encontrada"})
        try:
            payload = self.body_json()
            with db_session() as conn:
                meta = table_meta(conn, match.group(1))
                key = payload.get("key", {})
                if not all(column in key for column in meta["primaryKey"]):
                    raise ValueError("Falta la clave primaria del registro")
                binds, parts = {}, []
                for i, name in enumerate(meta["primaryKey"]):
                    binds[f"k{i}"] = normalize(key[name], self.col_type(meta, name))
                    parts.append(f"{safe_ident(name)} = :k{i}")
                with conn.cursor() as cur:
                    cur.execute(f"DELETE FROM {safe_ident(meta['name'])} WHERE {' AND '.join(parts)}", binds)
                    if cur.rowcount != 1:
                        raise ValueError("No se encontró el registro")
                conn.commit()
            self.send_json(200, {"ok": True})
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})

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

    def serve_index(self):
        content = (ROOT / "index.html").read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

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
    def add_faq_synonym(cls, cursor, faq_id: int, canonical_question: str, variant: str) -> bool:
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
        cursor.execute("INSERT INTO SINONIMOS_CONSULTA (ID_PREGUNTA, TEXTO) VALUES (:faq_id, :text)",
                       {"faq_id": faq_id, "text": variant})
        return True

    @classmethod
    def similar_question_exists(cls, cursor, question: str) -> bool:
        if cls.find_similar_approved_faq(cursor, question) or cls.find_similar_pending_proposal(cursor, question):
            return True
        cursor.execute("SELECT PREGUNTA FROM PROPUESTAS_CONOCIMIENTO WHERE ESTADO = 'APROBADA' FETCH FIRST 1000 ROWS ONLY")
        return any(cls.question_similarity(question, row[0] or "") >= 0.8 for row in cursor)


def main():
    port = int(os.getenv("ADMIN_PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Duco Admin disponible en http://127.0.0.1:{port}")
    print("Solo escucha en localhost. Usa Ctrl+C para cerrar.")
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
