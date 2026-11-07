# Fase 5 — Auditoría de paridad UI Flutter → Next

Fecha: 2026-09-28. Estado: **AUDITADO EN CÓDIGO; implementación no iniciada; validación visual/interactiva UNKNOWN**.

## Alcance y método

Se revisaron `AGENTS.md`, la skill local `ui-parity`, las instrucciones de `repo-audit` como referencia de evidencia, la matriz de Fase 1, documentación de decisiones clínicas/certificados y el código actual de rutas, pantallas, componentes, providers, datasources y APIs involucradas. El alcance de esta entrega prevalece sobre los nombres de documentos sugeridos por las skills: únicamente se crean este archivo y [phase5-parity-matrix.md](../ui/phase5-parity-matrix.md).

La matriz contiene S00–S23: inicio, todas las pantallas Flutter, variantes estudiante/admin/app_admin y verificador exclusivo de Next; S24 registra una capacidad API aún sin pantalla en ninguno de los clientes. Incluye perfil con firma, importación, diálogos de catálogo/titulación/revisión y pestañas de detalle. Cada entrada cubre estructura, datos, acciones, permisos, loading, empty, error, success, navegación, paginación, responsive, accesibilidad, tema y sesión expirada.

**Flutter es referencia inicial, no autoridad clínica.** Se contrastaron controles con FastAPI. No se considera un defecto que una plataforma use diálogo y otra edición inline, ni que Next tenga una capacidad adicional. Sí es una brecha perder una acción permitida, mostrar como resultado clínico una consulta fallida o prometer un formato que el servidor rechaza.

Evidencia de esta auditoría: lectura estática y búsquedas por ruta/función, inventario de tests y revisión documental. **No se ejecutaron aplicaciones, tests, navegador, emulador, capturas, escaneo físico QR ni validación con lector de pantalla.** No se reutilizan los resultados históricos de fases anteriores como prueba de paridad visual. No se consultaron datos institucionales ni se instalaron dependencias.

## Resultado ejecutivo

Hay una implementación Next para las familias de pantalla de Flutter, pero la paridad es **PARCIAL**. Los diez problemas que primero deben resolverse son:

1. Navegación web incompleta debajo de `md` (UI-01).
2. La expiración de una sesión ya montada no está conectada de forma completa a la salida visual en ninguno de los clientes (UI-02; impacto runtime pendiente de ensayo).
3. Comunicaciones Next omite destinatarios por rol y cerrar/reabrir; app_admin construye una creación incompatible con su contrato (UI-03).
4. Next mantiene instrucciones de contraseña temporal igual a documento, contrarias al flujo vigente (UI-04).
5. Fallos de consulta aparecen como ceros, vacío, “Incompleto” o loading indefinido (UI-05).
6. Next ofrece imágenes como evidencia aunque FastAPI acepta PDF (UI-06).
7. Evidencia nueva no se puede eliminar desde Next; las eliminaciones disponibles no confirman como Flutter (UI-07).
8. Listados sin continuación y carga completa anticipada de estudiantes (UI-08).
9. Acciones de gestión de estudiantes ocultas y enlaces contextuales sin respetar filtros/pestañas (UI-09/UI-10).
10. Editar/borrar un comentario en Next puede cambiar una dosis EN REVISIÓN a APROBADA (UI-13), una diferencia funcional prioritaria que no debe trasladarse al dominio.

Además: textos que confunden completo/certificable, restricciones de fechas del dispositivo, temas forzados, semántica accesible incompleta, errores del verificador, revocación solo web, ausencia de UI de asignación de responsable y contadores de comunicaciones desincronizados. No se identificó un P0 demostrado dentro de esta inspección de UI. Los P1 indican pérdida funcional, representación engañosa relevante o riesgo de una acción no expresada por el usuario; no equivalen a una vulnerabilidad explotada.

## Autoridad de negocio y permisos

| Área | Autoridad observada | Obligación de UI |
|---|---|---|
| Estado clínico | `backend/app/modules/vaccination_scheme/schemas.py` (`SchemeOverviewResponse` y DTOs de evaluación), `rules.py`/`service.py`: señales separadas `is_up_to_date`, `is_complete`, `is_certifiable`, vencimiento/días. | Representar cada señal; no traducir una a otra ni recalcular por fechas/cantidad de dosis. |
| Certificado | `certificates/service.py`, `assignment_service.py`: emisión valida elegibilidad y responsable explícito programa+campus/firma activa. | Consumir señal y manejar error de emisión, incluso si el botón estaba habilitado. Nunca seleccionar firmante arbitrario. |
| Firma | `certificates/router.py`: carga/metadata/imagen solo `admin`; imagen privada. | No ofrecer subida a estudiante/app_admin. No publicar preview como URL permanente. |
| Responsable | `admin/router.py`: GET/PUT asignaciones y conflictos solo `app_admin`. | Puede añadirse UI con ese permiso existente; no corresponde a estudiante ni admin normal. |
| Estudiantes | `admin/router.py`, `admin/students/service.py`, `common/access.py`: rol y ámbito son controles servidor. | Visibilidad por rol no sustituye autorización. Next restringe students a admin normal; Flutter router solo separa admin/student y depende de API para subroles. Una ruta accesible no demuestra acceso a datos. |
| Evidencia | `evidence/service.py::upload_evidence/review_batch/delete_batch`; `core/file_validators.py`: PDF, propiedad/ámbito, revisión y vínculo transaccional a dosis. | Mostrar estados recibidos; no duplicar la aprobación automática asociada. `delete_batch` actual no restringe por estado; no inventar una política nueva de retención en UI. |
| Conversaciones | `communications/service.py::create_thread/search_recipients/_ensure_access/update_status/add_message`. | Destinatarios diferentes por rol; API permite cerrar/reabrir y reabre al responder un hilo cerrado. No confundir remitente administrador con autorización para cualquier hilo. |
| Sesión | Flutter Dio/session/auth; Next BFF/cookie y AuthGate/Zustand; FastAPI valida sesión real. | Al invalidarse, ocultar datos/borradores sensibles y conducir a login. No confundir 403 con sesión vencida ni 5xx con resultado clínico. |

## Hallazgos comprobados y propuestas

Las prioridades son de esta auditoría de UI. Todas las propuestas son futuras, sin código modificado. Las fuentes se indican por archivo/función; algunas líneas ayudan a localizar el fragmento actual. Los ensayos descritos son **pruebas necesarias, no ejecutadas**.

### UI-01 — P1 — Navegación móvil web incompleta

- **Fuente:** [AppShell](../../frontend-next/src/components/app-shell.tsx), línea 94 (`hidden … md:block`); [UserMenu](../../frontend-next/src/components/user-menu.tsx); layouts student/admin. Flutter usa AppBar, menús y accesos de dashboard.
- **Causa/problema:** se oculta el único nav de módulos en móvil y no existe reemplazo en AppShell. UserMenu no lista esquema/evidencia/comunicaciones/catálogo/administradores.
- **Impacto:** desde subpantallas faltan recorridos directos disponibles en escritorio; el usuario depende del logo/inicio/atrás. Los accesos del dashboard atenúan, pero no resuelven toda la navegación.
- **Propuesta:** navegación móvil que derive del mismo inventario por rol, sin ampliar permisos; conservar desktop.
- **Pruebas:** recorrer S04–S22 a 360/390/768/1280 px para tres roles; teclado, foco, atrás y ruta activa. Capturas claro/oscuro. No exigir copiar la composición Material.

### UI-02 — P1 — Sesión expirada durante una pantalla abierta

- **Fuente Next:** [api/client.ts](../../frontend-next/src/lib/api/client.ts) interceptor de respuesta; [AuthGate](../../frontend-next/src/components/auth-gate.tsx) primer efecto; [auth/store.ts](../../frontend-next/src/lib/auth/store.ts); BFF `route.ts` maneja 401 y cookie.
- **Fuente Flutter:** [routerProvider](../../frontend/lib/core/router/app_router.dart), `ref.read(authStateProvider)` en redirect; [main.dart](../../frontend/lib/main.dart) listener dedicado a FCM; `SessionManager.expire`, `AuthNotifier._sessionExpired`.
- **Causa/problema:** Next no notifica globalmente a Zustand al recibir 401 de consultas/mutaciones corrientes; Flutter limpia identidad pero el router no escucha ese cambio para refrescar redirect. Renovar tokens o vaciar cookie no asegura desmontar la pantalla.
- **Impacto:** riesgo de quedarse con datos anteriores, error local o acciones visibles después de expirar/revocar. No se afirma que FastAPI permita la operación ni que haya filtración demostrada.
- **Propuesta:** coordinación explícita de expiración terminal con navegación y limpieza de estado de UI, reutilizando el contrato de sesión existente. Respetar refresh único y no reenviar automáticamente mutaciones ambiguas.
- **Pruebas:** expirar/revocar mientras cada pantalla está abierta; 401 durante consulta, descarga y subida, refresh válido/invalidado, 403 y 503 distintos; respuesta tardía, logout/cambio de usuario, varias pestañas. **UNKNOWN:** comportamiento exacto renderizado y persistencia residual hasta ejecutarlas.

### UI-03 — P1 — Comunicaciones incompletas por rol y estado

- **Fuente:** Flutter `CommunicationsScreen._openCreateDialog`, `AdminManagementScreen._messageAdmin`, `CommunicationDetailScreen._toggleStatus/_load`; Next [admin/communications/PageInner](../../frontend-next/src/app/admin/communications/page.tsx), [student/communications](../../frontend-next/src/app/student/communications/page.tsx), [ThreadDetail](../../frontend-next/src/components/thread-detail.tsx). API `CommunicationService`.
- **Causa/problema:** Next reutiliza compositor dirigido a estudiantes incluso para app_admin; no selecciona `admin_id` ni categoría. App_admin requiere admin_id en backend. Admin→app_admin y estudiante→admin específico no tienen representación equivalente. ThreadDetail no usa `updateThreadStatus`, oculta compositor en closed y no refresca periódicamente detalle; Flutter sí permite esos flujos.
- **Impacto:** creación app_admin falla; conversaciones cerradas no pueden reabrirse/responderse en web; mensajes recibidos pueden no aparecer hasta refetch por otra causa.
- **Propuesta:** adaptar destinatarios/acciones al contrato vigente por rol; recuperar cierre/reapertura y actualización de hilo sin inferir acceso por frontend. No copiar sin análisis el polling de 3 s de Flutter.
- **Pruebas:** estudiante→admin de ámbito, admin→estudiante, admin→app_admin, app_admin→admin; negativos fuera de ámbito; cerrar/reabrir/responder cerrado; llegada externa de mensaje; categoría, vacío/errores de búsqueda, formulario inválido.

### UI-04 — P1 — Instrucciones de acceso desactualizadas

- **Fuente:** [CreateStudentPage](../../frontend-next/src/app/admin/students/create/page.tsx) líneas 94 y 194; [ChangePasswordForm](../../frontend-next/src/components/change-password-form.tsx) línea 125. Flutter `CreateStudentScreen` informa entrega por correo. Backend alta/importación genera contraseña temporal, no la deriva del documento.
- **Causa/problema:** copy antiguo sobrevivió al cambio de autenticación.
- **Impacto:** el administrador comunica instrucciones incorrectas y el estudiante intenta credenciales inválidas. No indica que el backend siga aceptando documento como contraseña.
- **Propuesta:** textos coherentes con correo/cambio obligatorio; sin modificar emisión ni validación de credenciales.
- **Pruebas:** alta manual/importación/cambio forzado muestran instrucciones correctas; búsqueda estática y tests de UI impiden reintroducir texto obsoleto.

### UI-05 — P1 — Error, vacío y resultado clínico indistinguibles

- **Fuente Next:** S04 dashboard (`data ?? 0`, sin error), S07 certificado (`ready=false`), S06 evidencia, S10 notificaciones, S11 historial, S12/S13 comunicaciones, S21 catálogo; S08/S22 perfil y S19 detalle (`isLoading || !data`).
- **Fuente Flutter:** `AdminStudentDetailScreen._load` captura y solo apaga loading; `AdminStudentListScreen` no representa `state.error`; `NotificationNotifier` conserva datos sin canal error; certificado no representa error de consulta del esquema.
- **Causa/problema:** vistas deducen el estado a partir de ausencia de datos, no de resultado de la consulta. En Next algunos fallos mantienen “Cargando” indefinidamente y otros aparentan listas vacías.
- **Impacto:** confusión entre falta de datos, denegación, indisponibilidad y estado del estudiante. En refetch también pueden quedar datos anteriores sin aviso de desactualización.
- **Propuesta:** estados diferenciados de carga inicial/refetch/error/empty/success; reintento y mensaje seguro. “Sin evaluación disponible” no implica incompleto ni no certificable. Mantener aviso offline Flutter y no presentar cache como validación actual.
- **Pruebas:** 200 vacío/datos, 401/403/404/409/422/429/500/503 y timeout en cada fila; refetch fallido con datos anteriores; retry recupera. No crear mensajes que expongan payload clínico de error.

### UI-06 — P1 — Selector de evidencia contradice formatos admitidos

- **Fuente:** Next [EvidencePage](../../frontend-next/src/app/student/evidence/page.tsx), `accept="application/pdf,image/*"`, texto PDF/imágenes; Flutter `_pickFiles` solo pdf; backend [validate_pdf_file](../../backend/app/core/file_validators.py), MIME PDF, límite10MB y cabecera `%PDF-`.
- **Causa/problema:** web anuncia y selecciona archivos que el servidor rechaza. El texto “Máx.10 archivos” tampoco se valida en el selector/drop handler; no se encontró ese límite de cantidad en el servicio inspeccionado.
- **Impacto:** cargas fallidas evitables y error genérico, especialmente tras arrastrar imágenes.
- **Propuesta:** UI ajustada a PDF y tamaño real, validación cliente orientativa además de autoridad backend. No ampliar backend a imágenes para conseguir paridad. No inventar límite institucional de cantidad.
- **Pruebas:** PDF válido, imagen, MIME/extension discordante, corrupto, 10MB/límite excedido, drag/drop y picker, archivo individual quitado; rechazo seguro del backend preservado.

### UI-07 — P2 — Eliminación de evidencia desigual y confirmación ausente

- **Fuente:** Next `BatchCard` línea276 muestra eliminar solo pending/uploaded; nuevos lotes API son in_review. `EvidenceTab` admin elimina directamente. Flutter `_confirmDeleteBatch/_deleteEvidenceBatch` confirma y no filtra estado. API `EvidenceService.delete_batch` comprueba propiedad, no estado.
- **Causa/problema:** condición de UI legacy limita nuevas cargas; handlers restantes no confirman una operación que elimina archivos.
- **Impacto:** pérdida de acción para estudiante web y riesgo de eliminación accidental en admin/legacy web.
- **Propuesta:** representar permisos actuales y confirmación equivalente; no introducir reglas clínicas/retención nuevas. Si se desea cambiar la política de eliminación, hacerlo en tarea de dominio separada autorizada.
- **Pruebas:** lotes oficiales y legacy; cancelar no llama API, confirmar llama una vez; error conserva fila, éxito recarga; rechazo de lote ajeno.

### UI-08 — P2 — Continuación incompleta y coste de listados

| Listado | Flutter | Next | Consecuencia comprobable |
|---|---|---|---|
| Evidencia propia | page1,size20; guarda metadata pero no navega. | page1,size100; sin siguiente/anterior. | Con más elementos no se accede al resto; umbral distinto. |
| Estudiantes | `listAllStudents`; notifier fija page1/totalPages1 aunque conserva métodos next/prev. | `listAllStudents`, resto con Promise.all; búsqueda sin debounce en página. | Ambos cargan colección completa; Next puede emitir ráfagas por cada cambio de filtro. Rendimiento medido UNKNOWN. |
| Historial | Usa limit/offset por defaults, sin avance. | limit100/offset0, sin avance. | API soporta continuación que pantalla no expone. |
| Importación | Preview30/resultados20. | Preview30/resultados40. | Resumen global con detalle truncado, sin ver todas las filas. |
| Certificados estudiante desde admin | Sin pantalla. | Endpoint lista hasta50, UI sin más. | Límite backend no se puede solucionar inventando páginas de cliente. |
| Notificaciones/hilos/admins/catálogo | Arrays. | Arrays. | No afirmar que tienen contrato page/size; escalabilidad requiere medición y, si procede, contrato futuro separado. |

- **Fuentes:** datasources/providers y helpers enlazados en S06/S11/S17/S18/S19; `certificates/router.py::list_student_certificates` (`limit(50)`).
- **Propuesta:** usar metadata/paginación ya disponible, mostrar límites explícitos donde no exista continuación, debounce/cancelación y concurrencia acotada. No truncar silenciosamente ni inventar total.
- **Pruebas:** 0/1/página exacta/+1/varias páginas; filtros cambian página; orden estable/sin duplicados; error en página intermedia; selección/formulario preservados. Dataset sintético grande para medir, no afirmar métricas sin ejecución.

### UI-09 — P1 — Gestión de estudiante escondida y acción contextual cambiada

- **Fuente:** [AdminStudentDetailPage](../../frontend-next/src/app/admin/students/[id]/page.tsx) línea183: div hidden contiene activar/desactivar/eliminar. Lista web solo enlaza detalle. Flutter `AdminStudentListScreen._buildStudentTile` ofrece menú de acciones.
- **Causa/problema:** controles quedaron en DOM oculto tras otra composición. El botón MessageSquare visible abre tab evidencia; Flutter ofrece enviar mensaje al estudiante desde detalle.
- **Impacto:** administrador web no puede ejecutar la gestión de cuenta disponible en móvil ni el mismo atajo de comunicación.
- **Propuesta:** recuperar acciones autorizadas y sus confirmaciones/feedback en una ubicación accesible; mantener evidencia como acción distinta.
- **Pruebas:** activar/desactivar/eliminar según estado, confirmación/cancelar, 403 fuera de ámbito, refrescar lista/detalle; mensaje preselecciona únicamente ID de estudiante correcto.

### UI-10 — P2 — Deep links ignoran contexto

- **Fuente:** Next `AdminStudentsPage` inicializa `EMPTY_FILTERS`, no lee URL; `AdminStudentDetailPage` usa `useState("info")`, no lee tab. `AuditList.destinationFor` genera tab; Flutter router consume active/scheme/semester/tab.
- **Causa/problema:** rutas emisoras y receptoras no comparten contrato de navegación completo.
- **Impacto:** tarjeta de dashboard/historial llega a datos sin filtro o pestaña equivocada; afecta también action_path de notificaciones que use ese formato.
- **Propuesta:** validar/consumir parámetros no sensibles y mantenerlos en atrás/adelante; no añadir PII al query string.
- **Pruebas:** URL directa, enlaces dashboard/audit/notificación, filtros desconocidos, tab inválida, back/forward. El receptor no debe ampliar alcance por query params.

### UI-11 — P2 — Etiquetas mezclan completo y certificable

- **Fuente:** Next dashboard estudiante “Descarga el PDF cuando esté completo”; certificado badge `ready ? Listo : Incompleto` usando `is_certifiable`; listado estudiantes etiqueta vaccination_status=approved como “Completo”. Backend publica señales distintas.
- **Causa/problema:** copy y etiquetas históricos simplifican conceptos separados por las decisiones aprobadas.
- **Impacto:** una persona al día/incompleta/certificable recibe orientación contradictoria. La etiqueta de listado necesita comprobar la semántica de su DTO, no inferir equivalencia por nombre.
- **Propuesta:** representar certificabilidad/completitud/al día con su campo y vocabulario propio; para listados sin is_complete usar descripción del estado que sí proveen. No calcular is_complete en frontend.
- **Pruebas:** señales independientes y ausencia de evaluación; `is_certifiable=true,is_complete=false`; dosis futura; denegada; carga/error no muestran veredicto. Fixtures de API, no algoritmos clínicos nuevos.

### UI-12 — P2 — Restricción temporal cliente ajena al contrato

- **Fuente:** Flutter `SchemeDetailScreen._selectDate/_editTiterRecord`: firstDate1990, lastDate DateTime.now. Next `DoseRow` max=`localDateInputValue()`, helper usa calendario local. Decisión vigente: aplicación hasta hoy America/Bogota, sin antigüedad mínima en esta fase.
- **Causa/problema:** límites del selector se basan en dispositivo y Flutter agrega un mínimo no definido.
- **Impacto:** impide introducir una fecha antigua válida; cerca de medianoche y en otra zona puede ocultar una fecha válida o dejar seleccionar una rechazada por API.
- **Propuesta:** representar límite institucional ya definido, preservar YYYY-MM-DD como calendario; autoridad final backend. No copiar 1990 ni UTC parsing de fechas sin zona.
- **Pruebas:** antes1990, día actual Bogotá/zonas distintas, último minuto/primer minuto, bisiesto, fecha futura rechazada por API, fecha pasada aceptada. No cambiar vencimientos/titulación.

### UI-13 — P1 — Acción de comentario cambia estado clínico en Next

- **Fuente:** `AdminDoseRow` en [detalle web](../../frontend-next/src/app/admin/students/[id]/page.tsx), líneas796/807: `isDenied ? "denied" : "approved"` para editar/eliminar comentario. Flutter pasa `doseStatus` a `_reviewDose/_deleteDoseComment`. Backend `SchemeService.review_dose` aplica el status explícito recibido.
- **Causa/problema:** componente solo tipa approved/denied para mutación y deduce approved para cualquier estado distinto de denied.
- **Impacto:** con dosis in_review que tiene nota, borrar comentario manda aprobación sin que la acción se presente como tal; editar comentario entra en flujo de aprobación en lugar de conservar estado. No es fallo de FastAPI al interpretar ese payload.
- **Propuesta:** separar intención de comentario y transición explícita, conservar el estado recibido cuando solo cambie la nota usando contrato existente. Flutter restringe comentario a reviewed_by propio; esa restricción de UI no debe convertirse en permiso nuevo sin comprobar política backend.
- **Pruebas:** misma acción en approved/denied/in_review; assert status enviado y visible; cancelar; permisos API/revisor distinto; no side effects clínicos inesperados. Caso de borrado in_review debe fallar como regresión antes de corregir.

### UI-14 — P2 — Temas no aplicados consistentemente

- **Fuente:** `globals.css`, `AppTheme`, Next detalle estudiante bg#071416/filas#0e2023, `VaccineEditorModal` bg#24292c, verificador bg-white; clases dark: en catálogo sin custom variant data-theme en CSS inspeccionado.
- **Causa/problema:** estilos de pantalla fijan colores fuera de tokens. Selector usa data-theme mientras dark: utiliza su comportamiento por defecto asociado al sistema; preferencia manual y sistema pueden divergir.
- **Impacto:** editor/detalle no siguen tema claro y verificador permanece claro. Flutter también tiene textos secundarios/fondos fijos; no se considera referencia perfecta de contraste.
- **Propuesta:** contrato de tokens compartido conceptualmente y adaptadores por plataforma; no rediseñar PDF ni copiar una captura oscura como estilo universal.
- **Pruebas:** light/dark/system con SO opuesto al manual, reload/hidratación, hover/disabled/error/success y modales; contraste efectivo UNKNOWN hasta medir render.

### UI-15 — P2 — Semántica accesible incompleta

- **Fuente:** Next `Field/FieldInput` de perfiles/altas/filtros sin htmlFor/id; `Overlay` catálogo sin role/dialog/focus trap/Escape; `VaccineBox/AdminVaccineCard` sin aria-expanded; tabs detalle sin semántica tab; `ThreadDetail` textarea solo placeholder; `NotificationsList` control interactivo dentro de botón. Flutter GestureDetector picker y varios IconButton sin tooltip explícito.
- **Causa/problema:** apariencia de control no siempre acompaña asociación semántica y navegación de foco. Hay controles correctos: login con labels/aria-invalid, Alert role alert/status, Button/Input con focus-visible, firma web con alt.
- **Impacto:** dificultad para teclado/lector de pantalla; no se declara conformidad ni incumplimiento WCAG global sin pruebas.
- **Propuesta:** labels/enlaces de error, expansión/pestañas y diálogo accesibles; foco inicial/retorno y cierre; acciones independientes de color; semántica Flutter equivalente.
- **Pruebas:** teclado completo, Escape/tab trap/retorno, lector NVDA o equivalente y TalkBack/VoiceOver, texto ampliado200%, nombres accesibles y contraste. Automatización complementa, no reemplaza prueba manual.

### UI-16 — P1 — Verificador convierte indisponibilidad en invalidez

- **Fuente:** [CertificateVerificationPage.fetchVerification/checkFile](../../frontend-next/src/app/verify/[publicId]/page.tsx): no comprueba response.ok ni shape; catch retorna INVALID. API diferencia estados documentales y errores HTTP/rate limit.
- **Causa/problema:** transporte y estado del certificado comparten fallback.
- **Impacto:** fallo de red se presenta como certificado inválido; 429/503 con envelope de error no produce mensaje correcto ni retry. No implica que se acepte un certificado inválido como válido.
- **Propuesta:** estado UI “no se pudo verificar”, con reintento seguro y 429 diferenciado; representar INVALID solo si API devuelve ese resultado. Preservar cálculo hash local, privacidad y ruta pública.
- **Pruebas:** VALID/REVOKED/NOT_FOUND/INVALID, MATCH/MISMATCH, offline, JSON no válido, envelope429/503, hash no disponible, sesión ausente/expirada; no exponer firma ni PII.

### UI-17 — P2 — Capacidades administrativas de certificado desiguales

- **Fuente:** Next `CertificateHistory` consulta emisiones/revoca; Flutter detalle/datasource solo descargan. Búsqueda de consumidores de `certificate-signer-assignments` en ambos clientes no encontró implementación; endpoints están en admin/router.
- **Causa/problema:** Fase4 tiene capacidades de backend que no se completaron en ambas interfaces.
- **Impacto:** Flutter no puede gestionar revocación/historial; no existe configuración de responsable en UI de ninguno. No afirmar que backend carece de configuración: API sí existe.
- **Propuesta:** preservar extra Next; planificar equivalente móvil y UI app_admin de asignación/conflictos respetando permiso actual. Distinguir409 sin ámbito/sin responsable/sin firma al solicitar certificado; nunca habilitar elección de firmante al estudiante.
- **Pruebas:** firma activa/cambio de versión, emisión previa intacta, responsable cambiado, no asignado/firma ausente, revocar/conflicto/permiso y URL pública; confirmación clara de revocación. T-02/T-03 y storage real siguen pendientes, no se cierran aquí.

### UI-18 — P2 — Formularios y errores no ofrecen recuperación equivalente

- **Fuente:** S02/S03; Next alta/admins usan required fuera de form y toast genérico; `FieldInput` perfil manda vacío como undefined; Flutter usa Form validators y catálogos locales AcademicOptions. Contratos de mutación siguen validándose en API.
- **Causa/problema:** mezcla validaciones visuales, atributos HTML no ejecutados y manejo genérico de errores. Next recuperación muestra explicaciones técnicas de CORS/Render, reset llama inválido a cualquier fallo.
- **Impacto:** intentos evitables, corrección de campo poco clara y posible “guardado” sin borrar un contacto vaciado. No se infiere política nueva de programa/campus desde opciones locales Flutter.
- **Propuesta:** validación de forma inequívoca, mensajes seguros por code/status, payload de borrado alineado a nullability real y etiquetas de campos. Confirmar fuente autorizada de opciones académicas antes de copiar listas locales.
- **Pruebas:** vacío, formato,422,409,429 con reintento,503, borrado de opcionales, campus/programa fuera de ámbito. **UNKNOWN:** catálogo institucional autorizado de opciones; no usar datos reales para resolverlo.

### UI-19 — P2 — Lectura de mensajes y contadores divergen

- **Fuente:** Flutter `CommunicationDetailScreen._load` llama markCategoryRead; Next `ThreadDetail` solo escribe `ic_thread_seen_*`. `AppShell` calcula contador con notificaciones backend y `ThreadRow` utiliza marca local.
- **Causa/problema:** dos fuentes para “no leído”, sin sincronización equivalente al abrir el hilo.
- **Impacto:** conversación leída localmente puede seguir con contador de comunicaciones. Alcance de marcar categoría completa versus solo hilo debe documentarse antes de homologar comportamiento.
- **Propuesta:** representar contrato disponible y acordar alcance de UX de lectura, sin inventar endpoint ni cambiar notificaciones/backend en este audit. Revisar limpieza de marcas al cambiar usuario.
- **Pruebas:** abrir hilo desde notificación/lista, varios hilos, otra pestaña/dispositivo, logout/login otra cuenta, fallo al marcar leído. No afirmar que una marca local permite leer mensajes ajenos.

## Contrato visual observado y dirección propuesta

| Elemento | Evidencia Flutter → Next | Dirección sin rediseño funcional |
|---|---|---|
| Identidad | AppColors y globals comparten primario#00AFC6, oscuro#007F93, acento#79C143, éxito#5FAE36, alerta#E6A700, error#C94242. | Conservar significado/identidad; medir contraste con texto y estado reales. |
| Tipografía | GoogleFonts.inter frente next/font Inter; tamaños/pesos variables por pantalla. | Jerarquía equivalente título/sección/campo/ayuda, no igualdad ciega de píxeles. |
| Superficies | Fondo claro#F6FAFA, oscuro#071416 y superficie oscura#0E2023 compartidos; excepciones UI-14. | Los tokens deben gobernar ambas variantes, incluidos modales. |
| Espacio/radios | Flutter espaciados habituales8/12/16/24 y botones radius12; Next rounded-xl, gaps/paddings de Tailwind, alturas44/48. | Mantener densidad legible y objetivos táctiles; no copiar tamaños fijos de diálogos. |
| Componentes | Flutter Material/ExpansionTile/AlertDialog/TabBar; Next cards/acordeones/Overlay/botones de pestaña. | Misma información/acción/estado con semántica nativa de cada plataforma. |
| Feedback | Flutter snackbar/spinner/skeleton/refresh; Next toast/LoadingState/DataState/skeleton. | Cobertura consistente de estados, mensajes y recuperación; posición visual puede ser propia de plataforma. |
| Responsive | Flutter LayoutBuilder y scroll, Next sm/md/lg, sidebar desktop. | Matriz móvil/tablet/desktop con zoom/teclado; no declarar responsive por presencia de breakpoint. |

## Pruebas encontradas y evidencia faltante

No se añadieron ni ejecutaron tests: esta entrega es exclusivamente documental. Se inspeccionaron estas pruebas existentes:

| Cobertura localizada | Qué demuestra su diseño | Qué no demuestra |
|---|---|---|
| Flutter `test/features/auth/presentation/screens/login_screen_test.dart`, `test/e2e/*`, `integration_test/*` | Render/login básico, arranque con overrides/fakes. | No flujo clínico completo contra API real ni paridad visual de todas las pantallas. |
| Flutter `test/widget_test.dart`, `admin_dashboard_screen_test.dart` | Loading/estadísticas y vista administrativa. | No navegación móvil Next, modales ni comparación de temas. |
| Flutter `session_rotation_test.dart`, `auth_provider_test.dart`, `scheme_provider_test.dart` | Rotación/logout/respuesta tardía, FCM previo a logout, cache por usuario/TTL/401403. | No redirección reactiva con pantalla abierta ni aislamiento de todos los providers/UI. |
| Flutter `app_theme_test.dart`, modelos de esquema/paginación, error helper | Transiciones tema y contratos/helpers. | No screenshots/goldens de claro/oscuro, contraste ni lector. |
| Next `components/__tests__/auth-gate.test.tsx` | Roles/cambio forzado y ocultar hijos. | No expiración terminal de una query corriente tras montar pantalla. |
| Next `vaccine-due-badge.test.tsx`, `lib/__tests__/format.test.ts`, `api/__tests__/contracts.test.ts` | Señales backend, fechas de calendario, evidence/page y asociación de dosis, mensajes seguros. | No selector real, ocultación de delete, formatos ofrecidos ni todas las páginas de evidencia. |
| Next `lib/__tests__/theme.test.tsx`, button/card/badge tests | Preferencia y componentes básicos. | No efecto visual de colores hardcoded ni accesibilidad completa. |
| Next `auth-api`, `phase1-auth`, `server/__tests__/*` | Contrato BFF, store/sesiones; BFF E2E usa PostgreSQL condicional y upstream simulado. | No E2E con navegador de pantallas contra FastAPI completo. |
| Backend `test_phase1_e2e.py`, `test_certificate_*`, `test_evidence_dose_link.py`, `test_api_contracts.py` | Autoridad HTTP/contratos y flujos de dominio/certificado. | No evidencia del render, click, foco, QR físico ni experiencia de los clientes. |

No se localizó una suite de capturas/goldens/Playwright de las pantallas ni ensayos axe en los archivos de tests inspeccionados. No se deduce que todas las pruebas existentes fallen o pasen: **no ejecutadas en este audit**.

Protocolo propuesto para cada S00–S23: fixture sintético determinista, rol aplicable y negativo, datos/carga/vacío/error/success, navegación directa/back/forward, primera/última página donde aplique, claro/oscuro/sistema, móvil/tablet/desktop y texto200%, teclado/lector, sesión expirada antes y durante operación. Guardar captura de ambas plataformas con ID de fila/estado/viewport/tema/fecha y resultado esperado. Ocultar datos personales en artefactos; no usar tokens reales en URLs/capturas. Los fixtures clínicos deben venir de respuestas sintéticas válidas del backend, no de cálculo frontend.

## Orden propuesto de implementación posterior

1. **Estados y sesión (UI-02/UI-05):** estados de datos seguros, expiración terminal, recuperación y limpieza; tests de componentes montados y cambio de usuario antes de tocar apariencia.
2. **Intención de acciones (UI-13/UI-09/UI-07):** evitar transición clínica implícita al editar notas; recuperar gestión de estudiantes y confirmaciones. FastAPI intacto salvo tarea futura explícitamente autorizada.
3. **Comunicaciones (UI-03/UI-19):** destinatarios por rol, categoría, cierre/reapertura, actualización y lectura coherente; pruebas por rol/ámbito.
4. **Contratos visibles (UI-04/UI-06/UI-11/UI-12/UI-18):** instrucciones, PDF-only, etiquetas de señales, calendario institucional, validación de formulario y mensajes seguros. Ninguna regla clínica nueva.
5. **Navegación/listados (UI-01/UI-08/UI-10):** móvil, filtros/tab/deep links, continuación real, errores intermedios y carga controlada. Límites del API se documentan, no se inventa paginación.
6. **Certificados UI (UI-16/UI-17):** errores de verificación separados de invalidez, gestión existente por rol, paridad móvil y configuración explícita. Sin rediseño de PDF/QR y sin cierre de T-02/T-03.
7. **Accesibilidad/temas (UI-14/UI-15):** semántica y foco junto con cada componente, luego matriz de capturas y contrastes. Corregir tokens inconsistentes, no cambiar identidad sin necesidad.
8. **Gate conjunto:** E2E real Flutter/Next→FastAPI con datos sintéticos: login→esquema→evidencia→revisión→elegibilidad→certificado→verificador; roles negativos, expiración, offline, archivos/paginación y ambos temas. Tests API previos no reemplazan este gate UI.

El orden prioriza correcciones funcionales y seguridad de representación; no autoriza implementación en esta entrega.

## UNKNOWN, límites y cierre documental

- UNKNOWN: apariencia renderizada, diferencias de píxeles, contraste efectivo, comportamiento con zoom/teclado virtual, lector de pantalla, redirección de sesión expirada en cada pantalla, descarga real móvil/browser y lector QR externo.
- UNKNOWN: volumen/latencia en listados reales, fuente institucional autorizada de opciones académicas y política UX de lectura por hilo/categoría cuando no quede definida en contrato. No se inventan requisitos para resolverlos.
- T-02 y T-03 permanecen **PARTIAL**, Fase3B permanece **PARTIAL**. El almacenamiento privado real y sus controles externos no fueron validados aquí. No se declara Fase4 DONE ni producción lista.
- No hubo cambios de código, backend, reglas clínicas, contratos, migraciones, dependencias, Maps, Azure o diseño PDF. No hubo commit.
- El repositorio ya contenía cambios y documentos sin seguimiento de fases anteriores. La revisión debe distinguir ese baseline de estos dos archivos; no se afirma que el árbol previo estuviera limpio.
- Rollback de esta entrega: retirar únicamente los dos documentos de Fase5 si se descartan. No afecta código ni datos.

## Verificación de la entrega

- Se revisaron ambos documentos y sus referencias locales. La matriz separa las 24 entradas de pantallas/variantes (S00–S23) de la capacidad API sin pantalla (S24).
- `git diff --check`: PASS sobre el diff rastreado preexistente. Los dos documentos nuevos se revisan adicionalmente con `git diff --no-index --check /dev/null <archivo>`, porque `docs/` está sin seguimiento en este árbol.
- La comparación SHA-256 con el inventario capturado al iniciar este audit no detectó modificaciones de archivos previos de backend, Flutter, Next o docs; se agregaron únicamente los dos documentos solicitados.
- No se añadieron migraciones ni tests, no se ejecutaron suites ni gates de build, y no se hizo commit. La validación pendiente de UI no se marca PASS.
