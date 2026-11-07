# Fase 3B — implementación de dominio clínico

Fecha de verificación: 2026-09-28

Estado de verificación inicial: **PARTIAL**. Las decisiones T-01 y T-04 se recibieron después; ambas se implementaron y verificaron según `docs/audits/phase3b-closure.md`.

Fase 3A: **DONE**. No se creó commit.

## Alcance y causa raíz

La auditoría de Fase 3A encontró reglas clínicas repetidas entre clientes y FastAPI, estados de evidencia que se interpretaban de forma distinta, cálculo de elegibilidad repartido entre pantallas y backend, y cambios de catálogo que no conservaban una representación histórica verificable. La causa común era que las señales de dominio no tenían un evaluador backend único ni snapshots versionados ligados a los cambios que alteran el esquema.

El cuerpo de este informe conserva el contexto de la implementación inicial. Las decisiones posteriores T-01 y T-04 reemplazan las incertidumbres y el estado de pruebas indicados en ese corte; la evidencia final está en `docs/audits/phase3b-closure.md`.

## Reglas y arquitectura implementadas

- FastAPI concentra `is_up_to_date`, `is_complete` e `is_certifiable` en `evaluate_scheme`; certificado y endpoints de esquema consumen el mismo evaluador.
- La fecha actual clínica se obtiene en `America/Bogota`; las fechas de aplicación/vencimiento son `date`, no instantes UTC. Fechas futuras se rechazan y las pasadas no tienen límite de antigüedad.
- La anualidad se obtiene exclusivamente de `Vaccine.is_annual`; el aniversario permanece válido durante todo el día. La regla especial de 29/02 aún no estaba implementada en esta verificación.
- FastAPI expone señales por dosis `is_overdue` e `is_due_today`. Flutter y Next las representan. `days_until_due` permanece para el conteo; el umbral visual existente de siete días es presentación y no decide elegibilidad.
- Flutter/Next consumen las señales globales del backend y ya no reconstruyen elegibilidad o completitud a partir de estados locales. Si una respuesta/cache de transición carece de señal de vencimiento, la UI conserva la fecha y no infiere que está vencida.
- Evidencia usa `IN_REVIEW`, `APPROVED` y `DENIED`; los alias legacy se preservan sin inferir un resultado de revisión. El vínculo y transición automática a dosis se incorporan tras la decisión T-04.
- Cambios de catálogo, reglas, sexo/género autorizado, programa o campus guardan snapshots append-only y archivan lógicamente asignaciones anteriores. Las filas clínicas y fechas previas permanecen.
- Un estudiante no puede cambiar su sexo/género desde su perfil; el endpoint responde 403. El administrador con autorización puede hacerlo y dispara reconciliación versionada.
- Los contratos globales, evidencia, paginación y errores se documentan en `docs/domain/api-contract-matrix.md`.

## Bloques y archivos principales

| Bloque | Resultado | Archivos principales |
|---|---|---|
| 0. Documentación | DECIDIDO/PARCIAL/PENDIENTE explícitos; las 16 decisiones recibidas ya no figuran como UNKNOWN | `docs/domain/clinical-decisions.md`, `decision-log.md`, `clinical-rules-matrix.md`, `state-transition-matrix.md`, `api-contract-matrix.md` |
| 1. Reglas puras | Predicados, vencimientos y validación de fecha centralizados | `backend/app/modules/vaccination_scheme/rules.py`; `backend/tests/test_vaccination_rules.py` |
| 2. Estados/transiciones | Estados oficiales, revisión auditada; edición de DENIED por estudiante regresa a IN_REVIEW | `backend/app/common/enums.py`, `backend/app/modules/evidence/*`, `backend/app/modules/vaccination_scheme/service.py`, tests de evidencia y E2E |
| 3. Versionado | Snapshots before/after y archivado lógico con conservación de historia | `backend/app/modules/vaccination_scheme/{models,service}.py`, `backend/app/modules/admin/{students,vaccines}/service.py`, `backend/app/modules/vaccines/models.py`, `backend/app/db/seed.py` |
| 4. Elegibilidad | Servicio puro compartido por esquema y certificado | `backend/app/modules/vaccination_scheme/rules.py`, `router.py`, `backend/app/modules/certificates/service.py` |
| 5. API/DTOs | Señales globales y por dosis, fecha evaluada, versión, errores uniformes | `backend/app/modules/vaccination_scheme/{schemas,router}.py`, `backend/app/modules/admin/router.py`, `backend/app/main.py`, `backend/app/core/exceptions.py` |
| 6. Flutter | Eliminados cálculos locales; UI muestra señales recibidas y estado offline no verificado | `frontend/lib/features/student/data/models/vaccine_model.dart`, pantallas de esquema/certificado/admin, `frontend/test/features/student/data/models/vaccine_model_contract_test.dart` |
| 7. Next | Tipos/backend flags y representación de señal por dosis/global | `frontend-next/src/lib/api/types.ts`, páginas de esquema/certificado/admin, `frontend-next/src/components/vaccine-due-badge.tsx` |
| 8. Evidencias/listados | Revisión/paginación contractual aditiva | `backend/app/modules/evidence/*`, DTOs/datasources Flutter y Next |
| 9. E2E | Flujo login→esquema→evidencia→revisión→elegibilidad→certificado y permisos/concurrencia | `backend/tests/test_phase1_e2e.py`, `test_phase1_migration.py`, `test_admin_integration.py` |

## Migraciones

Se agregó únicamente `backend/alembic/versions/2026_09_27_0400_clinical_statuses.py` (head 0400, descendiente de 0300). Añade valores de enum de evidencia, auditoría de revisión, tabla `student_scheme_versions`, `vaccine_rules.is_active` y normalización explícita de valores legacy indicados. No elimina filas ni columnas. El downgrade se rechaza intencionalmente: volver atrás implicaría descartar estados/versiones o la trazabilidad añadida. Rollback operacional: desplegar una corrección forward compatible; restaurar desde backup solo si una operación de datos lo exige y con autorización del propietario.

La cadena completa se ejecutó en PostgreSQL 18.6 con bases vacías locales y sintéticas; se comprobó repetición de upgrade, conservación de filas y un caso concurrente approve/edit. No se ejecutó sobre datos institucionales/productivos.

## Pruebas y resultados

| Plataforma | Verificación en el corte inicial | Resultado |
|---|---|---|
| Backend | `.venv/bin/pytest -q` con `PHASE1_INTEGRATION_URL`, `PHASE1_POSTGRES_URL`, `PHASE2_POSTGRES_URL` apuntando solo a PostgreSQL local desechable | **328 passed**, 7 warnings, 49.95 s. Incluye E2E, migraciones PostgreSQL y concurrencia; no hubo skips de esas dos migraciones. |
| Backend, señal final de vencimiento | `pytest -q tests/test_api_contracts.py tests/test_vaccination_rules.py` | **26 passed**; Ruff check y format check PASS. Después se amplió la prueba de frontera anual: `pytest -q tests/test_vaccination_rules.py` **20 passed**, Ruff check PASS, 136 archivos ya formateados. |
| PostgreSQL | Migraciones Fase 1/2/3B, repetición de upgrade, filas históricas, estados de evidencia, concurrencia | **PASS** en DBs desechables `immuno_phase1_*` y `immuno_phase2_*`. Una primera corrida encontró DBs ya migradas porque había dos invocaciones activas; se repitió con bases nuevas y limpias, y la corrida completa posterior pasó. |
| Next | Vitest | **48 passed, 3 skipped** (12 archivos aprobados, 1 skip). Incluye pruebas de `VaccineDueBadge` con señales backend y respuesta de transición sin flag. |
| Next | ESLint | **PASS**, salida sin errores. |
| Next | `tsc --noEmit` | **PASS**, salida sin errores. |
| Next | `next build --webpack` | **PASS**, 26 páginas generadas; Turbopack fuera de este gate. |
| Flutter | `flutter analyze` | **PASS**, sin issues. |
| Flutter | `flutter test` | **44 passed**. |
| Flutter | `dart format --output=none --set-exit-if-changed lib test/features/student/data/models/vaccine_model_contract_test.dart` | **PASS**, 60 archivos comprobados, 0 cambios. |
| Revisión de diff | `git diff --check` | **PASS** al momento de escribir la documentación; se repetirá como verificación final. |

Las siete advertencias backend conocidas son seis avisos SQLAlchemy `noload` y uno deprecado de Firebase `MulticastMessage.tokens`; no hicieron fallar gates y quedan como deuda separada. Tres pruebas Next aparecen skipped por condiciones propias de la suite; no se atribuye un resultado PASS a esas tres pruebas. La verificación posterior de T-01/T-04 y los gates repetidos están registrados en `phase3b-closure.md`.

## Riesgos y rollback

- **Riesgo histórico del corte inicial, resuelto:** la regla aniversario para aplicación el 29 de febrero fue definida e implementada después: 28/02 en año siguiente no bisiesto y 29/02 si es bisiesto. Ver T-01 y `phase3b-closure.md`.
- **Riesgo de datos:** los snapshots conservan información clínica histórica, pero solo se probaron con datos sintéticos. Falta revisar integridad/volumen y criterios de retención institucionales antes de aplicar migración a un entorno con datos existentes.
- **Compatibilidad de despliegue:** campos de respuesta nuevos son aditivos y nullable para consumidores/versiones mixtos; clientes actuales no infieren vencimiento si falta la señal.
- **Rollback de aplicación:** reversión de binario a una versión compatible y corrección forward. La migración no soporta downgrade destructivo; conservar la tabla/snapshots y no borrar historial.
- No se tocó Azure, mapas, diseño PDF, QR, reglas no aprobadas ni despliegue productivo.

## Pendientes — no completados

| ID | Estado | Falta / qué depende |
|---|---|---|
| T-01 aniversario 29 de febrero | **DONE** | Implementado y probado en `phase3b-closure.md`. |
| T-02 snapshots frente a información institucional | **PARTIAL** | Fixtures y pruebas sintéticas ahora cubren catálogo, reglas, sexo, programa y campus, con conservación de snapshots, dosis, titulación y revisiones. Falta validación con un dataset institucional autorizado; no se cuenta la evidencia sintética como cierre. |
| T-03 datos legacy | **PARTIAL** | Se preparó un comparador offline y fixtures de dosis/evidencias/titulación/estados/fechas/parciales. No se verificó ni conectó ningún dataset institucional; valores ambiguos como `reviewed` no se reinterpretan. |
| T-04 lote de evidencia a dosis | **DONE** | Asociación opcional y aprobación transaccional implementadas y probadas en `phase3b-closure.md`. |

Las decisiones D-01..D-17 están DECIDIDAS. T-02 y T-03 permanecen PARCIAL/UNKNOWN por depender de datos institucionales reales, fuera de la evidencia disponible. El cierre de los pendientes T-01/T-04 se determina en `docs/audits/phase3b-closure.md`.

## Cierre de T-01 y T-04

- T-01: `annual_anniversary_in_year` resuelve el 29/02 sin construir una fecha inválida; mantiene los aniversarios inclusivos y la evaluación del día actual en `America/Bogota`.
- T-04: la relación opcional evidencia-dosis se almacena mediante migración aditiva. La aprobación autorizada modifica evidencia y dosis dentro de una transacción; las pruebas cubren rollback y dos aprobaciones concurrentes.
- La evidencia final de backend, PostgreSQL, migraciones, Next y Flutter, junto con los riesgos y el rollback, está en `docs/audits/phase3b-closure.md`.
