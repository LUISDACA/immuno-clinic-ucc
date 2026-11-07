# Política del firmante de certificados de autoservicio

**Decisión institucional: DECIDED**

**Implementación: verificada con fixtures sintéticos y PostgreSQL local**

## Política

Para un certificado solicitado por autoservicio, firma el administrador normal asignado explícitamente al par exacto **programa + campus** del estudiante. No se permite elegir al estudiante, un administrador arbitrario, otro administrador ni el primer administrador coincidente.

- Sin programa/campus: no se emite; `409 CERTIFICATE_SIGNER_SCOPE_MISSING`.
- Sin asignación activa: no se emite; `409 CERTIFICATE_SIGNER_NOT_ASSIGNED`.
- Sin firma activa del responsable: no se emite; `409 CERTIFICATE_SIGNER_SIGNATURE_MISSING`.
- Si se emite, la emisión conserva las referencias exactas del administrador, asignación y firma vigentes.

## Verificación de implementación

| Requisito | Evidencia | Resultado |
|---|---|---|
| Programa y campus disponibles en el perfil del estudiante | `backend/app/modules/users/models.py`, `Profile.program` y `Profile.campus` son nullable. Autoservicio invoca `issue_certificate(current_user.id)` en `backend/app/modules/certificates/router.py`. | Implementado fail-closed con `CERTIFICATE_SIGNER_SCOPE_MISSING`. |
| Resolución usa ambos valores de ámbito | `CertificateService._resolve_signer` consulta `CertificateSignerAssignment` por programa, campus y `active=true` (`backend/app/modules/certificates/service.py`). | Implementado mediante relación explícita. |
| Sin selección implícita por antigüedad/primer resultado | Índice único parcial por `(program, campus)` activo y advisory transaction lock en `backend/app/modules/certificates/assignment_service.py`; migración agrega reporte de perfiles legacy con múltiples admins y no crea asignaciones. | Implementado; no existe fallback al perfil coincidente más antiguo. |
| Firma pertenece al responsable exacto | La consulta de `CertificateSignature` filtra por `admin_id` del asignado, activa y no revocada. | Implementado; sin firma da 409 antes de crear emisión. |
| Se preserva el histórico | `CertificateEmission` almacena `signer_admin_id`, `signer_assignment_id` y `signature_id`; las filas previas de asignación pasan a inactivas y se conservan. | Verificado: E2E PostgreSQL reasigna A→B; emisiones previas retienen sus IDs y nueva emisión usa B y su firma. |
| Estudiante no elige firmante | `GET /api/v1/certificates/scheme` no acepta identidad de firmante. La administración de asignaciones requiere `app_admin`. | Verificado por E2E y permisos. |

## Causa raíz corregida

Antes, el servicio consultaba perfiles administrativos por programa/campus, ordenaba por antigüedad y limitaba el resultado a uno. Esa heurística convertía múltiples coincidencias en selección arbitraria. Se eliminó `UserRepository.find_admin_by_scope`; ahora el servicio consume una asignación activa concreta.

## Permisos elegidos

Solo `app_admin` puede configurar, listar asignaciones e inspeccionar conflictos. Es el mismo rol que ya crea, lista y elimina administradores normales; no se amplían permisos de `admin`. El administrador asignado debe ser normal, estar activo y tener perfil con el mismo programa y campus. Las rutas administrativas son:

- `PUT /api/v1/admin/certificate-signer-assignments`: asigna o reemplaza el responsable de un ámbito.
- `GET /api/v1/admin/certificate-signer-assignments`: muestra historial activo e inactivo.
- `GET /api/v1/admin/certificate-signer-assignment-conflicts`: muestra conflictos legacy reportados por la migración.

Cada cambio registra actor, ámbito, administrador anterior/nuevo, y conserva la asignación anterior inactiva. La emisión registra además actor emisor mediante auditoría.

## Migración y activación

La migración `2026_09_28_0400_certificate_signer_assignments.py` es aditiva: crea el registro de asignaciones, el reporte de conflictos legacy y dos referencias nullable para emisiones anteriores. Antes de permitir configurar ámbitos, la migración detecta pares con varios administradores normales activos y persiste sus IDs en `certificate_signer_assignment_conflicts`. **No asigna ninguno automáticamente.** El índice parcial garantiza como máximo un responsable activo por par; el advisory lock serializa escrituras concurrentes incluso cuando aún no hay fila.

Tras migrar cada entorno, `app_admin` debe revisar el reporte y establecer explícitamente cada relación programa/campus→responsable. También se debe cargar la firma privada activa de cada responsable antes de la primera emisión de su ámbito. El endpoint falla cerrado mientras falte configuración.

## Pruebas y evidencia

- Backend completo: **363 passed, 15 skipped**.
- PostgreSQL E2E (flujo clínico/certificado, reasignación, permisos y concurrencia): **11 passed, 1 skipped**.
- Migración sintética con dos administradores coincidentes: **1 passed**; reportó ambos IDs y dejó la tabla de asignaciones vacía.
- `alembic upgrade head` y `alembic check`: exitosos en PostgreSQL local de integración.
- Ruff: limpio.

## Límites

La validación usa únicamente cuentas y datos sintéticos. Configurar asignaciones y cargar firmas en los entornos institucionales queda pendiente. T-02/T-03 permanecen PARTIAL; no se declara Fase 4 ni producción listas. La emisión administrativa iniciada por `admin` conserva su firma activa como antes; `app_admin` usa la asignación explícita del ámbito.
