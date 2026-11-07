# Fase 1 — Contención y reconstrucción

Fecha de verificación: 2026-09-27. Sin commit ni despliegue.

**Actualización:** este documento conserva la evidencia de la primera entrega.
Los resultados de cierre posteriores, correcciones de concurrencia/correo y
clasificación DONE / BLOCKED / UNKNOWN están en [phase1-closure.md](phase1-closure.md).
Los bloqueos Flutter y de las tres pruebas originales de concurrencia descritos
abajo ya fueron corregidos y verificados; no usar sus resultados históricos
como estado actual.

Estado: cambios implementados y verificados en los controles descritos abajo;
**Fase 1 no tiene cierre integral de calidad** por los bloqueos Flutter,
concurrencia de la suite general y validaciones operativas pendientes.
Los hallazgos del audit previo delimitan este trabajo. No se han cambiado
umbrales, intervalos, reglas de titulación ni criterios de certificación.

## Bloques, causas y soluciones

| Objetivo | Causa raíz | Cambio y evidencia |
|---|---|---|
| Alcance administrativo | El perfil propio aceptaba programa y sede que después delimitan permisos. | `UserService.update_own_profile` devuelve 403 si un `admin` intenta cambiar o borrar su alcance. Permite reenviar valores idénticos y editar contacto. Pruebas de rechazo y ausencia de modificación parcial. |
| Dosis aprobada | `update_dose` comprobaba propiedad, pero no inmutabilidad de `APPROVED`. | Cambios de fecha o titulación devuelven 409. Una revisión administrativa explícita a `IN_REVIEW` permite editar. Peticiones idempotentes siguen siendo compatibles. La lectura bloquea la fila y refresca el objeto ORM; PostgreSQL prueba aprobación y edición concurrentes. |
| Catálogo | Cada modificación regeneraba todos los esquemas borrando filas y restaurando solo fecha/titulación; eliminar configuraciones podía propagar borrados por FK. | Sincronización de la vacuna afectada; conserva IDs, fechas, revisiones y notas. Configuraciones, asignaciones y dosis retiradas se archivan mediante `is_active`; su reactivación recupera las mismas filas. Consultas de esquema, reportes y recordatorios excluyen asignaciones archivadas. |
| Acceso inicial | Alta e importación derivaban la contraseña del documento. | Alta central genera una contraseña aleatoria criptográfica, la almacena como hash y usa el correo existente. Conserva `must_change_password`. La importación no genera ni devuelve contraseñas; Flutter deja de anunciar el documento como contraseña. |
| Seed administrador | El inicio de la aplicación volvía a aplicar `ADMIN_PASSWORD` a cuentas existentes. | Se utiliza solo al crear el administrador inicial. Pruebas conservan exactamente el hash modificado por el usuario tras sucesivas ejecuciones. |
| JMeter | Había credenciales literales y un destino publicado en el plan. | Credenciales mediante propiedades, correos sintéticos `example.invalid`, contraseñas sin valor por defecto y destino local. Prueba analiza XML/JSON de los tres payloads. |
| Next | Imports existentes apuntaban a seis módulos ausentes, impidiendo construir la aplicación. | Implementados configuración, API de autenticación, estado de sesión, proveedor de consultas, tema y validación de contraseña. Sesión validada por `/users/me`, limpieza de caché al cambiar usuario y protección de renderizado durante redirecciones. |
| Fechas | `new Date(YYYY-MM-DD)` se interpretaba en UTC y luego se mostraba en zona local; el máximo del selector también usaba UTC. | Fechas civiles mantienen día/mes/año sin conversión local. El selector usa el día local del dispositivo. Se conserva el tratamiento previo de timestamps. Pruebas de zonas horarias, medianoche, bisiestos y fechas inválidas. |
| Compatibilidad | La reconstrucción debía respetar clientes existentes y la API como fuente de verdad. | No se cambian rutas, roles ni nombres de campos. Se aceptan ambos nombres de variable de URL usados por Next. Pruebas de payloads de autenticación y matriz de estados; compatibilidad móvil ejecutada completa sigue pendiente. |

No se reinterpreta una configuración ya asignada cambiando su `dose_type`:
se devuelve 409 y se solicita una nueva dosis. El versionado clínico de esa
operación necesita una decisión separada; no se inventa una equivalencia
entre una dosis estándar y una titulación aprobada.

## Archivos de implementación

Rutas relativas al repositorio:

- `backend/app/modules/users/service.py`: contención de alcance propio.
- `backend/app/modules/vaccination_scheme/service.py`: inmutabilidad de dosis aprobada.
- `backend/app/modules/vaccination_scheme/repository.py`: filtro de archivo, bloqueo y refresco de dosis.
- `backend/app/modules/admin/vaccines/service.py`: reconciliación sin borrados del catálogo.
- `backend/app/modules/vaccination_scheme/models.py`, `backend/app/modules/vaccines/models.py`, `backend/app/modules/users/models.py`: marcas de archivo y relaciones activas.
- `backend/app/modules/admin/reports/repository.py`, `backend/app/modules/notifications/vaccine_due.py`: excluir asignaciones archivadas.
- `backend/app/modules/admin/students/service.py`: contraseña temporal aleatoria.
- `backend/app/modules/admin/import_students/import_helpers.py`, `backend/app/modules/admin/import_students/service.py`: importación sin contraseña derivada ni divulgada.
- `backend/app/db/seed.py`: conservar contraseña existente.
- `frontend-next/src/lib/config.ts`, `frontend-next/src/lib/password.ts`: módulos recuperados de configuración y contraseña.
- `frontend-next/src/lib/auth/api.ts`, `frontend-next/src/lib/auth/store.ts`: módulos recuperados de autenticación.
- `frontend-next/src/lib/query/provider.tsx`, `frontend-next/src/lib/theme/store.ts`: módulos recuperados de consultas y tema.
- `frontend-next/src/components/providers.tsx`, `frontend-next/src/components/auth-gate.tsx`: hidratar y proteger sesión.
- `frontend-next/src/lib/format.ts`, `frontend-next/src/app/student/scheme/page.tsx`: fechas civiles y selector.
- `frontend/lib/features/admin/presentation/screens/create_student_screen.dart`: texto de acceso inicial.
- `jmeter_tests/ImmunoClinic_LoadTest.jmx`, `jmeter_tests/README.md`: parámetros sintéticos y ejecución aislada.
- Este informe y `docs/ui/ui-parity-matrix.md`: evidencia y límites del bloque.

Se preservan los cambios ajenos en `.gitignore` y el archivo sin seguimiento
`codex`. El cambio de resolución de dependencias causado por `flutter pub get`
se revirtió en `frontend/pubspec.lock`; no se propone actualizar dependencias.

## Migración y operación

Creada `backend/alembic/versions/2026_09_26_0100-archive_catalog_records.py`,
posterior a `2026_05_07_0100`. Añade `is_active BOOLEAN NOT NULL DEFAULT true`
a `vaccine_dose_configs`, `student_vaccines` y `student_vaccine_doses`.
No borra ni transforma datos clínicos. Todos los registros anteriores permanecen activos.

Verificación real en PostgreSQL 18 temporal: cadena desde una base vacía hasta
la revisión anterior, carga sintética aprobada, upgrade a `head`, comparación
de todas las columnas previas, conservación de evidencia y repetición del
upgrade. Después se comprueba el bloqueo concurrente de dosis. Sin conexión
a datos productivos.

La migración debe preceder al código que consulta estas columnas. Un futuro
release requiere copia de seguridad verificada y ensayo con volumen semejante
al real. No se ha ejecutado ningún despliegue.

Rollback propuesto: detener escrituras de catálogo y desplegar una revisión
compatible con las marcas de archivo manteniendo las columnas. **No volver
directamente al código antiguo que borra esquemas o ignora el archivo.**
`downgrade` falla explícitamente para impedir reactivar historial al quitar las
marcas. La revisión de rollback y su ensayo operativo son pendientes, no un
rollback verificado. Recuperar backup queda reservado al procedimiento humano
con evaluación de las escrituras posteriores.

## Pruebas añadidas o actualizadas

- Nuevas `backend/tests/test_phase1_containment.py`: alcance, edición aprobada, transición explícita y seed idempotente.
- Nueva `backend/tests/test_phase1_migration.py`: PostgreSQL opt-in; preservación de filas y concurrencia con objeto ORM previamente cargado.
- Nueva `backend/tests/test_jmeter_configuration.py`: ausencia de credenciales literales en payloads y destino publicado anterior.
- Ampliada `backend/tests/test_admin_vaccine_catalog.py`: archivo/reactivación, conservación de revisión/ID, vacuna ajena intacta y rechazo de reinterpretación de tipo asignado.
- Actualizadas `backend/tests/test_admin_integration.py`, `backend/tests/test_admin_import.py`, `backend/tests/test_import_helpers.py`: nueva política de acceso inicial e importación.
- Nuevas `frontend-next/src/lib/__tests__/phase1-auth.test.ts`, `auth-api.test.ts`, `theme.test.tsx`: sesión, caché, roles, contraseña, payloads y recuperación de preferencias.
- Nueva `frontend-next/src/components/__tests__/auth-gate.test.tsx`: no renderizar contenido sin rol o durante cambio obligatorio de contraseña.
- Ampliada `frontend-next/src/lib/__tests__/format.test.ts`: fechas civiles y entradas locales.

## Ejecuciones y resultados

| Comprobación | Resultado |
|---|---|
| Backend `pytest -q -k 'not TestConcurrency'` | **279 passed, 1 skipped, 3 deselected**. El skip PostgreSQL se ejecutó por separado. |
| PostgreSQL `PHASE1_POSTGRES_URL=… pytest -q tests/test_phase1_migration.py` | **1 passed**, incluida concurrencia aprobación/edición. Requiere una base local vacía llamada `immuno_phase1_*`; la conserva para inspección. |
| Backend suite sin exclusiones | Interrumpida al bloquearse en `TestConcurrency.test_concurrent_requests_each_get_unique_request_id`; 60 pruebas habían pasado. No se presenta como verde. |
| Backend Ruff check y format check | Correctos; 125 archivos formateados. |
| Backend `python -m compileall -q app` | Correcto; no equivale a un typecheck estático. |
| Next `npm test` | **36 passed, 8 archivos**. |
| Next `npm run lint` y `npx tsc --noEmit` | Correctos. |
| Next `npm run build` | Correcto, 26 páginas estáticas generadas y rutas dinámicas compiladas. |
| Flutter `flutter test --no-pub` | **15 passed; 5 archivos de tests no compilan** por el tema existente. |
| Flutter `flutter analyze --no-pub` | 5 errores asociados a `CupertinoPageTransitionsBuilder` en `app_theme.dart:262–263`. |
| Dart format, archivo Flutter modificado | Correcto, sin cambios de formato. |
| `git diff --check` | Correcto. |
| Patrones de secretos en adiciones | 0 coincidencias de claves privadas, AWS, JWT y Google API; alcance limitado, no sustituye escaneo del historial. |
| JMeter carga real | No ejecutada; solo validación estructural del plan. |

Entorno usado: Python 3.14.4, PostgreSQL 18, Node 22.16.0, Flutter 3.44.9 /
Dart 3.12.2. CI declara Python 3.12 y Flutter 3.41.6: no se afirma equivalencia
con esos entornos. Hay avisos de deprecación de `noload` y SlowAPI. Las primeras
ejecuciones descubrieron errores de fixtures nuevas que se corrigieron antes
de obtener los resultados anteriores. Las restricciones del sandbox exigieron
permisos para herramientas temporales, socket PostgreSQL y caché Flutter.

## UNKNOWN y pendientes, sin cambio de criterios clínicos

1. **UNKNOWN clínico:** versionado de catálogo y conservación de criterios históricos
   para certificados ya emitidos; equivalencia al cambiar `dose_type`, reglas
   por sexo y titulación. Propuesta separada: versiones inmutables de catálogo
   y transiciones clínicas auditadas, previa validación del responsable clínico.
2. **Riesgo conocido fuera del cambio de catálogo:**
   `regenerate_scheme_for_sex_change` conserva su comportamiento destructivo
   previo; cambiar sexo aún puede reconstruir el esquema. Su política clínica
   requiere resolución separada. No se afirma inmutabilidad global ante todas
   las operaciones administrativas ni archivo histórico integral.
3. Los estudiantes inactivos no se resincronizan por un cambio de catálogo,
   igual que antes. La política de actualización al reactivarlos sigue pendiente.
4. **UNKNOWN operativo:** entrega real de correo y recuperación de acceso. Sin
   correo funcional, la cuenta creada con contraseña aleatoria no tiene un canal
   de acceso verificado. Se conserva el flujo de correo existente, no se ha
   implementado una invitación con expiración. El campo opcional `password` de
   alta sigue aceptándose por compatibilidad pero no determina la contraseña.
5. No se cambian contraseñas de cuentas ya creadas a partir del documento.
   Identificación y remediación de esas cuentas requieren un procedimiento
   operativo separado; no se han tocado datos productivos.
6. **UNKNOWN:** vigencia de las credenciales retiradas de JMeter e historial Git.
   Retirarlas del árbol actual no equivale a revocarlas ni a purgar el historial.
7. **UNKNOWN de ejecución móvil:** paridad visual, widgets completos y build con
   Flutter 3.41.6; el SDK local falla en código del tema no modificado. No se
   adaptó el tema a otro SDK como parte de esta fase.
8. **UNKNOWN de concurrencia general:** causa completa del bloqueo del test de
   salud con SQLite en memoria; no se ha corregido el middleware ni el pool.
   La prueba PostgreSQL cubre específicamente la nueva protección de dosis.
9. Compatibilidad E2E conjunta Flutter/Next/FastAPI, SMTP/FCM y navegador real:
   pendiente. Las pruebas de Next usan mocks; el build no prueba esos servicios.
10. Typecheck estático backend y análisis exhaustivo de dependencias pendientes.
    La instalación previa de Next informó vulnerabilidades; no se actualizó el
    lockfile ni se afirma un cierre SCA. JWT/refresh en almacenamiento web y sus
    riesgos existentes quedan para el bloque de seguridad posterior.

Para cerrar Fase 1: reproducir Flutter con el SDK de CI, resolver o aislar con
evidencia el bloqueo de concurrencia, ejecutar un flujo sintético real de
alta/correo/login/cambio de contraseña/esquema y ensayar migración/rollback en
staging. La ampliación clínica debe aprobarse como propuesta separada.
