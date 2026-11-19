@echo off
setlocal
cd /d "%~dp0"
rem Si la base de datos Oracle esta apagada, se inicia primero (pide permisos de administrador).
sc query OracleServiceFREE 2>nul | find "RUNNING" >nul
if errorlevel 1 (
    sc query OracleServiceFREE >nul 2>&1
    if not errorlevel 1 call "%~dp0Iniciar_Base_de_Datos.cmd"
)
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
