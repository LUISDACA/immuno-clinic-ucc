# Fase 4 — Certificado verificable

**Estado técnico: IMPLEMENTADO Y VERIFICADO EN ENTORNO LOCAL SINTÉTICO.**
**Producción: NO LISTA.** Fase 3B continúa PARTIAL; T-02 y T-03 requieren validación institucional autorizada y no se cerraron.

## Alcance y causa raíz

La implementación anterior generaba un PDF en cada descarga, sin persistir una emisión ni conservar vínculo entre un artefacto y su estado de vigencia. También exponía correo, documento, código estudiantil, teléfono, programa, campus, semestre, vacunas y detalle de dosis. No existía verificación pública, revocación, QR ni evidencia de integridad.

Fase 4 incorpora registro de emisión, verificador público, QR y revocación. La certificabilidad sigue decidiéndose exclusivamente mediante `evaluate_scheme(...).is_certifiable` en FastAPI. No se modificaron reglas clínicas, elegibilidad, titulación, vencimientos ni estados clínicos. Flutter y Next no calculan elegibilidad.

## Arquitectura y modelo

Se añadió `certificate_emissions` mediante una migración aditiva (`2026_09_28_0200`). El modelo registra UUID interno, ID público, referencia opcional a usuario, instante de emisión, estado, SHA-256 del PDF, versión documental, instante de revocación, motivo, actor y timestamps. Los estados persistidos son `ISSUED` y `REVOKED`. La referencia de usuario permite `SET NULL` ante una eliminación física; el registro documental se conserva. La revocación es irreversible y no hay endpoint de borrado o reactivación.

La migración no reescribe tablas clínicas ni borra datos. El tipo enum se crea como parte de la creación de la tabla. Una primera ejecución detectó la creación duplicada del tipo; se corrigió y se validó la cadena completa en PostgreSQL antes de continuar.

## Emisión, PDF y hash

`CertificateService.issue_certificate` conserva la evaluación del backend como autoridad y realiza el flujo dentro de una transacción:

1. Obtiene el esquema y rechaza la emisión si el backend no lo declara certificable.
2. Genera un ID público con `secrets.token_urlsafe(32)` (256 bits aleatorios; forma URL-safe de 43 caracteres).
3. Inserta la emisión todavía no confirmada para reservar el ID.
4. Genera el PDF final con QR y URL pública.
5. Calcula SHA-256 sobre los bytes exactos del PDF terminado y lo asocia a la emisión.
6. Registra auditoría y confirma emisión, hash y auditoría en la misma transacción.

El hash no se incrusta dentro del propio PDF, para evitar una referencia circular. El verificador devuelve el hash esperado y acepta `sha256` opcional. La página calcula SHA-256 localmente sobre un PDF elegido por el usuario. `MATCH` demuestra que los bytes coinciden con los registrados; un archivo alterado da `INVALID/MISMATCH`. Descargar/emitar de nuevo crea una emisión y PDF nuevos; no se regenera ni reemplaza el documento histórico.

El algoritmo es SHA-256 sobre los bytes finales exactos. El resultado depende de los metadatos y bytes concretos de ese PDF; no se calcula sobre JSON ni sobre una representación reconstruida. **Esto no es firma digital ni demuestra quién firmó el documento.**

El nuevo PDF en tamaño carta vertical incluye nombre completo, estado `CERTIFICABLE` obtenido del backend, fecha en `America/Bogota`, versión, ID público, QR y URL. Omite email, documento, código estudiantil, teléfono, programa, campus, semestre y filas de vacunas/dosis. Incluye metadatos PDF y pie/paginación. La identidad visual disponible se limita a `APP_NAME`: no se inventó logotipo, nombre legal institucional ni sello. La fecha de emisión es un instante convertido a hora de Bogotá.

## Contratos y clientes

| Método y ruta | Acceso | Comportamiento |
|---|---|---|
| `GET /api/v1/certificates/scheme` | Usuario autenticado | Emite y descarga PDF; nombre de archivo genérico y `Cache-Control: no-store`. |
| `GET /api/v1/certificates/students/{student_id}` | Administrador dentro de ámbito o app admin | Lista hasta 50 emisiones con ID interno/público, estado, fecha y hash. |
| `POST /api/v1/certificates/{certificate_id}/revoke` | Administrador dentro de ámbito o app admin | Requiere motivo no vacío; registra actor/fecha/motivo y auditoría transaccional. Es idempotente si ya está revocado. |
| `GET /verify/{public_id}` | Público; sin sesión | Devuelve `VALID`, `REVOKED`, `NOT_FOUND` o `INVALID`, más estado de integridad y datos mínimos. |

La verificación pública devuelve HTTP 200 con uno de esos estados en el cuerpo. Una URL mal formada da `INVALID`; un ID de forma válida que no existe da `NOT_FOUND`; un hash con formato válido que no coincide da `INVALID/MISMATCH`. Un certificado revocado siempre mantiene estado `REVOKED`, aunque se envíe un hash distinto.

La respuesta pública puede incluir hash, `issued_at` y `revoked_at`, pero nunca identidad, motivo de revocación, vacunas, dosis, usuario, correo o documento. Incluye `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow` y `Referrer-Policy: no-referrer`. El endpoint usa el rate limiter compartido de PostgreSQL (`30/minute` por IP/route key) y el ID de alta entropía impide enumeración práctica; las respuestas conservan la distinción requerida entre `NOT_FOUND` e `INVALID`.

El BFF Next admite únicamente `GET /api/verify/{id}`, sin requerir cookie de sesión y sin añadir Authorization. Reenvía a FastAPI en `/verify/{id}` y no almacena en caché la respuesta. La página pública permite comprobar estado y cargar el PDF para comparar el hash; no muestra datos clínicos ni identidad. La pantalla de administración permite consultar emisiones y revocar con motivo, sujeto al control de ámbito del backend. Las pantallas de certificado Flutter/Next siguen usando `is_certifiable` proporcionado por FastAPI y ofrecen descargas con nombre genérico.

## Pruebas y evidencia

Ejecución sobre el PostgreSQL local temporal `immuno_phase1_phase4_cert`, únicamente con cuentas y registros sintéticos:

- `PHASE1_INTEGRATION_URL=… .venv/bin/pytest -q`: **364 passed, 2 skipped**. Incluye emisión, elegibilidad, hash exacto, texto/metadatos del PDF, minimización de campos, imagen QR, carga/reemplazo/auditoría/rollback de firmas, permisos, no publicación de claves/firmas, firma histórica fija tras reemplazo, flujo HTTP login → esquema → evidencia → revisión → certificado → verificación → revocación, contrato OpenAPI del verificador, autorización, bytes PDF alterados, identificador inexistente/mal formado, cabeceras de caché/robots, rate limiting, rollback y concurrencia de dos revocaciones.
- `tests/test_certificate_service.py::TestCertificateServicePdf::test_issuance_persists_exact_pdf_hash_and_minimizes_content`: **1 passed** por separado; `pdfimages` extrajo QR y firma del PDF, y los píxeles extraídos de la firma coincidieron con la versión privada asociada.
- `tests/test_certificate_service.py::TestCertificateServicePdf::test_signature_replacement_never_changes_historical_certificate`: **1 passed** por separado; `pdfimages` extrajo ambos PDFs y sus imágenes coincidieron con las dos versiones distintas almacenadas. El primer hash/PDF permaneció intacto tras el reemplazo.
- `alembic upgrade head` en la base desechable `immuno_phase4_signature`: **PASS**, recorrió toda la cadena incluyendo `2026_09_28_0300`.
- `alembic check` contra esa base: **No new upgrade operations detected**.
- `PHASE1_POSTGRES_URL=… PHASE2_POSTGRES_URL=… .venv/bin/pytest -q tests/test_phase1_migration.py tests/test_phase2_migration.py`: **2 passed**. La migración Fase 4 también fue ejecutada dentro de la actualización completa hasta `head`.
- `alembic check` contra PostgreSQL migrado: **No new upgrade operations detected**.
- `.venv/bin/ruff check` dirigido a módulo, migración y pruebas modificadas: **PASS**.
- Contrato OpenAPI mínimo del verificador y E2E de dos perfiles administrativos después del DTO tipado: **9 passed**.
- Next, ejecutado desde `frontend-next`: `node node_modules/vitest/vitest.mjs run`: **51 passed, 3 skipped**; `node node_modules/eslint/bin/eslint.js .`: **PASS**; `node node_modules/typescript/bin/tsc --noEmit`: **PASS**; `node node_modules/next/dist/bin/next build --webpack`: **PASS**, incluye `/verify/[publicId]` y la UI administrativa.
- Flutter, desde `frontend`: `flutter analyze`: **PASS**; `flutter test`: **44 passed**.
- Flutter verificado nuevamente con la pantalla privada de firma en perfil: `flutter analyze`: **PASS**; `flutter test`: **44 passed**.
- `git diff --check`: **PASS**.

Los tests E2E no usaron datos institucionales. Dos pruebas opcionales del backend no ejecutadas en la suite general quedaron cubiertas separadamente con bases PostgreSQL vacías y sintéticas. Se observaron advertencias deprecadas preexistentes de SQLAlchemy/FCM que no afectan este cambio.

El PDF se verificó por contenido extraído, metadatos/cabecera PDF, hash, URL y recurso de imagen QR incrustado. La ruta codificada lleva únicamente la URL `/verify/{public_id}`. No hay lector QR/cámara independiente disponible en este entorno: el escaneo físico por cámara/dispositivo permanece **UNKNOWN**; el E2E visitó la misma URL mediante HTTP. No se afirma una prueba física del escaneo.

## Seguridad, privacidad y límites

- No hay PII en URL, nombre de archivo, consulta de verificación, QR ni logs del path: FastAPI registra la plantilla de ruta, no el ID recibido.
- No se reenvían cookies ni tokens a rutas públicas del BFF.
- La razón de revocación se guarda solo en la emisión privada y no se publica ni se copia a los detalles de auditoría.
- El hash protege frente a cambios del archivo si se compara con el valor de la autoridad; por sí solo no autentica criptográficamente al emisor.
- El nombre completo sigue siendo PII en el PDF porque el artefacto debe identificar a su titular; la página pública no confirma nombre ni identidad.
- La configuración `CERTIFICATE_VERIFY_BASE_URL` debe apuntar al dominio institucional HTTPS y terminar en `/verify`. Si no se establece, se deriva de `FRONTEND_URL`; fuera de `DEBUG`, el backend rechaza una URL HTTP al emitir. El dominio definitivo y la configuración productiva son **UNKNOWN**.
- El nombre legal, logo, sello y textos jurídicos institucionales son **UNKNOWN** porque no se suministraron fuentes aprobadas.
- T-02 y T-03 siguen **PARTIAL**. No se usaron datos institucionales y esta evidencia técnica no habilita certificación productiva.

## Firma visual versionada del administrador

El requisito aprobado agrega una **firma visual**, no una firma digital criptográfica. La causa raíz era que una emisión conservaba hash y PDF exactos, pero no registraba identidad/versión de firma asociada al documento.

`certificate_signatures` conserva versiones append-only con `id`, `admin_id`, `storage_key` privado, SHA-256 del PNG normalizado, `created_at`/`updated_at`, `is_active`, `is_revoked` y `revoked_at`. `certificate_emissions.signature_id` relaciona cada emisión nueva con la versión exacta; es nullable únicamente para emisiones históricas anteriores al cambio. Reemplazar firma desactiva la versión anterior, no la borra ni la marca revocada. Una FK `RESTRICT` protege la referencia histórica.

La carga autenticada está disponible desde el perfil de administrador normal y por `POST /api/v1/certificates/signature`. Solo acepta PNG/JPEG/WebP (MIME declarado comparado con el formato real), máximo **2 MiB**, dimensiones máximas **4096 × 4096** y **8 megapíxeles**, decodificación/verificación íntegra. Los bytes válidos se normalizan a PNG (conserva alfa cuando existe), se guardan en el almacenamiento privado configurado y el hash corresponde a esos bytes normalizados. El `storage_key` nunca se devuelve a clientes. `GET /api/v1/certificates/signature/active` devuelve solo metadatos; la previsualización usa `GET /api/v1/certificates/signature/active/image`, autenticación de administrador normal, autorización propia y `private, no-store`; Next lo convierte en Blob URL temporal y Flutter lo obtiene con sesión. Ninguna ruta pública entrega la imagen.

La política institucional de autoservicio está **DECIDED e implementada**: firma el administrador normal asignado explícitamente al par exacto programa + campus del estudiante. La emisión falla cerrada con `409 CERTIFICATE_SIGNER_SCOPE_MISSING` si falta ámbito, `409 CERTIFICATE_SIGNER_NOT_ASSIGNED` si no hay asignación y `409 CERTIFICATE_SIGNER_SIGNATURE_MISSING` si el responsable no tiene firma activa. No existe consulta por antigüedad ni fallback a otro usuario.

La migración aditiva crea `certificate_signer_assignments`, un índice único parcial por ámbito activo, `certificate_signer_assignment_conflicts` para pares legacy con múltiples administradores activos y referencias nullable `signer_admin_id`/`signer_assignment_id` en certificados históricos. No infiere responsables. Solo `app_admin` puede listar/configurar; al configurar se verifica que el administrador normal esté activo y su perfil coincida exactamente con ambos valores. Cada cambio conserva la fila anterior inactiva y audita actor, ámbito y responsable anterior/nuevo. Cada emisión persiste administrador, asignación y firma exactos.

**Activación operativa pendiente:** revisar el reporte después de migrar cada entorno y configurar explícitamente cada par programa/campus con el administrador institucional responsable. Cargar también la firma privada activa antes de la primera emisión del ámbito. No se usaron datos institucionales y esta implementación no declara producción lista. Ver `docs/audits/certificate-signer-policy.md` y `docs/domain/certificate-signer-assignment.md`.

`SIGNATURE_UPLOADED` y `SIGNATURE_REPLACED` se escriben en `audit_logs` en la misma transacción que cambia la versión activa, con actor, instante creado por auditoría y hash de imagen; el contenido de imagen y la clave no se auditan. El archivo nuevo se escribe antes del commit SQL y se elimina best-effort si falla la transacción; se retienen siempre las versiones antiguas. Emisión inserta la referencia exacta, comprueba el hash del objeto privado, renderiza la firma y QR en el PDF, calcula SHA-256 sobre el PDF final y confirma emisión/hash/auditoría en transacción. Cambios de firma posteriores afectan solo a futuras emisiones.

Endpoints agregados:

| Método y ruta | Acceso | Comportamiento |
|---|---|---|
| `POST /api/v1/certificates/signature` | Administrador normal autenticado | Multipart upload; valida, normaliza, reemplaza transaccionalmente y devuelve id/hash/fecha, sin clave de almacenamiento. |
| `GET /api/v1/certificates/signature/active` | Administrador normal autenticado | Metadatos de la firma propia activa; 404 si no hay una. |
| `GET /api/v1/certificates/signature/active/image` | Administrador normal autenticado | Bytes PNG propios con no-store, sin URL permanente ni acceso público. |
| `PUT /api/v1/admin/certificate-signer-assignments` | `app_admin` | Crea o reemplaza responsable explícito para programa/campus; audita el cambio y preserva historial. |
| `GET /api/v1/admin/certificate-signer-assignments` | `app_admin` | Lista asignaciones activas e históricas. |
| `GET /api/v1/admin/certificate-signer-assignment-conflicts` | `app_admin` | Reporta ámbitos legacy ambiguos detectados por la migración; no selecciona responsables. |

La página pública de verificación no se modifica y no incluye `signature_id`, administrador, hash de imagen, bytes ni URL de firma. Certificados históricos mantienen PDF, hash y `signature_id=NULL`; no se regeneran con la firma actual. El hash PDF conserva el significado existente. La firma gráfica no acredita por sí sola identidad ni integridad criptográfica del emisor.

La verificación de que el almacenamiento de objetos configurado en un futuro entorno tenga bloqueo de acceso público depende de la política/ACL externa del bucket y sigue **UNKNOWN** hasta revisar esa configuración. El código no genera ni expone URL firmada de firma; el secreto del `storage_key` por sí solo no se trata como control de autorización.

Pruebas añadidas cubren PNG real con transparencia y normalización, formato/MIME incorrecto, formato prohibido, bytes excesivos, archivo corrupto, rol no permitido, reemplazo conservando versión anterior, actor/acción/hash de auditoría, asociación exacta en emisión, firma visible en el texto/recursos del PDF, invariancia del PDF anterior tras reemplazo y protección HTTP de metadata/imagen para estudiante/no autenticado. También se ejecuta el flujo E2E de login→esquema→evidencia→revisión→certificado con firma sintética del administrador normal asignado.

## Rollback y despliegue

La migración conserva una política de downgrade que falla explícitamente para evitar borrar el historial de emisiones/versiones. Rollback recomendado: detener temporalmente nuevas emisiones y revertir la aplicación solo a una versión que no regenere certificados durante la reversión; dejar tablas, firmas privadas, PDFs emitidos y auditoría intactos. No borrar objetos antiguos ni ejecutar `DROP TABLE`/`DROP TYPE`. Una aplicación previa puede ignorar las tablas aditivas, pero no debe reactivar emisión sin firma si el requisito visual sigue vigente. Los objetos huérfanos de una caída simultánea del storage/commit se limpian manualmente tras revisión; la compensación automática tras fallo DB es best-effort.

No se modificó Azure ni configuración de tiendas móviles. No se ejecutó despliegue, no se conectaron datos reales y no se declara producción lista. T-02/T-03 permanecen PARTIAL.
