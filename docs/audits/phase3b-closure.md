# Cierre de decisiones T-01 y T-04 — Fase 3B

Fecha: 2026-09-28
Alcance: únicamente resolver e implementar T-01 (aniversario anual del 29/02) y T-04 (aprobación de evidencia vinculada a una dosis). No incluye PDF, QR, Google Maps ni Azure. No se hizo commit.

## Estado

**FASE 3B = PARTIAL. T-01 = DONE; T-04 = DONE.**
El alcance solicitado en este cierre está verificado. La fase completa permanece PARTIAL porque T-02 y T-03 continúan PARCIAL/UNKNOWN en el registro de implementación: su validación restante requiere inspeccionar datos institucionales autorizados. Esa evidencia no estaba disponible en esta tarea y no se sustituyó por datos reales ni por supuestos.

Las decisiones clínicas implementadas son exactamente las aprobadas: T-01 usa el 28/02 cuando el año aniversario no es bisiesto y conserva 29/02 cuando sí lo es; T-04 solo vincula una dosis cuando se selecciona explícitamente y una aprobación autorizada de evidencia EN REVISIÓN aprueba esa dosis en la misma transacción. DENEGADA no produce aprobación de dosis.

## Causa raíz

- **T-01:** el cálculo anterior de aniversario no tenía una política definida para el 29 de febrero. Construir la misma fecha en un año no bisiesto generaba una fecha inválida o requería escoger una convención no aprobada.
- **T-04:** los lotes de evidencia no guardaban asociación con una dosis. Por ello la revisión de un archivo no podía actualizar de forma consistente el estado de la dosis correspondiente; separar las escrituras habría permitido que evidencia y dosis quedaran en estados divergentes.

## Cambios

| Decisión | Archivos principales | Solución |
|---|---|---|
| T-01 | `backend/app/modules/vaccination_scheme/rules.py`, `backend/tests/test_vaccination_rules.py` | `annual_anniversary_in_year` genera fechas calendario válidas, incluyendo 29/02 → 28/02 en año no bisiesto y 29/02 en año bisiesto. Los cálculos siguen usando `date`; `clinical_today()` deriva el día en `America/Bogota` y el vencimiento es inclusivo hasta el final del día. |
| T-04 | `backend/app/modules/evidence/{models,repository,router,schemas,service}.py`, `backend/alembic/versions/2026_09_28_0100_evidence_dose_link.py`, `backend/tests/test_evidence_dose_link.py`, `backend/tests/test_phase1_e2e.py`, `backend/tests/test_phase1_migration.py` | Se añadió asociación nullable opcional, validación de propiedad al subir, y revisión atómica. La evidencia genérica sin dosis conserva su flujo anterior. Solo administradores autorizados revisan; rechazo no aprueba la dosis. El rollback cubre errores de escritura. |
| Clientes | `frontend-next/src/{app/student/evidence/page.tsx,lib/api/{evidence,types}.ts}`, `frontend/lib/features/student/{data/{datasources/evidence_remote_ds.dart,models/evidence_model.dart},presentation/{providers/evidence_provider.dart,screens/evidence_upload_screen.dart}}` | Se ofrece asociación opcional de evidencia a una dosis del esquema y se envía `dose_id`; el contrato admite `null`/ausencia para compatibilidad. Los clientes no ejecutan reglas clínicas. |
| Documentación | `docs/domain/{clinical-decisions,decision-log,clinical-rules-matrix,state-transition-matrix,api-contract-matrix}.md`, `docs/audits/phase3b-implementation.md` | T-01/T-04 pasan a DECIDIDO y se documenta el comportamiento y su evidencia. Este archivo registra el cierre técnico. |

## Migración y rollback

Migración aditiva: `backend/alembic/versions/2026_09_28_0100_evidence_dose_link.py`. Agrega `evidence_batches.dose_id` nullable, una FK con `ON DELETE SET NULL` y un índice. Filas preexistentes conservan `NULL`; no se eliminan ni actualizan datos históricos.

No se permite downgrade que borre vínculos ya guardados; la migración falla explícitamente en downgrade para evitar pérdida. Rollback de aplicación: volver a una versión que ignore el campo aditivo. Si se requiere retirar el esquema, hacerlo mediante una migración forward aprobada que preserve/traslade asociaciones; no borrar datos ni editar una base productiva desde este cambio.

## Pruebas ejecutadas

Los tests PostgreSQL usaron bases locales desechables con datos sintéticos. No se usaron credenciales productivas.

| Área | Comando/verificación | Resultado |
|---|---|---|
| Backend completo + PostgreSQL | `.venv/bin/pytest -q` con `PHASE1_INTEGRATION_URL`, `PHASE1_POSTGRES_URL`, `PHASE2_POSTGRES_URL` apuntando a PostgreSQL local | **333 passed**, 7 warnings, 52.93 s. |
| T-04 concurrencia/rollback | `pytest -q tests/test_evidence_dose_link.py` contra PostgreSQL | **3 passed**: aprobación y estado relacionado; dos aprobaciones concurrentes; fallo transaccional deja ambos objetos intactos. |
| E2E clínico | `pytest -q tests/test_phase1_e2e.py` contra PostgreSQL | **7 passed**. Incluye login, esquema, carga asociada, denegación a estudiante, revisión por administrador, dosis APROBADA y certificado elegible. |
| Migraciones | `pytest -q tests/test_phase1_migration.py tests/test_phase2_migration.py` sobre bases PostgreSQL vacías desechables | **2 passed**. Se aplicó la cadena completa y se verificó que el vínculo legacy queda nullable. |
| Reglas T-01 | `pytest -q tests/test_vaccination_rules.py` (incluido en suite completa) | PASS en la suite completa. Cubre 28/02 normal, 28/02 aniversario no bisiesto, 29/02 aniversario bisiesto, año bisiesto y límite inclusivo/primer día vencido; el test de fecha actual fija UTC en un instante que corresponde al día anterior en Bogotá. |
| Next | `npm test -- --run` (Vitest) | **50 passed, 3 skipped**. Los tres skips permanecen skips; no se cuentan como aprobados. |
| Next lint/typecheck | `npm run lint`; `npx tsc --noEmit` | **PASS**. |
| Next build | `next build --webpack` | **PASS**, compilación de producción y generación de rutas completadas. |
| Flutter | `flutter analyze` | **PASS**, sin issues. |
| Flutter | `flutter test` | **44 passed**. |
| Flutter format de archivos T-04 | `dart format --output=none --set-exit-if-changed` en los cinco archivos Flutter modificados para esta decisión | **PASS**, 0 cambios. |
| Formato Python | `ruff check app tests`; `ruff format --check app tests` | **PASS**, 137 archivos verificados. |
| Diff | `git diff --check` | **PASS** en la revisión final. |

Las siete advertencias de backend son seis advertencias deprecadas de SQLAlchemy relacionadas con `noload` y una de Firebase relacionada con `MulticastMessage.tokens`; ninguna falló. No se afirma éxito para los tres tests Next omitidos.

## Riesgos y límites

- T-04 tiene prueba de concurrencia/rollback en PostgreSQL local real; no se aplicó la migración a una base institucional/productiva.
- T-02/T-03 siguen requiriendo revisión de datos institucionales autorizados. No bloquean la verificación técnica de las dos decisiones cerradas aquí, pero impiden afirmar validación de esos aspectos sobre datos reales.
- Flutter conserva su relación opcional para envío y representación; la transición final sigue siendo decisión de FastAPI.
- Los warnings de dependencias quedan como deuda técnica separada.
- Los tres tests Next marcados skip no proporcionan evidencia de cobertura.
- El chequeo adicional del formatter sobre todo `frontend/test` señala cuatro archivos preexistentes fuera de T-04 como modificables (`test/e2e/app_smoke_test.dart`, `test/e2e/login_flow_test.dart`, `test/features/admin/presentation/providers/admin_provider_test.dart`, `test/features/admin/presentation/screens/admin_dashboard_screen_test.dart`). No se reformatearon porque no pertenecen al alcance; los cinco archivos Flutter de T-04 sí pasan el chequeo.

## UNKNOWN pendientes

- **T-02:** volumen, retención y consistencia de snapshots con datos/replicas institucionales reales.
- **T-03:** valores legacy adicionales en registros reales y su tratamiento seguro sin reinterpretar un estado ambiguo.
- Credenciales/productividad de servicios externos no fueron necesarias para estos gates; por ello no se valida aquí el entorno productivo.

No quedan UNKNOWN para las políticas explícitas T-01 y T-04. No se implementaron reglas clínicas adicionales.
