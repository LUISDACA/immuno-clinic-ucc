# Cierre formal — Fase 3A

Fecha: 2026-09-27

Estado: **FASE 3A = DONE**

Fase siguiente: **FASE 3B = NOT STARTED**

## Alcance

Este cierre cubre la implementación y verificación de contratos no clínicos de Fase 3A: contratos FastAPI/OpenAPI, DTOs y enums inequívocos, errores, paginación aditiva, fechas de calendario, contratos de evidencia y sus pruebas. No se modificaron reglas clínicas ni se inició Fase 3B. No se crearon migraciones de Fase 3A.

La ejecución de gates se documenta en [phase3a-verification.md](phase3a-verification.md). El cierre acepta la evidencia allí registrada y las decisiones explícitas de gate de este documento.

## Evidencia y comandos

Los comandos se ejecutaron en runtimes alineados a CI. Las variables de conexión usadas para PostgreSQL apuntaban a bases locales desechables con datos sintéticos; no se incluyeron credenciales ni valores de conexión en esta documentación.

| Área | Comandos / evidencia | Resultado |
|---|---|---|
| Backend | `pytest tests -v` | **314 passed**, 7 warnings. Incluye pruebas PostgreSQL reales de integración, concurrencia y migraciones sobre bases vacías desechables. |
| Migraciones/concurrencia | PostgreSQL 18.6 local aislado; pruebas opt-in de migración y operaciones concurrentes | **PASS**. Ninguna migración de Fase 3A; las verificaciones de migración usaron exclusivamente bases temporales. |
| Backend lint/formato | `ruff check app tests`; `ruff format --check app tests` | **PASS**, 136 archivos. |
| Contrato OpenAPI | Export de `app.openapi()` y `backend/tests/test_api_contracts.py` | **PASS**, OpenAPI 3.1.0 con 56 rutas y 68 schemas; 6 pruebas de contrato. |
| Next | `npm test` con PostgreSQL local desechable para BFF | **PASS**, 12 archivos y 48 tests; cero skips. |
| Next lint | `npm run lint` | **PASS**. |
| Next typecheck | `node node_modules/typescript/bin/tsc --noEmit` | **PASS**, exit code 0. No existe script `typecheck` en `package.json`. |
| Next build de producción | `node node_modules/next/dist/bin/next build --webpack` | **PASS**, build de producción y 26 rutas generadas. |
| Flutter | `flutter analyze`; `flutter test` | **PASS**, analyze sin issues y 44 tests. Evidencia de la verificación inmediatamente anterior; Flutter no cambió durante la preparación de entorno. |

La instalación de Next se hizo con `npm ci` desde `frontend-next/package-lock.json` (500 paquetes, auditoría npm con cero vulnerabilidades). No se actualizaron dependencias del proyecto ni se instalaron paquetes globales. No existe lockfile de Python; las dependencias backend se instalaron desde los requirements declarados.

## Decisiones de gate

1. **Webpack se acepta como gate de producción.** `next build --webpack` completó correctamente y generó las rutas de producción.
2. **Turbopack no bloquea esta fase.** El `npm run build` predeterminado falló en el entorno actual al intentar crear un proceso y enlazar un puerto (`Operation not permitted`). El modo webpack es el gate válido aprobado para este cierre; la validación de Turbopack queda no bloqueante.
3. **No se requiere generación automática de tipos OpenAPI para cerrar Fase 3A.** No hay generador TS/Dart configurado. FastAPI sigue siendo la fuente contractual y las seis pruebas de contrato son el mecanismo actual de detección de drift.
4. **No se exige una prueba de breaking-change automatizada entre snapshots.** La cobertura actual es la validación de contrato descrita; automatizar generación de tipos o comparación de snapshots queda fuera del gate de cierre.
5. **No hubo cambios clínicos ni migraciones de Fase 3A.** Los tests de migración ejecutados fueron verificación sobre bases locales vacías y no representan migraciones nuevas de esta fase.

## Bloqueos no bloqueantes y deuda técnica

- **Turbopack — no bloqueante:** su build no puede validarse en este entorno por la limitación de creación de procesos/puertos. No se afirma que Turbopack compile correctamente.
- **Tipos generados desde OpenAPI — deuda P2:** no hay generación TypeScript/Dart automatizada. Mantener pruebas de contrato y evaluar tooling fijado en una tarea posterior.
- **Reproducibilidad backend — deuda:** los requirements declaran rangos, no una resolución bloqueada por lockfile. La ejecución se hizo con Python 3.12.14 y la resolución instalada que consta en la verificación.
- **Warnings — deuda menor:** suite backend reportó seis avisos deprecados de SQLAlchemy (`noload`) y uno de Firebase Admin (`MulticastMessage.tokens`); Vitest mostró un aviso sobre `configLoader: native`. Ninguno falló los gates.
- **Comando de typecheck — deuda menor:** Next no declara script `typecheck`; se ejecutó directamente el binario TypeScript.

## Riesgos

- La validación de contratos detecta los casos cubiertos por sus seis pruebas, pero no equivale a generación de tipos ni a comparación exhaustiva de todas las respuestas en ejecución.
- No hay evidencia de compilación Turbopack en un runner compatible.
- Los rangos backend sin lockfile pueden resolver versiones distintas en una instalación futura; conservar Python 3.12 y revisar la resolución de dependencias en CI.
- El resultado Flutter se reutiliza de la verificación previa porque no hubo cambios Flutter durante la preparación; esta limitación temporal queda explícita.

## Rollback

Este cierre documental no altera código, datos, infraestructura ni contratos. Para revertir únicamente el cierre, restaurar `phase3a-verification.md` y eliminar `phase3a-closure.md`.

La implementación de Fase 3A no añadió migraciones y los cambios de contrato se plantearon de forma compatible/aditiva, conservando las rutas antiguas de evidencia. Si una regresión posterior exige rollback funcional, revertir el conjunto de cambios de Fase 3A y mantener los consumidores en las rutas/formatos previos; verificar backend, Next y Flutter antes de retirar campos o endpoints aditivos. No se requiere rollback de datos.

## Estado final

**FASE 3A = DONE** — gates requeridos con evidencia PASS según las decisiones aprobadas.

**FASE 3B = NOT STARTED** — no se implementó ni se inició trabajo de Fase 3B.
