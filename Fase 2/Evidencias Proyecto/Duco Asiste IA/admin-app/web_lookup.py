"""Consulta limitada a duoc.cl para preguntas que los datos locales no cubren.

Solo se leen paginas listadas en los sitemaps oficiales de www.duoc.cl: el usuario nunca entrega una URL.
Si el sitio no responde, la funcion devuelve una lista vacia y el asistente sigue sin esta ayuda.
"""
from __future__ import annotations

import re
import threading
import time
import unicodedata
from html import unescape
from html.parser import HTMLParser
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

ALLOWED_HOSTS = {"www.duoc.cl", "duoc.cl"}
SITEMAP_INDEX = "https://www.duoc.cl/wp-sitemap.xml"
# Solo contenido institucional: se omiten noticias, eventos, galerias, proyectos, usuarios y taxonomias.
USEFUL_SITEMAPS = ("posts-page", "carrera_post_type", "escuelas_post_type", "preguntas_post_type", "sedes_post_type",
                   "emtpinfo_post_type", "emtpdisci_post_type", "admisionfaq", "admisionespecial")
USER_AGENT = "DucoAsiste/1.0 (proyecto academico; consulta limitada a duoc.cl)"
FETCH_TIMEOUT = 6
MAX_BYTES = 600_000
INDEX_TTL = 12 * 3600
PAGE_TTL = 3600
STOPWORDS = set("""de la el los las un una unos unas y o a en con por para que como cual cuales cuando donde quien quienes cuanto cuantos
es son se me mi mis te tu yo ya al del lo le les si no hay tiene tienen tengo puedo puede pueden quiero quisiera necesito saber sobre
duoc uc esto eso esta este ese esa hacer favor porfa dime dame cuentame hablame informacion info""".split())

_lock = threading.Lock()
_index: dict = {"at": 0.0, "urls": []}
_pages: dict[str, tuple[float, dict]] = {}


class _SameSiteRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlparse(newurl).hostname not in ALLOWED_HOSTS or not newurl.startswith("https://"):
            raise URLError("Redireccion fuera de duoc.cl bloqueada")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = build_opener(_SameSiteRedirect())


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", str(text or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _fetch(url: str, limit: int = MAX_BYTES) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        raise URLError("Dominio no permitido")
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "es-CL,es;q=0.9"})
    with _opener.open(request, timeout=FETCH_TIMEOUT) as response:
        return response.read(limit).decode("utf-8", "ignore")


def _load_index() -> list[str]:
    """URLs institucionales tomadas de los sitemaps oficiales (se renuevan cada 12 horas)."""
    with _lock:
        if _index["urls"] and time.time() - _index["at"] < INDEX_TTL:
            return _index["urls"]
    urls: list[str] = []
    try:
        root = _fetch(SITEMAP_INDEX, 200_000)
        for sub in re.findall(r"<loc>([^<]+)</loc>", root):
            if not any(key in sub for key in USEFUL_SITEMAPS):
                continue
            try:
                urls += [u for u in re.findall(r"<loc>([^<]+)</loc>", _fetch(sub, 400_000))
                         if urlparse(u).hostname in ALLOWED_HOSTS and "?" not in u]
            except Exception:
                continue
    except Exception:
        pass
    with _lock:
        if urls:
            _index.update(at=time.time(), urls=urls)
        return _index["urls"]


def warm_async() -> None:
    threading.Thread(target=_load_index, daemon=True).start()


def query_tokens(query: str) -> list[str]:
    tokens = [t for t in _norm(query).split() if t not in STOPWORDS and len(t) >= 3]
    return list(dict.fromkeys(tokens))


def _stem(token: str) -> str:
    return token[:-1] if len(token) > 4 and token.endswith("s") else token


def _score(url: str, tokens: list[str]) -> float:
    slug_words = [_stem(w) for w in _norm(urlparse(url).path).split() if w]
    if not slug_words:
        return 0.0
    total = 0.0
    for token in tokens:
        stem = _stem(token)
        if any(w == stem or (len(stem) >= 5 and (w.startswith(stem[:5]) or stem.startswith(w[:5]) and len(w) >= 5)) for w in slug_words):
            total += 1.0 + min(len(stem), 10) / 10
    # Prefiere paginas cuyo nombre se parece a la pregunta y no a un listado generico.
    return total - 0.04 * max(0, len(slug_words) - len(tokens) - 3)


class _Text(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "nav", "header", "footer", "form", "button", "select", "iframe"}
    BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "h5", "td", "th", "div", "section", "article", "br", "tr", "dd", "dt"}

    def __init__(self) -> None:
        super().__init__()
        self.skip = 0
        self.blocks: list[str] = []
        self.cur: list[str] = []
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        if tag in self.SKIP:
            self.skip += 1
        if tag in self.BLOCK:
            self._flush()

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        if tag in self.BLOCK:
            self._flush()

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self.skip:
            self.cur.append(data)

    def _flush(self):
        text = re.sub(r"\s+", " ", unescape("".join(self.cur))).strip()
        self.cur = []
        if len(text) >= 18 and text not in self.blocks:
            self.blocks.append(text)


def _extract(url: str, tokens: list[str]) -> dict | None:
    cached = _pages.get(url)
    if cached and time.time() - cached[0] < PAGE_TTL:
        parsed = cached[1]
    else:
        parser = _Text()
        parser.feed(_fetch(url))
        parser._flush()
        parsed = {"title": re.sub(r"\s*[–-]\s*Duoc UC\s*$", "", re.sub(r"\s+", " ", unescape(parser.title)).strip()), "blocks": parser.blocks[:400]}
        _pages[url] = (time.time(), parsed)
    stems = [_stem(t) for t in tokens]
    scored = []
    for i, block in enumerate(parsed["blocks"]):
        nb = _norm(block)
        hits = sum(1 for s in stems if s in nb)
        if hits:
            scored.append((hits, -i, block))
    scored.sort(reverse=True)
    chosen = [b for _, _, b in scored[:6]]
    # Se conserva el orden original de la pagina para que el texto se lea con sentido.
    chosen.sort(key=lambda b: parsed["blocks"].index(b))
    excerpt = " ".join(chosen)[:1500].strip()
    if not excerpt:
        return None
    faq = "preguntas_frecuentes" in url or "preguntas-frecuentes" in url
    return {"title": parsed["title"] or url, "url": url, "excerpt": excerpt, "faq": faq}


def lookup(query: str, limit: int = 2) -> dict:
    """Devuelve hasta `limit` extractos de paginas de duoc.cl relacionadas con la consulta."""
    started = time.time()
    tokens = query_tokens(query)
    if not tokens:
        return {"results": [], "reason": "consulta sin palabras utiles"}
    urls = _load_index()
    if not urls:
        return {"results": [], "reason": "no se pudo leer el indice de duoc.cl"}
    ranked = sorted(((_score(u, tokens), u) for u in urls), reverse=True)
    minimum = 2.0 if len(tokens) > 1 else 1.0
    candidates = [u for s, u in ranked[:6] if s >= minimum]
    results: list[dict] = []
    for url in candidates:
        if len(results) >= limit or time.time() - started > 10:
            break
        try:
            item = _extract(url, tokens)
        except Exception:
            continue
        if item:
            results.append(item)
    return {"results": results, "checkedAt": time.strftime("%Y-%m-%d"), "source": "duoc.cl"}
