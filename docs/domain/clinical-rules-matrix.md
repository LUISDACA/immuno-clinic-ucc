# Matriz normativa de reglas clínicas — Fase 3B

Autoridad: FastAPI. Las decisiones de esta tabla son las aprobadas en [clinical-decisions.md](clinical-decisions.md); los hallazgos de auditoría anteriores describen comportamiento histórico y no prevalecen sobre estas decisiones.

| ID | Regla normativa | Capa propietaria | Estado | Clientes | Prueba mínima |
|---|---|---|---|---|---|
| CR-01 | AL DÍA = cumplidas todas las dosis correspondientes hasta la fecha de evaluación; las futuras/no correspondientes no bloquean. | Backend domain service | DECIDIDO | Flutter/Next muestran boolean y textos | cubiertas actual, futuras, vencidas, mezcla actual/futura |
| CR-02 | COMPLETO = todos los requerimientos de vacunas cubiertos. | Backend domain service | DECIDIDO | representación únicamente | todas las dosis y combinación titulación+dosis de varias vacunas |
| CR-03 | Titulación válida cubre por completo sus requerimientos de vacuna. | Backend domain service | DECIDIDO | no recalcular | título válido y vencido/denegado restante según decisión: título satisface vacuna |
| CR-04 | CERTIFICABLE es decisión exclusiva backend; al día/incompleto puede certificar; futuro no bloquea; dosis DENEGADA bloquea; título válido puede satisfacer vacuna. | Backend eligibility service | DECIDIDO | consumir resultado | matriz de decisiones y consistencia emisión certificado |
| CR-05 | Estado oficial: EN REVISIÓN/APROBADO/DENEGADO; en reportes EN REVISIÓN puede agruparse como PENDING, que no es estado clínico separado. | Backend enum + reporting projection | DECIDIDO | etiqueta/agrupación | enum exacto, filtro agregado reportes |
| CR-06 | Admin normal revisa y cambia estados permitidos; estudiante editando DENEGADA produce EN REVISIÓN, nunca APROBADO. | Backend transition service | DECIDIDO | acción disponible por permisos | matriz de transición, rol, replay concurrente |
| CR-07 | Fecha clínica calendario; “hoy” basado en America/Bogota; vencimiento válido inclusive todo el día. | Backend pure date rules | DECIDIDO | formatear date sin UTC | límite de día, timezone, fin de mes/año bisiesto |
| CR-08 | Fecha de aplicación <= hoy Bogotá; pasado sin límite de antigüedad. | Backend request/domain validation | DECIDIDO | enviar date ISO | futuro rechazo, hoy y pasado aceptación |
| CR-09 | Anualidad con `Vaccine.is_annual`, nunca `DoseType.annual`; aniversario inclusivo. Aplicación 29/02 vence 28/02 si el próximo año no es bisiesto y 29/02 si lo es. Evaluación en `America/Bogota`. | Backend vaccine rule | DECIDIDO | mostrar flag/fecha backend | 28/02 normal/bisiesto, 29/02, ambos aniversarios, zona y límites de día |
| CR-10 | Cambio catálogo/reglas/sexo-género/programa/campus crea nueva versión/reconciliación y conserva historia. | Backend version/reconciliation service | DECIDIDO | refrescar versión | cada disparador y snapshots históricos inmutables |
| CR-11 | Estudiante no edita género; admin autorizado sí. | Backend authorization | DECIDIDO | ocultar acción según rol sin ser control de seguridad | student 403, admin autorizado éxito, scopes |
| CR-12 | Cache offline puede estar stale; mensaje exacto y nunca validado como estado actual. | Flutter presentation + cache metadata | DECIDIDO | Flutter muestra stale | cache vieja, cambio usuario, logout, respuesta tardía |
| CR-13 | Contrato estándar de paginación y error sanitizado definidos en clinical-decisions. | Backend API contract | DECIDIDO | parsear y representar | shape/compatibilidad y sin datos sensibles |
| CR-14 | Next enum exacto: sin `Gender.other`, `ConversationStatus.archived`, `DoseType.annual`. | API/OpenAPI source | DECIDIDO | tipos contractuales | comparar unions con enums backend |
| CR-15 | Evidencia asociada aprobada por admin: EN REVISIÓN→APROBADA y dosis asociada→APROBADA atómicamente; DENIED no produce aprobación de dosis. | Backend evidence transaction | DECIDIDO | asociación opcional al subir; representar resultados | propiedad, roles, rollback y dos aprobaciones concurrentes |

## Decisiones resueltas y pendientes técnicos acotados

| ID | Tema | Estado | Límite seguro |
|---|---|---|---|
| U-01 | Aniversario anual aplicado el 29 de febrero | DECIDIDO | 28/02 en el siguiente año no bisiesto; 29/02 en el siguiente año bisiesto. |
| U-02 | Revisión de evidencia batch asociada a dosis | DECIDIDO | Aprobación admin actualiza evidencia y dosis en la misma transacción; DENIED no aprueba dosis. |
| U-03 | Valores legacy de estados almacenados | PARCIAL | Preservar datos; mapear solo equivalencias inequívocas. No alterar resultados ambiguos. |
| U-04 | Esquema físico de snapshots/versiones | PARCIAL | Se implementó `StudentSchemeVersion` con snapshots JSONB append-only y archivado lógico de asignaciones/dosis; cadena migratoria validada en PostgreSQL desechable. Validación contra datos/replicas institucionales de producción sigue UNKNOWN y no se ejecutó. |

Las reglas clínicas no se implementan en Flutter/Next. Los clientes no deben derivar elegibilidad usando fechas, estados de dosis, tipo anual, titulación ni configuración de vacuna.
