"""Autenticación del panel de administración de Duco Asiste.

- Contraseñas: PBKDF2-HMAC-SHA256 con sal aleatoria (solo biblioteca estándar); en la base solo queda el hash.
- Sesiones: token aleatorio en una cookie HttpOnly; en la base solo se guarda el SHA-256 del token y su vencimiento.
- Límite de intentos: tras varios fallos seguidos desde la misma dirección y correo, se bloquea el ingreso un rato.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import secrets
import threading
import time

ITERATIONS = 200_000
SESSION_HOURS = 8
MAX_FAILURES = 5
LOCK_SECONDS = 300
MIN_PASSWORD_LENGTH = 8
ROLE_ADMIN = "ADMINISTRADOR"
ROLE_REVIEWER = "REVISOR"
COOKIE_NAME = "duco_admin"

_b64 = lambda raw: base64.b64encode(raw).decode("ascii")


def hash_password(password: str, iterations: int = ITERATIONS) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str | None) -> bool:
    """Compara en tiempo constante; un hash ausente o mal formado nunca valida."""
    try:
        scheme, iterations, salt, digest = str(stored).split("$")
        if scheme != "pbkdf2_sha256":
            return False
        expected = base64.b64decode(digest)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), base64.b64decode(salt), int(iterations))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


# Hash de relleno: se verifica contra él cuando el correo no existe, para que el tiempo de respuesta no delate qué correos existen.
_DUMMY_HASH = hash_password("relleno-sin-uso", 1000)


def verify_or_dummy(password: str, stored: str | None) -> bool:
    return verify_password(password, stored if stored else _DUMMY_HASH) and bool(stored)


def password_problem(password: str) -> str | None:
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres."
    if password.lower() in {"12345678", "password", "contrasena", "contraseña", "admin1234", "duco1234", "qwerty123"}:
        return "Esa contraseña es demasiado común."
    if not (re.search(r"[A-Za-z]", password) and re.search(r"\d", password)):
        return "Usa letras y números."
    return None


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def parse_cookie(header: str | None, name: str = COOKIE_NAME) -> str | None:
    for part in str(header or "").split(";"):
        key, _, value = part.strip().partition("=")
        if key == name and value:
            return value
    return None


class LoginThrottle:
    """Bloqueo temporal tras demasiados intentos fallidos (en memoria; se reinicia con el servidor)."""

    def __init__(self, max_failures: int = MAX_FAILURES, lock_seconds: int = LOCK_SECONDS):
        self.max_failures = max_failures
        self.lock_seconds = lock_seconds
        self._failures: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def wait_seconds(self, key: str) -> int:
        with self._lock:
            now = time.time()
            recent = [stamp for stamp in self._failures.get(key, []) if now - stamp < self.lock_seconds]
            self._failures[key] = recent
            if len(recent) >= self.max_failures:
                return int(self.lock_seconds - (now - recent[0])) + 1
            return 0

    def failed(self, key: str) -> None:
        with self._lock:
            self._failures.setdefault(key, []).append(time.time())

    def succeeded(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)


throttle = LoginThrottle()
