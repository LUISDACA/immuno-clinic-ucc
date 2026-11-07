# Matriz normativa de estados y transiciones — Fase 3B

Los estados de dominio y las transiciones se deciden en FastAPI. La UI presenta el estado y ofrece únicamente acciones que la API autoriza. Estados no definidos aquí no deben introducirse como decisiones clínicas.

## Estados y señales derivadas

| Concepto | Valores/contrato | Quién lo decide | Representación Flutter/Next | Estado |
|---|---|---|---|---|
| Estado de dosis/revisión | `IN_REVIEW`, `APPROVED`, `DENIED` (serialización wire según enum API) | FastAPI | etiqueta exacta/localizada | DECIDIDO |
| `PENDING` de reporte | Agregación/reporting alias de EN REVISIÓN; no estado persistido independiente | FastAPI report projection | filtro/contador reportable | DECIDIDO |
| Estado agregado de vacuna | Señal backend calculada con reglas vigentes y titulación; el cliente no deriva | FastAPI | muestra campo retornado | DECIDIDO |
| AL DÍA | boolean/señal calculada según fechas de evaluación | FastAPI | muestra señal | DECIDIDO |
| COMPLETO | boolean/señal de todos los requerimientos cubiertos | FastAPI | muestra señal | DECIDIDO |
| CERTIFICABLE | resultado backend exclusivo + código/motivo seguro | FastAPI | habilita/representa resultado | DECIDIDO |
| Esquema | versión/reconciliación identificable; anteriores conservados | FastAPI | muestra esquema vigente/versionado | DECIDIDO |
| Certificado | emisión permitida solo desde elegibilidad backend; sin nuevo estado local | FastAPI | descarga/resultado | DECIDIDO |
| Lote evidencia | `IN_REVIEW`, `APPROVED`, `DENIED`; `PENDING` solo como agrupación de reporte | FastAPI | presenta lo recibido | PARCIAL: compatibilidad de estados históricos legacy |

## Transiciones normativas

| Entidad | Actor | Origen | Acción | Destino | Reglas/efectos | Estado |
|---|---|---|---|---|---|---|
| Dosis | Estudiante dueño | DENIED | corregir/reenviar dosis | IN_REVIEW | Nunca autoaprobar; limpiar solo metadatos de revisión invalidada según historial preservado | DECIDIDO |
| Dosis | Estudiante | APPROVED | editar campos clínicos | Sin transición/edición rechazada | Requiere conservar regla de protección existente; decisión de 3B no la relaja | DECIDIDO (regla preservada) |
| Dosis | Admin normal autorizado | IN_REVIEW, APPROVED o DENIED | revisión explícita | uno de los estados permitidos por dominio | El backend valida transición y autorización, audita actor/tiempo; no asumir aprobación por carga/edición | DECIDIDO |
| Dosis | Actor no autorizado | cualquiera | modificar/revisar | sin cambio | Respuesta 403/404 conforme a contrato seguro | DECIDIDO |
| Esquema | Sistema, tras cambio de catálogo/reglas | versión vigente | reconciliar | nueva versión vigente | Histórico anterior inmutable; no borrar dosis, revisiones, evidencias o snapshots históricos | DECIDIDO |
| Esquema | Admin autorizado, cambio género | versión vigente | reconciliar | nueva versión | Estudiante prohibido; historial intacto | DECIDIDO |
| Esquema | Admin autorizado, cambio programa/campus | versión vigente | reconciliar | nueva versión | Historial intacto | DECIDIDO |
| Certificado | Estudiante/rol autorizado | evaluación backend | solicitar emisión | PDF si certificable; error seguro si no | El generador y endpoint consultan el mismo servicio central; cliente no preevalúa | DECIDIDO |
| Evidencia batch sin dosis asociada | Admin normal autorizado | `IN_REVIEW` | revisar | `APPROVED` o `DENIED` | Registra actor/fecha; conserva el flujo general sin efecto clínico en dosis | DECIDIDO |
| Evidencia batch asociada a dosis | Admin normal autorizado | `IN_REVIEW` | aprobar | `APPROVED` | Dosis asociada pasa a `APPROVED` en la misma transacción; rollback de ambos cambios ante fallo | DECIDIDO |
| Evidencia batch asociada a dosis | Admin normal autorizado | `IN_REVIEW` | denegar | `DENIED` | No aprueba ni modifica la dosis asociada | DECIDIDO |
| Evidencia batch | Estudiante u otro actor sin permiso | `IN_REVIEW` | revisar | sin cambio | 403; lote y dosis sin mutación | DECIDIDO |

## Invariantes

- Un resultado clínico se calcula del lado servidor y no se confía en valores enviados por el cliente.
- La actualización DENIED -> IN_REVIEW y la revisión transaccional evidencia+dosis deben usar bloqueos que impidan resultados parciales o carreras; cambios de versión no sobrescriben filas históricas.
- Estado derivado de una vacuna, AL DÍA, COMPLETO y CERTIFICABLE son señales distintas; no reutilizar el mismo enum para ocultar semánticas diferentes.
- `PENDING` solo puede aparecer como alias de agregación en reporte, nunca como un cuarto estado clínico nuevo.
- Estados históricos desconocidos se preservan durante lectura/migración hasta resolver su mapeo; no reemplazarlos por aprobación o denegación por defecto.
