"""Crea (o restablece la contraseña de) un usuario del panel de administración.

Uso:
  python create_admin.py --name "Elías Cornejo" --email elias@ejemplo.cl            # pide la contraseña sin mostrarla
  python create_admin.py --name "Elías Cornejo" --email elias@ejemplo.cl --generate # genera una contraseña y la muestra una vez
  python create_admin.py --email elias@ejemplo.cl --reset --generate                 # restablece la contraseña de un usuario existente
Roles: ADMINISTRADOR (todo), EVALUADOR (ve datos y evalúa propuestas y valoraciones) o CONSULTA (solo ve dashboard, reportes y tablas).
La contraseña nunca se guarda: solo su hash.
"""
from __future__ import annotations

import argparse
import getpass
import secrets
import string
import sys

import app
import auth


def generated_password() -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(14))
        if auth.password_problem(candidate) is None:
            return candidate


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name", help="Nombre completo")
    parser.add_argument("--email", required=True, help="Correo (es el usuario de ingreso)")
    parser.add_argument("--role", default=auth.ROLE_ADMIN, choices=list(auth.ALL_ROLES))
    parser.add_argument("--generate", action="store_true", help="Generar una contraseña aleatoria y mostrarla una sola vez")
    parser.add_argument("--reset", action="store_true", help="Restablecer la contraseña de un usuario que ya existe")
    args = parser.parse_args()
    email = args.email.strip().lower()

    password = generated_password() if args.generate else getpass.getpass("Contraseña (mínimo 8, con letras y números): ")
    problem = auth.password_problem(password)
    if problem:
        print(problem)
        return 1

    with app.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT ID_ADMIN FROM USUARIOS_ADMIN WHERE LOWER(CORREO) = :e", e=email)
        row = cur.fetchone()
        if row and not args.reset:
            print("Ya existe un usuario con ese correo. Usa --reset para cambiar su contraseña.")
            return 1
        if row:
            cur.execute("UPDATE USUARIOS_ADMIN SET CLAVE_HASH = :h, ACTIVO = 1 WHERE ID_ADMIN = :id", h=auth.hash_password(password), id=row[0])
            app.record_audit(cur, "USUARIOS_ADMIN", "UPDATE", row[0], {"campo": "CLAVE_HASH"}, {"campo": "CLAVE_HASH", "cambio": "contraseña restablecida por consola"},
                             {"name": "consola", "origin": "sistema"})
        else:
            if not args.name:
                print("Falta --name para crear un usuario nuevo.")
                return 1
            cur.execute("SELECT ID_ROL FROM ROLES WHERE NOMBRE = :r", r=args.role)
            role_row = cur.fetchone()
            if not role_row:
                print("No existen los roles; ejecuta primero apply_migration.py con la migración 006.")
                return 1
            new_id = cur.var(int)
            cur.execute("""
                INSERT INTO USUARIOS_ADMIN (ID_ROL, NOMBRE, CORREO, CLAVE_HASH) VALUES (:r, :n, :e, :h) RETURNING ID_ADMIN INTO :id
            """, {"r": role_row[0], "n": args.name.strip(), "e": email, "h": auth.hash_password(password), "id": new_id})
            app.record_audit(cur, "USUARIOS_ADMIN", "INSERT", app.first_out(new_id), None, {"nombre": args.name.strip(), "correo": email, "rol": args.role},
                             {"name": "consola", "origin": "sistema"})
        conn.commit()
    print(f"Listo: {email} ({args.role}).")
    if args.generate:
        print(f"Contraseña generada (cámbiala al ingresar): {password}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
