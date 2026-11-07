# Fase 5A — Paridad funcional crítica

Fecha inicial: 2026-09-28. Actualización de cierre: 2026-10-09, America/Bogota. **FASE 5A = DONE** para el alcance funcional autorizado, incluidos los tres grupos de continuación. **FASE 5B = NOT STARTED**. La paridad global de Fase 5 sigue PARTIAL; UI-16/UI-17 continúan BLOCKED por alcance. Evidencia vigente: [phase5a-closure.md](phase5a-closure.md).

## Alcance y autoridad

Fuentes: `AGENTS.md`, skills locales `security-health`, `quality-gates`, `ui-parity`, `docs/audits/phase5-ui-parity.md`, `docs/ui/phase5-parity-matrix.md` y código/tests existentes. FastAPI conserva autoridad de negocio y autorización. Flutter es referencia de capacidades; no se trasladan sus reglas clínicas a Next.

El árbol ya tenía modificaciones sin commit de Fases 1–4 y los documentos de Fase 5. Se capturó un inventario SHA-256 al empezar para distinguir esta entrega. La lista final de archivos de este documento corresponde a esta tarea, no a todo `git diff` frente a HEAD.

Sin cambios de reglas clínicas, esquema de datos, dependencias/lockfiles, PDF/QR, Maps, Azure o publicación. **Migraciones nuevas: ninguna.** T-02/T-03 y Fase 3B siguen PARTIAL; almacenamiento productivo sigue sin validar. No se declara producción lista y no se hace commit.

## Hallazgos, causa raíz, solución y estado

| Hallazgo | Causa raíz comprobada | Cambio y archivos principales | Evidencia / estado |
|---|---|---|---|
| UI-13 P1 — comentario aprobaba | Next reutilizaba `reviewDose`, infiriendo `approved` para todo estado distinto de `denied`. Flutter también reenviaba estado/revisor al editar notas. | PATCH exclusivo de comentario en `admin/router.py`, DTO cerrado y servicio que solo modifica `admin_notes`; `AdminDoseRow` separa mutaciones/confirmaciones; Flutter tiene manejadores independientes. | **DONE**. HTTP PostgreSQL, concurrencia/rollback, componente, contrato Dart y Chrome→Next→FastAPI→PostgreSQL. |
| UI-02 P1 — sesión expirada | El 401 terminal de una consulta Next no actualizaba Zustand; GoRouter no escuchaba cambios de autenticación Flutter. | `api/client.ts`, `auth/store.ts`, `providers.tsx`: evento terminal, limpieza, descarte de respuestas de sesión anterior; `app_router.dart`: refresh de rutas al cambiar auth. No se altera JWT/rotación/backend de autenticación. | **DONE** para el defecto identificado. Tests de contenido montado, redirect, caché y respuesta tardía; widget Flutter. No se afirma cobertura de cada pantalla en dispositivo físico. |
| UI-03 P1 — comunicaciones | Pantallas duplicadas construían destinatario incorrecto para app_admin; detalle sin cerrar/reabrir y ocultaba respuesta en cerrado. | `CommunicationsPage`, wrappers de ambas rutas y `ThreadDetail`: búsquedas autorizadas, campo `admin_id`/`student_id`, categorías existentes, cerrar/reabrir con confirmación, responder en cerrado conforme API, polling. | **DONE**. Componentes por rol y cuatro flujos HTTP con PostgreSQL, incluyendo tercero fuera de ámbito 403. |
| UI-01 P1 — navegación móvil | Sidebar oculto bajo `md` sin navegación equivalente. | `AppShell`: enlaces móviles de la misma configuración por rol y `aria-current`; no nueva paleta/tipografía. | **DONE** funcional. Test de enlaces y Chrome a 390×844 comprueba disponibilidad real. No comparación visual masiva. |
| UI-05 P1 — errores ocultos | Uso de `data ?? []`, valores cero o `!data` antes de distinguir error. | `QueryError` + manejo en dashboards, perfiles, esquema, evidencias, notificaciones, historial, catálogo, admins, estudiantes/detalle/subconsultas, comunicaciones y contador del shell. Vista previa privada distingue error de ausencia de firma y permite retry; URL blob se libera. | **DONE** en consultas autenticadas intervenidas. Tests de 15 pantallas, detalle 403/404/500, mensajes por código y preview. El verificador público se registra aparte en UI-16. |
| UI-09 P1 — acciones escondidas | Controles existentes dentro de `hidden`; icono mensaje abría evidencia. | Detalle: muestra desactivar/reactivar/eliminar, confirmaciones; mensaje navega al compositor con ID interno de estudiante. Backend sigue validando ámbito. | **DONE**. Tests de cada confirmación y destino del enlace; API de permisos existente incluida en suite. |
| UI-04 P1 — contraseña/documento | Copia anterior al flujo de invitación vigente. | Alta de estudiante y `ChangePasswordForm`: instrucciones de correo, sin afirmar contraseña basada en documento. | **DONE**. Revisión de textos, lint/typecheck/build. Sin cambio en creación de credenciales. |
| UI-06 P1 — formato evidencia | Selector publicitaba imágenes aunque API solo admite PDF. | `student/evidence`: accept PDF y texto 10 MB/archivo según contrato. | **DONE** para discrepancia del selector. Test de accept/subida. MIME/tamaño real siguen siendo controles backend; arrastrar un archivo inválido lo rechaza la API. |
| UI-07 P2 — eliminar evidencia | Control condicionado a nombres de estados antiguos; falta confirmación. | Estudiante ofrece acción en estados del contrato; confirmaciones estudiante/admin. No se altera permiso ni estado clínico. | **DONE** para capacidad y confirmación. Componentes `in_review`/`approved`/`denied`, suite HTTP existente de evidencias. |
| UI-10 P2 — contexto de navegación | Filtros/tabs ignoraban URL; volver descartaba filtros y búsqueda. | Parámetros canónicos, `returnTo` interno validado y contexto opaco `ctx`; búsqueda por usuario/pestaña en sessionStorage con TTL de 30 minutos. Detalle→compositor→hilo conserva retorno. | **DONE** en el alcance funcional. Helpers, componentes y Chrome: filtros+página+búsqueda→detalle→regreso, atrás, tab+reload y deep link a página de evidencia. Búsqueda sensible nunca en URL. |
| UI-11 P2 — completo/certificable | Copia de dashboard/certificado confundía señales. | Etiquetas consumen señal backend; error nunca se representa como no certificable en la consulta intervenida. | **DONE** para textos intervenidos; no cálculo clínico nuevo. |
| UI-19 P2 — lectura/contadores | Marcas locales y GET anteriores podían contradecir una escritura confirmada. | Ambos clientes usan notificaciones del backend; se eliminan marcas locales de hilos. Generaciones de lectura, invalidación específica y reintento de fallo de lectura Next. | **DONE** para sincronización del contrato existente por categoría. No se añade lectura individual por hilo. Pruebas de fallo, respuesta retrasada, duplicación y cambio de cuenta. |
| UI-08 P2 — paginación/volumen | Descarga anticipada de estudiantes, historial limitado, evidencia administrativa sin metadata; orden sin desempate. Importaciones truncaban filas. | Páginas reales de 20, endpoints aditivos, filtros de visibilidad antes de COUNT/OFFSET y orden created_at+id. Importaciones paginan localmente la respuesta existente. | **DONE** para listados intervenidos. PostgreSQL, componentes, Flutter y Chrome; retorno a página válida al vaciar última página. Helpers listAll quedan compatibles y sin consumidores en pantallas. |
| UI-12 P2 — fechas del dispositivo | Restricciones y fechas UI descritas en audit inicial. | Sin cambios aquí. | **PARTIAL**; pendiente de bloque específico que use contrato backend. |
| UI-14/UI-15 P2 — temas/accesibilidad integral | Tokens/semántica inconsistentes en pantallas existentes. | Solo labels y navegación necesarios para acciones intervenidas; no rediseño. | **PARTIAL**, reservado para validación visual posterior. |
| UI-16 P1 — verificador público | Transporte se convierte en INVALID; audit previo lo demuestra. | No se modificó `verify/[publicId]`, PDF ni QR por el límite de certificados de esta entrega. | **BLOCKED por alcance**, no por infraestructura. Necesita bloque autorizado de manejo de errores del verificador; sigue abierto y no permite afirmar que todos los P1 de Fase 5 estén cerrados. |
| UI-17 P2 — gestión de certificados | Paridad móvil/configuración de responsable incompleta. | Sin cambios de capacidades de certificados. | **BLOCKED por alcance** de PDF/QR/certificados para este bloque. |
| UI-18 P2 — formularios | Lecturas anteriores, invalidación incompleta y eventos repetidos dejaban valores stale o duplicaban escrituras. | Mutaciones protegidas por intención y usuario; bloqueo de campos durante envío; cancelación/recarga de consultas afectadas; valores opcionales vacíos como null permitido por API. | **DONE** para sincronización/lectura de formularios intervenidos. Catálogo institucional de opciones sigue UNKNOWN, fuera de este cierre; no se copia catálogo Flutter ni se cambian validaciones clínicas. |

`DONE` refiere al defecto delimitado y a la evidencia indicada; no significa paridad global ni cierre de Fases 3B/4/5. La Fase 5B no se inicia. El P1 UI-16 sigue explícitamente abierto y excluido del alcance autorizado de este cierre.

## Contrato aditivo de comentario y controles

- `PATCH /api/v1/admin/doses/{dose_id}/comment`.
- JSON obligatorio `{ "admin_notes": "texto" }` o `{ "admin_notes": null }` para borrar. Campo ausente o cualquier campo adicional (incluido `status`) devuelve 422.
- Respuesta 200 `MessageResponse`, errores del envelope existente. 401 sin sesión; 403 estudiante/admin fuera del ámbito; 404 dosis no encontrada.
- Roles y ámbito iguales a revisión existente: admin normal autorizado o app_admin. No se copió una restricción de UI Flutter sobre autor original como nuevo permiso de negocio.
- Usa el mismo bloqueo de fila que revisión. No modifica `status`, `reviewed_by`, `reviewed_at`, fechas o estado padre. Comentario + auditoría se confirman juntos; fallo de auditoría revierte la escritura.
- Auditoría `dose.comment_updated`: actor, objetivo e indicador de eliminación; **sin texto del comentario**. No notifica aprobación/denegación al comentar.
- `PUT .../review` conserva compatibilidad; Next manda estado solo desde la confirmación de aprobar, denegar o enviar a revisión. Se conserva envío explícito de nota dentro de una revisión real. Al abrir confirmación, carga la nota actual para no reutilizar una nota anterior del componente.
- Next BFF ya reenviaba PATCH: no se añade bypass ni acceso a JWT desde el navegador. Flutter consume el nuevo PATCH con su autenticación existente.
- El texto de notificación de una revisión explícita `in_review` ya no dice “rechazada”. Es corrección de representación, no transición nueva.

## Navegación y comunicaciones verificadas

Rutas existentes de login, dashboard, esquema, evidencia, certificado, comunicaciones, perfil y administración se conservaron. Next genera todas en build. No se detectó una familia funcional de Flutter ausente entre estas prioridades; las brechas eran acceso móvil, destinos, permisos y parámetros ignorados.

- Detalle acepta `tab=info|scheme|evidence`; retorno solo a `/admin/students` con filtros permitidos, sin redirección externa. Dashboard conserva semestre junto con filtro. No introduce nombres/documentos/correos en query strings.
- Mensaje contextual usa el identificador interno del estudiante, no nombre/documento; solamente administrador normal puede preseleccionarlo en comunicaciones. Backend valida destino y ámbito incluso si URL se manipula.
- Estudiante puede dirigir a admin permitido o usar mensaje general del ámbito; admin normal a estudiante o app_admin; app_admin a admin normal. Se conservan `general`, `scheme`, `evidence`, `technical`.
- Listado polling 30 s, detalle 5 s. Cerrar/reabrir tiene confirmación; responder a cerrado lo reabre porque esa es la conducta actual de FastAPI. No se cambia la semántica.
- Marcar leído usa categoría completa, igual que Flutter. No se promete lectura individual ni sincronización perfecta de marcas locales entre dispositivos.

## Pruebas nuevas y nivel de evidencia

| Prueba | Nivel y controles |
|---|---|
| `backend/tests/test_phase5a_comments.py` | HTTP real ASGI + PostgreSQL: comentarios en tres estados con texto/null; rechazo de payload de revisión; permisos; bloqueo concurrente con denegación; rollback de auditoría; app_admin. |
| `backend/tests/test_phase5a_communications.py` | HTTP + PostgreSQL: cuatro combinaciones emisor/destinatario, apertura, respuesta, cierre, reapertura y tercero 403. |
| `backend/tests/test_phase5a_browser.py` + `frontend-next/tests/e2e/phase5a-browser.mjs` | Chrome real → build Next/BFF → servidor FastAPI → PostgreSQL. Login por formulario, deep link esquema, editar/borrar comentario sin PUT ni transición; confirmar aprobación/denegación; estudiante sin UI admin y 403 al forzar las mutaciones; navegación móvil visible. |
| Next `admin-dose-row`, `phase5a-communications`, `phase5a-queries`, `phase5a-evidence` | Componentes con React Query; intención/confirmaciones, roles, endpoints, errores/retry, carga/vacío, selector PDF y eliminación por estado. |
| Next `phase5a-session-navigation`, `phase5a-student-detail`, `phase5a-navigation` | Sesión montada/limpieza/respuesta tardía, permisos, enlaces móviles, filtros/tabs/retorno seguro, desactivar/reactivar/eliminar con confirmación. |
| Next `phase5a-signature-preview` | Fallo 503 no equivale a ausencia de firma; retry, recurso privado y revoke de URL al desmontar. |
| Next `api/__tests__/contracts.test.ts` | PATCH comentario y PUT revisión con payloads distintos. |
| Flutter `comment_contract_test.dart` | Datasource usa PATCH exclusivo, incluido borrado sin campo status. |
| Flutter `session_redirect_test.dart` | Widget montado con router real: ruta protegida → cambio auth → login. |

El test de navegador es opt-in, usa puertos loopback efímeros, un schema PostgreSQL `phase1_<uuid>`, cuentas sintéticas y un perfil Chrome temporal. No lee el perfil personal del navegador ni exporta tokens. FastAPI tiene lifespan desactivado para evitar seeds/tareas externas; mantiene rutas/dependencias reales con DB/storage aislados. BFF usa clave aleatoria de prueba solo en memoria. No se instaló Playwright ni se alteraron dependencias: CDP se controla con WebSocket de Node 20 (`--experimental-websocket`). Chrome usa `--no-sandbox` únicamente en este harness local sintético, no configura despliegue.

## Comandos y resultados iniciales (evidencia histórica)

Entorno: Python 3.12.14 en `backend/.venv`, Node 20.20.2 local, Next 16.3.6, Google Chrome 153.0.8010.52 y PostgreSQL 18 local en puerto 55544. No hubo instalaciones ni upgrades.

| Gate | Resultado verificado |
|---|---|
| Backend + PostgreSQL, primera ejecución completa | 382 PASS, 3 SKIP; antes de incorporar el harness Chrome a la colección. |
| Comentarios/comunicaciones sobre PostgreSQL | 7 PASS, incluidos concurrencia y rollback. |
| Chrome E2E crítico | 1 PASS en ejecución dedicada; el gate conjunto final se registra al pie. |
| Next con PostgreSQL BFF | 100 PASS, 0 SKIP (21 archivos de tests). |
| Next lint | PASS, sin warnings de ESLint tras corregir el harness. |
| Next typecheck | PASS (`tsc --noEmit`). |
| Next production webpack | PASS; 26 páginas estáticas y rutas dinámicas generadas. |
| Flutter analyze / tests | PASS, sin issues / 46 PASS. |
| Ruff | PASS `app tests`; format check de 7 archivos backend intervenidos PASS. |
| Diff | `git diff --check` PASS; chequeo adicional de archivos nuevos no rastreados PASS. |

Advertencias preexistentes: deprecaciones SQLAlchemy `noload`, Firebase `MulticastMessage.tokens`, y aviso Vite sobre futuro config loader. No son fallos de las pruebas ni se presentan como lint limpio del ecosistema completo.

```bash
# Backend: suite completa con integración PostgreSQL sintética
cd backend
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase4_cert .venv/bin/pytest -q
.venv/bin/ruff check app tests

# E2E real; requiere haber construido Next con webpack
PHASE5A_BROWSER=1 PHASE5A_NODE=/tmp/phase3a-tools/node/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase4_cert \
.venv/bin/pytest -q --tb=short tests/test_phase5a_browser.py

# Next, desde frontend-next con Node local en PATH
BFF_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55544/immuno_phase1_phase4_cert npm test
npm run lint
node_modules/.bin/tsc --noEmit
node node_modules/next/dist/bin/next build --webpack

# Flutter, desde frontend
flutter analyze
flutter test

git diff --check
```

Los tests de migraciones históricos requieren `PHASE1_POSTGRES_URL`, `PHASE2_POSTGRES_URL`, `PHASE4_SIGNER_POSTGRES_URL` apuntando a bases desechables vacías distintas; no se ejecutan sobre la base compartida. Sus skips no se cuentan como PASS. No hay migración creada por Fase 5A.

Incidencias durante verificación corregidas: expectativa 201 de test frente a contrato de comunicaciones 200; test router sin widget montado; aviso protegido de `notifyListeners` sustituido por método del notifier; E2E adaptado a WebSocket Node20, hidratación y texto visible en botones; `unknown` en estado de error convertido explícitamente a booleano para JSX. Build bajo sandbox falló al crear streams/leer configuración TypeScript; ejecución autorizada fuera del sandbox completó webpack. No se cambiaron versiones para resolver estos errores.

## Riesgos, límites y rollback

- Desplegar API aditiva antes que clientes que usan PATCH. El endpoint antiguo sigue compatible: **clientes antiguos conservan su riesgo de comentario vía revisión hasta actualizarse**; servidor no puede inferir intención humana de un PUT válido. No se promete corregir binarios no actualizados.
- Rollback no requiere migraciones: mantener endpoint de comentario aun si se retira una UI nueva. No restaurar como rollback el comportamiento que aprueba al comentar. Si es necesario contener una regresión, deshabilitar edición de comentarios temporalmente y conservar revisión explícita, sin borrar datos.
- Comentarios concurrentes se serializan por bloqueo, pero dos comentarios distintos siguen política de última escritura; no se introduce edición colaborativa ni versionado de notas.
- Polling aumenta solicitudes; sin prueba de carga institucional, volumen de comunicaciones/listAll continúa pendiente. No se incorporó Redis ni se cambió rate limiting.
- E2E ejecutado en Chrome local y datos sintéticos. Flutter físico, capturas de paridad de todas las pantallas, lectores de pantalla, claro/oscuro integral, condiciones reales de red y storage externo: **UNKNOWN**, no sustituidos por tests unitarios.
- Enlaces/acciones usan permisos actuales; ningún cliente calcula certificabilidad ni nuevos criterios de esquema.
- Auditoría pública/PDF/QR y problemas de alcance señalados en la tabla permanecen abiertos. No se modifica su diseño ni se promete su corrección en esta entrega.

## Archivos modificados en esta tarea

Inventario comparado con el estado inicial; incluye archivos que ya estaban sin seguimiento en Git. `tsconfig.tsbuildinfo` es artefacto local regenerado por typecheck/build, excluido del inventario de código.

- `backend/app/common/enums.py`
- `backend/app/modules/admin/dose_reviews/service.py`
- `backend/app/modules/admin/router.py`
- `backend/app/modules/vaccination_scheme/schemas.py`
- `backend/tests/test_phase5a_browser.py`
- `backend/tests/test_phase5a_comments.py`
- `backend/tests/test_phase5a_communications.py`
- `frontend-next/src/app/admin/admins/page.tsx`
- `frontend-next/src/app/admin/communications/page.tsx`
- `frontend-next/src/app/admin/history/page.tsx`
- `frontend-next/src/app/admin/notifications/page.tsx`
- `frontend-next/src/app/admin/page.tsx`
- `frontend-next/src/app/admin/profile/page.tsx`
- `frontend-next/src/app/admin/students/[id]/page.tsx`
- `frontend-next/src/app/admin/students/create/page.tsx`
- `frontend-next/src/app/admin/students/page.tsx`
- `frontend-next/src/app/admin/vaccines/page.tsx`
- `frontend-next/src/app/student/certificate/page.tsx`
- `frontend-next/src/app/student/communications/page.tsx`
- `frontend-next/src/app/student/evidence/page.tsx`
- `frontend-next/src/app/student/history/page.tsx`
- `frontend-next/src/app/student/notifications/page.tsx`
- `frontend-next/src/app/student/page.tsx`
- `frontend-next/src/app/student/profile/page.tsx`
- `frontend-next/src/app/student/scheme/page.tsx`
- `frontend-next/src/components/__tests__/admin-dose-row.test.tsx`
- `frontend-next/src/components/__tests__/phase5a-communications.test.tsx`
- `frontend-next/src/components/__tests__/phase5a-evidence.test.tsx`
- `frontend-next/src/components/__tests__/phase5a-queries.test.tsx`
- `frontend-next/src/components/__tests__/phase5a-session-navigation.test.tsx`
- `frontend-next/src/components/__tests__/phase5a-signature-preview.test.tsx`
- `frontend-next/src/components/__tests__/phase5a-student-detail.test.tsx`
- `frontend-next/src/components/admin-dose-row.tsx`
- `frontend-next/src/components/app-shell.tsx`
- `frontend-next/src/components/change-password-form.tsx`
- `frontend-next/src/components/communications-page.tsx`
- `frontend-next/src/components/providers.tsx`
- `frontend-next/src/components/query-error.tsx`
- `frontend-next/src/components/thread-detail.tsx`
- `frontend-next/src/lib/__tests__/phase5a-navigation.test.ts`
- `frontend-next/src/lib/api/__tests__/contracts.test.ts`
- `frontend-next/src/lib/api/client.ts`
- `frontend-next/src/lib/api/scheme.ts`
- `frontend-next/src/lib/auth/store.ts`
- `frontend-next/src/lib/navigation.ts`
- `frontend-next/tests/e2e/phase5a-browser.mjs`
- `frontend/lib/core/router/app_router.dart`
- `frontend/lib/features/admin/data/datasources/admin_remote_ds.dart`
- `frontend/lib/features/admin/presentation/screens/admin_student_detail_screen.dart`
- `frontend/test/core/router/session_redirect_test.dart`
- `frontend/test/features/admin/data/datasources/comment_contract_test.dart`
- `docs/audits/phase5a-implementation.md` (este informe).

## Gate inicial y revisión de entrega (evidencia histórica)

Ejecución conjunta final (build webpack definitivo ya generado):

```bash
cd backend
PHASE5A_BROWSER=1 PHASE5A_NODE=/tmp/phase3a-tools/node/bin/node \
PHASE1_INTEGRATION_URL=postgresql+asyncpg://postgres@127.0.0.1:55544/immuno_phase1_phase4_cert \
.venv/bin/pytest -q -rs
```

**383 PASS, 3 SKIP, 7 warnings; 92,50 s.** Incluye Chrome E2E real, HTTP, PostgreSQL, concurrencia, rollback y regresiones existentes. Los tres skips son exclusivamente `test_certificate_signer_migration.py`, `test_phase1_migration.py`, `test_phase2_migration.py`: no se configuraron sus bases vacías dedicadas. No son resultados PASS ni fallos críticos nuevos.

Revisión final:

- `git diff` revisado distinguiendo cambios preexistentes. Hashes confirman que requisitos/lockfiles, Alembic, servicio/reglas clínicas y módulos backend de certificados no cambiaron durante esta tarea. En `vaccination_scheme` solo cambió `schemas.py` para el DTO de comentario.
- `git diff --check` y chequeo de whitespace de archivos nuevos: PASS.
- Revisión de archivos intervenidos y búsqueda de marcadores de claves privadas/credenciales de proveedor: sin hallazgos. Esto es una revisión focalizada, no una nueva auditoría exhaustiva de secretos del repositorio/historial. Credenciales del harness son exclusivamente sintéticas; clave BFF aleatoria no se imprime ni se almacena en fuente.
- Sin migraciones nuevas, cambios clínicos, rediseño PDF, QR, Maps, Azure, publicación ni commit.
- **Estado al terminar esa ejecución inicial: Fase 5A PARTIAL, Fase 5B NOT STARTED.** Este resultado histórico queda sustituido por el cierre funcional documentado a continuación. Fase 5 global sigue PARTIAL; UI-16 permanece abierto y T-02/T-03 no se cierran.

## Continuación: cierre de pendientes funcionales — 2026-10-09

Fuente de alcance: instrucción de cierre funcional de Fase 5A. Los tres grupos siguientes están **DONE** con evidencia real; UI-16/UI-17 permanecen **BLOCKED por alcance**. No se inicia Fase 5B.

### Paginación — DONE

Causa raíz: ambos listados de estudiantes utilizaban helpers para descargar todas las páginas; historiales no ofrecían continuación y el filtrado administrativo ocurría después de limitar resultados. Evidencias administrativas carecían de metadata de página. El orden solo por created_at no resolvía empates.

Solución:

- Orden `created_at DESC, id DESC` en estudiantes, evidencias y auditoría.
- Endpoints aditivos `GET /api/v1/audit/me/page`, `/audit/admin/page` y `/admin/students/{id}/evidence/page`; contrato `page`, `page_size`, `total`, `total_pages`, `has_next`, `has_previous`, `items`, conservando aliases `size`/`pages` y rutas antiguas.
- En auditoría, aplicar visibilidad antes de contar/paginar. Autorización de ámbito existente; no ampliar roles.
- Next y Flutter solicitan una página de 20 registros. Navegación/actualización mantienen filtros y página; si desaparece la última página, vuelven a una válida. La recarga posterior a una escritura Flutter propaga `afterWrite`, evitando quedar en loading.
- Importaciones Next y Flutter permiten recorrer todas las filas ya recibidas en páginas locales de 20. Esta metadata describe la respuesta existente, no un total de servidor inventado. APIs de arrays sin paginación conservan su contrato.
- Los helpers `listAllStudents` permanecen por compatibilidad; búsqueda de consumidores en `frontend-next/src` y `frontend/lib` encontró únicamente sus definiciones.

Pruebas: `backend/tests/test_phase5a_pagination.py` (3); paginador/contexto Next; provider y widget Flutter; Chrome con 45 estudiantes y 45 lotes sintéticos. Permisos 403, filtros antes de COUNT/OFFSET, empates, metadata, páginas concurrentes, página vacía y refresh verificados. Limitación: orden estable no implica snapshot entre solicitudes si otros usuarios insertan/eliminan registros.

### Conservación de contexto — DONE

Causa raíz: estado local de búsqueda desaparecía al desmontar la lista; parámetros de retorno no componían el recorrido hacia comunicaciones. Páginas y tabs no siempre estaban representados en URL.

Solución: URL canónica para filtros inequívocos, página, tab y página de evidencia. `returnTo` solo acepta destinos internos previstos. Búsqueda privada usa referencia aleatoria `ctx`, almacenamiento de sesión por usuario/pestaña y TTL de 30 minutos; se elimina al cambiar de cuenta/logout. Si sessionStorage está deshabilitado, el borrador funciona en memoria durante la vida de la página; no se promete recuperarlo después de una recarga completa en ese caso. Deep link sin contexto local mantiene filtros/página/tab, no reconstruye texto privado.

Pruebas: helpers rechazan páginas inválidas y destinos externos; componente restaura contextos A/B, remount, expiración y cambio de cuenta, incluido storage deshabilitado. Chrome verifica filtros+búsqueda+página→detalle→tab→reload→regreso y botón atrás del navegador. Flutter conserva estado al hacer push/pop y refresca al volver del detalle.

### Formularios y sincronización de lectura — DONE

Causa raíz: escrituras sin protección de doble evento, invalidaciones parciales y respuestas iniciadas antes de una mutación podían repoblar valores anteriores. Lectura local de hilos contradecía notificaciones del backend.

Solución:

- `useSafeMutation`: guardia inmediata de doble submit, usuario capturado al iniciar, cancelación e invalidación de consultas afectadas antes/después de escritura y callbacks solo para la misma cuenta. No cancela consultas ajenas ni cambia autenticación.
- Formularios de perfiles, detalle, evidencia, alta/importación y comunicaciones conservan borradores y bloquean controles durante envío; opcionales vacíos usan null cuando FastAPI ya lo admite. No se modifica el formulario de firma ni operaciones de certificados.
- Flutter utiliza generaciones de petición, guardias mounted y exclusión de escritura en perfil/listas/evidencias/comunicaciones/notificaciones; providers ligados a identidad descartan respuestas de la cuenta previa.
- Estado de lectura de comunicaciones deriva de notificaciones backend, sin SharedPreferences/localStorage de “seen”. Solo una escritura confirmada marca leído; recarga después de ella. Next muestra error/retry de sincronización y maneja también el fallo del retry.

Pruebas: componentes y providers con GET anterior retrasado, escritura fallida, duplicación, desmontaje/cambio de cuenta y consulta no afectada. Chrome retiene una respuesta HTTP real de perfil mediante CDP, envía dos clics en el mismo turno, confirma un único PUT y UI/formulario actualizados, libera la respuesta antigua y comprueba que no sobrescribe el valor reciente.

### Archivos adicionales de esta continuación

Se añaden al inventario inicial; muchos ya estaban modificados por fases previas. No representa todos los cambios frente a HEAD.

- Backend: `app/modules/admin/{router.py,reports/repository.py}`, `app/modules/audit/{router.py,service.py}`, `app/modules/evidence/{router.py,repository.py}`; tests `test_phase5a_pagination.py` y `test_phase5a_browser.py`.
- Next: `src/components/{pagination.tsx,thread-row.tsx,thread-detail.tsx,communications-page.tsx,admin-dose-row.tsx}`; `src/lib/{navigation.ts,query/safe-mutation.ts,ui/list-state.tsx,api/admin.ts,api/audit.ts,api/evidence.ts,api/users.ts}`; páginas de estudiantes/detalle/alta, perfiles, historial, evidencia y administradores; componentes de pruebas de evidencia, detalle, comunicaciones y `phase5a-list-sync.test.tsx`; `tests/e2e/phase5a-browser.mjs`.
- Flutter: datasource admin; providers de admin, evidencia, comunicación y notificaciones; pantallas listado/detalle de estudiante, perfil, historial, comunicaciones/detalle y alta/importación; `shared/presentation/widgets/local_paged_list.dart`; `test/core/phase5a_sync_test.dart`, `phase5a_local_pagination_test.dart` y test existente de admin_provider.
- Documentos: este informe y `phase5a-closure.md`. **Migraciones nuevas: ninguna.**

### Evidencia vigente, riesgos y rollback

Suite conjunta backend+PostgreSQL+Chrome: **386 PASS, 3 SKIP**, 7 warnings, 99,39 s. Los 3 tests de migraciones se ejecutaron por separado en bases vacías dedicadas: **3 PASS**. Total de tests backend distintos verificados: **389**, sin contar ningún skip como PASS. Next: **108 PASS**, lint/typecheck/build webpack PASS. Flutter: **55 PASS**, analyze PASS. Comandos, entorno y límites: [phase5a-closure.md](phase5a-closure.md).

Revisión `git diff` y SHA-256 desde la llegada a esta máquina: no cambian reglas/servicio clínico, autenticación, módulos backend de certificados, Alembic, BFF servidor, verificador público, manifiestos ni lockfiles. Los cambios de esas áreas visibles frente a HEAD son preexistentes. No se usa ningún dataset institucional.

Rollback de esta continuación: retirar clientes/paginadores de manera coordinada si es necesario; mantener las rutas aditivas mientras haya clientes que las usan. Sin modificación de datos/migración que revertir. No restaurar el comentario mediante aprobación como rollback. Los formularios de revisión mantienen acciones explícitas y permisos backend.

Riesgos restantes: offset no ofrece snapshot ante nuevas escrituras; búsqueda privada expira y no es portable entre pestañas/máquinas; lectura por categoría conserva su granularidad backend. Paridad visual/accesibilidad integral y fechas del dispositivo siguen fuera de este cierre; catálogo institucional de opciones UNKNOWN. UI-16/UI-17 BLOCKED por alcance, T-02/T-03 PARTIAL y validación de almacenamiento real pendiente. **FASE 5A DONE; FASE 5B NOT STARTED; sin commit y sin declaración de producción lista.**
