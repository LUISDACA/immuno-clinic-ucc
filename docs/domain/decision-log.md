# Registro de decisiones clínicas y de dominio — Fase 3B

Fuente normativa: `clinical-decisions.md`, decisiones definitivas aprobadas por el propietario del producto/clínica. Los estados describen si existe definición y si está lista para código; no autorizan inferencias adicionales.

| ID | Decisión | Estado | Alcance / dependencias |
|---|---|---|---|
| D-01 | AL DÍA: todas las dosis que corresponden hasta la fecha de evaluación están cumplidas; dosis futuras aún no correspondientes no bloquean. | DECIDIDO | Predicado de esquema backend y reportes que expresen “al día”. |
| D-02 | COMPLETO: todos los requerimientos de todas las vacunas están cubiertos. Titulación válida cubre por completo esa vacuna. | DECIDIDO | Evaluador puro backend; su cobertura depende de titulación válida. |
| D-03 | CERTIFICABLE: decisión exclusiva del backend. AL DÍA e incompleto puede ser certificable; dosis futuras no bloquean; dosis DENEGADA bloquea; titulación válida cubre una vacuna. | DECIDIDO | Servicio central de elegibilidad, endpoint y certificado. Flutter/Next solo representan señal backend. |
| D-04 | Estados oficiales de evidencia/dosis: EN REVISIÓN, APROBADO, DENEGADO. EN REVISIÓN equivale funcionalmente a `PENDING` únicamente en reportes; no se crea estado clínico `PENDING`. Admin normal revisa y puede cambiar los estados correspondientes. | DECIDIDO | Mapear enums/API sin introducir estado separado `PENDING`; conservar compatibilidad de valor histórico solo con traducción explícita. |
| D-05 | Todas las fechas clínicas son fechas calendario; no se convierten a UTC. Evaluación de “hoy” en `America/Bogota`. | DECIDIDO | API serializa `YYYY-MM-DD`; zona solo para obtener fecha actual. |
| D-06 | Vencimiento inclusive: fecha de vencimiento completa es válida; vencida desde el día siguiente. | DECIDIDO | Comparación de `date`, tests de frontera. |
| D-07 | Anualidad se representa con `Vaccine.is_annual`; no existe `DoseType.annual`. Vence en el aniversario calendario inclusivo; aplicación 29/02 vence 28/02 si el siguiente año no es bisiesto o 29/02 si sí lo es. | DECIDIDO | Backend; `America/Bogota` determina la fecha de evaluación. |
| D-08 | Fecha de aplicación no puede ser futura en `America/Bogota`; fechas pasadas no tienen límite de antigüedad en esta fase. | DECIDIDO | Validación backend autoritativa y pruebas. |
| D-09 | Editar dosis DENEGADA por estudiante la devuelve a EN REVISIÓN; nunca aprueba automáticamente. | DECIDIDO | Servicio transición backend, autorización y auditoría. |
| D-10 | Cambios de catálogo o reglas crean nueva versión de esquema; no destruyen histórico. | DECIDIDO | Versionado aditivo y reconciliación preservando asignaciones y revisiones anteriores. |
| D-11 | Estudiante no cambia sexo/género; administrador autorizado puede hacerlo y produce nueva versión/reconciliación conservando historia. | DECIDIDO | Permisos por endpoint y versionado. |
| D-12 | Cambios de programa/campus siguen el mismo versionado/reconciliación con historial. | DECIDIDO | Perfil administrativo, reconciliación aditiva. |
| D-13 | Offline Flutter puede mostrar cache vieja con texto exacto “Información no verificada por falta de conexión.” Nunca se presenta como validada actualmente por backend. | DECIDIDO | UI solamente; acciones online siguen requiriendo servidor. |
| D-14 | Paginación estándar: `page`, `page_size`, `total`, `total_pages`, `has_next`, `has_previous`, `items`. | DECIDIDO | Contrato canónico aditivo manteniendo alias previos donde sean usados. |
| D-15 | Error estándar: `code`, `message`, `details` opcional; sanitizado y sin PII/PHI innecesaria. | DECIDIDO | Mantener status HTTP y compatibilidad temporal con `detail`. |
| D-16 | Next no admite `Gender.other`, `ConversationStatus.archived`, `DoseType.annual`; anualidad es `Vaccine.is_annual`. | DECIDIDO | Tipos clientes deben reflejar enum backend exacto. |
| D-17 | Aprobar evidencia asociada por administrador cambia evidencia EN REVISIÓN→APROBADA y dosis asociada→APROBADA en una transacción; DENEGADA no aprueba dosis. | DECIDIDO | Vínculo opcional y aditivo; comprobar permisos, rollback y concurrencia. |
| D-18 | El certificado incorpora la firma visual del administrador normal que lo emite y conserva la versión exacta usada. No es firma digital criptográfica. | DECIDIDO | Versionado privado, referencia por emisión, auditoría y PDF inmutable; sin recurso público de imagen. |
| D-19 | En emisión por autoservicio, firma el administrador normal asignado explícitamente al par exacto programa + campus del estudiante, usando su firma activa. Sin asignación se responde `409 CERTIFICATE_SIGNER_NOT_ASSIGNED`; sin ámbito, `409 CERTIFICATE_SIGNER_SCOPE_MISSING`; sin firma activa, `409 CERTIFICATE_SIGNER_SIGNATURE_MISSING`. Está prohibido elegir estudiante, administrador arbitrario, otro administrador o primer coincidiente. | DECIDIDO | Implementado con asignación versionada, índice único parcial, errores fail-closed y referencias históricas por emisión. Configurar cada ámbito tras migrar. Ver `docs/audits/certificate-signer-policy.md`. |
| D-20 | Solo `app_admin` puede crear y consultar asignaciones de responsables, acorde a sus permisos existentes sobre administradores normales. El asignado debe ser `admin` activo y coincidir exactamente con el programa/campus configurado. | DECIDIDO | Endpoints administrativos protegidos, cambios auditados e historial conservado. |

## Seguimiento de implementación y decisiones técnicas

| ID | Pendiente | Estado | Condición de cierre |
|---|---|---|---|
| T-01 | Regla de aniversario para aplicación el 29 de febrero. | DECIDIDO | 28/02 en el siguiente año no bisiesto; 29/02 en el siguiente año bisiesto. Verificada en Fase 3B closure. |
| T-02 | Forma de versionado de vacuna/reglas mediante snapshots de esquema append-only y archivado lógico. | PARCIAL | Implementación y migración se validaron en PostgreSQL desechable; contraste con datos/replicas institucionales reales permanece UNKNOWN. |
| T-03 | Definir compatibilidad/transición de registros legacy `pending`, `uploaded`, `under_review`, `reviewed`. | PARCIAL | Inspección de datos y uso; preservar historial, no mapear un resultado clínico ambiguo sin evidencia. |
| T-04 | Aprobación de evidencia asociada frente a estado de dosis. | DECIDIDO | Aprobar actualiza evidencia y dosis asociada atómicamente; denegar evidencia no aprueba dosis. Verificada en Fase 3B closure. |

No queda como UNKNOWN ninguna de las 17 decisiones explícitas. T-01 y T-04 dejan de ser decisiones pendientes; las pruebas se registran en `phase3b-closure.md`.
