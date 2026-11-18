# Entrega 2 actualizada: qué cambió (14/11/2026)

Esta carpeta es una copia de la Entrega 2 (FASE 2) con los documentos alineados al sistema real. Los originales de Descargas no se tocaron.

## Reemplazados por versiones regeneradas
- `Documento de diseño/Diagramas/Arquitectura/Duco_Asiste_Arquitectura.docx`: arquitectura real de 3 capas, componentes y comunicación entre servicios.
- `.../Casos de uso/*.png` y `.../Diagrama de secuencia/*.png`: regenerados según el flujo real.
- `.../Modelo de Datos/`: ER clásico de Oracle con las 32 tablas implementadas (general + 5 módulos), documento y SQL.

## Editados (mismo formato que el original)
| Documento | Cambios principales |
|---|---|
| 08 Manual técnico y de despliegue | Reescrito: modelo qwen3.5:4b, `Iniciar_Duco.cmd`, `admin-app/.env`, puerto 8765, OracleServiceFREE, estructura real de archivos, diagnóstico (ORA-12514, puerto ocupado), verificación con estados reales. |
| 2.4 Guía Fase 2 | Resumen, evidencias, plan de trabajo (observaciones, estados y ajustes) y pendientes actualizados. |
| 01 Product Vision | Estado al 14/11, alcance (Oracle, backend y panel web ya implementados; Docker pendiente). |
| 04 Definition of Done | Tabla de aplicación actual con resultados reales; se quitó el conteo "26 tareas". |
| 07 Plan de pruebas | Versión 2.1: estado de CP-01 a CP-31, índice de evidencias, registro técnico y pendientes. |
| Retrospectivas | Anexo corregido (Sprint 4 sigue "planificada") con avances técnicos posteriores. |

## Planillas Scrum (actualizadas el 14/11/2026)
| Planilla | Cambios |
|---|---|
| Kanban | Fecha y texto de evidencia al día; hoja nueva «Trabajo adicional» con 14 tareas (E5 a E10). |
| Sprint Backlog | Fecha y texto de evidencia al día. |
| Burndown | Nota de actualización en «Resumen»; el trabajo adicional no suma horas. |
| Product Backlog | 6 historias nuevas (E5-H1 a E10-H1) con 36 puntos y prioridades 10 a 15 (estimados a partir del trabajo realizado, no de un Planning Poker). |
| Historias de Usuario (.xlsm) | Las 6 historias nuevas con 4 criterios de aceptación cada una. |
| Plan de pruebas (07) | «Kanban: Pendiente» pasó a «En validación», como el Kanban vigente. |

**Aceptación (14/11/2026, por pedido del equipo):** las 36 tareas del plan y las 13 tareas nuevas (salvo Docker) pasaron a «Terminado», con base en las pruebas automatizadas aprobadas (453 casos). Kanban, Sprint Backlog, Burndown (resumen: 0 h por aceptar), Product Backlog (historias «Terminada»; E10-H1 «Parcial; Docker pendiente»), Visión, DoD, Plan de pruebas y Retrospectivas (anexo) se actualizaron en consecuencia. Quedan pendientes las capturas manuales y la prueba en el equipo de presentación; Docker sigue «Pendiente». Responsables y horas de lo nuevo (hoja «Trabajo adicional» del Kanban) asignados según los roles del equipo: 99 h estimadas en total (91 h terminadas y 8 h de Docker pendientes). Son estimaciones, no horas registradas; los puntos de historia de E5 a E10 (36 en total) son una estimación propia, no un Planning Poker del equipo.

## Fechas de las pruebas (reales)
El Plan de pruebas (07) usa las fechas reales de la evidencia: sprints 1 a 3 el 04/11 y 05/11/2026, sprint 4 el 05/11, compatibilidad de navegadores (Chromium, Edge y WebKit) y prueba de Oracle el 04/11, suites de conversación del 12 al 14/11. Con esa evidencia CP-28 pasó a «Aprobado (auto.)» (Safari y dispositivos físicos sin probar). No se pusieron fechas de septiembre porque no hay pruebas de esa fecha.

## Para decidir por el equipo (no se tocó)
- Daily Standup: sigue con «Pendiente de registro: reunión no acreditada»; no se inventaron reuniones.
- Burndown diario: sin fechas de aceptación verificadas; no se interpolaron datos.
- Cambiar tareas a «Terminado», asignar responsables y confirmar con Planning Poker los puntos de las historias nuevas.
- Retrospectiva del Sprint 4: registrar los resultados reales si ya se hizo.
- Diarios de reflexión: mencionan Google Maps; ahora el mapa usa OpenStreetMap con enlace de ruta a Google Maps.
- Video Pitch: no revisado.

## Limitaciones honestas
- Docker no está implementado (CP-30 queda Bloqueado).
- "Aprobado (auto.)" en CP-01 a CP-26 asigna las suites automatizadas (453 casos) por área funcional, no una a una; conviene revisar CP-03, CP-10 y CP-18 manualmente antes de adjuntar evidencia.
- CP-27: medición preliminar (respuestas locales de 1 ms a 1,35 s); falta la tabla de 5 consultas con Ollama. CP-28 y CP-29 sin ejecutar.
- Capturas manuales pendientes. Los .docx pasaron validación estructural (XSD) pero no se abrieron en Word.
