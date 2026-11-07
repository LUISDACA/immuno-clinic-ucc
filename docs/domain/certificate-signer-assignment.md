# Asignación explícita de firmante de certificado

## Modelo

`certificate_signer_assignments` asocia el par exacto de cadenas `program` + `campus` con un usuario normal `admin`. Los perfiles existentes guardan esos dos valores como texto y el repositorio no contiene catálogos de programas/campus con IDs estables, por lo que esta implementación conserva el tipo y la comparación exacta actuales; no inventa identificadores institucionales.

La fila incluye `active`, `assigned_by_id`, `created_at` y `updated_at`. Una reasignación desactiva la fila anterior y crea una fila nueva. Un índice único parcial limita a una asignación activa por `(program, campus)`. En PostgreSQL se toma además un advisory transaction lock por ámbito para serializar altas/cambios concurrentes cuando todavía no existe una fila.

`certificate_emissions.signer_admin_id` y `signer_assignment_id` conservan quién era responsable y qué asignación se usó. `signature_id` conserva la versión exacta de la firma visual. Las columnas son nullable para no atribuir retroactivamente certificados históricos.

## Permisos y endpoints

Se eligió `app_admin` porque ese rol ya tiene permisos para crear, listar y eliminar administradores normales. `admin`, `student` y usuarios anónimos no configuran ni consultan asignaciones. El administrador asignado debe ser normal, activo y tener perfil cuyos programa/campus coincidan exactamente con la asignación.

- `PUT /api/v1/admin/certificate-signer-assignments` configura/reemplaza una asignación.
- `GET /api/v1/admin/certificate-signer-assignments` lista filas activas e históricas.
- `GET /api/v1/admin/certificate-signer-assignment-conflicts` lista conflictos observados durante la migración.

Cada cambio registra una auditoría con actor, programa/campus, asignación anterior y administrador nuevo. La fila de asignación guarda también `assigned_by_id`. Las respuestas de emisión conservan el contrato PDF; el cliente no envía ni elige el firmante.

## Errores de emisión

- `409 CERTIFICATE_SIGNER_SCOPE_MISSING`: estudiante sin programa o campus.
- `409 CERTIFICATE_SIGNER_NOT_ASSIGNED`: no existe una asignación activa válida.
- `409 CERTIFICATE_SIGNER_SIGNATURE_MISSING`: el responsable no tiene firma activa/no revocada.

Los tres errores ocurren antes de insertar la emisión. Un admin asignado inactivo, desactivado o cuyo perfil ya no coincide se trata como asignación inválida y falla cerrado.

## Migración y reporte de conflictos

La revisión `2026_09_28_0400` solo agrega tablas, índices y columnas nullable. Durante la migración se detectan ámbitos con más de un administrador normal activo en perfiles y se guarda el conjunto de IDs en `certificate_signer_assignment_conflicts`. No se crea ninguna asignación a partir de esos perfiles. El reporte no incluye nombre, correo ni otra PII.

Después de migrar, un `app_admin` debe revisar el reporte y decidir explícitamente la asignación correcta de cada par. La migración no se debe ejecutar en producción sin el proceso institucional de despliegue/autorización correspondiente.

## Validación y rollback

Pruebas sintéticas: reasignación conserva historial, perfil incompleto y falta de asignación rechazan emisión, firma ausente devuelve conflicto, roles no autorizados reciben 403 y dos escrituras concurrentes dejan un único responsable activo. E2E PostgreSQL verifica certificado antiguo/nuevo antes y después de reasignación.

El rollback funcional consiste en dejar de llamar a los endpoints de asignación y volver a una versión de aplicación compatible; los lectores nuevos deben volver a bloquear emisiones si la tabla no existe. No ejecutar downgrade destructivo: las asignaciones y referencias históricas se retienen. La migración ofrece un downgrade que falla deliberadamente en vez de borrar historial.

## Estado

Implementación y verificación con base/datos sintéticos completadas. Configurar los ámbitos institucionales y cargar firmas sigue pendiente. T-02 y T-03 permanecen PARTIAL; no se declara Fase 4 ni producción listas.
