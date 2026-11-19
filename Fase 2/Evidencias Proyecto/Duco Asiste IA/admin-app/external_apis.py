"""APIs externas de Duco Asiste, consultadas desde el backend y con lista cerrada de servidores.

- Nominatim (OpenStreetMap): convierte una dirección en coordenadas.
- OSRM: calcula la ruta por calle (distancia, tiempo y trazado) entre dos puntos.
- Nager.Date: feriados públicos de Chile.

Ninguna requiere clave. Nominatim pide máximo 1 consulta por segundo y un User-Agent que identifique la aplicación.
Las direcciones nunca se guardan: solo hay una caché en memoria con vencimiento y no se escriben en el log.
"""
from __future__ import annotations

import json
import re
import threading
import time
from urllib.error import URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

ALLOWED_HOSTS = {"nominatim.openstreetmap.org", "router.project-osrm.org", "date.nager.at"}
USER_AGENT = "DucoAsiste/1.0 (proyecto academico; uso limitado y sin almacenar direcciones)"
TIMEOUT = 8
CACHE_TTL = {"geocode": 3600, "route": 1800, "holidays": 24 * 3600}

_cache: dict[str, tuple[float, object]] = {}
_lock = threading.Lock()
_last_nominatim = 0.0


class _SameHostRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlparse(newurl).hostname not in ALLOWED_HOSTS or not newurl.startswith("https://"):
            raise URLError("Redireccion bloqueada")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = build_opener(_SameHostRedirect())


def _get_json(url: str):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        raise URLError("Servidor no permitido")
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json", "Accept-Language": "es-CL,es;q=0.9"})
    with _opener.open(request, timeout=TIMEOUT) as response:
        return json.loads(response.read(1_500_000).decode("utf-8", "ignore"))


def _cached(kind: str, key: str):
    with _lock:
        item = _cache.get(f"{kind}:{key}")
        if item and time.time() - item[0] < CACHE_TTL[kind]:
            return item[1]
    return None


def _store(kind: str, key: str, value) -> None:
    with _lock:
        if len(_cache) > 300:
            _cache.clear()
        _cache[f"{kind}:{key}"] = (time.time(), value)


def geocode(query: str) -> dict:
    """Dirección -> {lat, lng, name}. Solo busca en Chile."""
    global _last_nominatim
    text = re.sub(r"\s+", " ", str(query or "")).strip()[:160]
    if len(text) < 5:
        return {"found": False, "reason": "direccion muy corta"}
    hit = _cached("geocode", text.lower())
    if hit is not None:
        return hit  # type: ignore[return-value]
    with _lock:
        wait = 1.1 - (time.time() - _last_nominatim)
        if wait > 0:
            time.sleep(wait)  # política de uso de Nominatim: 1 consulta por segundo
        _last_nominatim = time.time()
    try:
        data = _get_json("https://nominatim.openstreetmap.org/search?" + urlencode(
            {"format": "jsonv2", "q": text, "countrycodes": "cl", "limit": 1, "addressdetails": 0}))
    except Exception as error:
        return {"found": False, "reason": "servicio no disponible"}
    if not data:
        result = {"found": False, "reason": "sin resultados"}
    else:
        item = data[0]
        result = {"found": True, "lat": float(item["lat"]), "lng": float(item["lon"]), "name": str(item.get("display_name", ""))[:200]}
    _store("geocode", text.lower(), result)
    return result


def route(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> dict:
    """Ruta en auto por calle: distancia (km), duración (min) y trazado simplificado [[lat, lng], ...]."""
    for value in (from_lat, from_lng, to_lat, to_lng):
        if not isinstance(value, (int, float)) or abs(value) > 180:
            return {"found": False, "reason": "coordenadas invalidas"}
    key = f"{from_lat:.4f},{from_lng:.4f};{to_lat:.4f},{to_lng:.4f}"
    hit = _cached("route", key)
    if hit is not None:
        return hit  # type: ignore[return-value]
    url = (f"https://router.project-osrm.org/route/v1/driving/{from_lng:.6f},{from_lat:.6f};{to_lng:.6f},{to_lat:.6f}"
           "?overview=simplified&geometries=geojson")
    try:
        data = _get_json(url)
        best = data["routes"][0]
    except Exception:
        return {"found": False, "reason": "servicio no disponible"}
    points = [[round(lat, 5), round(lng, 5)] for lng, lat in best["geometry"]["coordinates"]][:400]
    result = {"found": True, "distanceKm": round(best["distance"] / 1000, 1), "durationMin": max(1, round(best["duration"] / 60)), "points": points}
    _store("route", key, result)
    return result


def holidays(year: int) -> dict:
    """Feriados públicos de Chile de un año: [{date, name}]."""
    if not isinstance(year, int) or year < 2020 or year > 2035:
        return {"found": False, "reason": "anio fuera de rango"}
    hit = _cached("holidays", str(year))
    if hit is not None:
        return hit  # type: ignore[return-value]
    try:
        data = _get_json(f"https://date.nager.at/api/v3/PublicHolidays/{year}/CL")
    except Exception:
        return {"found": False, "reason": "servicio no disponible"}
    result = {"found": True, "year": year, "items": [{"date": item["date"], "name": item.get("localName") or item.get("name")} for item in data]}
    _store("holidays", str(year), result)
    return result
