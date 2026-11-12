# Sprint 1 - Nueva revision y validacion

Fecha local: 4 de noviembre de 2026, America/Santiago.
Esta revision amplia la prueba basica anterior; no se limita a repetirla.

## Fallos reproducidos y corregidos

1. El avatar era un div sin activacion por teclado. Ahora es un boton con
   nombre accesible, estado expandido y referencia al panel. Enter abre el
   chat, Escape lo cierra y el foco vuelve al boton. El panel cerrado es inert.
2. La escritura de respuestas terminaba a los 2000 caracteres. Ahora ese
   limite solo afecta la animacion: el mensaje final se muestra completo.
   El texto de prueba de 2147 caracteres, incluido HTML literal, se conserva
   sin ejecutar ni crear las etiquetas incluidas en el mensaje.
3. Los enlaces recuperados del historial eran texto plano. Ahora se aplica
   el mismo enlace seguro al restaurar la conversacion.
4. Un timeout de Ollama se mostraba pero no se guardaba. Ahora persiste al
   recargar y el procesamiento espera su presentacion antes de desbloquear.

Ademas se elimino la restauracion diferida que podia reemplazar mensajes
enviados durante el arranque. Nueva conversacion limpia el borrador y los
efectos anteriores; la escritura de un mensaje retirado del DOM se detiene.

## Resultado por tarea

| ID | Validacion |
| --- | --- |
| E4-H1-T01 | Apertura por teclado, foco, Escape; vista a 320, 375 y 600px; captura revisada visualmente |
| E4-H1-T03 | Mensajes diferenciados, respuesta completa, HTML como texto y proteccion contra envios simultaneos |
| E4-H1-T04 | Enlaces y errores sobreviven recarga; sesion y dialogo reales sobreviven navegacion, regreso y recarga; reinicio persistente |
| E1-H1-T01 | Envio con boton y Enter; Enter durante composicion no envia; borrador conservado durante otra respuesta |
| E1-H1-T02 | Vacio, espacios y espacio no separable rechazados; 2001 caracteres rechazados; 2000 aceptados despues de trim |
| E1-H1-T03 | Consulta real enviada desde el chat a qwen3.5:9b y respuesta institucional mostrada; timeout simulado no bloquea la interfaz |

Diez escenarios aprobados en Chromium automatizado. La consulta real fue
"Que es Duoc UC?" con puntuacion espanola; el JSON conserva el texto exacto,
la respuesta y los mensajes recibidos de /api/chat. No se simulo ese caso.

## Evidencias

- sprint1-revalidation-before-fix.json: cuatro fallos reproducidos inicialmente.
- sprint1-revalidation.json: diez resultados finales y respuestas reales.
- sprint1-mobile.png: vista de 375px, inspeccionada visualmente.
- tests/sprint1-revalidation.cjs: prueba reproducible integrada al ejecutor.

```powershell
node tests/sprint1-revalidation.cjs
```

Requiere el servidor en 127.0.0.1:8765, Playwright resoluble y Ollama con el
modelo configurado. DUCO_SKIP_REAL_MODEL=1 omite explicitamente el caso real;
la ejecucion final documentada no lo omitio. Las pruebas de timeout y envios
simultaneos usan respuestas simuladas para controlar esas condiciones.

Tambien se repitieron smoke-test.js, highlight-target-regression.js,
sprint1-browser.cjs y sprint3-browser.cjs para detectar regresiones.

## Limites

La revision no certifica accesibilidad completa ni todos los dispositivos.
No se probaron telefonos fisicos, lectores de pantalla, navegadores distintos
de Chromium o perdida de red real. El timeout se inyecto de forma controlada.
No se repitieron en esta revision todas las suites de los otros sprints.
El acceptance.json anterior conserva la fecha de su ejecucion historica;
la evidencia actual de Sprint 1 es sprint1-revalidation.json.
