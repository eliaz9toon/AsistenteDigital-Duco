@echo off
setlocal
cd /d "%~dp0"
if exist "admin-app\.venv\Scripts\python.exe" (
    "admin-app\.venv\Scripts\python.exe" "admin-app\start.py"
) else (
    py "admin-app\start.py"
)
if errorlevel 1 (
    echo.
    echo No se pudo iniciar Duco. Revisa el error de arriba.
    pause
)
