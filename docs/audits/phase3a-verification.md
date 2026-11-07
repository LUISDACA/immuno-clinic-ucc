# Verificación de entorno y gates — Fase 3A

Fecha: 2026-09-27. No se hizo commit ni se modificaron reglas clínicas. No se añadieron dependencias al manifiesto ni migraciones. Los servidores PostgreSQL desechables se detuvieron después de las pruebas; sus clústeres y datos sintéticos permanecen bajo `/tmp/phase3a-tools/`.

## Entorno utilizado

| Componente | Versión / configuración | Fuente |
|---|---|---|
| Python | 3.12.14, venv `backend/.venv` | Python gestionado con uv en `/tmp`; CI declara Python 3.12. |
| uv | 0.12.19 | Binario temporal bajo `/tmp`; no es dependencia del proyecto. |
| FastAPI | 0.141.1 | Instalado desde el rango declarado `fastapi>=0.115.6`. |
| pytest / pytest-asyncio | 9.1.1 / 1.4.0 | Rangos de `backend/requirements-dev.txt`; suite final ejecutada con la resolución actual del rango. |
| SQLAlchemy / Pydantic | 2.1.1 / 2.13.5 | Rangos de `backend/requirements.txt`. |
| PostgreSQL | 18.6 | Dos clústeres locales temporales; solo loopback/socket, autenticación trust local y bases vacías sintéticas. |
| Node / npm | 20.20.2 / 10.8.2 | Node oficial temporal en `/tmp`, checksum SHA-256 verificado contra el manifiesto oficial. CI fija Node 20. |
| Next / TypeScript / Vitest | 16.3.6 / 5.9.3 / 4.1.11 | Instalados por `npm ci` desde `frontend-next/package-lock.json`. |
| Flutter | versión fijada por CI: 3.41.6 | Analyze y tests PASS ya registrados en la auditoría anterior; no hubo cambios Flutter en esta preparación. |

No existe `backend/pyproject.toml`, `.python-version`, `.nvmrc`, `.node-version`, `uv.lock` ni lockfile Python. El único lockfile web es `frontend-next/package-lock.json`. CI usa `pip install -r requirements.txt -r requirements-dev.txt`; por tanto esos archivos expresan mínimos, no una resolución reproducible bloqueada. `npm ci` instaló 500 paquetes desde el lock y reportó cero vulnerabilidades en su auditoría integrada. No se instalaron paquetes globales.

## Configuración y comandos reproducibles

### Backend

CI espera Python 3.12. El venv se creó con `uv venv --python 3.12 backend/.venv`; se instalaron únicamente `backend/requirements.txt` y `backend/requirements-dev.txt` con `uv pip install`. Para repetir en una máquina con Python 3.12 disponible:

```sh
cd backend
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt -r requirements-dev.txt
pytest tests -v
ruff check app tests
ruff format --check app tests
uvicorn app.main:app --reload
```

FastAPI carga `DATABASE_URL`, `SECRET_KEY` y `REFRESH_SECRET_KEY` desde entorno o `backend/.env`; configurar valores de desarrollo sintéticos antes de iniciar. No se leyó ni imprimió ningún `.env` o secreto. Para pruebas rápidas, `backend/tests/conftest.py` fuerza SQLite en memoria. Los tests PostgreSQL opt-in exigen bases locales desechables: `PHASE1_INTEGRATION_URL`, `PHASE1_POSTGRES_URL` y `PHASE2_POSTGRES_URL`. Las pruebas de migración verifican nombres `immuno_phase1_*`/`immuno_phase2_*` y que la base esté vacía; ejecutarlas exclusivamente contra DB temporales vacías.

En esta ejecución se usaron dos PostgreSQL 18.6 aislados y bases sintéticas `immuno_phase1_integration`, `immuno_phase1_migration_verify3`, `immuno_phase2_migration_verify3` e `immuno_phase3a_next`. Las migraciones quedaron aplicadas únicamente en sus DB de prueba y el esquema de integración Next borró sus esquemas aislados al terminar. No se usó ninguna DB externa o productiva.

### Next.js

CI fija Node 20 con `actions/setup-node@v4`, caché npm y `npm ci`. No hay `.nvmrc` ni `engines` declarado en el `package.json`; usar Node 20 para igualar CI y satisfacer Next 16. Comandos disponibles:

```sh
cd frontend-next
npm ci
npm test
npm run lint
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

`typecheck` no tiene script en `package.json`; se verificó mediante `tsc --noEmit`. La opción `BFF_TEST_DATABASE_URL` habilita los tres tests BFF/sesión que prueban almacenamiento compartido real; su valor debe apuntar a una DB local desechable cuyo nombre comience por `immuno_phase`.

No existe paquete, script npm ni job CI para generar tipos OpenAPI. Se conserva FastAPI `app.openapi()` como fuente contractual y las pruebas de contrato como mecanismo vigente de detección de drift. En esta ejecución se exportó `/tmp/phase3a-openapi.json` (OpenAPI 3.1.0, 56 rutas, 68 schemas) y se ejecutó `backend/tests/test_api_contracts.py` (6 pruebas) para validar enums, nullability, fechas, errores y paginación entre servidor y clientes. La generación automática de tipos TypeScript/Dart no es requisito de cierre; queda como deuda técnica P2, sin dependencia añadida.

## Resultados

| Gate | Resultado | Evidencia |
|---|---|---|
| Backend suite completa + PostgreSQL | PASS | `pytest tests -v`: **314 passed**, 7 warnings, 46.11 s. Incluyó flujos concurrentes y los dos tests de migración sobre PostgreSQL real local. |
| PostgreSQL concurrencia/migración | PASS | `PHASE1_INTEGRATION_URL` apuntó a la DB PostgreSQL desechable; sesiones, rate limit y catálogo concurrentes pasaron. `PHASE1_POSTGRES_URL` y `PHASE2_POSTGRES_URL` apuntaron a DBs vacías separadas y ambas pruebas de migración pasaron. |
| Backend Ruff | PASS | `ruff check app tests`; `ruff format --check app tests` — “All checks passed”, 136 archivos formateados. |
| Next tests | PASS | Con PostgreSQL local en `BFF_TEST_DATABASE_URL`: **12 archivos, 48 tests passed**, cero skips. |
| Next lint | PASS | `npm run lint` (ESLint, sin salida de errores). |
| Next typecheck | PASS | `node node_modules/typescript/bin/tsc --noEmit`, exit code 0 después del build. |
| Next build | PASS — gate de producción con webpack | `next build --webpack` compiló y generó las 26 páginas. El build Turbopack predeterminado no pudo validarse en el entorno actual: `creating new process` → `binding to a port` → `Operation not permitted`. Conforme a la decisión de cierre, esto no bloquea Fase 3A. |
| Contratos OpenAPI | PASS — export y validación | Export real OpenAPI 3.1.0 y 6 pruebas de contrato pasan. La generación automática de tipos no forma parte del gate de esta fase; queda como deuda P2. |
| Flutter | PASS heredado | `flutter analyze` sin issues y `flutter test`: 44 pasaron, según verificación anterior; no se repitió en esta preparación porque Flutter no cambió. |

### Hallazgos de verificación resueltos

1. **Harness pytest**: el módulo `test_admin_accounts.py` usaba `unittest.IsolatedAsyncioTestCase`. Su loop aislado se cerraba antes de que pytest-asyncio ejecutara los siguientes tests, causando `RuntimeError: There is no current event loop`. El módulo se convirtió a tests pytest equivalentes, conservando sus casos/aserciones. Con la resolución actual de dependencias, la invocación estándar completa ahora pasa: 314/314.
2. **Next build/typecheck**: `ThreadRow` se exportaba desde `src/app/student/communications/page.tsx` y se importaba desde la página administrativa. Next rechazaba ese export de módulo de ruta (`Property 'ThreadRow' ... is not assignable to never`). Se movió sin cambios visuales/lógicos a `src/components/thread-row.tsx`; el test, lint, typecheck y build webpack pasan.
3. **Ruff**: la clase genérica de `PageResponse` y formato de tres archivos no cumplían el Ruff instalado. Se ajustó el tipo genérico al estilo compatible con Python 3.12 y se formatearon únicamente esos archivos; lint y formato pasan.

Las 7 advertencias backend no fallan el gate: seis avisos deprecación SQLAlchemy `noload` y uno de `firebase_admin.MulticastMessage.tokens`. Vitest emitió un aviso de compatibilidad futura de `configLoader: native`; sus tests pasaron.

## Diferencias frente a la auditoría anterior

- Antes: backend/PostgreSQL y Next figuraban BLOCKED por falta de runtimes/dependencias. Ahora sus suites y pruebas PostgreSQL tienen ejecución real con versiones alineadas a CI.
- Antes: Flutter estaba PASS (analyze y 44 tests). Se conserva ese estado; no hubo cambios en Flutter.
- El drift de contratos OpenAPI ya tiene export y test ejecutados; la generación automática de TypeScript/Dart sigue siendo propuesta, no una tarea implementada.
- El build Next con Turbopack permanece limitado por creación de proceso/socket en este entorno; `next build --webpack` sí terminó con éxito.
- Se corrigieron dos bloqueos de gates en código no clínico: ciclo de vida de event loop en un módulo de tests y export de componente desde una página Next. Ninguna regla clínica cambió.

## Estado final

**FASE 3A = DONE.** La evidencia de ejecución real de backend, PostgreSQL y Next está presente; Flutter conserva sus gates PASS verificados. Se acepta `next build --webpack` como gate válido de producción. Turbopack queda como validación no bloqueante por limitación del entorno. No se exige generación automática OpenAPI para el cierre; las pruebas de contrato existentes son el control de drift y la generación queda como deuda P2.

**FASE 3B = NOT STARTED.** Este cierre no autoriza cambios clínicos ni inicia esa fase.
