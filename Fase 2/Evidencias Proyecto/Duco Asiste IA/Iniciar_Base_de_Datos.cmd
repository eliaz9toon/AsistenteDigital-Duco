@echo off
setlocal EnableExtensions
title Iniciar base de datos Oracle - Duco Asiste

rem Iniciar los servicios de Oracle requiere permisos de administrador: se vuelve a abrir con el aviso de Windows (UAC).
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Se necesitan permisos de administrador para iniciar Oracle.
    echo Acepta el aviso de Windows que aparece a continuacion.
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs -Wait"
    exit /b
)

echo.
echo === Iniciando Oracle Database Free ===
echo.

rem Primero el listener y luego la base de datos.
for %%S in (OracleOraDB23Home1TNSListener OracleServiceFREE) do (
    sc query %%S 2>nul | find "RUNNING" >nul
    if errorlevel 1 (
        echo Iniciando %%S ...
        net start %%S
    ) else (
        echo %%S ya esta en ejecucion.
    )
)

rem Busca lsnrctl para comprobar cuando FREEPDB1 queda registrado.
set "LSNR="
where lsnrctl >nul 2>&1 && set "LSNR=lsnrctl"
if not defined LSNR if exist "C:\app\elias\product\26ai\dbhomeFree\bin\lsnrctl.exe" set "LSNR=C:\app\elias\product\26ai\dbhomeFree\bin\lsnrctl.exe"

echo.
echo Esperando a que el servicio FREEPDB1 este disponible (puede tardar hasta 2 minutos)...
set /a intentos=0
:esperar
if defined LSNR goto conlsnr
if %intentos% geq 10 goto listo
goto siguiente
:conlsnr
"%LSNR%" status 2>nul | findstr /i "FREEPDB1" >nul && goto listo
:siguiente
set /a intentos+=1
if %intentos% geq 40 goto fallo
timeout /t 3 /nobreak >nul
goto esperar

:listo
echo.
echo Listo: la base de datos Oracle esta activa (FREEPDB1).
echo Ya puedes abrir Duco con Iniciar_Duco.cmd.
timeout /t 5 >nul
exit /b 0

:fallo
echo.
echo No se pudo confirmar que FREEPDB1 este disponible.
echo Revisa que los servicios OracleServiceFREE y OracleOraDB23Home1TNSListener existan en services.msc.
pause
exit /b 1
