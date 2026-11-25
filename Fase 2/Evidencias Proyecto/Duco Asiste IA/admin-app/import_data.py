"""Carga en TU base de datos local un archivo creado con export_data.py (para estudiar y probar consultas con datos reales).

Uso (desde admin-app/, con tu admin-app/.env apuntando a TU base local):
  python import_data.py ../database/export/duco_datos_20261120-2300.json

Seguridad:
  * Se niega a cargar en una base que no sea local (host distinto de localhost/127.0.0.1) para no tocar por error la base de otra persona;
    solo se salta con --allow-remote.
  * Se niega a cargar si alguna tabla que va a recibir datos ya tiene filas (no mezcla ni sobreescribe nada).
  * Todo ocurre en una sola transacción: si algo falla, no queda nada a medias.
Antes necesitas el esquema: schema.sql y las migraciones 001 a 007 (ver database/README.md).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from decimal import Decimal

import oracledb

import app


def host_of(dsn: str) -> str:
    match = re.match(r"^(?:\w+://)?\[?([^\]:/]+)", dsn or "")
    return (match.group(1) if match else "").lower()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("file", help="Archivo JSON creado por export_data.py")
    parser.add_argument("--allow-remote", action="store_true", help="Permitir cargar en una base que no es local (no recomendado)")
    parser.add_argument("--dry-run", action="store_true", help="Probar todo y deshacer al final (no deja datos ni cambia contadores)")
    args = parser.parse_args()

    dsn = os.getenv("ORACLE_DSN", "")
    if host_of(dsn) not in {"localhost", "127.0.0.1", "::1"} and not args.allow_remote:
        print(f"Me niego: ORACLE_DSN apunta a «{dsn}», que no es una base local.")
        print("Este script es para cargar datos en TU base propia. Si es a propósito, usa --allow-remote.")
        return 1

    with open(args.file, encoding="utf-8") as handle:
        payload = json.load(handle)
    if payload.get("formatVersion") != 1:
        print("Formato de archivo desconocido.")
        return 1

    conn = app.connect()
    try:
        return load_payload(conn, payload, args.dry_run)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def load_payload(conn, payload: dict, dry_run: bool = False) -> int:
    """Carga el contenido del archivo con la conexión dada. Devuelve 0 si todo salió bien."""
    try:
        existing = set(app.table_names(conn))
        tables = payload["tables"]
        missing = sorted(set(tables) - existing)
        if missing:
            print("Faltan tablas en tu base (¿ejecutaste schema.sql y las migraciones?):", ", ".join(missing))
            return 1
        info = app.schema_info(conn)
        depth = app.table_depths(info, sorted(existing))
        order = sorted(tables, key=lambda name: (depth.get(name, 0), name))
        with conn.cursor() as cur:
            busy = []
            for name in order:
                cur.execute(f"SELECT COUNT(*) FROM {app.safe_ident(name)}")
                if cur.fetchone()[0] and tables[name]["rows"]:
                    busy.append(name)
            if busy:
                print("Me niego: estas tablas ya tienen datos y no mezclo ni sobreescribo nada:", ", ".join(busy))
                return 1
            total = 0
            for name in order:
                spec = tables[name]
                if not spec["rows"]:
                    continue
                cur.execute("SELECT column_name, data_type FROM user_tab_columns WHERE table_name = :t", t=name)
                kinds = dict(cur.fetchall())
                columns = spec["columns"]
                unknown = [c for c in columns if c not in kinds]
                if unknown:
                    print(f"La tabla {name} no tiene las columnas {unknown}: la base y el archivo son de versiones distintas.")
                    return 1

                def convert(column, value):
                    kind = kinds[column]
                    if value is None:
                        return None
                    if isinstance(value, (dict, list)):
                        return json.dumps(value, ensure_ascii=False)
                    if kind == "NUMBER":
                        return Decimal(str(value))
                    if kind == "DATE" or kind.startswith("TIMESTAMP"):
                        return datetime.fromisoformat(str(value))
                    return value

                rows = [[convert(c, v) for c, v in zip(columns, row)] for row in spec["rows"]]
                sql = f"INSERT INTO {app.safe_ident(name)} ({', '.join(app.safe_ident(c) for c in columns)}) VALUES ({', '.join(f':{i + 1}' for i in range(len(columns)))})"
                cur.setinputsizes(*[oracledb.DB_TYPE_CLOB if kinds[c] in ("CLOB", "NCLOB") else None for c in columns])
                cur.executemany(sql, rows)
                total += len(rows)
                print(f"  {name}: {len(rows)} filas")
        if dry_run:
            conn.rollback()
            print(f"Prueba terminada: {total} filas se habrían cargado. Se deshizo todo (--dry-run).")
            return 0
        conn.commit()
        # Los ID se cargaron con su valor original: los contadores automáticos deben seguir después del mayor, o los próximos registros chocarían.
        with conn.cursor() as cur:
            cur.execute("SELECT table_name, column_name FROM user_tab_identity_cols")
            for table, column in cur.fetchall():
                if table in tables and tables[table]["rows"]:
                    cur.execute(f'ALTER TABLE "{table}" MODIFY ("{column}" GENERATED BY DEFAULT AS IDENTITY (START WITH LIMIT VALUE))')
        print(f"Listo: {total} filas cargadas en {len([t for t in order if tables[t]['rows']])} tablas. Los contadores de ID quedaron al día.")
        return 0
    except Exception:
        conn.rollback()
        raise


if __name__ == "__main__":
    sys.exit(main())
