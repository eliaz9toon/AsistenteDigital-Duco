# Oracle, Duco Admin y compatibilidad

Fecha local: 4 de noviembre de 2026.

## Oracle real: validado en las operaciones descritas

El entorno admin-app/.venv tiene python-oracledb 3.4.2. Se conecto a Oracle
23.26.3.0.0 sin imprimir credenciales ni el DSN. No fue necesario instalar
otra dependencia Python ni cambiar el esquema.

La prueba oracle-integration.py usa HTTP contra el backend en ejecucion y
consultas desde conexiones independientes para confirmar los commits:

- Enumeracion y metadatos de tablas reales.
- Alta, lectura, actualizacion y borrado en CONFIGURACIONES.
- Rechazo de una columna desconocida, sin alterar el valor guardado.
- Segundo borrado de un registro inexistente devuelve error.
- Timestamp y relacion numerica en SESIONES_CHAT/MENSAJES.
- CLOB de mas de 3000 caracteres con acentos, recuperado integro.
- Oracle impide eliminar el padre referenciado: ORA-02292.
- Aprobar propuesta crea una FAQ recuperable por la API de conocimiento.
- Repetir la revision se rechaza; rechazar otra propuesta no publica una FAQ.
- Consultas de propuestas, valoraciones negativas y experiencias responden.

Todas las filas temporales se identifican con UUID, se eliminan en finally y
se comprueba su ausencia. Los eventos de auditoria generados por la aplicacion
se conservan intencionalmente; no se modificaron filas de negocio existentes.
Evidencia: oracle-integration.json. La prueba esta separada de unittest y
requiere --run-real, porque escribe datos temporales en la base configurada.

Tambien pasaron nuevamente las quince pruebas unitarias Python.

## Compatibilidad: tres navegadores/motores aprobados, uno no ejecutado

| Navegador o motor | Version | Resultado |
| --- | --- | --- |
| Chromium automatizado | 151.0.7922.34 | Aprobado |
| Microsoft Edge instalado | 156.0.4314.58 | Aprobado |
| WebKit para Playwright en Windows | 26.5 | Aprobado; no equivale a Safari real |
| Firefox para Playwright | descarga 153.0 | No ejecutado: fallo de entorno al arrancar |

Cada uno de los tres entornos aprobados paso estos recorridos:

- Apertura por teclado, foco, envio con Enter y mensajes diferenciados.
- Conexion fetch/CORS real a Ollama local (sin generar otra respuesta de IA).
- Historial y mensajes conservados al navegar y recargar.
- Abrir/cerrar menu, activar carrusel, scroll arriba y marcador de texto.
- Panel y controles dentro de la pantalla a 320, 375 y 600px.
- Touch simulado a 375px: abrir, enviar, cerrar y reabrir.
- Duco Admin: crear, leer, editar y eliminar una fila real desde la interfaz.

Los registros temporales del CRUD de interfaz tambien se retiraron. Se
comprobo adicionalmente en Oracle que no quedaban filas DUCO_TEST_BROWSER_*.
El informe compatibility.json y las capturas compatibility-*.png conservan
los resultados; el resultado global es false porque Firefox no se ejecuto,
no porque los tres entornos probados hayan fallado.

## Fallo encontrado y corregido

La primera apertura con teclado podia dejar el foco en el documento mientras
el campo seguia oculto durante la entrada del panel. Se espera su visibilidad
con un plazo acotado sin quitar el foco a otro control elegido por el usuario.
Se retiro la transicion de visibility. La correccion paso en los tres motores
disponibles, y la suite ampliada del Sprint 1 volvio a pasar con Ollama real.

## Pendientes explicitos

- Firefox: Windows rechaza firefox.exe antes de abrir la aplicacion. El
  registro SideBySide indica que no puede resolver el ensamblado mozglue.
  Es un bloqueo del ejecutable de prueba, no un resultado de compatibilidad
  de Duco. No se modificaron binarios, manifiestos ni protecciones del sistema.
- Dispositivos fisicos: no probados. El usuario indico que no tiene un telefono
  disponible por ahora. Viewport y touch simulados no validan el teclado del
  telefono, Safari de iOS ni Chrome de Android reales.
- Las dependencias externas y las fuentes de iconos pendientes del informe
  general no se dan por resueltas en esta revision. Las pruebas aqui aislan
  la interfaz de Duco; no certifican todo el sitio sin internet.
- No se probaron todas las combinaciones de tipos y restricciones de las 32
  tablas, carga concurrente, recuperacion tras caida de Oracle ni seguridad
  de produccion. La prueba real de propuestas no sustituye un ensayo completo
  del flujo de valoraciones y experiencias nuevas.

## Reproduccion

```powershell
.\admin-app\.venv\Scripts\python.exe tests/oracle-integration.py --run-real
.\admin-app\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
node tests/compatibility.cjs
```

Requiere servidor local iniciado, Oracle configurado, Ollama disponible y
Playwright resoluble. Firefox y WebKit se instalaron con el instalador de
Playwright; la presencia del archivo de Firefox no implica que pueda arrancar.
No se expuso Duco Admin fuera de localhost para simular una prueba fisica.
