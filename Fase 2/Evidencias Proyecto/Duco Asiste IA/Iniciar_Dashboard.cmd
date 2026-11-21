@echo off
setlocal
cd /d "%~dp0"
if not exist "admin-app\.venv\Scripts\python.exe" (
    echo No se encontro el entorno de Python de Duco.
    pause
    exit /b 1
)
"admin-app\.venv\Scripts\python.exe" -B "admin-app\desktop_dashboard.py"
if errorlevel 1 pause
