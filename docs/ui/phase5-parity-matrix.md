# Fase 5 — Matriz de paridad Flutter → Next

Fecha: 2026-09-28. **Auditoría estática; no implementación.**

Flutter es la referencia funcional inicial, no una especificación clínica. FastAPI decide permisos, estados, elegibilidad y validaciones. Se inspeccionaron las 20 clases de pantalla Flutter y las rutas Next correspondientes, separando variantes por rol y subflujos. La existencia de una ruta no demuestra paridad funcional ni visual.

Los enlaces de fuentes apuntan al código actual; los nombres de componentes permiten localizar la evidencia. Hallazgos y propuestas: [auditoría](../audits/phase5-ui-parity.md). No se ejecutaron interfaces, capturas, tests ni comparaciones de píxeles en esta auditoría. En todas las filas, responsive observado, contraste renderizado, lector de pantalla y comportamiento real tras expiración son **UNKNOWN**. Las descripciones siguientes son comportamientos definidos en código, no resultados de ejecución.

## Convenciones transversales

- **F-SES**: Dio intenta una renovación compartida ante 401; al fallar limpia sesión y caché de esquema mediante `onExpired`. El router consulta autenticación con `ref.read`, sin `refreshListenable`; el listener de `main.dart` gestiona FCM, no navegación. La redirección inmediata desde una pantalla ya montada no está garantizada por ese enlace. Ver UI-02.
- **N-SES**: BFF renueva y elimina cookie ante invalidación; `AuthGate` protege montaje/rol y verifica sesión al activarse su efecto. El interceptor Axios no invalida Zustand ante un 401 posterior de una operación normal. Una pantalla montada puede seguir mostrando datos/error local hasta otra comprobación. Ver UI-02.
- **PÚBLICA**: acceso sin sesión; no debe requerir autenticación. Next monta `AppProviders` y realiza `checkSession` incluso en rutas públicas, pero su contenido no usa `AuthGate`.
- **F-TEMA**: Material claro/oscuro/sistema y tipografía Inter; algunos widgets usan colores constantes `AppColors.textSecondary`, fondos claros o colores de estado. No equivale a contraste validado.
- **N-TEMA**: tokens CSS mediante `data-theme`, Inter y selector claro/oscuro/sistema. Excepciones de colores fijos se indican por pantalla. Ver UI-14.
- **N-NAV**: sidebar visible desde `md`; debajo se oculta, sin drawer/tabbar equivalente. El menú de usuario solo ofrece perfil, contraseña, historial según rol, tema y logout. Los accesos del dashboard permiten parte de la navegación, no reemplazan la navegación contextual completa. Ver UI-01.
- **N/A**: dimensión sin aplicación natural, por ejemplo paginar un formulario. **PARCIAL**: existen ambas representaciones, con diferencias concretas. **EXTRA NEXT**: capacidad web sin pantalla Flutter equivalente; no se propone eliminarla.

## S00 — Inicio/restauración `/`

Fuentes: Flutter [SplashScreen](../../frontend/lib/features/auth/presentation/screens/splash_screen.dart); Next [HomePage](../../frontend-next/src/app/page.tsx), [AppProviders](../../frontend-next/src/components/providers.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Logo, degradado, título y barra; estado de autenticación/rol. | Logo, fondo de marca y texto “Cargando”; mismo objetivo, distinta composición. |
| Acciones; permisos | Consulta sesión con timeout de 5 s; pública. | Hidratación global y redirección por identidad; pública. |
| Loading; empty | Barra; usuario ausente lleva a login. | Texto; usuario ausente lleva a login. No listado vacío. |
| Error; success | Por código, excepción o timeout del splash conduce a login; sesión válida navega por rol/cambio obligatorio. Fallo y límite de 5 s no se probaron como transición del splash en este bloque. | Error de `getMe` deja sesión anónima y termina hidratación; navegación posterior va a login. Éxito usa rol/cambio obligatorio. Pruebas de store cubren error/race de logout, no timeout del home. |
| Navegación; paginación | `context.go`; N/A paginación. | `router.replace`; N/A paginación. |
| Responsive; accesibilidad | Centrado con tamaños fijos; indicador Material; equivalencia visual/semántica del progreso UNKNOWN. | Centrado fluido; “Cargando…” usa `role=status` y `aria-live=polite`; test DOM PASS. Zoom/lector/dispositivo UNKNOWN. |
| Tema; sesión expirada | Degradado fijo de marca; restaura o login. | N-TEMA; restaura o login. Los timeouts no son iguales. |

## S01 — Login `/login`

Fuentes: Flutter [LoginScreen](../../frontend/lib/features/auth/presentation/screens/login_screen.dart); Next [LoginPage](<../../frontend-next/src/app/(auth)/login/page.tsx>), [layout auth](<../../frontend-next/src/app/(auth)/layout.tsx>).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Tarjeta marca, correo y contraseña, mostrar/ocultar. | Tarjeta equivalente; identidad procede de API en ambas. |
| Acciones; permisos | Validar, ingresar, recuperar, cambiar tema; pública. | Mismas acciones; pública. |
| Loading; empty | Botón bloqueado/spinner; campos vacíos con validación. | “Ingresando”, bloqueo; campos vacíos con validación. |
| Error; success | Error de auth; éxito por rol o contraseña obligatoria. | Alert seguro; mismos destinos. |
| Navegación; paginación | Push recuperación, go dashboard; N/A. | Link recuperación, replace destino; N/A. |
| Responsive; accesibilidad | Scroll, SafeArea, ancho máximo 460; labels Material. Tooltips de visibilidad no explícitos en esta pantalla. | Ancho acotado, labels `htmlFor`, autocomplete, `aria-invalid` y errores de campo enlazados con `aria-describedby`; `role=alert`. |
| Tema; sesión expirada | F-TEMA; login público permite reautenticar. | N-TEMA; login reacciona a sesión autenticada. Autofill/teclado UNKNOWN. |

## S02 — Recuperación `/forgot-password`

Fuentes: Flutter [ForgotPasswordScreen](../../frontend/lib/features/auth/presentation/screens/forgot_password_screen.dart); Next [ForgotPasswordPage](<../../frontend-next/src/app/(auth)/forgot-password/page.tsx>).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Formulario correo y vista de confirmación. | Tarjeta correo y confirmación equivalentes. |
| Acciones; permisos | Enviar instrucciones; pública. | Igual. |
| Loading; empty | Spinner/bloqueo; correo vacío inválido. | “Enviando”; mismo vacío. |
| Error; success | Mensajes estáticos seguros para error HTTP/red/timeout; conserva el formulario para reintento explícito. Éxito condicional “si el correo existe”. | Mensajes estáticos seguros por estado HTTP/red/timeout, sin exponer CORS, Render ni body; conserva el formulario para reintento explícito. Mismo éxito condicional. R02A probado; no hubo envío real de correo. |
| Navegación; paginación | Volver con `pop`, éxito a login; N/A. | Enlace explícito login; N/A. |
| Responsive; accesibilidad | Scroll con `LayoutBuilder/SingleChildScrollView`; label Material; error anunciado como live region. | Formulario acotado; label enlazado, `aria-invalid`/`aria-describedby`, `aria-busy` durante envío y Alert. |
| Tema; sesión expirada | F-TEMA; PÚBLICA. | N-TEMA; PÚBLICA. |

## S03 — Reset `/reset-password`

Fuentes: Flutter [ResetPasswordScreen](../../frontend/lib/features/auth/presentation/screens/reset_password_screen.dart), [router](../../frontend/lib/core/router/app_router.dart); Next [ResetPasswordForm](<../../frontend-next/src/app/(auth)/reset-password/page.tsx>).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Token recibido por ruta/deep link, nueva contraseña y confirmación. | Token de búsqueda, mismos campos. No mostrar el token. |
| Acciones; permisos | Cambiar contraseña con token; pública. | Igual, sin depender de sesión actual. |
| Loading; empty | Spinner; token vacío muestra un mensaje de error sin revelar el valor. | Suspense/guardando; token vacío ofrece solicitar otro enlace y no envía petición. |
| Error; success | `accountFormError` distingue token inválido y fallos de red/servidor con mensajes seguros; éxito con botón login. | `accountFormError` distingue HTTP 400 de red/5xx/timeout, sin exponer detalles; éxito login. Suite R02A cubre respuestas controladas, no consumo de enlace real. |
| Navegación; paginación | Alias `/reset-password` y `/auth/reset-password`, además del deep link `immunoclinic`; N/A. | Ruta `/reset-password`; no se muestra el token y el éxito enlaza a login. Compatibilidad de enlaces desplegados UNKNOWN; N/A. |
| Responsive; accesibilidad | Scroll; campos Material y tooltips en botones de mostrar/ocultar; asociación accesible de errores nativos. | Labels/autocomplete, `aria-invalid` y `aria-describedby` en ambos campos; `aria-busy` en envío. Lector real UNKNOWN. |
| Tema; sesión expirada | F-TEMA; PÚBLICA, expiración del token distinta de sesión. | N-TEMA; misma distinción necesaria. |

## S04 — Dashboard estudiante `/student`

Fuentes: Flutter [StudentDashboardScreen](../../frontend/lib/features/student/presentation/screens/student_dashboard_screen.dart); Next [StudentDashboard](../../frontend-next/src/app/student/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Hero, cinco señales del DTO y accesos. Ceros son respuesta válida; cache offline lleva el aviso “Información no verificada por falta de conexión.” | Hero y cinco contadores del DTO; badge “Al día/Requiere atención” solo cuando hay datos exitosos y deriva de `is_up_to_date`. Ceros iniciales no sustituyen carga: muestra elipsis. |
| Acciones; permisos | Cinco accesos rápidos (esquema/evidencia/certificado/historial/comunicaciones); notificaciones y comunicaciones con badge en AppBar; perfil/historial/password/logout en menú. | Siete tarjetas incluyen además perfil/notificaciones; shell ofrece navegación completa y contadores de notificación/comunicación. Capacidades de estudiante; FastAPI valida destinos. La diferencia es ubicación/duplicación de accesos. |
| Loading; empty | Skeleton sin overview; si existe respuesta vacía/ceros presenta los valores del DTO; error separado con retry. | Elipsis por contador durante carga; respuesta exitosa con ceros muestra ceros. No tiene modo offline/cache clínica web. |
| Error; success | Error inicial ofrece retry; con overview cacheado presenta aviso de datos no verificados y los datos cacheados. | `QueryError`/retry dentro de estadísticas, mantiene accesos y oculta contadores/badge previos tras fallo de refresh; no convierte error en ceros ni señal clínica. D01–D04 probados. |
| Navegación; paginación | Accesos por grid, notificaciones/comunicaciones en AppBar, perfil/historial en menú; N/A. | Quick action cards más `AppShell` y `UserMenu`; N-NAV; N/A. Rutas protegidas por guardas existentes. |
| Responsive; accesibilidad | `LayoutBuilder/Wrap`, textos multilínea a TextScaler2 y tooltip de notificaciones probado; lector real UNKNOWN. | Grid/reflow local, cinco estadísticas y accesos comprobados; región `aria-busy`, refresh y enlaces nombrados. CSS zoom probado; zoom nativo/lector real UNKNOWN. |
| Tema; sesión expirada | F-TEMA/F-SES; fixtures claro/oscuro y aviso offline comprobados, no expiración de sesión real. | N-TEMA/N-SES; no conserva/rotula datos offline. Errores controlados y retiro de datos anteriores probados; interceptor real/expiración en dispositivo UNKNOWN. |

## S05 — Esquema estudiante `/student/scheme`

Fuentes: Flutter [SchemeDetailScreen](../../frontend/lib/features/student/presentation/screens/scheme_detail_screen.dart); Next [StudentSchemePage, DoseRow](../../frontend-next/src/app/student/scheme/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Resumen, vacunas expandibles, dosis/fechas/títulos/notas/señales API. | Resumen, acordeones y filas; mismo dominio consumido. |
| Acciones; permisos | Registrar/editar/eliminar fecha o titulación si estado editable; estudiante propio. Diálogos. | Edición inline, eliminar registro directamente; aprobadas no editables. Backend decide. |
| Loading; empty | Skeleton; una respuesta exitosa sin vacunas muestra “Sin vacunas asignadas” y “Tu esquema aún no tiene vacunas.”; el arrastre permite refrescar aunque la lista sea corta. Cache offline conserva aviso de información no verificada. | LoadingState; “Sin vacunas asignadas” y descripción equivalente. |
| Error; success | En error inicial muestra botón “Reintentar” que fuerza una nueva lectura; estado vacío mantiene actualización por arrastre. Tests focales del esquema: **2 PASS** (error/retry y vacío/refresh, ejecutados 2026-10-26). Cache offline conserva aviso. | Error/reintento con QueryError; al editar, mutation refresca consulta y presenta toast. Tests focales de detalle/acordeón: **7 PASS** (ejecutados 2026-10-26). |
| Navegación; paginación | AppBar atrás, expandir/diálogo; N/A. | N-NAV, expandir/cancelar inline; N/A. |
| Responsive; accesibilidad | Lista y diálogo de titulación ancho 420; widget test en320×568 confirma que un nombre sintético extenso ocupa varias líneas sin excepción. Escalado nativo/lector siguen UNKNOWN. | Grid sm; etiquetas de fecha/valor asociadas. El trigger enlaza panel con `aria-controls` y comunica `aria-expanded`; el botón nativo permite Enter/Espacio. Nombre largo de vacuna envuelve sin `truncate`; Chromium con datos sintéticos lo verificó a320/768/1440/720 CSS px y sin overflow horizontal. Lector real y zoom nativo siguen UNKNOWN. |
| Tema; sesión expirada | F-TEMA/F-SES. Selector impone 1990 y hoy del dispositivo. | N-TEMA/N-SES. Máximo usa hoy local del navegador. UI-12: no copiar esas restricciones. |

## S06 — Evidencia estudiante `/student/evidence`

Fuentes: Flutter [EvidenceUploadScreen](../../frontend/lib/features/student/presentation/screens/evidence_upload_screen.dart), [datasource](../../frontend/lib/features/student/data/datasources/evidence_remote_ds.dart); Next [EvidencePage, BatchCard](../../frontend-next/src/app/student/evidence/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Carga PDF, notas/dosis opcionales y lotes expandibles. Muestra metadatos del lote y permite abrir/guardar sus archivos. | Carga PDF, notas/dosis opcionales y tarjetas; archivos históricos se muestran según MIME. FastAPI valida el contrato y el formato aceptado. Ambos muestran estado por lote, aunque ciertas etiquetas de estados legacy difieren (ver abajo). |
| Acciones; permisos | Quitar archivos seleccionados; subir, descargar/abrir y eliminar lote propio con confirmación. FastAPI verifica dueño/estado. | También permite retirar archivos seleccionados y confirma eliminación; descarga por archivo y llama al API para borrar el lote. Los controles no sustituyen permisos/reglas de FastAPI. |
| Loading; empty | Carga de lotes y subida separadas; distingue lista vacía de error de lectura. Error inicial/refresh retira contenido viejo y ofrece retry solo GET. La consulta `schemeProvider` muestra progreso/error/retry propio junto al selector; prueba controlada de recuperación, **16 PASS**. | Loading/empty/error son estados distintos; error de lista ofrece retry GET. Error de consulta de esquema auxiliar tiene control propio y retry separado. Ambos clientes distinguen esa falla de la lista vacía; Flutter cubre provider controlado, no caída real de red. |
| Error; success | Tras POST confirmado pero GET fallido informa carga confirmada/lista desactualizada, retira lista/formulario y permite retry sin POST. Fallo POST conserva borrador y dice que no se confirmó. | Mismo resultado observable; no repite POST al reintentar la lectura. Tras éxito confirmado limpia el formulario; tras fallo no confirmado conserva selección/notas/dosis. Mensajes seguros, sin diagnóstico crudo. |
| Navegación; paginación | `/evidence/page`, páginas de20; anterior/siguiente y reconsulta en la página solicitada, con recuperación si la última página quedó fuera de rango. | Mismo endpoint y tamaño20; componente Pagination y `page` en URL. No descarga todos los lotes. |
| Responsive; accesibilidad | Picker anunciado como botón semántico, quitar archivo con tooltip; nombres de archivo seleccionados e históricos envuelven a320×568. Selector de dosis ahora ocupa el ancho disponible y no desborda en ese viewport. Escala/dispositivo físico UNKNOWN. | Dropzone/button y input con `aria-label`; controles de quitar archivo nombrados, labels dosis/notas y descarga como button. Nombres seleccionados/históricos envuelven, no se truncan; Chromium con API/archivo sintéticos confirmó320/640/720 CSS px sin overflow. Lector real/teclado/zoom físico UNKNOWN. Ver [R03X](evidence/phase5b/evidence-file-reflow/measurements.json). |
| Tema; sesión expirada | F-TEMA/F-SES; archivo/borrador vive en la pantalla y no se afirma persistencia tras logout/expiración. | N-TEMA/N-SES; multipart no añade manejo de sesión propio; interceptor existente gobierna401. Cambios de cuenta durante upload no se validan aquí. |
| Estados legacy | `uploaded`/`under_review` y `legacyPending` se presentan como “En revisión (estado histórico)”; `reviewed` como “Estado histórico sin resultado”. | `uploaded` se presenta “Cargada”, `under_review`/`pending` como “En revisión” y `reviewed` como “Estado de revisión histórico”. Diferencia de etiqueta comprobada; no inferir nueva semántica ni normalizar sin decisión/contrato. |

## S07 — Certificado estudiante `/student/certificate`

Fuentes: Flutter [CertificateScreen](../../frontend/lib/features/student/presentation/screens/certificate_screen.dart); Next [CertificatePage](../../frontend-next/src/app/student/certificate/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Icono documental, explicación y descarga; usa `isCertifiable` de API. | Card, contadores, badge y descarga; usa `is_certifiable`. No recalcular elegibilidad. |
| Acciones; permisos | Descargar/abrir PDF; estudiante; deshabilita offline. | Descargar PDF; estudiante. Emisión valida responsable/firma en backend. |
| Loading; empty | Progreso de bytes; no hay listado; sin overview no habilita. | Texto cargando esquema y toast progreso; badge “Incompleto” por defecto. |
| Error; success | Error de descarga seguro, éxito persistente “Descargar de nuevo”; error de consulta esquema no diferenciado. | Error de descarga; éxito toast; no error/reintento consulta esquema. UI-05/UI-11. |
| Navegación; paginación | Atrás/abrir archivo del SO; N/A. | N-NAV/descarga navegador; N/A. |
| Responsive; accesibilidad | Scroll, botón 52, barra de progreso Material. | Card fluida; feedback de descarga toast; aviso de estado no live específico. |
| Tema; sesión expirada | F-TEMA/F-SES; aviso “Información no verificada…”. | N-TEMA/N-SES; códigos 409 no tienen acciones de recuperación específicas. |

## S08 — Perfil estudiante `/student/profile`

Fuentes: Flutter [ProfileScreen](../../frontend/lib/features/student/presentation/screens/profile_screen.dart); Next [ProfilePage, ProfileView](../../frontend-next/src/app/student/profile/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Identidad, datos académicos y contacto desde `/users/me`; ausencias se muestran como “No registrado”. | Hero y tiles equivalentes; valores ausentes no se infieren. Email/nombre y tiles permiten reflujo; pruebas P02 en viewports sintéticos. |
| Acciones; permisos | Estudiante edita contacto/EPS/emergencia; sexo y ámbito permanecen lectura. Guardar/cancelar; FastAPI valida PUT. | Mismos campos editables y payload de contacto; campos institucionales bloqueados. Guardar/cancelar no amplían permisos. |
| Loading; empty | Espera inicial muestra spinner; perfil/propiedades ausentes son distintos de carga. | LoadingState sin user y placeholders para campos ausentes; consulta error no queda en loading. |
| Error; success | Error de lectura con perfil previo oculta datos/acciones y ofrece retry; borrador en memoria se conserva. PUT confirmado seguido de GET fallido se representa como confirmado pero no actualizado; retry solo GET. PUT fallido tiene mensaje separado y conserva borrador. | QueryError seguro; mantiene ProfileView y su borrador montados pero oculta datos/formulario mientras falla GET. PUT confirmado+GET fallido, PUT fallido y respuestas antiguas se distinguen; recuperar GET no repite PUT. Mensajes no exponen diagnóstico. |
| Navegación; paginación | AppBar/editar/cancelar; N/A. Regresión de escritura durante dispose cubierta por P03. | N-NAV/editar/cancelar; N/A. Borrador vive solo mientras la vista montada/cache de la cuenta permanezca; no persistencia tras logout/recarga. |
| Responsive; accesibilidad | Scroll y labels Material; dimensiones/teclado nativo/lector siguen UNKNOWN. | Container queries por espacio disponible, valores largos no truncados en escenas 320/390/768/1440 y CSS zoom1/2; labels enlazados. Zoom nativo/lector real UNKNOWN. |
| Tema; sesión expirada | F-TEMA/F-SES. Pruebas P03 por tema con errores controlados; no demuestran expiración criptográfica real. | N-TEMA/N-SES; 401/403/503 controlados y protección de propietario probados; navegación/interceptor real ante expiración en dispositivo UNKNOWN. |

## S09 — Cambiar contraseña `/student/change-password`, `/admin/change-password`

Fuentes: Flutter [ChangePasswordScreen](../../frontend/lib/features/shared/presentation/screens/change_password_screen.dart); Next [ChangePasswordForm](../../frontend-next/src/components/change-password-form.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Actual/nueva/confirmación, requisitos; cambio forzado indica contraseña temporal recibida por correo. | Mismos campos y requisitos; el copy de cambio forzado también habla de contraseña temporal recibida por correo, no de documento. UI-04 queda corregido. |
| Acciones; permisos | Guardar y logout; roles autenticados, ruta habilitada en cambio forzado. FastAPI conserva autorización. | Cambiar y después logout; roles autenticados, guards existentes; el formulario no permite elegir rol. |
| Loading; empty | Spinner/bloqueo y campos deshabilitados; validación de campos. | “Guardando”/fieldset bloqueado; validaciones. Tests controlados comprueban una sola mutación ante doble submit. |
| Error; success | Mensajes estáticos seguros; 400 contraseña actual y 401 sesión expirada distinguidos. Éxito tras logout, luego botón volver al dashboard por rol. | Errores estáticos seguros; 400 contraseña actual y 401 sesión expirada distinguidos. Tras éxito/logout inicia `router.replace('/login')`; la prueba verifica secuencia logout→login, no la visibilidad persistente de la pantalla de éxito. |
| Navegación; paginación | Sin atrás durante cambio forzado; N/A. | AuthGate encierra cambio forzado; N-NAV y N/A. |
| Responsive; accesibilidad | `SingleChildScrollView`, labels Material y tooltips de mostrar/ocultar. 390×568/TextScaler2 probado dentro de R02A; anuncio del error para lector real UNKNOWN. | Card max-md, labels asociados, `aria-invalid`/`aria-describedby` para errores, `aria-busy` durante submit. 390 sin overflow horizontal probado; lector/teclado real UNKNOWN. |
| Tema; sesión expirada | F-TEMA/F-SES; invalidación esperada tras cambio. | N-TEMA/N-SES; no confundir 401 expiración con contraseña incorrecta. |

## S10 — Notificaciones `/student/notifications`, `/admin/notifications`

Fuentes: Flutter [NotificationsScreen](../../frontend/lib/features/shared/presentation/screens/notifications_screen.dart), [provider](../../frontend/lib/features/shared/presentation/providers/notification_provider.dart); Next [NotificationsList](../../frontend-next/src/components/notifications-list.tsx), páginas student/admin.

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | ListTile, contador de no leídas, mensaje/categoría/action_path. | Cards, contador y fecha/hora adicional; mensajes largos reflow probados en tamaños/escalas indicados en R04. |
| Acciones; permisos | Marcar leída/abrir; error de mutación muestra mensaje seguro. API filtra por dueño. Al abrir una no leída espera el marcado antes de navegar; si falla, permanece en la lista. | Botones hermanos con nombre accesible; error de mutación muestra toast seguro. Al abrir una no leída espera el marcado confirmado y no navega si falla, alineado con Flutter. API filtra por dueño. Admin normal; app_admin no obtiene acceso web por inferencia. |
| Loading; empty | Spinner; empty explícito. Error inicial y aviso de datos retenidos son estados distintos. Pull-to-refresh solo cuando hay filas. | LoadingState; empty explícito; consulta cada30s y control Reintentar en error. |
| Error; success | Reintento seguro; conserva datos solo ante fallos transitorios (red/429/5xx), limpia lista/contador ante cancelación y errores HTTP no transitorios, con aviso live. Mutación fallida conserva estado no leído y muestra snackbar. Pruebas focales actuales N10/estados: **42 PASS**. | Error inicial/reintento; en refresh transitorio retiene lista con advertencia; errores de acceso/contrato/cancelación ocultan datos previos. Mutación fallida muestra toast; éxito invalida contador/lista. Pruebas focales actuales N10/estados: **47 PASS**. |
| Navegación; paginación | `action_path`; array sin controles. | `action_path` + N-NAV; array sin controles. No inventar páginas de API. |
| Responsive; accesibilidad | ListTile, botón de lectura con tooltip, error con liveRegion; referencias claro/oscuro y texto ampliado existen. Lector/dispositivo físico UNKNOWN. | Acciones son botones nativos separados y etiquetados; reflow y focus de marcado probados en Chrome. Lector/dispositivo físico UNKNOWN. |
| Tema; sesión expirada | F-TEMA/F-SES. Provider cambia con userId y descarta respuestas tardías. | N-TEMA/N-SES. Lista web actualiza por polling; no afirmar push web. |

## S11 — Historial `/student/history`, `/admin/history`

Fuentes: Flutter [AuditHistoryScreen](../../frontend/lib/features/shared/presentation/screens/audit_history_screen.dart); Next [AuditList](../../frontend-next/src/components/audit-list.tsx), páginas history.

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Acción, actor, detalles/cambios y fecha. | Cards con mismos grupos; acciones nuevas sin diccionario muestran código crudo. |
| Acciones; permisos | Abrir recurso con ruta pertinente; estudiante consulta historial propio, admin consulta ámbito; API valida. La ruta Flutter también permite app_admin según permisos backend vigentes. | Abrir recurso con ruta pertinente; admin normal web. El RoleGuard redirige app_admin; acceso web sigue H02 PARTIAL/decisión institucional UNKNOWN. |
| Loading; empty | Spinner inicial; empty explícito (“No hay cambios registrados”). | Estado “Cargando…” y empty explícito; ambos son distintos de error. |
| Error; success | Errores seguros diferenciados para401/403/404/429/500/503; retry y paginador oculto hasta lectura exitosa. | `QueryError` con retry; el error no se representa como `entries=[]`. Lista/paginador no se muestran hasta recuperación. |
| Navegación; paginación | API paginada a20, anterior/siguiente y swipe refresh; se navega a esquema/evidencia por destino. Página se mantiene en la vista mientras sigue montada, pero no está en URL y vuelve a1 tras reload. | API paginada a20, `has_next/has_previous`, `page` en query string y botón actualizar; los destinos admin conservan `tab=scheme/evidence` y el detalle consume `tab`. Navegación atrás preserva la URL previa. |
| Responsive; accesibilidad | Lista scroll, `ListTile` tocable cuando hay destino, error con retry. Contraste/reflow integral, teclado y lector/dispositivo nativo UNKNOWN. | Cards; botón nativo en entradas con destino; error con retry. Texto/cambios extensos, contraste integral y lectores/dispositivos UNKNOWN. |
| Tema; sesión expirada | F-TEMA/F-SES; pruebas H01 cubren error en claro/oscuro y roles, no interceptor móvil real. | N-TEMA/N-SES; pruebas H01 cubren errores student/admin en claro/oscuro. app_admin conserva guard existente. |

## S12 — Comunicaciones estudiante `/student/communications`

Fuentes: Flutter [CommunicationsScreen](../../frontend/lib/features/shared/presentation/screens/communications_screen.dart); Next [StudentCommunicationsPage](../../frontend-next/src/app/student/communications/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Lista, diálogo y búsqueda de destinatario/categoría/asunto/mensaje. Preview de último mensaje tiene una línea. | Lista y formulario inline con destinatario/categoría/asunto/mensaje; cambia layout y copy. Preview de último mensaje limita a una línea, alineado con Flutter (R04, [mediciones](evidence/phase5b/communications-preview-line/measurements.json)). |
| Acciones; permisos | Estudiante busca/selecciona admin; admin normal alterna estudiante/admin; app_admin busca admins. Backend resuelve permisos. | Estudiante puede dejar destinatario vacío para resolución de ámbito; admin selecciona estudiante/admin; app_admin solo busca admins. Backend autoridad. La obligación del estudiante de seleccionar persona difiere y no se cambia aquí. |
| Loading; empty | Carga/error/vacío de hilos; búsqueda con spinner; después del cambio C07, empty de destinatarios explícito. Polling listado cada8s. | Estados loading/empty/error/retry de búsqueda y lista; polling hilos30s. |
| Error; success | Error de búsqueda con retry, error de formulario y empty de destinatarios separados; éxito abre/actualiza hilo. Pruebas focales compartidas de comunicaciones: **52 PASS**. | QueryError de búsqueda/lista; error de creación visible, éxito limpia formulario y navega al hilo. Pruebas focales compartidas: **54 PASS**. |
| Navegación; paginación | FAB y diálogo modal; `initialStudentId` abre el diálogo y preselecciona destinatario; detalle por hilo; arrays sin paginación. | Formulario inline y detalle; consulta `studentId` inicia formulario/preselección. Arrays sin paginación. N-NAV. |
| Responsive; accesibilidad | Diálogo con scroll; input de búsqueda label; estados live/error y reintento; pruebas físicas teclado/lector UNKNOWN. | Formulario con labels enlazados, resultados como botones; no combobox ARIA completo. |
| Tema; sesión expirada | F-TEMA/F-SES; selección de destinatario no se conserva tras cerrar diálogo. | N-TEMA/N-SES. Borrador enviado con sesión vencida y comportamiento entre pestañas UNKNOWN. |

## S13 — Comunicaciones admin/app_admin `/admin/communications`

Fuentes: mismo Flutter de S12; Next [PageInner](../../frontend-next/src/app/admin/communications/page.tsx); autoridad [CommunicationService.create_thread/search_recipients](../../backend/app/modules/communications/service.py).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Admin normal selecciona estudiante o administrador; app_admin selecciona administrador. Categoría/asunto/mensaje. Preview de último mensaje tiene una línea. | Igual distribución funcional por rol: selector de target solo admin normal, app_admin busca admins, estudiante usa destino administrativo por ámbito. Categoría/asunto/mensaje. `ThreadRow` compartido limita el preview a una línea para ambos roles (R04, [mediciones](evidence/phase5b/communications-preview-line/measurements.json)). |
| Acciones; permisos | Búsqueda debounced; formulario valida destinatario en roles administrativos y abre el hilo al éxito. | Búsqueda query-keyed con retry; admin/app_admin necesita selección; API valida ámbito/rol. El listado de hilos no amplía permisos. |
| Loading; empty | Hilos separados en loading/error/vacío; buscador destinatario con loading/empty/error/retry tras C07. | Hilos, búsqueda y empty/error/loading separados; polling30s. |
| Error; success | Mensajes seguros de búsqueda y creación; empty de búsqueda no es error. Conversación abre al éxito. Pruebas focales admin/app_admin: **52 PASS**. | QueryError de búsqueda y error de creación; éxito invalida lista y navega al hilo. Pruebas focales admin/app_admin compartidas: **54 PASS**. |
| Navegación; paginación | `studentId` desde detalle abre diálogo y preselecciona estudiante; detalle al éxito; arrays sin páginas. | Enlace de detalle usa `studentId` y `returnTo`; detalle Next conserva el retorno. Arrays sin páginas. |
| Responsive; accesibilidad | Diálogo por rol y búsqueda etiquetada; lector/teclado nativo UNKNOWN. | Formulario grid; resultados botones nativos; combobox completo y lector real UNKNOWN. |
| Tema; sesión expirada | F-TEMA/F-SES. | N-TEMA/N-SES. |

## S14 — Detalle conversación `/{rol}/communications/{id}`

Fuentes: Flutter [CommunicationDetailScreen](../../frontend/lib/features/shared/presentation/screens/communication_detail_screen.dart); Next [ThreadDetail](../../frontend-next/src/components/thread-detail.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Cabecera/estado, burbujas, compositor; refresca cada 3 s. | Cabecera, burbujas/compositor; refresca cada 5 s. Mensajes del hilo no tienen paginación en ninguno de los clientes. |
| Acciones; permisos | Responder incluso cerrado (API reabre), cerrar/reabrir sin confirmación; FastAPI decide el acceso. | Responder incluso cerrado (texto advierte que responder reabre), cerrar/reabrir con confirmación; FastAPI decide el acceso. Los controles no sustituyen permisos del backend. |
| Loading; empty | Spinner; `No hay mensajes`. | `LoadingState`; `No hay mensajes` y mantiene el compositor. |
| Error; success | Error de carga con reintento; errores de envío/estado con SnackBar; refresco manual y scroll al final. | Error de carga con reintento; error de sincronización de lectura recuperable; envío notificado con toast; invalida detalle/lista/notificaciones tras mutaciones. |
| Navegación; paginación | Atrás, scroll, marca categoría `communication` como leída. | Atrás conserva `returnTo` seguro; marca categoría `communication` como leída e invalida notificaciones. Array de mensajes sin páginas en ambos. |
| Responsive; accesibilidad | Lista expandida y compositor con controles etiquetados; teclado/lector de pantalla UNKNOWN. | Burbujas con ancho máximo 80%; textarea con label `Respuesta`, controles con nombres accesibles. Anuncio de nuevos mensajes y verificación con tecnologías asistivas UNKNOWN. |
| Tema; sesión expirada | F-TEMA/F-SES. | N-TEMA/N-SES; la expiración efectiva de sesión sigue delegada a BFF/AuthGate y requiere validar por navegador (N-SES). |

## S15 — Dashboard admin normal `/admin`

Fuentes: Flutter [AdminDashboardScreen](../../frontend/lib/features/admin/presentation/screens/admin_dashboard_screen.dart); Next [RegularAdminDashboard](../../frontend-next/src/app/admin/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Estadísticas por semestre, gráficos, ranking/distribuciones y acciones. | Cards, ranking/distribuciones; estadísticas de API. Equivalencia numérica runtime UNKNOWN. |
| Acciones; permisos | Filtrar semestre, exportar, abrir lista filtrada, crear, mensajes, historial; los enlaces de estudiantes llevan `active`, `scheme` y `semester`; admin ámbito. | Selector de semestre refleja URL; los cinco enlaces estadísticos preservan semestre y añaden estado/esquema cuando aplica. El listado consume `active`, `scheme`, `semester`, `sex` y `page` al cargar. Pruebas de parsing, enlaces y restauración pasan; la equivalencia de rango institucional del semestre sigue A07 UNKNOWN. |
| Loading; empty | AsyncValue loading/error; distribuciones según datos. | Skeleton/error/reintento y distribuciones. Ceros no son error por sí mismos. |
| Error; success | Error stats y export; refresh al volver. | Error stats y toast export; invalidación al volver depende Query. |
| Navegación; paginación | Flutter `GoRouter` entrega active/scheme/semester como filtros iniciales; al volver refresca estadísticas. | Next conserva semestre en query string, recarga/remount y cambios del historial restauran selección/datos; enlaces abren el listado con filtros iniciales. URL inválida/duplicada se normaliza a Todos. N/A paginación del dashboard; el listado tiene su paginador propio. La consulta de búsqueda no va en URL por privacidad y no forma parte de estos enlaces. |
| Responsive; accesibilidad | LayoutBuilder y gráficos fl_chart; alternativas de lectura UNKNOWN. | Grids sm/lg y distribuciones textuales; label semestre enlazado. N-NAV. |
| Tema; sesión expirada | F-TEMA/F-SES. | N-TEMA/N-SES. |

## S16 — Dashboard app_admin `/admin`

Fuentes: Flutter `_buildAppAdminDashboard` en S15; Next `AppAdminDashboard` en S15.

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Gestión global y estadísticas globales. Ranking de vacunas y distribuciones; no presenta los contadores clínicos del admin normal. | Gestión global y estadísticas globales. Ranking de vacunas compacto y distribuciones por sede/programa; consulta sin semestre. Equivalencia numérica runtime con datos institucionales UNKNOWN. |
| Acciones; permisos | Administradores, catálogo, comunicaciones; app_admin. El contador de comunicaciones aparece en AppBar y tarjeta; FastAPI autoriza cada acción. | Mismos accesos. `CommunicationsPage` adapta la búsqueda/selección al rol: app_admin busca administradores y no ofrece seleccionar estudiantes. El shell muestra el contador de comunicaciones en navegación. FastAPI sigue autorizando; no hay acceso de app_admin a funciones de admin normal. |
| Loading; empty | Carga stats; gráficos consumen colecciones del DTO global. | Skeleton y refresh bloqueado mientras carga; `Distribution` distingue colección sin filas de error. Los ceros de estadísticas permanecen valores válidos. |
| Error; success | AsyncValue error con mensaje seguro y retry; contenido cargado al éxito. | `QueryError` con reintento; falla oculta análisis viejo y preserva enlaces de gestión. Casos loading/vacío/error/refresh están cubiertos por pruebas de ambos roles. |
| Navegación; paginación | Tarjetas, contador de comunicaciones en AppBar y menú de perfil; N/A. | Tarjetas y menú de perfil; contador de comunicaciones queda en navegación lateral, no en tarjeta del dashboard. No hay listado paginado. Asignación de firmante no se gestiona en estos dashboards. |
| Responsive; accesibilidad | `LayoutBuilder`; semántica de gráficos/lector físico UNKNOWN. | Grid adaptable; enlaces con texto, región de análisis `aria-busy` y controls de refresh nombrados. Lector, zoom nativo, reflow integral y alternativa textual detallada de gráficos UNKNOWN. |
| Tema; sesión expirada | F-TEMA/F-SES. | N-TEMA/N-SES. |

## S17 — Estudiantes `/admin/students`

Fuentes: Flutter [AdminStudentListScreen](../../frontend/lib/features/admin/presentation/screens/admin_student_list_screen.dart), [AdminStudentListNotifier](../../frontend/lib/features/admin/presentation/providers/admin_provider.dart); Next [AdminStudentsPage](../../frontend-next/src/app/admin/students/page.tsx), [listAllStudents](../../frontend-next/src/lib/api/admin.ts).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Búsqueda/chips, grupos semestre, estudiantes/estado. | Filtros sexo/semestre adicionales, grupos, cards móvil/tabla desktop. |
| Acciones; permisos | Ver/activar/desactivar/eliminar en menú del listado; admin ámbito. | Listado ofrece ver/exportar/crear/importar; activar/desactivar/eliminar están en el detalle S19 con confirmación. Diferencia de ubicación, no de capacidad; API conserva autorización. |
| Loading; empty | Spinner; “No se encontraron estudiantes” para respuesta sin filas; muestra error con acción Reintentar por separado. | Skeleton, error con retry y empty separados. |
| Error; success | La consulta usa `/admin/students/search`; al error muestra mensaje/reintento; las mutaciones existentes muestran snackbar. | La consulta usa TanStack Query y `QueryError` con retry; exportación tiene progreso/resultado. |
| Navegación; paginación | Inicializa filtros de active/scheme/semester desde la ruta; solicita 20 registros por página y usa `totalPages` para anterior/siguiente. Tiene control accesible “Actualizar lista” y tooltips para anterior/siguiente; refrescar recarga página/filtros vigentes. Al abrir detalle conserva la pantalla anterior en la pila. | Solicita 20 registros; Pagination usa `has_previous/has_next`, actualiza `page` en query string y refresca la página actual. Búsqueda se conserva en contexto privado de sesión; la página de detalle recibe `returnTo`. La descarga total ocurre solo al exportar, no en la consulta paginada. |
| Responsive; accesibilidad | Listas/chips y debounce; nombre/correo largos envuelven en `ListTile`; menú Material. Widget en320×568 comprueba varias líneas para nombre/correo sintéticos. Lector/teclado real UNKNOWN. | Cards bajo md/tabla sobre md; el card móvil envuelve nombre y correo largos, ya no los trunca. Chromium con fixture sintético lo confirmó a320/640/720 CSS px, sin overflow horizontal; tabla desktop usa scroll horizontal propio. Labels enlazados a ID. Zoom nativo y lector/teclado real UNKNOWN; evidencia [R03V](evidence/phase5b/admin-student-list-reflow/measurements.json). |
| Tema; sesión expirada | F-TEMA/F-SES. Estado de resumen `approved/pending/denied` representado por separado, sin calcular completitud. | N-TEMA/N-SES. FastAPI entrega `approved/pending/denied`; Next representa los tres estados en fila/tarjeta y contadores (R03A). |

## S18 — Crear/importar estudiantes `/admin/students/create`

Fuentes: Flutter [CreateStudentScreen](../../frontend/lib/features/admin/presentation/screens/create_student_screen.dart); Next [CreateStudentPage](../../frontend-next/src/app/admin/students/create/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Form manual, selector archivo, diálogo preview/resultados. Programa/campus consume `GET /admin/academic-options`. | Form manual/cards y paneles inline; `Field` enlaza label/input. Programa/campus consume el mismo contrato FastAPI. |
| Acciones; permisos | Validar/crear, previsualizar/importar con confirmación; admin dentro del ámbito que valida FastAPI. | Submit nativo asociado al form, Enter/required/email comprobados; preview/import requieren confirmación explícita y FastAPI conserva autoridad de ámbito. |
| Loading; empty | Crear/importar bloquea; archivo ausente no opera. | Estados independientes; requiere preview para importar. |
| Error; success | Mensajes seguros en formulario/importación; instrucciones por correo declaran contraseña temporal. | Error estático persistente y toast; éxito manual navega al detalle. Copy también indica contraseña temporal por correo, no documento (UI-04 corregido). |
| Navegación; paginación | Atrás, diálogo de preview y resultado. Lista local página20; resultado Flutter filtra filas creadas y deja filas por revisar. | Atrás/detalle y panels inline. Preview y resultado página20; resultado incluye todas las filas. La diferencia de filas visibles es representación actual, no política backend. |
| Responsive; accesibilidad | Scroll/form y diálogos ancho520; labels Material. | Grid sm; labels enlazados por IDs únicos, incluido input de archivo. No implica validación con lector/hardware real. |
| Tema; sesión expirada | F-TEMA/F-SES. | N-TEMA/N-SES. Verificar expiración entre preview y confirmación. |

## S19 — Detalle estudiante `/admin/students/{id}`: perfil, esquema, evidencia y certificados

Fuentes: Flutter [AdminStudentDetailScreen](../../frontend/lib/features/admin/presentation/screens/admin_student_detail_screen.dart); Next [AdminStudentDetailPage, InfoTab, SchemeTab, EvidenceTab, CertificateHistory](../../frontend-next/src/app/admin/students/[id]/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Tres pestañas, carga conjunta perfil/esquema/evidencia. | Tres pestañas por consultas; extra historial emisiones dentro de perfil. |
| Acciones; permisos | Editar perfil, revisar dosis/evidencias, descargar certificado y abrir comunicación; activar/desactivar/eliminar se ofrecen desde el listado, no en detalle. API conserva autorización. | Editar/revisar/descargar y comunicación contextual; activar/desactivar/eliminar en detalle con confirmación. Historial/revocación solo web; comentarios y revisión usan mutaciones separadas tras Fase5A. UI-09 describe diferencia de ubicación, no ausencia total de acciones. |
| Loading; empty | Spinner conjunto. Si falla cualquiera de las tres lecturas, ahora muestra error genérico y retry en vez de confundirlo con tabs vacías; la carga sigue siendo atómica para perfil/esquema/evidencia. | Perfil y cada consulta de pestaña muestran carga/error con reintento y estados vacíos diferenciados. |
| Error; success | Error no expone la excepción ni conserva acciones de detalle; “Reintentar” repite las tres lecturas. Test focal de fallo/retry y reload fallido: **2 PASS** (2026-10-26). Snackbars y recarga completa tras revisión. | Toast y reintento por consulta; aprobación de evidencia invalida esquema y evidencia asociada. |
| Navegación; paginación | initialTab respeta índice de ruta; mensaje abre comunicaciones; evidencia paginada. | `?tab`/`returnTo` conservados, tabs enlazadas y evidencia paginada; historial de certificados en perfil, sin paginación de emisiones. |
| Responsive; accesibilidad | TabBar Material y scroll; los `ExpansionTile` empiezan cerrados; nombre largo del estudiante en AppBar, título de vacuna y etiqueta de dosis envuelven a320×568 en widget test; diálogo perfil; prueba física pendiente. | tablist/tab/tabpanel y `aria-selected`/`aria-controls`; acordeones con `aria-expanded` que empiezan cerrados como Flutter. Nombre largo de vacuna del esquema (R03W), nombre del estudiante en header fijo (R03Z) y etiqueta de dosis (R03AA) envuelven sin truncar en Chromium a320/640/720 CSS px. En móvil, la etiqueta recibe el ancho de contenido y las acciones quedan debajo; la disposición vuelve a horizontal desde768 px. [Mediciones de título/dosis](evidence/phase5b/admin-scheme-title-reflow/measurements.json). El email del header continúa truncado en Next y el AppBar Flutter no lo muestra; el perfil Flutter sí lo representa. Lector real, zoom nativo y dispositivos siguen UNKNOWN. |
| Tema; sesión expirada | Tema Material y controles; F-SES. | Tokens de tema en superficies; N-SES. Paridad completa en anchos/lector y respuesta de expiración durante una mutación sigue pendiente. |

Subflujos que requieren prueba separada: perfil lectura/edición/cancelar/error; aprobar/denegar dosis; editar/eliminar solo comentario conservando estado; evidencia EN REVISIÓN/APROBADA/DENEGADA y vínculo a dosis; descarga fallida por responsable/firma; historial vacío/error/revocación/URL pública. No modificar reglas del backend para hacer coincidir UI.

## S20 — Administradores `/admin/admins`

Fuentes: Flutter [AdminManagementScreen](../../frontend/lib/features/admin/presentation/screens/admin_management_screen.dart); Next [AdminManagementPage](../../frontend-next/src/app/admin/admins/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Alta/lista, ámbito mediante `GET /admin/academic-options`. | Alta desplegable + tabla; ámbito mediante el mismo contrato FastAPI. |
| Acciones; permisos | Crear, eliminar con confirmación, enviar mensaje; API app_admin. | Crear/eliminar confirmado y enviar mensaje al administrador seleccionado. Reutiliza POST `/communications/threads` con `category=admin` y `admin_id`; UI bajo RoleGuard app_admin, FastAPI valida rol/destinatario. |
| Loading; empty | Spinner/error; lista vacía en pantalla con formulario. | Cargando/error; tabla sin filas sin empty dedicado. |
| Error; success | Validación Form y mensaje seguro API; recarga. | Toast genérico; required sin form no valida al click; recarga tras éxito. |
| Navegación; paginación | Mensaje abre hilo; lista sin paginación. | Tras enviar abre el hilo y conserva retorno seguro a `/admin/admins`; lista sin paginación. No confundir crear admin con asignar responsable certificado. |
| Responsive; accesibilidad | Lista/formulario con scroll; diálogo mensaje. | Tabla overflow-x; Field sin htmlFor/id. |
| Tema; sesión expirada | F-TEMA/F-SES. | N-TEMA/N-SES. |

Hallazgo compartido S18/S20 actualizado 2026-10-26: el gap se corrigió con contrato aditivo protegido `GET /admin/academic-options`. FastAPI es fuente de las listas; Next y Flutter obtienen y representan las mismas opciones con carga/error/reintento. Se mantienen intactas las listas y validaciones. Pruebas focales: backend 4, Next 57 y Flutter 52 PASS; ver `docs/audits/phase5b-implementation.md`. La nota anterior documenta el estado al momento de la auditoría y queda reemplazada para el estado actual.

## S21 — Catálogo `/admin/vaccines`, crear/editar/activar/desactivar

Fuentes: Flutter [VaccineCatalogScreen](../../frontend/lib/features/admin/presentation/screens/vaccine_catalog_screen.dart); Next [VaccineCatalogPage, VaccineEditorModal, Overlay](../../frontend-next/src/app/admin/vaccines/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Lista, editor vacunas/config dosis, flags/tipo/aplicabilidad/orden. | Lista y modales con equivalentes; annual es flag de vacuna. |
| Acciones; permisos | Crear/editar/desactivar/reactivar; API app_admin. | Mismas; layout app_admin. UI solo configura, no decide reconciliación. |
| Loading; empty | Spinner; fallo de carga muestra error/reintento; vacío muestra “Aún no hay vacunas en el catálogo.” y mantiene actualización por gesto. | Loading; fallo de consulta muestra QueryError/retry; vacío muestra tarjeta “Aún no hay vacunas en el catálogo.”. |
| Error; success | Errores genéricos de lectura terminan loading y permiten retry; las fallas de escritura quedan en el editor sin reemplazar la lista. Si guardar se confirma y falla la lectura posterior, el mensaje identifica ambos resultados. | QueryError para lectura; errores de mutación con mensaje seguro y borrador del editor conservado en los casos de la suite. Desactivar requiere confirmación. El copy dice que la vacuna sale de esquemas activos/regenera esquemas; el efecto sobre snapshots históricos no se revalida aquí y no debe inferirse del texto. |
| Navegación; paginación | Diálogos Material; array. | Overlay por click exterior; N-NAV; array. |
| Responsive; accesibilidad | Editor limitado a 90% de altura y ancho disponible; selectores de dosis expandidos para evitar overflow. Widget test en 390×844 y título de vacuna largo envuelve a320×568. Validación de otros viewports/lector nativo no hecha. | Modal nativo `<dialog>` con `aria-modal`, nombre/descripción, foco inicial/retorno, Escape y ciclo de Tab; labels asociados. El título de vacuna largo envuelve sin truncarse en Chromium a320/640/720 CSS px (R03Y); [mediciones sintéticas](evidence/phase5b/admin-catalog-name-reflow/measurements.json). Lector y hardware UNKNOWN. UI-15. |
| Tema; sesión expirada | F-TEMA; paridad de todo el catálogo aún no verificada. | Editor/filas usan tokens de tema en los estados probados; paridad completa de lista/errores y dispositivos UNKNOWN; N-SES. |

## S22 — Perfil admin/app_admin `/admin/profile`, firma visual

Fuentes: Flutter [ProfileScreen, _loadSignature/_pickAndUploadSignature](../../frontend/lib/features/student/presentation/screens/profile_screen.dart); Next [AdminProfilePage](../../frontend-next/src/app/admin/profile/page.tsx).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | Perfil, nombre/cargo y ámbito de lectura; firma privada forma parte de una sección separada y no se revalida en este bloque. | Hero/tiles + datos base; sección de firma separada y excluida de esta revalidación. |
| Acciones; permisos | Editar nombre/cargo; programa/campus son de solo lectura. Firma se mantiene en alcance independiente. | Editar nombre/cargo; ámbito no editable. No ampliar permisos por rol; firma excluida aquí. |
| Loading; empty | Loading de perfil; campos ausentes se representan sin inventar datos. Firma ausente fuera de esta revalidación. | Loading perfil; error inicial distinto de vacío y campos ausentes representados. Firma fuera de esta revalidación. |
| Error; success | Lectura fallida ofrece retry y oculta dato viejo; borrador/PUT confirmado frente a lectura fallida probado. Error de escritura conserva borrador. | QueryError/retry; oculta dato anterior ante GET fallido y conserva borrador. PUT confirmado+GET fallido se distingue de PUT fallido; retry es GET-only. |
| Navegación; paginación | Atrás/picker; N/A. | N-NAV/picker; N/A. |
| Responsive; accesibilidad | Scroll y labels Material; test de widget con valores extensos a 320 px/texto 2×. Lector/teclado/hardware UNKNOWN. | Grid y labels asociados. Nombre, correo, cargo, programa y sede ahora envuelven sin truncar; E2E Chromium con fixture sintético verificó 320/768/1440 y viewport 720 CSS px como aproximación de reflow a 200%, sin overflow horizontal. Firma/preview/blob, zoom nativo, lector y hardware no se evalúan. |
| Tema; sesión expirada | F-TEMA/F-SES; recuperación controlada de perfil por tema probada en R02C; expiración real UNKNOWN. | N-TEMA/N-SES; errores 401/403/503 controlados. Firma/blob y respuesta tardía de blob tras logout excluidos/UNKNOWN. |

## S23 — Verificador público `/verify/{publicId}` — EXTRA NEXT

Fuentes: Next [CertificateVerificationPage](../../frontend-next/src/app/verify/[publicId]/page.tsx); backend [verify_certificate](../../backend/app/modules/certificates/router.py).

| Dimensión | Flutter | Next / paridad |
|---|---|---|
| Estructura; datos | No ruta interna equivalente; PDF contiene URL para navegador externo. | Estado mínimo, emisión, identificador público y comprobación hash. Sin firma independiente ni datos clínicos. |
| Acciones; permisos | Abrir URL desde lector externo; público. | Consulta pública, selecciona PDF local y envía solo hash; sin sesión requerida. |
| Loading; empty | N/A pantalla; apertura real externa UNKNOWN. | Consultando/calculando; NOT_FOUND explícito. |
| Error; success | N/A. | Red se convierte a INVALID; response.ok no validado: 429/503 no se distinguen de contrato de verificación. VALID/REVOKED/MATCH/MISMATCH representados. UI-16. |
| Navegación; paginación | URL externa, no implica implementar escáner; N/A. | Ruta pública directa sin shell privado; N/A. |
| Responsive; accesibilidad | N/A pantalla interna. | max-w-2xl, label archivo asociado; estado sin live/retry específico. |
| Tema; sesión expirada | Sesión no aplica. | Tarjeta blanca/colores slate fijos; PÚBLICA. No debe degradarse por sesión vencida. |

## S24 — Responsable programa + campus — SIN PANTALLA EN AMBOS

Autoridad: [admin/router.py](../../backend/app/modules/admin/router.py), endpoints `certificate-signer-assignments` y `certificate-signer-assignment-conflicts`.

| Dimensión | Estado actual y criterio propuesto |
|---|---|
| Estructura; datos | No se encontró pantalla ni consumidor cliente. API ya representa ámbito/responsable/asignaciones/conflictos. |
| Acciones; permisos | Configurar/listar por app_admin existente; falta UI, no permiso nuevo. Estudiante nunca elige. |
| Loading; empty | No implementados; proponer carga y “sin asignación” diferenciados. |
| Error; success | No implementados; representar 403/409 y confirmación de responsable guardado. |
| Navegación; paginación | Sin entrada de navegación; paginación debe respetar contrato existente, sin inventarla. |
| Responsive; accesibilidad | N/A implementación; exigir formulario accesible y utilizable en móvil al diseñar. |
| Tema; sesión expirada | N/A implementación; usar ambos temas y sesión protegida al implementarlo. |

**No se da por cerrada paridad.** La siguiente fase debe corregir discrepancias demostradas, conservar capacidades exclusivas justificadas y validar cada fila con datos sintéticos, roles y capturas. T-02/T-03 siguen PARTIAL; este inventario no acredita producción.
