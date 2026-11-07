# Matriz de contratos API

## Addendum normativo — Fase 3B

Las decisiones aprobadas en `clinical-decisions.md` sustituyen las notas UNKNOWN históricas de esta auditoría para: AL DÍA, COMPLETO, CERTIFICABLE, titulación, vencimientos, anualidad, fechas clínicas y versionado/reconciliación. El código debe exponer señales backend independientes y no autorizar a Flutter/Next a recalcularlas.

El contrato canónico de paginación es `{page,page_size,total,total_pages,has_next,has_previous,items}` y el de error `{code,message,details?}`. Cambios se entregarán aditivamente, conservando respuestas/rutas legadas cuando los consumidores existentes dependan de ellas. Los enums de Next deben coincidir con FastAPI; los valores `Gender.other`, `ConversationStatus.archived` y `DoseType.annual` se retiran de los tipos Next. La anualidad se expresa solo con `Vaccine.is_annual`.

El resto de este documento registra observaciones del audit Fase 3A. Cuando contradiga este addendum o `clinical-decisions.md`, es evidencia histórica, no una decisión vigente.

## Implementación Fase 3B — contratos verificados (2026-09-28)

| Operación | Contrato backend vigente | Flutter/Next | Compatibilidad y prueba |
|---|---|---|---|
| `GET /scheme/` y `GET /admin/students/{id}/scheme` | Mantiene campos existentes y agrega señales de evaluación global (`is_up_to_date`, `is_complete`, `is_certifiable`, `evaluated_on`, `scheme_version`) y por dosis (`is_overdue`, `is_due_today`); decisión calculada en FastAPI | Flutter y Next representan señales backend; `days_until_due` solo da magnitud/contador y el umbral visual de siete días sigue siendo presentación | Backend contrato + E2E; aliases de `PENDING` quedan solo en reportes |
| `GET /scheme/eligibility` | Respuesta booleana de elegibilidad y fecha de evaluación, sin lista clínica | Next/Flutter usan overview compartido para UI; no hacen cálculo local | OpenAPI/contracts y certificado consumen el mismo evaluador |
| `PUT /scheme/doses/{id}` | Acepta `date` calendario; rechaza fechas futuras en America/Bogota; dosis APPROVED conserva bloqueo; edición de DENIED vuelve a `IN_REVIEW` | Flutter y Next limitan edición según estado recibido; servidor valida | E2E de fecha/estado y pruebas puras de límites calendario |
| `PUT /users/me/profile` | Campo `sex` recibido con valor produce `403`; `null`/omitido no modifica el campo | Clientes no ofrecen modificación propia de sexo/género | E2E estudiante recibe 403 y el valor permanece intacto |
| `PUT /admin/students/{id}/profile` | Admin autorizado puede cambiar `sex`, programa/campus sujeto a scope; genera snapshots antes/después y reconciliación | Pantalla administrativa consume respuesta backend | E2E PostgreSQL con admin normal y test de histórico/versiones |
| `POST /evidence/upload`, `PATCH /evidence/batches/{id}/review` (contrato previo) | Históricamente los lotes no tenían vínculo a dosis y la revisión no cambiaba el estado clínico | Clientes aún conservan cargas generales | El addendum T-04 decidido abajo reemplaza esta descripción histórica |
| `POST /evidence/upload`, `PATCH /evidence/batches/{id}/review` — T-04 decidido | Agrega `dose_id` opcional; aprobar evidencia asociada cambia la dosis a `APPROVED` dentro de la misma transacción; denegar no aprueba dosis | Los clientes pueden asociar una carga a una dosis; las cargas genéricas siguen compatibles | Migración aditiva nullable, ownership, permisos, rollback y concurrencia PostgreSQL |
| `GET /evidence/page` | Wrapper paginado canónico; `GET /evidence/` permanece por compatibilidad | Flutter/Next entienden el wrapper nuevo | Contract tests y pruebas de modelo cliente |
| Certificado estudiante/admin | Usa `evaluate_scheme`; no elegible responde HTTP 400 con `CERTIFICATE_NOT_ELIGIBLE` y mensaje seguro | Clientes habilitan descarga solo con señal backend | E2E login→scheme→evidence→review→certificate con student/admin |
| Migración `2026_09_27_0400` | Extiende enum de evidencia, agrega auditoría de revisión, `student_scheme_versions` y `vaccine_rules.is_active`; normaliza `PENDING` de dosis/vacuna a `IN_REVIEW` | No cambia contratos legacy de listas | PostgreSQL real: migración desde vacío, segunda ejecución idempotente, preservación de filas y concurrencia |

Los status/enum legacy de evidencia (`uploaded`, `under_review`, `reviewed`, `pending`) se conservan para lectura. `reviewed` se presenta como histórico sin aprobar/denegar por inferencia. La equivalencia lote de evidencia→dosis permanece sin implementar mientras no exista decisión institucional.

## Addendum — opciones académicas compartidas (2026-10-26)

`GET /admin/academic-options` entrega `{programs: string[], campuses: string[], semesters: number[]}` a roles `admin` y `app_admin`. FastAPI toma las listas de `app.common.academic`; el campo `semesters` es aditivo y publica `1..10`, la decisión institucional elegida desde Flutter. Next consume el mismo campo en dashboard, listado y formularios. Las nuevas altas validan `1..10`; la edición preserva un semestre histórico fuera de ese rango solo cuando no cambia. Las consultas de lectura mantienen hasta20 para poder encontrar datos históricos. La ruta requiere autenticación y rol administrativo existente. Backend contract tests comparan la respuesta exacta y comprueban 401/403; Next prueba las opciones representadas y Flutter conserva su lista existente.

## Ejecución Fase 3A — contratos no clínicos (2026-09-27)

FastAPI/OpenAPI se mantiene como fuente contractual. El trabajo no genera aún un SDK ni reemplaza los clientes manuales: el gate de generación requiere Node/npm, que no están disponibles en este entorno. Propuesta para el siguiente entorno CI: fijar `openapi-typescript` y generar tipos TypeScript desde una exportación reproducible de `app.openapi()`; comparar artefacto generado y OpenAPI versionado para detectar drift/breaking changes. En Flutter, conservar Dio/datasources, usar enums tipados con valor desconocido preservado y probar DTOs contra fixtures; decidir generador Dart solo tras spike con versión fijada. No se incorporó dependencia ni se cambió lockfile.

Se implementó el sobre aditivo de error `code`, `message`, `details` opcional y `detail` de compatibilidad, manteniendo status HTTP. Los mensajes genéricos no contienen detalles internos y los 422 no reflejan el valor rechazado. Flutter prefiere `message` y conserva fallback a `detail`; Next BFF emite ambas claves y su cliente normaliza respuestas antiguas. La semántica de autorización no cambió. Backend/Next no pudieron ejecutar sus pruebas en este entorno, por lo que este contrato permanece **BLOCKED para verificación runtime**.

Paginación: admin acepta `size` además de `page_size` y agrega `size/pages/has_next/has_previous`, conservando claves antiguas. Evidencia conserva `/evidence/` como respuesta histórica y añade `/evidence/page?page&size` con `items` y metadatos canónicos; ambos clientes actualizados usan la ruta nueva. Pruebas backend/Next fueron añadidas pero no ejecutadas; no hubo verificación PostgreSQL. Flutter parsea claves nuevas y antiguas y sus pruebas pasan.

Los enums Flutter distinguen estados inequívocos del servidor y preservan strings desconocidos para round-trip; los unions Next incluyen valores exactos del backend sin borrar aliases de compatibilidad. `reviewed` no se interpreta como aprobación ni rechazo. `other`, `annual` y `archived` quedan conservados en compatibilidad hasta aclarar su equivalencia.

Fechas: `birth_date`, `applied_date` y fechas calendario del esquema siguen en `YYYY-MM-DD`; timestamps siguen siendo instantes. No se encontró ni corrigió conversión UTC incorrecta demostrable durante este bloque. Zona horaria clínica para vencimientos/“hoy” continúa **UNKNOWN**. Sin cambio de reglas clínicas.

| Área | Estado Fase 3A | Evidencia / limitación |
|---|---|---|
| OpenAPI, drift y breaking checks | BLOCKED | Prueba de contrato escrita; no se ejecuta backend (pytest/FastAPI ausentes), ni generador/check en CI (Node/npm ausentes). |
| DTOs/enums | DONE en Flutter; BLOCKED en backend/Next | `flutter analyze` limpio y 44 tests pasan. Pruebas de drift backend/Next escritas, no ejecutadas. |
| Error uniforme | BLOCKED | Implementación aditiva en backend/BFF/consumidores; tests Flutter pasan, suites backend/Next no ejecutables. |
| Paginación y evidencia | BLOCKED | Ruta aditiva y compatibilidad de aliases implementadas; prueba Flutter pasa; falta ejecución API real y PostgreSQL. |
| Fechas calendario | DONE en Flutter; UNKNOWN timezone | Round-trip Flutter cubierto; test OpenAPI backend escrito sin ejecución. Política timezone clínica fuera de alcance. |
| Semántica `reviewed` | NEEDS_CLINICAL_DECISION | No se hizo equivalencia ni transición clínica. |

Pruebas nuevas: `backend/tests/test_api_contracts.py`, `frontend-next/src/lib/api/__tests__/contracts.test.ts`; se amplió `frontend-next/src/lib/server/__tests__/route.test.ts`; Flutter: `frontend/test/core/error/api_error_message_test.dart`, `frontend/test/features/student/data/models/vaccine_model_contract_test.dart`, `frontend/test/features/admin/data/models/paginated_response_contract_test.dart`. Comandos backend/Next y estado se registran en `docs/audits/phase3-domain-audit.md`.

La referencia observada del servidor es FastAPI/Pydantic/OpenAPI. Los tipos Next y Dart son implementaciones cliente inspeccionadas; la presencia de un campo tipado no demuestra que el cliente valide el response. No se ejecutó ni exportó `/openapi.json` durante este audit.

| Área / operación | FastAPI observado | Flutter | Next.js | Gap / prioridad | Pruebas presentes y necesarias |
|---|---|---|---|---|---|
| Enums globales | `common/enums.py`: Role, Gender, DoseStatus, VaccineStatus, EvidenceBatchStatus, ConversationStatus, AppliesTo, DoseType | Varios estados y enums son strings; esquema model trae campos tipados parciales | `lib/api/types.ts` mantiene union manual; añade `other`, `annual`, `archived`, evidencia enum distinto | `API-01 P1/P2`: diferencia de enum puede invalidar/falsear estado | Existe cobertura puntual de format y flujo; falta comparar OpenAPI enums vs ambos clientes automáticamente y probar unknown values. |
| GET `/scheme/` | `SchemeOverviewResponse`: contadores snake_case y lista de `StudentVaccineResponse`; dosis incluye date, days, titer, review, config | `SchemeOverviewModel`, `DoseModel` string status/date, VaccineInfo subset; copia contadores | `SchemeOverview`, `StudentDose`, `StudentVaccine.vaccine: Vaccine` completo | `API-02 P1`: semántica agregada y perfil DTO difieren | Backend rules/e2e, Flutter provider cache; faltan fixture común JSON, nullable/extra/required y resultados de elegibilidad. |
| PUT `/scheme/doses/{id}` | Body `applied_date: date|null`, `titer_value: string|null`, respuesta `{message}`; errores incluyen 403/404/409/422 | datasource puede omitir campos y usa clear flags para enviar null | esquema envía fecha vía API cliente | `API-03 P2`: omisión vs null son semánticas diferentes; la API response no devuelve objeto actualizado | E2E aprobado->409; faltan tests de null/omitted, fecha futura y round-trip DTO. |
| Review dosis `/admin/doses/{id}/review` | `ReviewDoseRequest(status:DoseStatus, admin_notes?)`; respuesta revisada (ver admin schemas/router) | Admin datasource transmite mapa; UI consume valor | Admin pages consumen types / cliente | `API-04 P2`: revisar permitidos/transiciones solo por enum no expresa máquina estado | `test_admin_dose_reviews`, e2e parcial; falta matriz de transición por estado y permiso scope completo. |
| Evidencia GET `/evidence/` | Query `page` 1-based default 1, `page_size` 20 max100; response declarada list batch | `EvidenceRemoteDataSource` parsea lista | `listEvidence()` declara `EvidenceBatch[]` | `API-05 P1/P2`: pagina sin `total/page/pages`; sin filtros declarados | No localizados contract tests de paging; agregar tests backend y consumidores. |
| Evidencia upload | POST multipart `files[]` y `notes`; respuesta `EvidenceBatchResponse`; PDF validator | multipart; parsea lote | FormData declara `EvidenceBatch` | Alinear tipo exacto, límites y error de validación. | `test_file_validators`, e2e synthetic upload; faltan contrato multipart, límite y errores representados por cliente. |
| Evidencia download | GET `/evidence/files/{file_id}` stream, tipo de media y Content-Disposition, autorización en service | API Dio autenticada y escritura local | `downloadEvidenceUrl` apunta a `/api/evidence/...` same-origin; el BFF reenvía cookie y autoriza con sesión | `API-06 P2`: contrato de stream/headers y cobertura end-to-end faltan; no se encontró falla de auth en el flujo inspeccionado | Tests backend permisos existentes; falta test de navegador/BFF para sesión válida, expirada, scope, filename/MIME/no-store. |
| Evidencia delete | DELETE `/{batch_id}` 204; service ownership error actual usa BadRequest para no propietario | parsea 204 | llama delete | `API-07 P2`: error de permiso puede ser 400 en lugar de 403; diferenciar contrato sin asumir bug de autorización (permiso se rechaza) | Test status/shape por dueño/no dueño, cliente handling 204/400. |
| Certificado estudiante/admin | GET `/certificates/scheme`, admin path; PDF o 400 textual; role/object checks deben probarse | petición de PDF y mensaje de error | llamada API y nombre local deriva hint de email en filename | `API-08 P1`: no hay endpoint reusable de decisión, errores no tipados; nombre/hint UI no altera regla pero contrato requiere filename | E2E certificado; falta eligibility JSON shared, error reasons estables y test permisos por cada rol/scope. |
| Listado de estudiantes admin | GET query paginado y POST `/students/search` JSON; objeto `{items,total,page,page_size,total_pages}`; `page_size` 1..100; filtros search, active, program, campus, sex, semester/status | `PaginatedResponse<T>` espera ese formato | inspeccionar `admin.ts` para tipos/endpoints; la lista usa types API | `API-09 P2`: dos transportes semánticamente equivalentes, query puede exponer búsqueda/PII; POST existe para preservar URL | Tests admin reports existentes; falta paridad exacta GET vs POST y todos filtros/resultados/errors. |
| Auditoría propia/admin | GET `/audit/me` y `/audit/admin`; `limit` default 100, max 200; `offset` default 0; response array | No se localizó datasource Flutter dedicado; historial consulta endpoint | Next pasa `limit/offset`, espera array | `API-10 P2`: offset no devuelve total/has-next; páginas consumen tamaño fijo | Pruebas de permisos/auditoría; falta siguiente/última página con cambios concurrentes y contrato cliente. |
| Evidencia vista admin | GET `/admin/students/{id}/evidence`, sin parámetros y devuelve lista | admin datasource obtiene lista | Next admin detail usa endpoint API | Sin paginación ni total para historial largo; distinto de evidencia propia | Añadir contract test de límite esperado o paginación acordada y tests de scope. |
| Comunicaciones/notificaciones | `GET /communications/threads`, recipients y `GET /notifications/` devuelven listas sin parámetros page/limit | clientes consumen lista | clientes consumen lista | No son endpoints paginados; no hay orden común y pueden crecer | Prueba de orden/cantidad y límite solo si se define requisito de producto; no inventar paginación. |
| Errores | main handlers: HTTP exception detail, validación detail array, ciertos handlers `code`; 401/403/404/409 via exceptions; rate limit 429 y service 503 | `api_error_message.dart` busca detail/message/msg, stringifica fallback | Axios callers extraen detail; BFF devuelve `{detail}` en algunos fallos | `API-11 P2`: ninguna estructura estable compartida por status ni mapping de error | Tests seguridad y BFF puntuales; falta contrato parametrizado status x endpoint x cliente. |
| Campos fechas | Pydantic `date` vs `datetime`; server timestamps suelen llevar timezone | Date/instants ambos `String`; algunas pantallas `DateTime.tryParse` | `string`; formatter distingue regex `YYYY-MM-DD` de date-time | `API-12 P2`: tipos declarativos insuficientes / timezone de display no expresa | Next formato test ya cubre un caso; falta test validación calendario e instantes en tres plataformas. |
| Auth/session | FastAPI v2 refresh y auth session contracts en routers; Fase2 establecida | interceptores token rotation | BFF session cookie y types AuthTokens histórico/manual | No auditar aquí seguridad general; evitar incluir `/auth/refresh` al generado si no se protege tokens browser | Fase2 tests cubren BFF/session; contract schemas y versiones requieren OpenAPI check restringido. |

## Paginación y listados encontrados

| Recurso | Parámetros | Respuesta | Orden/filtros | Cliente/interpretación |
|---|---|---|---|---|
| Admin estudiantes | `page`, `page_size` por GET; mismo body en POST search; filtros académicos/estado | wrapper completo `{items,total,page,page_size,total_pages}` | reporte usa `created_at desc`; filtros combinados; page empieza en 1 | Flutter `PaginatedResponse`; Next API/admin list. |
| Evidencia propia | `page`, `page_size` | `list[EvidenceBatchResponse]`, sin wrapper | repository `created_at desc`, no total | Flutter datasource recibe lista; Next API tipa lista. |
| Auditoría `/audit/me`, `/audit/admin` | `limit`, `offset` | `list[AuditLogResponse]`, sin total/has-next | Next devuelve lista; páginas piden hasta 100 | Offset-based sin metadatos. |
| Evidencia admin | ninguno | lista simple; service default `limit=20` | admin detail recibe respuesta completa disponible | Sin mecanismo de continuación; endpoint queda limitado al default del service. |
| Threads, recipients, notifications, admin vaccines/admins, student scheme | ninguno | listas simples | listas simples | No son paginados según routers inspeccionados. |

La utilería `backend/app/common/pagination.py` expone `page/page_size` y wrapper `items,total,page,page_size,total_pages`, pero no se utiliza en todos los routers y no ofrece `has_next/has_previous`. El valor de `total_pages` vale cero cuando total es cero. Los endpoints `page` observados usan base 1; auditoría usa offset. Evidencia admin lista con el default `limit=20` y no expone continuación.

## Contrato de error: situación observada y propuesta de trabajo

No debe implementarse envelope sin migración. Inventario que debe mantenerse por status:

| HTTP | Uso encontrado | Riesgo de contrato | Prueba propuesta |
|---|---|---|---|
| 400 | Bad request y certificado no elegible, parsing/operaciones inválidas | confunde datos inválidos, criterio clínico y recurso inaccesible | endpoint, código estable, texto no clínico sensible y cliente |
| 401 | credenciales/sesión inválida | Flutter y Next redirigen/limpian estado por rutas distintas | expiración, refresh, sesión revocada, mensaje seguro |
| 403 | rol/scope/propiedad | algunos clientes solo muestran detail | acceso a recurso propio, ajeno y cross-scope |
| 404 | ids no encontrados | coherencia frente a recurso ajeno puede revelar existencia | dueño/ajeno/ID inexistente y política de concealment |
| 409 | dosis APPROVED edit, conflicto de concurrencia | puede ser textual sin `code` | código, retry policy y presentación |
| 422 | Pydantic validación (detail list), algunos requests inválidos handler `{detail,code}` | shape múltiple | cada forma de field error y mapping a campo |
| 429 | middleware/limiter | posible Retry-After y mensaje diferente | headers/status/body en limit compartido |
| 500 | no controlado | filtrar detalle interno | envelope sin stack/SQL/PII |
| 503 | limitador no disponible o dependencia temporal | cliente puede tratar como error terminal o fallback offline | retry-after, offline behavior y presentación segura |

Envelope candidato para decisión (no contrato aprobado): `code` machine-readable, `message` sanitizado, `field_errors[]` con `field/code/message` opcional, `request_id`; mantener el HTTP status. La compatibilidad exacta exige contrato v/version y pruebas antes de migrar.

## Tipos calendario e instante

- `calendar date`: `Profile.birth_date` (`Date`/Pydantic `date`); `StudentVaccineDose.applied_date`; `due_date` calculada. Formato canónico `YYYY-MM-DD`.
- `instant`: `reviewed_at`, `created_at`, `uploaded_at`, `created_at` de auditoría/notificación/conversación; DB timezone-aware y en varios servicios UTC. OpenAPI `date-time` con offset.
- No se debe convertir un `date` a instante UTC para mostrar fecha local. Next `formatDate()` distingue formato date y tiene tests para día/mes y fechas inválidas; Flutter mantiene strings, pero perfiles y detalle usan `DateTime.tryParse` en formateadores. Ver `DOM-08`.
- `today=date.today()` aparece en reglas y certificado sin zona de negocio explícita. La zona de negocio para determinar “hoy” es **UNKNOWN**; DEC-02.

## OpenAPI: propuesta y compatibilidad

- **TypeScript**: generación de types/SDK desde especificación versionada; CI compara output limpio y verifica breakages. Migración gradual desde `src/lib/api/types.ts`, evitar cualquier lógica de negocio generada.
- **Dart/Flutter**: spike para `openapi-generator` o conversión de schemas a modelos; mantener Dio/datasources inicialmente, validar `json` de respuestas contra schemas antes de sustituir modelos manuales. Revisar unions, enums y nullable del stack actual.
- **Compatibilidad**: producción puede servir versionados `/api/v1` y `/api/v2`; archivo OpenAPI por versión, pruebas de respuestas. Generadores y versiones fijados en lockfiles; publicación de artefactos solo tras diff revisable.
- **Breaking checks**: cambios de required/nullability, renombrado/remoción, enum narrow/change, query/body, response status/content type, date-vs-date-time o permiso no aditivo requieren aprobación y migración/versionado.
- **Respuestas especiales**: file upload multipart, streams PDF, 204, auth/BFF cookies, errores y headers necesitan descripción explícita; no asumir que types solos validan comportamiento.

## Fuente única frente a especificidad de plataforma

**Compartido backend/OpenAPI**: roles/estados, campos/nullability, fechas/formato, filtros/order/page, errores machine-readable, transiciones aceptadas, estado agregado y elegibilidad/resultados/reasons, constraints de upload, permisos contractuales, headers/filename.

**Específico permitido**: layout responsive, navegación, diálogo de selección de archivo/cámara, almacenamiento seguro de sesión por plataforma, sistema de permisos OS, toast/error rendering, lectura/captura local de fecha con conversión a `YYYY-MM-DD`, UI offline marcada como stale, idioma/accesibilidad. Estos no pueden alterar decisiones clínicas.

## Faltantes de pruebas por consumidor

- FastAPI: existe suite extensa por módulos y algunos E2E; falta export OpenAPI estable, contract test por todos los endpoints, matriz de error, paging uniforme y resultado de elegibilidad separable.
- Flutter: tests de providers/auth/dashboard; no se localizó test de roundtrip de modelos de vacuna/evidencia contra muestras OpenAPI ni prueba que detecte `certificateStatus` divergente.
- Next: tests de formato/auth/BFF/UI primitives; no se localizó contract test API contra especificación ni tests de paridad de estados clínicos/evidencia.
- Cross-client: falta fixture compartida y suite que pruebe los mismos payloads/decisiones para Dart y TypeScript.
