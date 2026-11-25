"""Exporta los datos de Duco a un archivo JSON para que otra persona los cargue en su propia base (con import_data.py).

Uso (desde admin-app/):
  python export_data.py                      # crea ../database/export/duco_datos_AAAAMMDD-HHMM.json
  python export_data.py --keep-names         # conserva los nombres reales de quienes usaron el chat
  python export_data.py --out ruta.json

Qué NO se exporta, a propósito: USUARIOS_ADMIN y SESIONES_ADMIN (contraseñas y sesiones), AUDITORIA_CAMBIOS, EVENTOS_SISTEMA y ROLES
(los roles los crea la migración 006). Por defecto los nombres del chat se reemplazan por «Usuario N».
El archivo contiene conversaciones reales: compártelo solo con tu equipo y NO lo subas a GitHub (database/export/ está ignorada).
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import app

EXCLUDED = {"USUARIOS_ADMIN", "SESIONES_ADMIN", "AUDITORIA_CAMBIOS", "EVENTOS_SISTEMA", "ROLES"}
FORMAT_VERSION = 1


def encode(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat(sep=" ")
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, (dict, list)):  # columnas con restricción IS JSON: el controlador las entrega ya convertidas
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, bytes):
        raise ValueError("Hay una columna binaria; este exportador no la admite.")
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", help="Archivo de salida (por defecto database/export/duco_datos_<fecha>.json)")
    parser.add_argument("--keep-names", action="store_true", help="No anonimizar SESIONES_CHAT.NOMBRE_USUARIO")
    args = parser.parse_args()

    out = Path(args.out) if args.out else app.ROOT.parent / "database" / "export" / f"duco_datos_{datetime.now():%Y%m%d-%H%M}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {"formatVersion": FORMAT_VERSION, "exportedAt": datetime.now().isoformat(timespec="seconds"), "anonymized": not args.keep_names, "tables": {}}
    total = 0
    with app.connect() as conn, conn.cursor() as cur:
        for name in app.table_names(conn):
            if name in EXCLUDED:
                continue
            cur.execute(f"SELECT * FROM {app.safe_ident(name)}")
            columns = [col[0] for col in cur.description]
            rows = [[encode(value) for value in row] for row in cur]
            if name == "SESIONES_CHAT" and not args.keep_names and "NOMBRE_USUARIO" in columns:
                at, id_at = columns.index("NOMBRE_USUARIO"), columns.index("ID_SESION")
                for row in rows:
                    if row[at]:
                        row[at] = f"Usuario {row[id_at]}"
            payload["tables"][name] = {"columns": columns, "rows": rows}
            total += len(rows)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Exportadas {len(payload['tables'])} tablas y {total} filas a {out}")
    print("Nombres del chat:", "reales" if args.keep_names else "anonimizados")
    print("No subas este archivo a GitHub.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
