"""Aplica un script SQL de database/oracle/migrations contra el esquema de admin-app/.env.

Uso:  python apply_migration.py ../database/oracle/migrations/006_login_auditoria_fechas.sql

Los bloques del archivo terminan con una línea que contiene solo «/». Cada bloque se ejecuta por separado y la
migración es idempotente, de modo que puede repetirse sin dañar los datos. Haz un respaldo antes de correrla.
"""
from __future__ import annotations

import sys
from pathlib import Path

import app  # carga .env y trae connect()


def blocks(text: str) -> list[str]:
    parts, current = [], []
    for line in text.splitlines():
        if line.strip() == "/":
            block = "\n".join(current).strip()
            if block:
                parts.append(block)
            current = []
        elif line.strip() and not (line.strip().startswith("--") and not current):
            # Se omiten líneas en blanco y comentarios sueltos entre bloques; los comentarios dentro de un bloque se conservan.
            current.append(line)
    return parts


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    sql_text = Path(sys.argv[1]).read_text(encoding="utf-8")
    with app.connect() as conn:
        with conn.cursor() as cur:
            for index, block in enumerate(blocks(sql_text), 1):
                statement = block.rstrip().rstrip(";") if not block.upper().lstrip().startswith(("BEGIN", "DECLARE")) else block
                cur.execute(statement)
                print(f"bloque {index}: ok ({cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0} filas)")
        conn.commit()
    print("migración aplicada")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
