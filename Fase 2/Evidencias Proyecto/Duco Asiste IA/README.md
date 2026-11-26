# Duco Asiste IA

Duco Asiste combina un chat de orientación para Duoc UC con un dashboard de
escritorio para consultar los indicadores de uso, revisar propuestas de
conocimiento y administrar usuarios. Oracle guarda las sesiones, los mensajes
y las valoraciones. Ollama genera las respuestas de IA.

## Ejecutar el proyecto completo con Docker

Necesitas Docker Desktop abierto en modo de contenedores Linux y conexión a
Internet para descargar las imágenes y el modelo la primera vez. Abre
PowerShell en la carpeta `Duco Asiste IA`, donde está `compose.yaml`.

### Iniciar con un solo comando

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Iniciar_Duco_Docker.ps1
```

El lanzador crea el archivo `.env` en el primer arranque, conserva uno existente
y levanta los servicios. Luego descarga o comprueba el modelo de Ollama y
verifica que respondan la API y la página del dashboard. El archivo `.env`
queda en el computador que ejecuta el proyecto.

| Componente | Dónde abrirlo |
|---|---|
| Chat web | http://127.0.0.1:8765/duco |
| Dashboard de escritorio desde el navegador | http://127.0.0.1:6080/vnc.html?autoconnect=true |
| Oracle en SQL Developer | `127.0.0.1:11521/FREEPDB1` con el usuario `DUCO_APP` |
| Ollama | `http://127.0.0.1:11434` |

El primer arranque inicializa el esquema Oracle y aplica las migraciones. Para
confirmar que el modelo está descargado, espera a que termine el lanzador. Si un servidor local ya usa
los puertos `8765`, `6080`, `11521` o `11434`, libera el puerto correspondiente
antes de arrancar los contenedores.

### Crear cuentas para probar los roles

Ejecuta cada comando por separado y elige la contraseña que te pida. Las cuentas
se guardan en el Oracle de Docker.

```powershell
docker compose exec dashboard /opt/venv/bin/python /app/admin-app/create_admin.py --name "Matías Peredo" --email "ma.peredo@duocuc.cl" --role ADMINISTRADOR
docker compose exec dashboard /opt/venv/bin/python /app/admin-app/create_admin.py --name "Evaluador de prueba" --email "evaluador@duco.local" --role EVALUADOR
docker compose exec dashboard /opt/venv/bin/python /app/admin-app/create_admin.py --name "Consulta de prueba" --email "consulta@duco.local" --role CONSULTA
```

| Rol | Qué puede hacer |
|---|---|
| `ADMINISTRADOR` | Consultar reportes, gestionar tablas y usuarios, evaluar propuestas y ver la auditoría. |
| `EVALUADOR` | Consultar tablas y reportes, evaluar propuestas y valoraciones negativas y ver la auditoría. |
| `CONSULTA` | Consultar el dashboard, los reportes y las tablas en modo de lectura. |

Abre el dashboard e inicia sesión con cada cuenta para comprobar sus permisos.
Cierra sesión entre pruebas.

### Comprobar el flujo

1. Abre el chat web, ingresa un nombre de prueba y envía una pregunta.
2. Abre el dashboard y pulsa **Actualizar** para consultar los KPI de sesiones,
   mensajes y valoración positiva. Inicia sesión para acceder a **Tablas**,
   **Evaluación** y **Auditoría**.
3. Para demostrar los procedimientos almacenados y el trigger, conecta SQL
   Developer al Oracle de Docker y ejecuta
   `database/oracle/demo_procedimientos.sql` como `DUCO_APP` con **F5**.
   El script revierte sus datos de prueba al finalizar.

## Detener y volver a iniciar

```powershell
docker compose down
powershell -NoProfile -ExecutionPolicy Bypass -File .\Iniciar_Duco_Docker.ps1
```

Los datos y el modelo se conservan en los volúmenes `oracle-data` y
`ollama-models`. El Oracle de Docker se inicializa con su propio esquema.
