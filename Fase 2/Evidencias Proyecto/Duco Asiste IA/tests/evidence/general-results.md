# Pruebas generales - Duco Asiste

Fecha local: 4 de noviembre de 2026. Los registros usan UTC.

## Conclusion

El nucleo del asistente pasa los escenarios de aceptacion y esta en buen
estado para una demostracion con conexion. No todo el sitio es autonomo sin
internet, y hay recursos visuales pendientes. No se presenta esta revision
como certificacion de produccion ni como garantia de toda respuesta del modelo.

## Ejecuciones

- Diez suites de aceptacion/regresion aprobadas: acceptance.json. Incluyen
  interfaz, casos limite, historial, Ollama real, navegacion, regreso manual,
  resaltados, menus y consultas ambiguas. Tiempo total aproximado: 175 segundos.
- Quince pruebas unitarias de backend aprobadas: backend-tests.log.
- Integracion con conexion aprobada: general-site-online.json. Portada,
  catalogo y ficha de Ingenieria en Informatica sin excepciones JavaScript
  durante el recorrido. Busqueda de informatica, pestaña de perfil y apertura
  y cierre del video funcionan.
- Las 81 rutas de fichas respondieron HTTP 200 y contienen el script de Duco.
  Esto es una comprobacion de disponibilidad, no 81 recorridos interactivos.
- En las tres paginas recorridas hay una sola instancia del asistente y no
  aparece desborde horizontal a 375px. La suite ampliada de Sprint 1 prueba
  ademas controles del chat a 320, 375 y 600px.

## Fallo corregido durante esta revision

La portada ejecutaba animaciones con jQuery Slim, que no ofrece animate.
Se reprodujo con y sin acceso externo. Se sustituyo por la copia completa ya
incluida y se restituyo el alias $ que esa copia WordPress libera mediante
noConflict. No se descargo una nueva libreria ni se modifico el proveedor.

Tras el cambio, la integracion conectada deja de mostrar esa excepcion.
Tambien se repitieron sprint1-revalidation.cjs con Ollama real y
sprint3-browser.cjs, para verificar chat, navegacion y operaciones visuales.
La ejecucion completa de diez suites fue anterior a este pequeno cambio de
carga de jQuery; las repeticiones indicadas y la integracion fueron posteriores.

## Pendientes detectados

1. Sin acceso externo: la prueba general NO pasa. Carreras y las fichas
   dependen de jQuery, Feather y otros scripts remotos. El chat sigue
   apareciendo, pero no se puede asumir que el buscador, video y todos los
   controles del sitio funcionen desconectados. Evidencia: general-site-offline.json.
2. Fuentes de iconos ausentes: la portada solicita fa-solid-900 y fa-brands-400
   en woff2, woff y ttf; las seis solicitudes devuelven 404. Se registran como
   avisos visuales, no se ocultan en el resultado conectado.
3. Calidad generativa: algunas respuestas son mas extensas de lo necesario.
   Las pruebas semanticas comprueban escenarios concretos; no certifican
   todas las afirmaciones institucionales ni todas las reformulaciones.

Las pruebas sin internet bloquean peticiones externas en el navegador, pero
mantienen accesibles el servidor local y Ollama. No simulan una caida de Ollama.

## Evidencias y reproduccion

```powershell
node tests/run-acceptance.cjs
.\admin-app\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
$env:DUCO_TEST_EXTERNAL='1'
node tests/general-site.cjs
Remove-Item Env:DUCO_TEST_EXTERNAL
node tests/general-site.cjs
```

Requiere servidor local en 127.0.0.1:8765, modelo qwen3.5:9b y Playwright
resoluble por Node. El ultimo comando devuelve fallo mientras existan las
dependencias externas; no debe confundirse con el resultado de aceptacion.
Los JSON y logs se guardan junto a este informe. Los errores del diagnostico
inicial tambien incluyen ajustes de selectores de la prueba; las evidencias
conectada y desconectada finales son las referencias de esta revision.

No se hicieron pruebas fisicas en telefonos, auditoria de accesibilidad
completa, pentesting, carga concurrente ni verificacion integral de Oracle.
