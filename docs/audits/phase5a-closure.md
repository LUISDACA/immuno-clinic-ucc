# Fase 5A — Cierre funcional

Fecha: 2026-10-09, America/Bogota.

**FASE 5A = DONE**, dentro del alcance autorizado de paridad funcional crítica y cierre de sus tres pendientes. **FASE 5B = NOT STARTED**. UI-16/UI-17 permanecen **BLOCKED por alcance**. Fase 5 global sigue PARTIAL; este cierre no acredita paridad visual integral ni preparación productiva.

Fuentes: `AGENTS.md`, skills locales `quality-gates`, `ui-parity`, `security-health`, [phase5a-implementation.md](phase5a-implementation.md), [phase5-ui-parity.md](phase5-ui-parity.md) y [phase5-parity-matrix.md](../ui/phase5-parity-matrix.md). FastAPI mantiene negocio y permisos; Flutter sigue siendo referencia funcional, sin copiar reglas clínicas.

## Alcance y resultados por grupo

| Grupo pendiente | Resultado | Evidencia |
|---|---|---|
| Paginación | **DONE** | Página de servidor de 20 en estudiantes, evidencias e historial; metadata estándar, orden con desempate, scope antes de COUNT/OFFSET, actualización sin descargar todas las páginas. PostgreSQL verifica páginas simultáneas, permisos y límites; Chrome recorre datos sintéticos; Flutter prueba última página vacía después de eliminación. Importaciones de ambos clientes permiten recorrer respuestas existentes con paginación local. |
| Contexto completo del recorrido intervenido | **DONE** | URL conserva filtros/página/tab/evidence_page y retorno interno validado. Búsqueda privada por referencia opaca `ctx`, usuario/pestaña y TTL, sin texto en URL. Componentes verifican back/remount, expiración y cambio de usuario; Chrome verifica listado→detalle→tab→recarga→Volver, atrás del navegador y deep link de evidencia. Retorno a detalle desde comunicaciones conserva su contexto mediante helper probado. |
| Formularios y sincronización | **DONE** | Guardias de doble evento, controles bloqueados durante escritura, cancelación/invalidation por consulta y descarte de respuestas anteriores/cuenta previa. Notificaciones backend reemplazan marcas locales de lectura de hilos. Chrome comprueba un único PUT con dos clics y descarta una respuesta HTTP anterior retenida; al reabrir formulario aparece el dato nuevo. |

Las correcciones previas de comentario/aprobar/denegar/revisar, permisos, comunicaciones por rol, navegación móvil, errores y expiración siguen verificadas por la suite completa. Un comentario usa PATCH exclusivo y nunca PUT de revisión; estudiante obtiene 403 al intentar comentar/aprobar/denegar una dosis como administrador. Abrir una confirmación no realiza la mutación.

## Entorno verificado

| Componente | Entorno real |
|---|---|
| Workspace | `/home/migueldaca/immuno-clinic-ucc`; árbol migrado con modificaciones preexistentes sin commit. |
| Python | 3.12.15, venv local `backend/.venv`; se reparó su referencia al intérprete tras trasladar la máquina. Paquetes existentes conservados. |
| Backend | FastAPI 0.141.1, pytest 9.1.1, SQLAlchemy 2.1.1, asyncpg 0.31.0, Ruff 0.16.9. |
| PostgreSQL | 18.6, clúster exclusivamente sintético en `/tmp/immuno-miguel-tools/pgdata`, loopback `127.0.0.1:55544`. Ninguna conexión institucional. |
| Next | Node 22.22.1, npm 9.2.0, Next 16.3.6; node_modules copiado, manifiestos/lockfile conservados. |
| Navegador | Google Chrome 155.0.8059.39; perfil temporal y CDP local del harness. |
| Flutter | 3.41.6, Dart 3.11.4, SDK y PUB_CACHE en `/tmp/immuno-miguel-tools`; `pub get --enforce-lockfile` conserva lockfile. |

SDKs/intérprete se recuperaron localmente tras la migración de máquina; no se instalaron nuevas dependencias del proyecto ni se cambiaron sus versiones para obtener PASS. El venv trasladado conserva algunos nombres absolutos antiguos en bytecode de tests no modificados; comandos, procesos y archivos fuente se ejecutan desde el workspace actual.

## Gates ejecutados

| Gate | Resultado real |
|---|---|
| Backend completo + PostgreSQL + Chrome sobre build final | **386 PASS, 3 SKIP**, 7 warnings, 99,39 s. |
| Tres tests de migraciones en bases vacías separadas | **3 PASS**, 6 warnings, 1,57 s. |
| Total backend distinto verificado | **389 PASS** entre ambas ejecuciones. Los tres skips de la suite principal corresponden exclusivamente a esos tests de migraciones, ejecutados por separado con sus variables dedicadas; nunca se cuentan skips como PASS. |
| Paginación HTTP/PostgreSQL | 3 PASS, incluidos en suite completa. |
| E2E navegador dedicado | 1 PASS, 8,39 s; repetido satisfactoriamente dentro de la suite final después del último build. |
| Next tests + PostgreSQL BFF | **108 PASS, 0 SKIP**, 22 archivos, 5,32 s. |
| Next ESLint | **PASS**. |
| Next TypeScript `--noEmit` | **PASS**. |
| Production webpack build | **PASS**: compilación, TypeScript, 26 páginas estáticas y rutas dinámicas. |
| Flutter analyze | **PASS**, sin issues, 3,1 s. |
| Flutter tests | **55 PASS**, sin fallos. |
| Ruff | **PASS** `app tests`; format check de 7 archivos backend del bloque: PASS. |
| Dart format | Archivos Flutter del cierre comprobados; formato aplicado a la última línea del nuevo paginador. Chequeo final sin diferencias. |
| Diff y revisión de alcance | `git diff --check` PASS, inspección de archivos nuevos y comparación SHA-256 con inventario al reanudar sesión. |

Advertencias existentes: deprecaciones SQLAlchemy `noload`, Firebase `MulticastMessage.tokens` y aviso de configuración Vite sobre un cambio futuro. No son tests fallidos. El sandbox devuelve `Operation not permitted` al crear algunos streams de Node y bloquea cachés/sockets de herramientas; verificaciones afectadas se ejecutaron con autorización fuera del sandbox. No se cambiaron opciones funcionales para ocultarlo. Webpack es el gate de producción aceptado; no se usa este cierre para validar Turbopack ni builds móviles nativos.

## Comandos reproducibles

Desde `backend`, con PostgreSQL local iniciado y Next ya construido:

```bash
PHASE5A_BROWSER=1 PHASE5A_NODE=/usr/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a \
.venv/bin/python -m pytest -q -rs

.venv/bin/python -m ruff check app tests
.venv/bin/python -m ruff format --check \
  app/modules/admin/reports/repository.py app/modules/audit/router.py \
  app/modules/audit/service.py app/modules/evidence/repository.py \
  app/modules/evidence/router.py tests/test_phase5a_pagination.py \
  tests/test_phase5a_browser.py
```

Migraciones históricas: usar tres bases sintéticas vacías distintas. Las usadas en esta ejecución ya no están vacías; crear otras bases para repetir la prueba. No apuntar estas variables a datos persistentes autorizados o institucionales.

```bash
PHASE1_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase5a_migration \
PHASE2_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase2_phase5a_migration \
PHASE4_SIGNER_POSTGRES_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase4_phase5a_migration \
.venv/bin/python -m pytest -q --tb=short \
  tests/test_phase1_migration.py tests/test_phase2_migration.py \
  tests/test_certificate_signer_migration.py
```

Desde `frontend-next`:

```bash
BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase5a npm test
npm run lint
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build --webpack
```

Desde `frontend`:

```bash
FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache \
/tmp/immuno-miguel-tools/flutter/bin/flutter analyze --no-pub
FLUTTER_SUPPRESS_ANALYTICS=true PUB_CACHE=/tmp/immuno-miguel-tools/pub-cache \
/tmp/immuno-miguel-tools/flutter/bin/flutter test --no-pub --reporter expanded
```

Desde la raíz: `git diff`, `git diff --check` y revisión de archivos nuevos, ya que Git diff no los incluye mientras permanezcan sin seguimiento.

## Pruebas añadidas o ampliadas

- `backend/tests/test_phase5a_pagination.py`: 3 tests de permisos/metadata/orden/filtros previos al paginado y lectura concurrente sobre PostgreSQL real.
- `backend/tests/test_phase5a_browser.py` y `frontend-next/tests/e2e/phase5a-browser.mjs`: datos sintéticos multipágina, Chrome real, Next de producción, BFF/FastAPI/PG; contexto, recarga, mutación inmediata, doble submit y GET HTTP retrasado. Mantienen regresiones de comentario/intención/permisos.
- `frontend-next/src/components/__tests__/phase5a-list-sync.test.tsx`: 7 tests de paginador, contexto privado, TTL/logout, storage deshabilitado, retorno seguro, consultas afectadas/ajenas, duplicación y cambio de cuenta.
- Tests existentes de detalle/evidencias/comunicaciones actualizados para navegación/paginación y retry fallido de sincronización de lectura.
- `frontend/test/core/phase5a_sync_test.dart`: 7 pruebas de generación de lecturas, filtros/página, notificaciones confirmadas/fallidas, doble escritura, descarte tras dispose y eliminación en última página.
- `frontend/test/core/phase5a_local_pagination_test.dart`: 2 pruebas de acceso a filas de importación, avance/retroceso y reducción/vacío de resultados.
- Test existente de admin provider adapta el mock al contrato de página real, conservando sus comprobaciones previas.

Inventario de archivos funcionales y causas raíz: sección de continuación de [phase5a-implementation.md](phase5a-implementation.md). **Migraciones creadas por este bloque: ninguna.**

## Seguridad, límites y pendientes

- URLs solo contienen parámetros funcionales permitidos, IDs internos ya existentes y referencias opacas de contexto; nunca texto privado de búsqueda. Destinos de retorno se validan y no permiten redirect externo.
- Borradores privados expiran en 30 minutos y se limpian al cambiar usuario/logout. No son un mecanismo para compartir búsquedas entre pestañas/máquinas. Con storage deshabilitado la recarga completa no puede recuperarlos; filtros/tab/página siguen representados en URL.
- Guardias de mutación y providers descartan callbacks/respuestas de otro usuario sin modificar el protocolo de autenticación de Fase 2.
- No se imprimen credenciales/tokens de ejecución. Datos del harness exclusivamente sintéticos, sin información institucional. Búsqueda focalizada de marcadores de claves privadas/credenciales de proveedor en archivos intervenidos: sin hallazgos. No sustituye una auditoría exhaustiva del historial Git/dependencias.
- SHA-256 desde el inventario de reanudación confirma autenticación, backend de certificados, dominio clínico, Alembic, BFF servidor, verificador público y manifiestos/lockfiles sin nuevos cambios. El diff frente a HEAD incluye fases anteriores y no debe atribuirse entero a este bloque.
- Paginación offset con desempate es estable para el conjunto evaluado; no garantiza snapshot entre páginas frente a altas/bajas concurrentes. No se añadió cursor ni semántica de snapshot.
- Lectura de comunicaciones conserva el contrato por categoría; no se inventa estado leído por hilo.
- **UI-16/UI-17: BLOCKED por alcance.** Verificador y gestión de certificados requieren bloque posterior autorizado. No constituyen un gate pendiente de esta Fase 5A según la instrucción de cierre.
- UI-12 y paridad integral de temas/accesibilidad UI-14/UI-15 siguen pendientes de la auditoría global; fuente institucional de opciones de formulario **UNKNOWN**. No se valida un catálogo institucional con fixtures sintéticos.
- **T-02/T-03 y Fase 3B: PARTIAL**. Almacenamiento real de certificados pendiente; Fase 4 no se declara DONE ni se acredita producción lista.
- Sin Maps, Azure, rediseño PDF/QR, reglas clínicas nuevas, publicación o commit.

## Rollback

Cambios de cliente y endpoints son aditivos, sin migración ni reescritura de datos. Mantener endpoints nuevos mientras existan clientes que los consumen; retirar paginadores/clientes coordinadamente ante regresión. No revertir cambios preexistentes de otras fases junto con este bloque. Conservar separación comentario/revisión y sus controles aunque se retire una UI. Borrar solo contextos privados de sesión si es necesario; no requiere tocar datos clínicos ni históricos.

**Resultado final: FASE 5A DONE; FASE 5B NOT STARTED. Sin commit.**
